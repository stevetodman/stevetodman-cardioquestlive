import "dotenv/config";
import WebSocket from "ws";
import { SessionManager } from "./sessionManager";
import { CharacterId, ClientToServerMessage, OrderResult, ServerToClientMessage } from "./messageTypes";
import { log, logError, logEvent } from "./logger";
import { getOpenAIClient, MODEL } from "./openaiClient";
import { getOrCreatePatientEngine, setScenarioForSession, getScenarioForSession, getPersonaPrompt } from "./patientEngine";
import { synthesizePatientAudio } from "./ttsClient";
import { transcribeDoctorAudio } from "./sttClient";
import { Buffer } from "buffer";
import { performance } from "perf_hooks";
import { PatientScenarioId } from "./patientCase";
import { analyzeTranscript, analyzeComplexScenario, type ComplexScenarioId } from "./debriefAnalyzer";
import { DebriefTurn } from "./messageTypes";
import { RealtimePatientClient } from "./sim/realtimePatientClient";
import { createEventLog } from "./sim/eventLog";
import { ScenarioEngine } from "./sim/scenarioEngine";
import { ToolGate } from "./sim/toolGate";
import { ToolIntent, Interventions, hasSVTExtended, hasMyocarditisExtended, SVTExtendedState } from "./sim/types";
import { createInitialSVTState, SVT_PHASES } from "./sim/scenarios/teen_svt_complex";
import { CostController } from "./sim/costController";
import { persistSimState, logSimEvent, loadSimState } from "./persistence";
import { validateMessage, validateSimStateMessage } from "./validators";
import { getAuth } from "./firebaseAdmin";
import { respondForCharacter, chooseCharacter, isUnsafeUtterance, parseOrderRequest } from "./speechHelpers";
import { buildTelemetryWaveform, checkAlarms } from "./telemetry";
import { Runtime } from "./typesRuntime";
import { createOrderHandler } from "./orders";
import { shouldAutoReply } from "./autoReplyGuard";
import { createTransport, send, ClientContext } from "./transport";
import { getAuscultationClips } from "./data/auscultation";
import { createTreatmentHandler } from "./treatmentHandler";
import { createExamHandler } from "./examHandler";
import { tickSVTPhase as tickSVTPhaseHandler } from "./svtPhaseHandler";

const PORT = Number(process.env.PORT || 8081);
const sessionManager = new SessionManager();
const eventLog = createEventLog();
const lastCommandAt: Map<string, number> = new Map();
const realtimeModel = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-mini-realtime-preview";
const realtimeApiKey = process.env.OPENAI_API_KEY || "";
const softBudgetUsd = Number(process.env.SOFT_BUDGET_USD || 3.5);
const hardBudgetUsd = Number(process.env.HARD_BUDGET_USD || 4.5);
const scenarioHeartbeatMs = Number(process.env.SCENARIO_HEARTBEAT_MS || 1000);
// Reduced from 3000ms to 1000ms for faster autonomous conversation flow
const commandCooldownMs = Number(process.env.COMMAND_COOLDOWN_MS || 1000);
const lastAutoReplyAt: Map<string, number> = new Map();
const lastAutoReplyByUser: Map<string, number> = new Map();
const lastDoctorUtterance: Map<string, { text: string; ts: number }> = new Map();
const lastTreatmentAt: Map<string, number> = new Map();
const alarmSeenAt: Map<
  string,
  {
    spo2Low?: number;
    hrHigh?: number;
    hrLow?: number;
  }
> = new Map();
const handleOrder = createOrderHandler({
  ensureRuntime,
  sessionManager,
  broadcastSimState,
});

// Create modular handlers
const handleTreatmentModule = createTreatmentHandler({
  sessionManager,
  ensureRuntime,
  broadcastSimState,
  handleOrder,
  lastTreatmentAt,
});

const examHandlers = createExamHandler({
  sessionManager,
  ensureRuntime,
  broadcastSimState,
});

// Default to secure WebSocket auth; only allow insecure for local dev/tunnels when explicitly set.
const allowInsecureWs = process.env.ALLOW_INSECURE_VOICE_WS === "true";
if (allowInsecureWs && process.env.NODE_ENV === "production") {
  log(
    "[warn] ALLOW_INSECURE_VOICE_WS=true in production; require Firebase ID tokens or set ALLOW_INSECURE_VOICE_WS=false."
  );
}
const timingEnabled = process.env.GATEWAY_TIMING === "true";

// Chaos testing guards - only enabled in non-production
const isProduction = process.env.NODE_ENV === "production";
const chaosLatencyMs = !isProduction ? Number(process.env.CHAOS_WS_LATENCY_MS || 0) : 0;
const chaosDropPct = !isProduction ? Number(process.env.CHAOS_WS_DROP_PCT || 0) : 0;
if (chaosLatencyMs > 0 || chaosDropPct > 0) {
  log(`[chaos] Enabled: latency=${chaosLatencyMs}ms, drop=${chaosDropPct}%`);
}
if (isProduction && (process.env.CHAOS_WS_LATENCY_MS || process.env.CHAOS_WS_DROP_PCT)) {
  log("[warn] Chaos testing env vars ignored in production");
}

function shouldDropMessage(): boolean {
  if (chaosDropPct <= 0) return false;
  return Math.random() * 100 < chaosDropPct;
}

async function applyChaoticLatency(): Promise<void> {
  if (chaosLatencyMs <= 0) return;
  await new Promise((res) => setTimeout(res, chaosLatencyMs));
}

const runtimes: Map<string, Runtime> = new Map();
const scenarioTimers: Map<string, NodeJS.Timeout> = new Map();
const hydratedSessions: Set<string> = new Set();
// Per-session correlation IDs for tracing voice events
const sessionCorrelationIds: Map<string, string> = new Map();
// Sessions where voice has fallen back to text-only
const voiceFallbackSessions: Set<string> = new Set();

// Clean up per-session state when all clients disconnect (prevents memory leaks)
sessionManager.onSessionEmpty((sessionId) => {
  const runtime = runtimes.get(sessionId);
  if (runtime?.realtime) {
    try { runtime.realtime.close(); } catch { /* ignore */ }
  }
  runtimes.delete(sessionId);
  const timer = scenarioTimers.get(sessionId);
  if (timer) clearInterval(timer);
  scenarioTimers.delete(sessionId);
  hydratedSessions.delete(sessionId);
  sessionCorrelationIds.delete(sessionId);
  voiceFallbackSessions.delete(sessionId);
  lastCommandAt.delete(sessionId);
  lastAutoReplyAt.delete(sessionId);
  lastDoctorUtterance.delete(sessionId);
  lastTreatmentAt.delete(sessionId);
  alarmSeenAt.delete(sessionId);
  log("Session cleaned up", { sessionId });
});

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getOrCreateCorrelationId(sessionId: string): string {
  let corrId = sessionCorrelationIds.get(sessionId);
  if (!corrId) {
    corrId = generateCorrelationId();
    sessionCorrelationIds.set(sessionId, corrId);
  }
  return corrId;
}

function emitVoiceError(
  sessionId: string,
  error: "tts_failed" | "stt_failed" | "openai_failed",
  detail?: string
) {
  const correlationId = getOrCreateCorrelationId(sessionId);
  voiceFallbackSessions.add(sessionId);
  sessionManager.broadcastToSession(sessionId, {
    type: "voice_error",
    sessionId,
    error,
    correlationId,
    detail,
  });
  logEvent("voice_error", { sessionId, error, correlationId, detail });
}

// Natural-sounding voices: coral (warm), sage (calm), ballad (expressive), verse (versatile)
const CHARACTER_VOICE_MAP: Partial<Record<CharacterId, string>> = {
  patient: process.env.OPENAI_TTS_VOICE_PATIENT || "coral",
  nurse: process.env.OPENAI_TTS_VOICE_NURSE || "sage",
  tech: process.env.OPENAI_TTS_VOICE_TECH || "verse",
  consultant: process.env.OPENAI_TTS_VOICE_CONSULTANT || "ballad",
  imaging: process.env.OPENAI_TTS_VOICE_IMAGING || "verse",
};

