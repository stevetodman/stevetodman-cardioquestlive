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
import { createAnalysisHandler, createTreatmentHandler, createScenarioOperationsHandler, createDoctorAudioHandler } from "./handlers";
import { createBroadcastUtils } from "./state";
import { getAuscultationClips } from "./data/auscultation";
import { withStateLock, tryWithStateLock } from "./stateLock";

const PORT = Number(process.env.PORT || 8081);
const sessionManager = new SessionManager();

/**
 * Fire-and-forget async operation with proper error logging.
 * Use instead of `.catch(() => {})` or `void promise` to ensure errors are logged.
 */
function fireAndForget(
  promise: Promise<unknown>,
  context: string,
  sessionId?: string
): void {
  promise.catch((err) => {
    logError(`[fireAndForget] ${context} failed:`, err);
    // Optionally emit an error event for observability
    if (sessionId) {
      sessionManager.broadcastToPresenters(sessionId, {
        type: "voice_error",
        sessionId,
        errorType: "async_operation_failed",
        message: `${context} failed`,
      } as any);
    }
  });
}
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
// handleOrder initialized after broadcastUtils below
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

// Initialize extracted handlers
const analysisHandler = createAnalysisHandler({
  sessionManager,
  runtimes,
});

// Clean up per-session state when all clients disconnect (prevents memory leaks)
sessionManager.onSessionEmpty((sessionId) => {
  const runtime = runtimes.get(sessionId);
  if (runtime?.realtime) {
    try { runtime.realtime.close(); } catch { /* ignore */ }
  }
  runtimes.delete(sessionId);
  scenarioTimers.get(sessionId) && clearInterval(scenarioTimers.get(sessionId)!);
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

// Initialize broadcast utilities
const broadcastUtils = createBroadcastUtils({
  sessionManager,
  getOrCreateCorrelationId,
  voiceFallbackSessions,
  fireAndForget,
});

// Initialize order handler (depends on broadcastUtils)
const handleOrder = createOrderHandler({
  ensureRuntime,
  sessionManager,
  broadcastSimState: broadcastUtils.broadcastSimState,
});

// Initialize treatment handler (depends on handleOrder, broadcastUtils)
const treatmentHandler = createTreatmentHandler({
  ensureRuntime,
  sessionManager,
  handleOrder,
  broadcastSimState: broadcastUtils.broadcastSimState,
  runtimes,
  lastTreatmentAt,
  fireAndForget,
});

// Initialize scenario operations handler (depends on broadcastUtils)
const scenarioOperationsHandler = createScenarioOperationsHandler({
  ensureRuntime,
  sessionManager,
  runtimes,
  scenarioTimers,
  alarmSeenAt,
  eventLog,
  broadcastSimState: broadcastUtils.broadcastSimState,
  fireAndForget,
  logSimEvent,
  synthesizePatientAudio,
});

// Initialize doctor audio handler (depends on handleOrder, handleExamRequest, handleForceReply)
const doctorAudioHandler = createDoctorAudioHandler({
  sessionManager,
  ensureRuntime,
  handleOrder,
  handleExamRequest,
  handleForceReply,
  withRetry,
  timed,
  sendDegradedNotice,
  commandCooldownMs,
  lastAutoReplyAt,
  lastAutoReplyByUser,
  lastDoctorUtterance,
});

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

// Character voices - imported from central config for consistency
import { CHARACTER_VOICES } from "./voiceConfig";

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
      doctorAudioHandler.handleDoctorAudio(simId, parsed.userId, parsed.audioBase64, parsed.contentType, parsed.character as CharacterId | undefined);
      break;
    }
    case "set_scenario": {
      scenarioOperationsHandler.handleScenarioChange(simId, parsed.scenarioId);
      break;
    }
    case "analyze_transcript": {
      analysisHandler.handleAnalyzeTranscript(simId, parsed.turns);
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
          handleExamRequest(simId, examType);
          break;
        }
        case "toggle_telemetry": {
          const enabled = parsed.payload?.enabled === true;
          handleTelemetryToggle(simId, enabled);
          break;
        }
        case "treatment": {
          const treatmentType = typeof parsed.payload?.treatmentType === "string" ? parsed.payload.treatmentType : undefined;
          treatmentHandler.handleTreatment(simId, treatmentType, parsed.payload).catch((err) =>
            logError("[handleMessage] Treatment handler failed:", err)
          );
          break;
        }
        case "show_ekg": {
          handleShowEkg(simId);
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
          broadcastUtils.broadcastSimState(simId, {
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
            fireAndForget(logSimEvent(simId, {
              type: "budget.resume_blocked",
              payload: { usdEstimate: budget.usdEstimate },
            }), "logSimEvent:budget.resume_blocked");
            broadcastUtils.broadcastSimState(simId, {
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
                broadcastUtils.broadcastSimState(simId, {
                  ...runtime.scenarioEngine.getState(),
                  stageIds: runtime.scenarioEngine.getStageIds(),
                  budget: runtime.cost.getState(),
                });
              },
              onDisconnect: () => {
                runtime.fallback = true;
                sessionManager.setFallback(simId, true);
                runtime.scenarioEngine.setFallback(true);
                broadcastUtils.broadcastSimState(simId, {
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
          broadcastUtils.broadcastSimState(simId, {
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
            broadcastUtils.broadcastSimState(simId, {
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
          broadcastUtils.broadcastSimState(simId, {
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
      broadcastUtils.broadcastSimState(sessionId, {
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
    const voice = CHARACTER_VOICES[routedCharacter];
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
      () => timed("tts.synthesize", () => synthesizePatientAudio(finalText, CHARACTER_VOICES[routedCharacter])),
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



/**
 * Attempt to reconnect the realtime client with exponential backoff.
 * @param attempt - Current attempt number (1-based)
 */
async function attemptRealtimeReconnect(
  sessionId: string,
  runtime: Runtime,
  scenarioId: string,
  attempt: number
): Promise<void> {
  const maxAttempts = 3;
  const baseDelayMs = 2000; // 2, 4, 8 seconds

  if (attempt > maxAttempts) {
    log(`[realtime] Reconnection failed after ${maxAttempts} attempts`, sessionId);
    sessionManager.broadcastToPresenters(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: "Voice connection could not be restored. Using text fallback mode.",
      character: "nurse",
    });
    return;
  }

  const delay = baseDelayMs * Math.pow(2, attempt - 1);
  log(`[realtime] Reconnection attempt ${attempt}/${maxAttempts} in ${delay}ms`, sessionId);

  await new Promise((resolve) => setTimeout(resolve, delay));

  // Check if session still exists
  const currentRuntime = runtimes.get(sessionId);
  if (!currentRuntime || currentRuntime !== runtime) {
    log(`[realtime] Session no longer active, aborting reconnect`, sessionId);
    return;
  }

  try {
    // Create new realtime client
    const newClient = new RealtimePatientClient({
      simId: sessionId,
      model: realtimeModel,
      apiKey: realtimeApiKey,
      systemPrompt: buildSystemPrompt(scenarioId as any),
      onAudioOut: (buf) => {
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
        broadcastUtils.broadcastSimState(sessionId, {
          ...runtime.scenarioEngine.getState(),
          stageIds: runtime.scenarioEngine.getStageIds(),
          budget: runtime.cost.getState(),
        });
      },
      onDisconnect: () => {
        runtime.fallback = true;
        sessionManager.setFallback(sessionId, true);
        runtime.scenarioEngine.setFallback(true);
        broadcastUtils.broadcastSimState(sessionId, {
          ...runtime.scenarioEngine.getState(),
          stageIds: runtime.scenarioEngine.getStageIds(),
        });
        sessionManager.broadcastToPresenters(sessionId, {
          type: "patient_state",
          sessionId,
          state: "error",
        });
        // Attempt reconnection again
        attemptRealtimeReconnect(sessionId, runtime, scenarioId, 1);
      },
    });

    await newClient.connect();

    // Success! Replace old client and clear fallback
    runtime.realtime = newClient;
    runtime.fallback = false;
    sessionManager.setFallback(sessionId, false);
    runtime.scenarioEngine.setFallback(false);

    log(`[realtime] Reconnection successful on attempt ${attempt}`, sessionId);
    sessionManager.broadcastToPresenters(sessionId, {
      type: "patient_state",
      sessionId,
      state: "idle",
    });
    sessionManager.broadcastToPresenters(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: "Voice connection restored.",
      character: "nurse",
    });
    broadcastUtils.broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
    });
  } catch (err) {
    logError(`[realtime] Reconnection attempt ${attempt} failed`, err);
    // Try again with next attempt
    attemptRealtimeReconnect(sessionId, runtime, scenarioId, attempt + 1);
  }
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
        broadcastUtils.broadcastSimState(sessionId, {
          ...runtime.scenarioEngine.getState(),
          stageIds: runtime.scenarioEngine.getStageIds(),
          budget: runtime.cost.getState(),
        });
      },
      onDisconnect: () => {
        // Mark as fallback temporarily
        runtime.fallback = true;
        sessionManager.setFallback(sessionId, true);
        runtime.scenarioEngine.setFallback(true);
        broadcastUtils.broadcastSimState(sessionId, {
          ...runtime.scenarioEngine.getState(),
          stageIds: runtime.scenarioEngine.getStageIds(),
        });
        sessionManager.broadcastToPresenters(sessionId, {
          type: "patient_state",
          sessionId,
          state: "error",
        });

        // Attempt reconnection with exponential backoff
        attemptRealtimeReconnect(sessionId, runtime, scenarioId, 1);
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

  broadcastUtils.broadcastSimState(sessionId, {
    ...runtime.scenarioEngine.getState(),
    stageIds: runtime.scenarioEngine.getStageIds(),
  });
  scenarioOperationsHandler.startScenarioHeartbeat(sessionId);
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
    broadcastUtils.broadcastSimState(sessionId, {
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
    fireAndForget(logSimEvent(sessionId, {
      type: "tool.intent.rejected",
      payload: { intent, reason: decision.reason },
    }), "logSimEvent:tool.intent.rejected");
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
  fireAndForget(logSimEvent(sessionId, { type: "tool.intent.approved", payload: intent as any }), "logSimEvent:tool.intent.approved");
  result.events.forEach((evt) =>
    eventLog.append({
      id: `${Date.now()}-${Math.random()}`,
      ts: Date.now(),
      simId: sessionId,
      type: evt.type as any,
      payload: evt.payload,
    })
  );
  fireAndForget(logSimEvent(sessionId, { type: "tool.intent.applied", payload: intent as any }), "logSimEvent:tool.intent.applied");
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
  broadcastUtils.broadcastSimState(sessionId, nextState);
}

function handleBudgetSoftLimit(sessionId: string) {
  fireAndForget(logSimEvent(sessionId, { type: "budget.soft_limit" }), "logSimEvent:budget.soft_limit");
  console.warn("[budget] soft limit reached", sessionId);
  logEvent("budget.soft_limit", { sessionId });
}

function handleBudgetHardLimit(sessionId: string) {
  const runtime = runtimes.get(sessionId);
  fireAndForget(logSimEvent(sessionId, { type: "budget.hard_limit" }), "logSimEvent:budget.hard_limit");
  console.warn("[budget] hard limit reached, switching to fallback", sessionId);
  logEvent("budget.hard_limit", { sessionId });
  if (runtime) {
    runtime.fallback = true;
    runtime.scenarioEngine.setFallback(true);
    runtime.realtime?.close();
    runtime.realtime = undefined;
    sessionManager.setFallback(sessionId, true);
    broadcastUtils.broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      fallback: true,
    });
  }
}

/**
 * Handle SVT phase transitions based on time and state.
 * Auto-advances from presentation → svt_onset after 2 minutes,
 * and handles deterioration if untreated.
 */


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

type ExamOrderType = "cardiac_exam" | "lung_exam" | "general_exam";

function handleExamRequest(sessionId: string, examType?: string) {
  const runtime = ensureRuntime(sessionId);
  const state = runtime.scenarioEngine.getState();
  const exam = state.exam ?? {};
  const maneuver = examType ?? (runtime as any).lastManeuver as string | undefined;

  // Determine which exam order type to create based on the maneuver/request
  let orderType: ExamOrderType = "general_exam";
  if (maneuver === "cardiac" || maneuver === "auscultation" || maneuver === "heart" || maneuver === "cardiovascular") {
    orderType = "cardiac_exam";
  } else if (maneuver === "pulmonary" || maneuver === "lungs" || maneuver === "respiratory" || maneuver === "breath") {
    orderType = "lung_exam";
  }

  // Create exam order
  const currentOrders = state.orders ?? [];
  const newOrder = {
    id: `order-${orderType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: orderType,
    status: "pending" as const,
  };
  const nextOrders = [...currentOrders, newOrder];

  // Persist orders to scenarioEngine so subsequent broadcasts include them
  runtime.scenarioEngine.hydrate({ orders: nextOrders });

  // Broadcast pending state
  broadcastUtils.broadcastSimState(sessionId, {
    ...runtime.scenarioEngine.getState(),
    stageIds: runtime.scenarioEngine.getStageIds(),
    orders: nextOrders,
  });

  // After brief delay, complete the exam order and announce results
  setTimeout(() => {
    // Get current orders from scenarioEngine (may have been updated since)
    const currentState = runtime.scenarioEngine.getState();
    const currentOrders = currentState.orders ?? nextOrders;
    const completedOrders = currentOrders.map((o: any) =>
      o.id === newOrder.id ? { ...o, status: "complete" as const, completedAt: Date.now() } : o
    );

    // Persist completed orders to scenarioEngine
    runtime.scenarioEngine.hydrate({ orders: completedOrders });

    // Build exam summary based on exam type
    let summary: string;
    if (orderType === "cardiac_exam") {
      summary = exam.cardio ? `CV exam: ${exam.cardio}` : "Cardiac exam: Normal heart sounds, regular rate and rhythm.";
    } else if (orderType === "lung_exam") {
      summary = exam.lungs ? `Lung exam: ${exam.lungs}` : "Lung exam: Clear to auscultation bilaterally.";
    } else {
      // general exam - show all
      summary = [
        exam.general && `General: ${exam.general}`,
        exam.cardio && `CV: ${exam.cardio}`,
        exam.lungs && `Lungs: ${exam.lungs}`,
        exam.perfusion && `Perfusion: ${exam.perfusion}`,
        exam.neuro && `Neuro: ${exam.neuro}`,
      ]
        .filter(Boolean)
        .join(" | ") || "Exam: Appears well, no acute distress.";
    }

    // Nurse reports exam findings
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "speaking",
      character: "nurse",
    });
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: summary,
      character: "nurse",
    });

    // If cardiac exam, prompt about heart sounds
    if (orderType === "cardiac_exam" && exam.heartAudioUrl) {
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: "Heart sounds available - use your headphones to listen.",
        character: "nurse",
      });
    }
    // If lung exam, prompt about breath sounds
    if (orderType === "lung_exam" && exam.lungAudioUrl) {
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: "Breath sounds available - use your headphones to listen.",
        character: "nurse",
      });
    }

    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "idle",
      character: "nurse",
    });

    // Broadcast updated state with completed order
    broadcastUtils.broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      orders: completedOrders,
    });

    fireAndForget(logSimEvent(sessionId, { type: `exam.${orderType}.complete`, payload: { summary } }), `logSimEvent:exam.${orderType}.complete`);
  }, 1500);

  fireAndForget(logSimEvent(sessionId, { type: "exam.requested", payload: { maneuver: maneuver ?? "standard", orderType } }), "logSimEvent:exam.requested");
}

function handleTelemetryToggle(sessionId: string, enabled: boolean) {
  const runtime = ensureRuntime(sessionId);
  runtime.scenarioEngine.setTelemetry(enabled, runtime.scenarioEngine.getState().rhythmSummary);
  const telemetryWaveform = enabled ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90) : [];
  const telemetryHistory = runtime.scenarioEngine.getState().telemetryHistory ?? [];
  broadcastUtils.broadcastSimState(sessionId, {
    ...runtime.scenarioEngine.getState(),
    stageIds: runtime.scenarioEngine.getStageIds(),
    telemetry: enabled,
    telemetryWaveform,
    telemetryHistory,
  });
  if (enabled) {
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: "Telemetry leads on. Live rhythm streaming.",
      character: "tech",
    });
  }
  fireAndForget(logSimEvent(sessionId, { type: "telemetry.toggle", payload: { enabled } }), "logSimEvent:telemetry.toggle");
}

function handleShowEkg(sessionId: string) {
  const runtime = ensureRuntime(sessionId);
  const ekgs = (runtime.scenarioEngine.getState().orders ?? []).filter((o) => o.type === "ekg" && o.status === "complete");
  const latest = ekgs.length ? ekgs[ekgs.length - 1] : null;
  const summary = latest?.result?.summary ?? runtime.scenarioEngine.getState().rhythmSummary ?? "Latest EKG ready to view.";
  const imageUrl = (latest?.result as any)?.imageUrl;
  const telemetryWaveform = runtime.scenarioEngine.getState().telemetry
    ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90)
    : undefined;
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_transcript_delta",
    sessionId,
    text: `EKG: ${summary}`,
    character: "tech",
  });
  if (imageUrl) {
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: `EKG image: ${imageUrl}`,
      character: "tech",
    });
  }
  // Keep a rolling archive of last 3 ekg ids/urls on runtime
  const archive = (runtime as any).ekgArchive ?? [];
    const entry = { ts: Date.now(), summary, imageUrl };
    const updatedArchive = [...(runtime.scenarioEngine.getState().ekgHistory ?? []), entry].slice(-3);
    runtime.scenarioEngine.setEkgHistory(updatedArchive);
  broadcastUtils.broadcastSimState(sessionId, {
    ...runtime.scenarioEngine.getState(),
    stageIds: runtime.scenarioEngine.getStageIds(),
    telemetryWaveform,
  });
  fireAndForget(logSimEvent(sessionId, { type: "ekg.viewed", payload: { summary, imageUrl } }), "logSimEvent:ekg.viewed");
}


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