async function verifyAuthToken(authToken: string | undefined, claimedUserId: string): Promise<boolean> {
  if (allowInsecureWs) return true;
  if (!authToken) return false;
  try {
    const auth = getAuth();
    if (!auth) return false;
    const decoded = await auth.verifyIdToken(authToken);
    if (decoded.uid && decoded.uid === claimedUserId) return true;
    return false;
  } catch (err) {
    logError("Auth token verification failed", err);
    return false;
  }
}

async function handleMessage(ws: WebSocket, ctx: ClientContext, raw: WebSocket.RawData) {
  // Chaos testing: random message drops and artificial latency (non-production only)
  if (shouldDropMessage()) {
    log("[chaos] Dropped incoming message");
    return;
  }
  await applyChaoticLatency();

  let parsedRaw: any;
  try {
    parsedRaw = JSON.parse(raw.toString());
  } catch (err) {
    logError("Invalid JSON", err);
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }
  const parsed = validateMessage(parsedRaw);
  if (!parsed) {
    send(ws, { type: "error", message: "Invalid message shape" });
    return;
  }

  if (parsed.type === "join") {
    if (!parsed.sessionId || !parsed.userId || !parsed.role) {
      send(ws, { type: "error", message: "Missing join fields" });
      return;
    }
    const authed = await verifyAuthToken(parsed.authToken, parsed.userId);
    if (!authed) {
      send(ws, { type: "error", message: "unauthorized_token" });
      logEvent("ws.auth.denied", { sessionId: parsed.sessionId, userId: parsed.userId, reason: "invalid_or_expired_token" });
      ws.close();
      return;
    }
    ctx.joined = true;
    ctx.sessionId = parsed.sessionId;
    ctx.role = parsed.role;
    sessionManager.addClient(parsed.sessionId, parsed.role, ws);
    send(ws, { type: "joined", sessionId: parsed.sessionId, role: parsed.role, insecureMode: allowInsecureWs });
    logEvent("ws.join", { sessionId: parsed.sessionId, role: parsed.role, userId: parsed.userId });
    log("Client joined", parsed.sessionId, parsed.role, parsed.userId);
    return;
  }

  if (!ctx.joined || !ctx.sessionId || !ctx.role) {
    send(ws, { type: "error", message: "Must join first" });
    return;
  }

  // sessionId is guaranteed after the guard above; capture a non-null string for TS
  const simId = ctx.sessionId as string;

  switch (parsed.type) {
    case "start_speaking": {
      log("start_speaking received", simId, parsed.userId);
      const result = sessionManager.requestFloor(simId, parsed.userId);
      if (!result.granted) {
        log("start_speaking floor denied (held by)", simId, result.previous);
        send(ws, { type: "error", message: "floor_taken" });
        return;
      }
      log("start_speaking floor granted", simId, parsed.userId);
      if (result.previous && result.previous !== parsed.userId) {
        sessionManager.broadcastToSession(simId, {
          type: "participant_state",
          sessionId: simId,
          userId: result.previous,
          speaking: false,
        });
      }
      sessionManager.broadcastToSession(simId, {
        type: "participant_state",
        sessionId: simId,
        userId: parsed.userId,
        speaking: true,
      });
      break;
    }
    case "stop_speaking": {
      const released = sessionManager.releaseFloor(simId, parsed.userId);
      sessionManager.broadcastToSession(simId, {
        type: "participant_state",
        sessionId: simId,
        userId: parsed.userId,
        speaking: false,
      });
      if (!released) {
        log("stop_speaking ignored (not floor holder)", simId, parsed.userId);
      }
      break;
    }
    case "doctor_audio": {
      handleDoctorAudio(simId, parsed.userId, parsed.audioBase64, parsed.contentType, parsed.character as CharacterId | undefined);
      break;
    }
    case "set_scenario": {
      handleScenarioChange(simId, parsed.scenarioId);
      break;
    }
    case "analyze_transcript": {
      handleAnalyzeTranscript(simId, parsed.turns);
      break;
    }
    case "voice_command": {
      const key = `${simId}:${parsed.commandType}`;
      const now = Date.now();
      const last = lastCommandAt.get(key) || 0;
      if (now - last < commandCooldownMs) {
        send(ws, { type: "error", message: "Command cooldown, try again momentarily." });
        return;
      }
      lastCommandAt.set(key, now);
      log("Voice command", parsed.commandType, "by", parsed.userId, "session", simId);
      const runtime = ensureRuntime(simId);
      const character = parsed.character as CharacterId | undefined;
      switch (parsed.commandType) {
        case "force_reply": {
          const doctorUtterance =
            typeof parsed.payload?.doctorUtterance === "string"
              ? parsed.payload.doctorUtterance.trim()
              : undefined;
          handleForceReply(simId, parsed.userId, doctorUtterance, character);
          break;
        }
        case "order": {
          const orderType = typeof parsed.payload?.orderType === "string" ? parsed.payload.orderType : "vitals";
          const displayName = typeof parsed.payload?.displayName === "string" ? parsed.payload.displayName : "Unknown";
          handleOrder(simId, orderType as any, {
            id: parsed.userId,
            name: displayName,
            role: ctx.role as "presenter" | "participant",
          });
          break;
        }
        case "exam": {
          const examType = typeof parsed.payload?.examType === "string" ? parsed.payload.examType : undefined;
          examHandlers.handleExamRequest(simId, examType);
          break;
        }
        case "toggle_telemetry": {
          const enabled = parsed.payload?.enabled === true;
          examHandlers.handleTelemetryToggle(simId, enabled);
          break;
        }
        case "treatment": {
          const treatmentType = typeof parsed.payload?.treatmentType === "string" ? parsed.payload.treatmentType : undefined;
          handleTreatmentModule(simId, treatmentType, parsed.payload);
          break;
        }
        case "show_ekg": {
          examHandlers.handleShowEkg(simId);
          break;
        }
        case "pause_ai":
        case "freeze": {
          sessionManager.broadcastToSession(simId, {
            type: "patient_state",
            sessionId: simId,
            state: "idle",
          });
          runtime.fallback = true;
          sessionManager.setFallback(simId, true);
          broadcastSimState(simId, {
            ...runtime.scenarioEngine.getState(),
            stageIds: runtime.scenarioEngine.getStageIds(),
            fallback: true,
            budget: runtime.cost.getState?.() ?? undefined,
          });
          logEvent("voice.fallback_enabled", { sessionId: simId, reason: parsed.commandType });
          break;
        }
        case "resume_ai":
        case "unfreeze": {
          const budget = runtime.cost.getState?.();
          if (budget?.usdEstimate !== undefined && budget.usdEstimate >= hardBudgetUsd) {
            log("[budget] resume blocked; hard limit reached", simId);
            logSimEvent(simId, {
              type: "budget.resume_blocked",
              payload: { usdEstimate: budget.usdEstimate },
            }).catch(() => {});
            broadcastSimState(simId, {
              ...runtime.scenarioEngine.getState(),
              stageIds: runtime.scenarioEngine.getStageIds(),
              fallback: true,
              budget,
            });
            logEvent("voice.resume_blocked", { sessionId: simId, usd: budget?.usdEstimate });
            break;
          }

          // Recreate realtime client if it was closed due to fallback.
          if (!runtime.realtime && realtimeApiKey) {
            runtime.realtime = new RealtimePatientClient({
              simId,
              model: realtimeModel,
              apiKey: realtimeApiKey,
              systemPrompt: buildSystemPrompt(runtime.scenarioEngine.getState().scenarioId as PatientScenarioId),
              onAudioOut: (buf) => {
                // Send audio to all participants so students hear the patient
                sessionManager.broadcastToSession(simId, {
                  type: "patient_audio",
                  sessionId: simId,
                  audioBase64: buf.toString("base64"),
                });
              },
              onTranscriptDelta: (text, isFinal) => {
                sessionManager.broadcastToSession(simId, {
                  type: "patient_transcript_delta",
                  sessionId: simId,
                  text,
                });
                eventLog.append({
                  id: `${Date.now()}-${Math.random()}`,
                  ts: Date.now(),
                  simId,
                  type: isFinal ? "scenario.state.diff" : "tool.intent.received",
                  payload: { text, final: isFinal },
                });
              },
              onToolIntent: (intent) => {
                eventLog.append({
                  id: `${Date.now()}-${Math.random()}`,
                  ts: Date.now(),
                  simId,
                  type: "tool.intent.received",
                  payload: intent as any,
                });
                handleToolIntent(simId, intent);
              },
              onUsage: (usage) => {
                runtime.cost.addUsage({
                  inputTokens: usage.inputTokens ?? 0,
                  outputTokens: usage.outputTokens ?? 0,
                });
                broadcastSimState(simId, {
                  ...runtime.scenarioEngine.getState(),
                  stageIds: runtime.scenarioEngine.getStageIds(),
                  budget: runtime.cost.getState(),
                });
              },
              onDisconnect: () => {
                runtime.fallback = true;
                sessionManager.setFallback(simId, true);
                runtime.scenarioEngine.setFallback(true);
                broadcastSimState(simId, {
                  ...runtime.scenarioEngine.getState(),
                  stageIds: runtime.scenarioEngine.getStageIds(),
                });
                sessionManager.broadcastToPresenters(simId, {
                  type: "patient_state",
                  sessionId: simId,
                  state: "error",
                });
              },
            });
            runtime.realtime.connect();
          }

          runtime.fallback = false;
          sessionManager.setFallback(simId, false);
          sessionManager.broadcastToSession(simId, {
            type: "patient_state",
            sessionId: simId,
            state: "listening",
          });
          broadcastSimState(simId, {
            ...runtime.scenarioEngine.getState(),
            stageIds: runtime.scenarioEngine.getStageIds(),
            fallback: false,
            budget: budget ?? runtime.cost.getState?.() ?? undefined,
          });
          logEvent("voice.fallback_disabled", { sessionId: simId, reason: parsed.commandType });
          break;
        }
        case "end_turn": {
          sessionManager.broadcastToSession(simId, {
            type: "patient_state",
            sessionId: simId,
            state: "idle",
          });
          break;
        }
        case "skip_stage": {
          const stageId = typeof parsed.payload?.stageId === "string" ? parsed.payload.stageId : undefined;
          if (stageId) {
            runtime.scenarioEngine.setStage(stageId);
            broadcastSimState(simId, {
              ...runtime.scenarioEngine.getState(),
              stageIds: runtime.scenarioEngine.getStageIds(),
              fallback: runtime.fallback,
              budget: runtime.cost.getState?.() ?? undefined,
            });
          }
          break;
        }
        case "mute_user": {
          // no-op
          break;
        }
        case "scenario_event": {
          // Presenter-triggered scenario events (vitals changes, rhythm changes, clinical events)
          const event = parsed.payload?.event as string | undefined;
          if (!event) break;

          log("Scenario event", event, "session", simId, "payload", parsed.payload);

          // Get current scenario to determine age-appropriate vitals
          const state = runtime.scenarioEngine.getState();
          const scenarioId = state.scenarioId;

          // Age group mapping for pediatric-appropriate vitals
          // infant (<1yr): ductal_shock
          // toddler (1-3yr): cyanotic_spell
          // preschool (3-5yr): kawasaki
          // school-age/preteen (6-12yr): myocarditis
          // teen (13-18yr): syncope, exertional_chest_pain, palpitations_svt, exertional_syncope_hcm
          type AgeGroup = "infant" | "toddler" | "preschool" | "child" | "teen";
          const ageGroupMap: Record<string, AgeGroup> = {
            ductal_shock: "infant",
            cyanotic_spell: "toddler",
            kawasaki: "preschool",
            myocarditis: "child",
            syncope: "teen",
            exertional_chest_pain: "teen",
            palpitations_svt: "teen",
            exertional_syncope_hcm: "teen",
          };
          const ageGroup = ageGroupMap[scenarioId] ?? "child";

          // Pediatric vital sign ranges by age group
          // Reference: PALS guidelines
          const pediatricVitals: Record<AgeGroup, {
            normalHr: number;
            tachyHr: number;
            normalBp: string;
            hypoBp: string;
            normalSpo2: number;
            rhythmHr: Record<string, number>;
            deteriorateVitals: { hr: number; spo2: number; bp: string };
          }> = {
            infant: {
              // 0-12 months: HR 100-160, BP ~70-90/50-65
              normalHr: 140,
              tachyHr: 200,
              normalBp: "75/50",
              hypoBp: "50/30",
              normalSpo2: 95,
              rhythmHr: { vtach: 220, svt: 260, afib: 180, sinus: 140 },
              deteriorateVitals: { hr: 200, spo2: 75, bp: "55/35" },
            },
            toddler: {
              // 1-3 years: HR 80-130, BP ~80-100/55-70
              normalHr: 110,
              tachyHr: 180,
              normalBp: "90/58",
              hypoBp: "60/35",
              normalSpo2: 96,
              rhythmHr: { vtach: 200, svt: 240, afib: 160, sinus: 110 },
              deteriorateVitals: { hr: 180, spo2: 80, bp: "65/40" },
            },
            preschool: {
              // 3-5 years: HR 80-120, BP ~85-105/55-70
              normalHr: 100,
              tachyHr: 170,
              normalBp: "95/60",
              hypoBp: "65/40",
              normalSpo2: 97,
              rhythmHr: { vtach: 190, svt: 220, afib: 150, sinus: 100 },
              deteriorateVitals: { hr: 170, spo2: 82, bp: "70/45" },
            },
            child: {
              // 6-12 years: HR 70-110, BP ~90-115/60-75
              normalHr: 90,
              tachyHr: 160,
              normalBp: "105/65",
              hypoBp: "75/45",
              normalSpo2: 98,
              rhythmHr: { vtach: 180, svt: 200, afib: 140, sinus: 90 },
              deteriorateVitals: { hr: 160, spo2: 85, bp: "75/50" },
            },
            teen: {
              // 13-18 years: HR 60-100, BP ~100-120/60-80
              normalHr: 80,
              tachyHr: 150,
              normalBp: "115/70",
              hypoBp: "80/50",
              normalSpo2: 99,
              rhythmHr: { vtach: 180, svt: 180, afib: 130, sinus: 80 },
              deteriorateVitals: { hr: 150, spo2: 88, bp: "80/50" },
            },
          };

          const vitals = pediatricVitals[ageGroup];

          // Handle vitals changes with age-appropriate values
          if (event === "hypoxia") {
            runtime.scenarioEngine.applyIntent({
              type: "intent_updateVitals",
              delta: { spo2: parsed.payload?.spo2 as number ?? 80 },
              reason: "presenter_triggered_hypoxia",
            });
          } else if (event === "tachycardia") {
            runtime.scenarioEngine.applyIntent({
              type: "intent_updateVitals",
              delta: { hr: parsed.payload?.hr as number ?? vitals.tachyHr },
              reason: "presenter_triggered_tachycardia",
            });
          } else if (event === "hypotension") {
            runtime.scenarioEngine.applyIntent({
              type: "intent_updateVitals",
              delta: { bp: parsed.payload?.bp as string ?? vitals.hypoBp },
              reason: "presenter_triggered_hypotension",
            });
          } else if (event === "fever") {
            runtime.scenarioEngine.applyIntent({
              type: "intent_updateVitals",
              delta: { temp: parsed.payload?.temp as number ?? 39.5 },
              reason: "presenter_triggered_fever",
            });
          } else if (event === "stabilize") {
            // Return to baseline vitals for current stage
            const stageDef = runtime.scenarioEngine.getStageDef(state.stageId);
            if (stageDef?.vitals) {
              runtime.scenarioEngine.applyIntent({
                type: "intent_updateVitals",
                delta: stageDef.vitals,
                reason: "presenter_triggered_stabilize",
              });
            }
          } else if (event === "rhythm_change") {
            // Rhythm changes - these affect telemetry display
            const rhythm = parsed.payload?.rhythm as string;
            if (rhythm) {
              // Update rhythm via telemetry history
              const telemetryHistory = state.telemetryHistory ?? [];
              telemetryHistory.push({ ts: Date.now(), rhythm, note: "presenter_triggered" });
              // Also adjust HR based on rhythm using age-appropriate values
              const hr = vitals.rhythmHr[rhythm];
              if (hr) {
                runtime.scenarioEngine.applyIntent({
                  type: "intent_updateVitals",
                  delta: { hr },
                  reason: `rhythm_change_${rhythm}`,
                });
              }
            }
          } else if (event === "deteriorate") {
            // General deterioration - age-appropriate critical vitals
            runtime.scenarioEngine.applyIntent({
              type: "intent_updateVitals",
              delta: vitals.deteriorateVitals,
              reason: "presenter_triggered_deterioration",
            });
          } else if (event === "improve") {
            // General improvement - return towards baseline
            const stageDef = runtime.scenarioEngine.getStageDef(state.stageId);
            runtime.scenarioEngine.applyIntent({
              type: "intent_updateVitals",
              delta: stageDef?.vitals ?? { hr: vitals.normalHr, spo2: vitals.normalSpo2, bp: vitals.normalBp },
              reason: "presenter_triggered_improvement",
            });
          } else if (event === "code_blue") {
            // Cardiac arrest - critical vitals (pulseless)
            runtime.scenarioEngine.applyIntent({
              type: "intent_updateVitals",
              delta: { hr: 0, spo2: 0, bp: "0/0" },
              reason: "presenter_triggered_code_blue",
            });
          } else if (event === "vitals_change") {
            // Direct vitals change from InjectsPalette - use absolute values, not deltas
            const vitalsChange = parsed.payload?.vitalsChange as Record<string, any> | undefined;
            if (vitalsChange) {
              // Set vitals directly since injects specify absolute target values
              runtime.scenarioEngine.setVitals({
                ...runtime.scenarioEngine.getState().vitals,
                ...vitalsChange,
              });
            }
          } else if (event === "equipment_failure") {
            // Equipment failure - update interventions
            const patientChange = parsed.payload?.patientChange as string | undefined;
            if (patientChange === "iv_lost") {
              runtime.scenarioEngine.updateIntervention("iv", undefined as any);
            } else if (patientChange === "oxygen_lost") {
              runtime.scenarioEngine.updateIntervention("oxygen", undefined as any);
            } else if (patientChange === "monitor_artifact") {
              // Keep monitor but note artifact (could affect telemetry display)
            }
          } else if (event === "patient_symptom") {
            // Patient symptom changes - record in treatment history
            const patientChange = parsed.payload?.patientChange as string | undefined;
            const history = runtime.scenarioEngine.getState().treatmentHistory ?? [];
            runtime.scenarioEngine.setTreatmentHistory([
              ...history,
              { ts: Date.now(), treatmentType: `[event] ${patientChange ?? "symptom change"}` },
            ]);
          }

          // Handle character announcement if provided
          const announcement = parsed.payload?.announcement as string | undefined;
          const character = parsed.payload?.character as CharacterId | undefined;
          if (announcement) {
            sessionManager.broadcastToSession(simId, {
              type: "patient_transcript_delta",
              sessionId: simId,
              text: announcement,
              character: character ?? "nurse",
            });
          }

          // Update rhythm based on vitals changes from the event
          const newRhythm = runtime.scenarioEngine.getDynamicRhythm();
          runtime.scenarioEngine.setRhythm(newRhythm, `scenario_event: ${event}`);

          // Broadcast updated sim state
          broadcastSimState(simId, {
            ...runtime.scenarioEngine.getState(),
            stageIds: runtime.scenarioEngine.getStageIds(),
            fallback: runtime.fallback,
            budget: runtime.cost.getState?.() ?? undefined,
          });
          logEvent("scenario.event.triggered", { sessionId: simId, event, payload: parsed.payload });
          break;
        }
      }
      break;
    }
    case "ping": {
      send(ws, { type: "pong" });
      break;
    }
    default: {
      send(ws, { type: "error", message: "Unknown message type" });
    }
  }
}

function main() {
  createTransport({
    port: PORT,
    handleMessage,
    sessionManager,
    log,
    logError,
    logEvent,
  });
}

async function handleForceReply(sessionId: string, userId: string, doctorUtterance?: string, character?: CharacterId) {
  const routedCharacter = character ?? chooseCharacter(doctorUtterance);
  const openai = getOpenAIClient();
  const runtime = ensureRuntime(sessionId);
  const latestOrderSummary = (() => {
    const completed = (runtime.scenarioEngine.getState().orders ?? []).filter((o) => o.status === "complete");
    if (completed.length === 0) return "";
    const last = completed[completed.length - 1];
    if (last.result?.type === "vitals") {
      return `Latest vitals: HR ${last.result.hr ?? "—"}, BP ${last.result.bp ?? "—"}, SpO2 ${last.result.spo2 ?? "—"}.`;
    }
    if (last.result?.summary) {
      return `Latest result: ${last.result.summary}`;
    }
    return "";
  })();
  // Characters that use AI: patient and nurse. Others use stub responses.
  const aiCharacters: CharacterId[] = ["patient", "nurse"];
  const useAI = openai && aiCharacters.includes(routedCharacter);

  if (!useAI) {
    log(openai ? `force_reply stub (${routedCharacter})` : "OPENAI_API_KEY not set; using stub response");
    const response = respondForCharacter(routedCharacter, doctorUtterance, latestOrderSummary);
    const text = response.text;
    const action = response.action;

    // Add to treatment history if an action was taken (shows on presenter timeline)
    if (action && runtime.scenarioEngine) {
      const currentHistory = runtime.scenarioEngine.getState().treatmentHistory ?? [];
      runtime.scenarioEngine.setTreatmentHistory([
        ...currentHistory,
        { ts: Date.now(), treatmentType: `[${routedCharacter}] ${action}` },
      ]);
      // Broadcast updated sim state to reflect the action
      broadcastSimState(sessionId, {
        ...runtime.scenarioEngine.getState(),
        stageIds: runtime.scenarioEngine.getStageIds(),
        budget: runtime.cost.getState?.() ?? undefined,
      });
    }

    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "speaking",
      character: routedCharacter,
    });
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text,
      character: routedCharacter,
    });
    // Generate TTS audio for non-patient characters
    const voice = CHARACTER_VOICE_MAP[routedCharacter];
    log("TTS for non-patient", routedCharacter, "voice:", voice, "text:", text.slice(0, 50));
    try {
      const audioBuffer = await synthesizePatientAudio(text, voice);
      if (audioBuffer) {
        log("TTS audio generated", routedCharacter, "bytes:", audioBuffer.length);
        // Send audio to all participants so students hear the patient/nurse
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_audio",
          sessionId,
          audioBase64: audioBuffer.toString("base64"),
          character: routedCharacter,
        });
      } else {
        log("TTS returned null for", routedCharacter);
      }
    } catch (err) {
      logError("TTS failed for non-patient", err);
    }
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "idle",
      character: routedCharacter,
    });
    return;
  }

  const engine = getOrCreatePatientEngine(sessionId);
  const simState = runtime.scenarioEngine.getState();
  const demographics = runtime.scenarioEngine.getDemographics();
  const simContext = {
    vitals: simState.vitals,
    stageId: simState.stageId,
    scenarioId: simState.scenarioId,
    demographics,
    treatmentHistory: simState.treatmentHistory,
    orders: simState.orders,
  };
  const personaPrompt = getPersonaPrompt(routedCharacter, engine.getCase(), simContext);
  const doctorPrompt =
    doctorUtterance && doctorUtterance.length > 0
      ? doctorUtterance
      : routedCharacter === "nurse"
      ? "The doctor needs help. Respond naturally as the bedside nurse."
      : "The doctor has just asked you a follow-up question about your chest pain and palpitations. Answer naturally in character.";

  engine.appendDoctorTurn(doctorPrompt);
  log(
    "force_reply received",
    sessionId,
    doctorUtterance && doctorUtterance.length > 0 ? "with doctorUtterance" : "no doctorUtterance"
  );

  try {
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "speaking",
      character: routedCharacter,
    });

    const messages = engine.getHistory();
    let fullText = "";

    const stream =
      routedCharacter === "patient"
        ? await openai.chat.completions.create({
            model: MODEL,
            messages:
              (() => {
                const orderSummaryArr = (runtime.scenarioEngine.getState().orders ?? [])
                  .filter((o) => o.status === "complete" && o.result)
                  .slice(-3)
                  .map((o) => {
                    if (o.result?.type === "vitals") {
                      return `Vitals: HR ${o.result.hr ?? "—"} BP ${o.result.bp ?? "—"} SpO2 ${o.result.spo2 ?? "—"}`;
                    }
                    if (o.result?.summary) {
                      return `${o.type}: ${o.result.summary}`;
                    }
                    return `${o.type}: complete`;
                  });
                const base = engine.getHistory();
                if (orderSummaryArr.length === 0) return base;
                return [
                  ...base,
                  {
                    role: "user",
                    content: `Recent orders:\n${orderSummaryArr.join(
                      "\n"
                    )}\nUse the latest result if it helps answer. Question: ${doctorPrompt}`,
                  },
                ];
              })(),
            stream: true,
          })
        : await openai.chat.completions.create({
            model: MODEL,
            messages: [
              personaPrompt,
              {
                role: "user",
                content: `Recent orders:\n${
                  (runtime.scenarioEngine.getState().orders ?? [])
                    .filter((o) => o.status === "complete" && o.result?.summary)
                    .slice(-3)
                    .map((o) => `- ${o.type}: ${o.result?.summary}`)
                    .join("\n") || "- none"
                }\nQuestion: ${doctorPrompt}`,
              },
            ],
            stream: true,
          });

    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content;
      if (!delta) continue;
      fullText += delta;
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: delta,
        character: routedCharacter,
      });
    }

    const finalText = fullText.trim();
    engine.appendPatientTurn(finalText);

    const audioBuffer = await withRetry(
      () => timed("tts.synthesize", () => synthesizePatientAudio(finalText, CHARACTER_VOICE_MAP[routedCharacter])),
      { label: "tts", attempts: 2, delayMs: 150 },
      sessionId
    );
    if (audioBuffer) {
      // Send audio to all participants so students hear the patient
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_audio",
        sessionId,
        audioBase64: audioBuffer.toString("base64"),
        character: routedCharacter,
      });
    } else {
      sendDegradedNotice(sessionId, "Audio unavailable; showing text reply only.");
    }

    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "idle",
      character: routedCharacter,
    });
    log("Patient reply complete", sessionId, "chars:", fullText.length);
  } catch (err) {
    logError("OpenAI force_reply error", err);
    emitVoiceError(sessionId, "openai_failed", "OpenAI completion failed");
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "error",
      character: routedCharacter,
    });
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: "I'm sorry, I'm having trouble answering right now.",
      character: routedCharacter,
    });
  }
}

function handleScenarioChange(sessionId: string, scenarioId: PatientScenarioId) {
  const allowed: PatientScenarioId[] = [
    "exertional_chest_pain",
    "syncope",
    "palpitations_svt",
    "myocarditis",
    "exertional_syncope_hcm",
    "ductal_shock",
    "cyanotic_spell",
    "kawasaki",
    "coarctation_shock",
    "arrhythmogenic_syncope",
    "teen_svt_complex_v1",
    "peds_myocarditis_silent_crash_v1",
  ];
  if (!allowed.includes(scenarioId)) {
    log("Ignoring invalid scenarioId", scenarioId);
    return;
  }
  setScenarioForSession(sessionId, scenarioId);
  ensureRuntime(sessionId);
  log("Scenario changed", sessionId, scenarioId);
  sessionManager.broadcastToPresenters(sessionId, {
    type: "scenario_changed",
    sessionId,
    scenarioId,
  });
}

async function handleDoctorAudio(
  sessionId: string,
  userId: string,
  audioBase64: string,
  contentType: string,
  character?: CharacterId
) {
  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    log("Doctor audio received", sessionId, "bytes:", audioBuffer.length, "character:", character ?? "patient");
    if (sessionManager.isFallback(sessionId)) {
      log("Session in fallback; routing legacy STT only", sessionId);
      await handleDoctorAudioLegacy(sessionId, userId, audioBuffer, contentType, character);
      return;
    }
    const runtime = ensureRuntime(sessionId);
    const floorHolder = sessionManager.getFloorHolder(sessionId);
    if (floorHolder && floorHolder !== userId) {
      log("Ignoring doctor_audio; user does not hold floor", sessionId, userId);
      return;
    }
    if (runtime.realtime) {
      runtime.realtime.sendAudioChunk(audioBuffer);
      runtime.realtime.commitAudio();
      void transcribeDoctorAudio(audioBuffer, contentType)
        .then((text) => {
          if (text && text.trim().length > 0) {
            // Check if utterance is for non-patient (order or explicit character routing)
            // If so, cancel the realtime patient response to avoid "echo" effect
            const orderRequest = parseOrderRequest(text);
            const routedCharacter = character ?? chooseCharacter(text);
            if (orderRequest || routedCharacter !== "patient") {
              log("Canceling realtime patient response for non-patient utterance", sessionId, orderRequest?.type ?? routedCharacter);
              runtime.realtime?.cancelResponse();
            }
            broadcastDoctorUtterance(sessionId, userId, text, character);
          }
        })
        .catch((err) => logError("Realtime doctor STT failed", err));
      return;
    }
    await handleDoctorAudioLegacy(sessionId, userId, audioBuffer, contentType, character);
  } catch (err) {
    logError("doctor_audio handling failed", err);
  }
}

async function handleAnalyzeTranscript(sessionId: string, turns: DebriefTurn[]) {
  if (!Array.isArray(turns) || turns.length === 0) return;
  try {
    const runtime = runtimes.get(sessionId);
    const scenarioId = getScenarioForSession(sessionId);

    // Check if this is a complex scenario with extended state
    if (runtime?.scenarioEngine) {
      const simState = runtime.scenarioEngine.getState();

      // Early debrief guard: ensure minimum meaningful interaction for complex scenarios
      const isComplexScenario = scenarioId === "teen_svt_complex_v1" || scenarioId === "peds_myocarditis_silent_crash_v1";
      if (isComplexScenario) {
        const timelineEvents = (simState.extended as any)?.timelineEvents ?? [];
        const hasMinimumActions = turns.length >= 3 || timelineEvents.length >= 3;

        if (!hasMinimumActions) {
          log("Debrief skipped: insufficient actions", { sessionId, turns: turns.length, events: timelineEvents.length });
          sessionManager.broadcastToPresenters(sessionId, {
            type: "analysis_result",
            sessionId,
            summary: "Not enough interaction to generate a meaningful debrief. Continue the scenario and try again.",
            strengths: [],
            opportunities: ["Try ordering diagnostics, performing exams, or talking to the patient/family."],
            teachingPoints: [],
          });
          return;
        }
      }

      // SVT complex scenario
      if (scenarioId === "teen_svt_complex_v1" && hasSVTExtended(simState)) {
        const scenarioStartTime = simState.extended.scenarioStartedAt;
        const complexResult = await analyzeComplexScenario(
          turns,
          simState.extended,
          scenarioStartTime,
          "teen_svt_complex_v1" as ComplexScenarioId
        );
        sessionManager.broadcastToPresenters(sessionId, {
          type: "complex_debrief_result",
          sessionId,
          scenarioId: "teen_svt_complex_v1",
          ...complexResult,
        });
        return;
      }

      // Myocarditis complex scenario
      if (scenarioId === "peds_myocarditis_silent_crash_v1" && hasMyocarditisExtended(simState)) {
        const scenarioStartTime = simState.extended.scenarioStartedAt;
        const complexResult = await analyzeComplexScenario(
          turns,
          simState.extended,
          scenarioStartTime,
          "peds_myocarditis_silent_crash_v1" as ComplexScenarioId
        );
        sessionManager.broadcastToPresenters(sessionId, {
          type: "complex_debrief_result",
          sessionId,
          scenarioId: "peds_myocarditis_silent_crash_v1",
          ...complexResult,
        });
        return;
      }
    }

    // Fallback to simple transcript analysis for non-complex scenarios
    const result = await analyzeTranscript(turns);
    sessionManager.broadcastToPresenters(sessionId, {
      type: "analysis_result",
      sessionId,
      summary: result.summary,
      strengths: result.strengths,
      opportunities: result.opportunities,
      teachingPoints: result.teachingPoints,
    });
  } catch (err) {
    logError("Debrief analysis error", err);
    // Send fallback error response so presenter doesn't wait forever
    sessionManager.broadcastToPresenters(sessionId, {
      type: "analysis_result",
      sessionId,
      summary: "Debrief analysis failed. Please try again.",
      strengths: [],
      opportunities: [],
      teachingPoints: [],
    });
  }
}

async function handleDoctorAudioLegacy(
  sessionId: string,
  userId: string,
  audioBuffer: Buffer,
  contentType: string,
  character?: CharacterId
) {
  const text = await withRetry(
    () => timed("stt.transcribe", () => transcribeDoctorAudio(audioBuffer, contentType)),
    { label: "stt", attempts: 2, delayMs: 150 },
    sessionId
  );
  if (text && text.trim().length > 0) {
    log("STT transcript", sessionId, text.slice(0, 120));
    broadcastDoctorUtterance(sessionId, userId, text, character);
  } else {
    sendDegradedNotice(sessionId, "Transcription unavailable; please repeat or use manual reply.");
  }
}

function maybeAutoForceReply(sessionId: string, text: string, explicitCharacter?: CharacterId, userId?: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (isUnsafeUtterance(trimmed)) {
    log("auto-reply blocked for safety", sessionId);
    sessionManager.broadcastToPresenters(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: "NPC reply held for review (content flagged). Use manual reply if appropriate.",
      character: "nurse",
    });
    return;
  }

  // Check if this is an order request (vitals, exam, EKG, labs, imaging)
  const orderRequest = parseOrderRequest(trimmed);
  if (orderRequest) {
    log("Order request detected from speech", sessionId, orderRequest.type);
    // Handle exam orders via handleExamRequest, other orders via handleOrder
    if (orderRequest.type === "cardiac_exam" || orderRequest.type === "lung_exam" || orderRequest.type === "general_exam") {
      const examType = orderRequest.type === "cardiac_exam" ? "cardiac"
        : orderRequest.type === "lung_exam" ? "lungs"
        : undefined;
      examHandlers.handleExamRequest(sessionId, examType);
    } else {
      // For voice-ordered requests, we only have userId (no displayName available)
      // Pass IV location if present
      const ivParams = orderRequest.type === "iv_access" && orderRequest.location
        ? { location: orderRequest.location }
        : undefined;
      handleOrder(sessionId, orderRequest.type, userId ? {
        id: userId,
        name: "Voice Order",
        role: "participant",
      } : undefined, ivParams);
    }
    return;
  }

  const allow = shouldAutoReply({
    sessionId,
    userId,
    text: trimmed,
    explicitCharacter,
    floorHolder: sessionManager.getFloorHolder(sessionId),
    commandCooldownMs,
    maps: { lastAutoReplyAt, lastAutoReplyByUser, lastDoctorUtterance },
  });
  if (!allow) return;
  const routed = explicitCharacter ?? chooseCharacter(trimmed);
  handleForceReply(sessionId, "auto", trimmed, routed);
}

function broadcastDoctorUtterance(sessionId: string, userId: string, text: string, character?: CharacterId) {
  sessionManager.broadcastToPresenters(sessionId, {
    type: "doctor_utterance",
    sessionId,
    userId,
    text,
    character,
  });
  maybeAutoForceReply(sessionId, text, character, userId);
}

function ensureRuntime(sessionId: string): Runtime {
  const existing = runtimes.get(sessionId);
  if (existing) return existing;
  const scenarioId = getScenarioForSession(sessionId);
  const runtime: Runtime = {
    fallback: false,
    scenarioEngine: new ScenarioEngine(sessionId, scenarioId),
    toolGate: new ToolGate(),
    cost: new CostController({
      softUsd: softBudgetUsd,
      hardUsd: hardBudgetUsd,
      onSoftLimit: () => handleBudgetSoftLimit(sessionId),
      onHardLimit: () => handleBudgetHardLimit(sessionId),
    }),
  };
  if (realtimeApiKey) {
    runtime.realtime = new RealtimePatientClient({
      simId: sessionId,
      model: realtimeModel,
      apiKey: realtimeApiKey,
      systemPrompt: buildSystemPrompt(scenarioId),
      onAudioOut: (buf) => {
        // Send audio to all participants so students hear the patient
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_audio",
          sessionId,
          audioBase64: buf.toString("base64"),
        });
      },
      onTranscriptDelta: (text, isFinal) => {
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_transcript_delta",
          sessionId,
          text,
        });
        eventLog.append({
          id: `${Date.now()}-${Math.random()}`,
          ts: Date.now(),
          simId: sessionId,
          type: isFinal ? "scenario.state.diff" : "tool.intent.received",
          payload: { text, final: isFinal },
        });
      },
      onToolIntent: (intent) => {
        eventLog.append({
          id: `${Date.now()}-${Math.random()}`,
          ts: Date.now(),
          simId: sessionId,
          type: "tool.intent.received",
          payload: intent as any,
        });
        handleToolIntent(sessionId, intent);
      },
      onUsage: (usage) => {
        runtime.cost.addUsage({
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        });
        broadcastSimState(sessionId, {
          ...runtime.scenarioEngine.getState(),
          stageIds: runtime.scenarioEngine.getStageIds(),
          budget: runtime.cost.getState(),
        });
      },
      onDisconnect: () => {
        runtime.fallback = true;
        sessionManager.setFallback(sessionId, true);
        runtime.scenarioEngine.setFallback(true);
        broadcastSimState(sessionId, {
          ...runtime.scenarioEngine.getState(),
          stageIds: runtime.scenarioEngine.getStageIds(),
        });
        sessionManager.broadcastToPresenters(sessionId, {
          type: "patient_state",
          sessionId,
          state: "error",
        });
      },
    });
    runtime.realtime.connect();
  }
  runtimes.set(sessionId, runtime);

  // Initialize extended state for complex scenarios
  const state = runtime.scenarioEngine.getState();
  if (scenarioId === "teen_svt_complex_v1" && !state.extended) {
    const svtExtended = createInitialSVTState(Date.now());
    // Apply initial phase vitals
    const presentationPhase = SVT_PHASES.find((p) => p.id === "presentation");
    if (presentationPhase) {
      runtime.scenarioEngine.hydrate({
        vitals: presentationPhase.vitalsTarget,
        exam: presentationPhase.examFindings,
        rhythmSummary: presentationPhase.rhythmSummary,
        extended: svtExtended,
      });
    }
  }

  broadcastSimState(sessionId, {
    ...runtime.scenarioEngine.getState(),
    stageIds: runtime.scenarioEngine.getStageIds(),
  });
  startScenarioHeartbeat(sessionId);
  if (!hydratedSessions.has(sessionId)) {
    hydratedSessions.add(sessionId);
    void hydrateSimState(sessionId, runtime);
  }
  return runtime;
}

async function hydrateSimState(sessionId: string, runtime: Runtime) {
  try {
    const persisted = await loadSimState(sessionId);
    if (!persisted) return;
    runtime.scenarioEngine.hydrate(persisted as any);
    broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      ekgHistory: runtime.scenarioEngine.getState().ekgHistory,
      telemetryHistory: runtime.scenarioEngine.getState().telemetryHistory,
      telemetryWaveform: persisted.telemetryWaveform as any,
    });
  } catch (err) {
    logError("hydrateSimState failed", err);
  }
}

function handleToolIntent(sessionId: string, intent: ToolIntent) {
  const runtime = ensureRuntime(sessionId);
  const stageId = runtime.scenarioEngine.getState().stageId;
  const stageDef = runtime.scenarioEngine.getStageDef(stageId);
  const decision = runtime.toolGate.validate(sessionId, stageDef, intent);
  if (!decision.allowed) {
    log("[tool] rejected", intent.type, "reason", decision.reason);
    eventLog.append({
      id: `${Date.now()}-${Math.random()}`,
      ts: Date.now(),
      simId: sessionId,
      type: "tool.intent.rejected",
      payload: { intent, reason: decision.reason },
    });
    logSimEvent(sessionId, {
      type: "tool.intent.rejected",
      payload: { intent, reason: decision.reason },
    }).catch(() => {});
    return;
  }
  log("[tool] approved", intent.type, "stage", stageId);
  const result = runtime.scenarioEngine.applyIntent(intent);
  eventLog.append({
    id: `${Date.now()}-${Math.random()}`,
    ts: Date.now(),
    simId: sessionId,
    type: "tool.intent.approved",
    payload: intent as any,
  });
  logSimEvent(sessionId, { type: "tool.intent.approved", payload: intent as any }).catch(() => {});
  result.events.forEach((evt) =>
    eventLog.append({
      id: `${Date.now()}-${Math.random()}`,
      ts: Date.now(),
      simId: sessionId,
      type: evt.type as any,
      payload: evt.payload,
    })
  );
  logSimEvent(sessionId, { type: "tool.intent.applied", payload: intent as any }).catch(() => {});
  const actionHint = (intent as any)?.action ? [(intent as any).action as string] : [];
  const transitionResult = runtime.scenarioEngine.evaluateAutomaticTransitions(actionHint);
  const nextState = transitionResult?.nextState ?? result.nextState;
  if (transitionResult?.events) {
    transitionResult.events.forEach((evt) =>
      eventLog.append({
        id: `${Date.now()}-${Math.random()}`,
        ts: Date.now(),
        simId: sessionId,
        type: evt.type as any,
        payload: evt.payload,
      })
    );
  }
  broadcastSimState(sessionId, nextState);
}

function handleBudgetSoftLimit(sessionId: string) {
  logSimEvent(sessionId, { type: "budget.soft_limit" }).catch(() => {});
  console.warn("[budget] soft limit reached", sessionId);
  logEvent("budget.soft_limit", { sessionId });
}

function handleBudgetHardLimit(sessionId: string) {
  const runtime = runtimes.get(sessionId);
  logSimEvent(sessionId, { type: "budget.hard_limit" }).catch(() => {});
  console.warn("[budget] hard limit reached, switching to fallback", sessionId);
  logEvent("budget.hard_limit", { sessionId });
  if (runtime) {
    runtime.fallback = true;
    runtime.scenarioEngine.setFallback(true);
    runtime.realtime?.close();
    runtime.realtime = undefined;
    sessionManager.setFallback(sessionId, true);
    broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      fallback: true,
    });
  }
}

// tickSVTPhase moved to svtPhaseHandler.ts

function startScenarioHeartbeat(sessionId: string) {
  if (scenarioTimers.has(sessionId)) return;
  const tick = () => {
    const runtime = runtimes.get(sessionId);
    if (!runtime) return;

    // Handle SVT phase transitions
    const state = runtime.scenarioEngine.getState();
    if (hasSVTExtended(state)) {
      tickSVTPhaseHandler(sessionId, runtime, state.extended, {
        sessionManager,
        scenarioHeartbeatMs,
      });
    }

    const result = runtime.scenarioEngine.tick(Date.now());
    const telemetryWaveform = runtime.scenarioEngine.getState().telemetry
      ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90)
      : undefined;
    checkAlarms(sessionId, runtime, alarmSeenAt, sessionManager);
    if (result) {
      if (runtime.scenarioEngine.getState().telemetry) {
        const rhythm = runtime.scenarioEngine.getState().rhythmSummary;
        const history = runtime.scenarioEngine.getState().telemetryHistory ?? [];
        if (rhythm && (history.length === 0 || history[history.length - 1]?.rhythm !== rhythm)) {
          runtime.scenarioEngine.setTelemetryHistory([...history, { ts: Date.now(), rhythm }]);
        }
      }
      result.events?.forEach((evt) =>
        eventLog.append({
          id: `${Date.now()}-${Math.random()}`,
          ts: Date.now(),
          simId: sessionId,
          type: evt.type as any,
          payload: evt.payload,
        })
      );
      result.events?.forEach((evt) =>
        logSimEvent(sessionId, { type: evt.type, payload: evt.payload as any }).catch(() => {})
      );
      broadcastSimState(sessionId, {
        ...runtime.scenarioEngine.getState(),
        stageIds: runtime.scenarioEngine.getStageIds(),
        telemetryWaveform,
        elapsedSeconds: runtime.scenarioEngine.getElapsedSeconds(),
        budget: runtime.cost.getState?.(),
      });
    } else {
      // Always broadcast to keep elapsed time updated
      broadcastSimState(sessionId, {
        ...runtime.scenarioEngine.getState(),
        stageIds: runtime.scenarioEngine.getStageIds(),
        telemetryWaveform,
        elapsedSeconds: runtime.scenarioEngine.getElapsedSeconds(),
        budget: runtime.cost.getState?.(),
      });
    }
  };
  const handle = setInterval(tick, scenarioHeartbeatMs);
  scenarioTimers.set(sessionId, handle);
}

function broadcastSimState(
  sessionId: string,
  state: {
    stageId: string;
    vitals: any;
    exam?: Record<string, string>;
    interventions?: Interventions;
    telemetry?: boolean;
    rhythmSummary?: string;
    telemetryWaveform?: number[];
    fallback: boolean;
    budget?: any;
    stageIds?: string[];
    scenarioId?: string;
    findings?: string[];
    orders?: { id: string; type: "vitals" | "ekg" | "labs" | "imaging" | "cardiac_exam" | "lung_exam" | "general_exam" | "iv_access"; status: "pending" | "complete"; result?: OrderResult; completedAt?: number }[];
    ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
    telemetryHistory?: { ts: number; rhythm?: string; note?: string }[];
    treatmentHistory?: { ts: number; treatmentType: string; note?: string }[];
    scenarioStartedAt?: number;
    elapsedSeconds?: number;
    extended?: any; // SVT or Myocarditis extended state
  }
) {
  const validated = validateSimStateMessage(state);
  if (!validated) {
    logError("sim_state validation failed; skipping broadcast", state);
    return;
  }
  const scenarioId = (validated.scenarioId ?? getScenarioForSession(sessionId)) as PatientScenarioId;
  const examAudio = getAuscultationClips(scenarioId, validated.stageId);

  // Check completed orders to determine what everyone can see
  // Exam data is gated for BOTH presenters and participants until ordered
  const completedOrders = (validated.orders ?? []).filter(o => o.status === "complete");
  const hasCardiacExam = completedOrders.some(o => o.type === "cardiac_exam");
  const hasLungExam = completedOrders.some(o => o.type === "lung_exam");
  const hasGeneralExam = completedOrders.some(o => o.type === "general_exam");
  const hasAnyExam = hasCardiacExam || hasLungExam || hasGeneralExam;

  // Build partial exam based on what was ordered (for all users)
  const gatedExam: typeof validated.exam = {};
  if (hasGeneralExam && validated.exam?.general) gatedExam.general = validated.exam.general;
  if ((hasCardiacExam || hasGeneralExam) && validated.exam?.cardio) gatedExam.cardio = validated.exam.cardio;
  if ((hasLungExam || hasGeneralExam) && validated.exam?.lungs) gatedExam.lungs = validated.exam.lungs;
  if (hasGeneralExam && validated.exam?.perfusion) gatedExam.perfusion = validated.exam.perfusion;
  if (hasGeneralExam && validated.exam?.neuro) gatedExam.neuro = validated.exam.neuro;
  if (hasCardiacExam && validated.exam?.heartAudioUrl) gatedExam.heartAudioUrl = validated.exam.heartAudioUrl;
  if (hasLungExam && validated.exam?.lungAudioUrl) gatedExam.lungAudioUrl = validated.exam.lungAudioUrl;

  // Gated exam audio based on ordered exams
  const gatedExamAudio = hasAnyExam ? examAudio.filter(a =>
    (hasCardiacExam && a.type === "heart") ||
    (hasLungExam && a.type === "lung")
  ) : [];

  // Get correlationId and voiceFallback status for this session
  const correlationId = getOrCreateCorrelationId(sessionId);
  const voiceFallback = voiceFallbackSessions.has(sessionId);

  // Build interventions object, merging ETT from extended state if patient is intubated
  const extended = (state as any).extended;
  const baseInterventions = (validated as any).interventions || {};
  const interventions = {
    ...baseInterventions,
    // Add ETT if patient is intubated (from extended airway state)
    ...(extended?.airway?.type === "intubation" && {
      ett: { placed: true, size: extended.airway.ettSize, depth: extended.airway.ettDepth }
    }),
  };

  // Full state for presenters - they see everything EXCEPT exam is gated until ordered
  const fullState = {
    type: "sim_state" as const,
    sessionId,
    stageId: validated.stageId,
    stageIds: validated.stageIds,
    scenarioId,
    vitals: validated.vitals ?? {},
    exam: hasAnyExam ? gatedExam : {},
    examAudio: gatedExamAudio,
    interventions,
    telemetry: validated.telemetry,
    rhythmSummary: validated.rhythmSummary,
    telemetryWaveform: validated.telemetryWaveform,
    findings: validated.findings ?? [],
    fallback: validated.fallback,
    voiceFallback,
    correlationId,
    budget: validated.budget,
    orders: validated.orders,
    ekgHistory: (state as any).ekgHistory,
    telemetryHistory: (state as any).telemetryHistory,
    treatmentHistory: (state as any).treatmentHistory,
    scenarioStartedAt: (state as any).scenarioStartedAt,
    stageEnteredAt: (state as any).stageEnteredAt,
    elapsedSeconds: (state as any).elapsedSeconds,
    extended: (state as any).extended, // SVT/Myocarditis extended state for presenters
  };

  // Send full state to presenters
  sessionManager.broadcastToPresenters(sessionId, fullState);

  // For participants: additional gating for vitals/telemetry
  const hasVitalsOrder = completedOrders.some(o => o.type === "vitals");
  const hasEkgOrder = completedOrders.some(o => o.type === "ekg");
  const hasTelemetryEnabled = validated.telemetry === true;

  // Participants only see:
  // - Vitals if they ordered vitals OR telemetry is on (continuous monitoring)
  // - Telemetry/rhythm if they ordered EKG or turned on telemetry
  // - Exam findings only if they ordered specific exam types (same as presenter)
  // - Interventions (IV, oxygen, etc.) always visible once placed
  const participantState = {
    type: "sim_state" as const,
    sessionId,
    stageId: validated.stageId,
    scenarioId,
    // Vitals revealed when ordered or telemetry on
    vitals: (hasVitalsOrder || hasTelemetryEnabled) ? (validated.vitals ?? {}) : {},
    // Exam available based on specific exam orders (reuse gated exam from above)
    exam: hasAnyExam ? gatedExam : {},
    examAudio: gatedExamAudio,
    // Interventions always visible (they can see the IV, oxygen, etc. on the patient)
    interventions,
    // Telemetry/rhythm only if EKG ordered or telemetry enabled
    telemetry: hasTelemetryEnabled,
    rhythmSummary: (hasEkgOrder || hasTelemetryEnabled) ? validated.rhythmSummary : undefined,
    telemetryWaveform: (hasEkgOrder || hasTelemetryEnabled) ? validated.telemetryWaveform : undefined,
    findings: validated.findings ?? [],
    fallback: validated.fallback,
    voiceFallback,
    correlationId,
    // Orders always visible (so they know status)
    orders: validated.orders,
    ekgHistory: (hasEkgOrder || hasTelemetryEnabled) ? (state as any).ekgHistory : undefined,
    // Treatment history for timeline (always visible so participants can see what's been done)
    treatmentHistory: (state as any).treatmentHistory,
    scenarioStartedAt: (state as any).scenarioStartedAt,
  };

  sessionManager.broadcastToParticipants(sessionId, participantState);
  persistSimState(sessionId, state as any).catch(() => {});
}

function buildSystemPrompt(scenario: PatientScenarioId): string {
  const persona =
    scenario === "syncope"
      ? "You are a teen with exertional syncope. Answer as the patient with short, concrete answers. Do not diagnose or recommend treatments."
      : scenario === "palpitations_svt"
      ? "You are a teen with recurrent palpitations. Stay in character with short answers, no diagnoses or treatments."
      : scenario === "myocarditis"
      ? "You are a pre-teen recovering from a viral illness, now tired with chest discomfort and short of breath. Stay in character and brief."
      : scenario === "exertional_syncope_hcm"
      ? "You are a teen athlete with presyncope during sprints and family history of sudden death. Stay in character, short answers."
      : scenario === "ductal_shock"
      ? "You are an ill infant; responses are limited to fussing/crying cues. Keep outputs minimal, describing distress simply."
      : scenario === "cyanotic_spell"
      ? "You are a toddler who turns blue and sometimes squats to feel better. Very short, simple toddler-like responses."
      : scenario === "teen_svt_complex_v1"
      ? "You are Alex Chen, a 14-year-old with episodes of sudden rapid heartbeat. Your heart is racing right now - it feels like it's pounding in your throat. You're scared but trying to stay calm. Answer briefly, stay in character. Your mom is here and worried."
      : "You are a teen with exertional chest pain. Stay in character with short answers, no diagnoses or treatments.";
  return `${persona}\nKeep answers to 1-3 sentences. If unsure, say you are not sure.`;
}

main();

// Exam handlers moved to examHandler.ts
// Treatment handler moved to treatmentHandler.ts


async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { label: string; attempts?: number; delayMs?: number },
  sessionId?: string
): Promise<T | null> {
  const { label, attempts = 2, delayMs = 150 } = opts;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) {
        logError(`${label} failed after ${attempts} attempts`, err);
        if (sessionId) {
          sendDegradedNotice(sessionId, `${label.toUpperCase()} temporarily unavailable.`);
          // Emit voice_error for observability
          const errorType = label === "tts" ? "tts_failed"
            : label === "stt" ? "stt_failed"
            : "openai_failed";
          emitVoiceError(sessionId, errorType, `${label} failed after ${attempts} attempts`);
        }
        break;
      }
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  return null;
}

function sendDegradedNotice(sessionId: string, text: string) {
  sessionManager.broadcastToPresenters(sessionId, {
    type: "patient_transcript_delta",
    sessionId,
    text,
    character: "nurse",
  });
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!timingEnabled) return fn();
  const start = performance.now();
  const res = await fn();
  const ms = Math.round(performance.now() - start);
  log(`[perf] ${label} ${ms}ms`);
  return res;
}

