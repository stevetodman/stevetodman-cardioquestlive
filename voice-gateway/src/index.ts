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
import { analyzeTranscript } from "./debriefAnalyzer";
import { DebriefTurn } from "./messageTypes";
import { RealtimePatientClient } from "./sim/realtimePatientClient";
import { InMemoryEventLog } from "./sim/eventLog";
import { ScenarioEngine } from "./sim/scenarioEngine";
import { ToolGate } from "./sim/toolGate";
import { ToolIntent } from "./sim/types";
import { CostController } from "./sim/costController";
import { persistSimState, logSimEvent, loadSimState } from "./persistence";
import { validateMessage, validateSimStateMessage } from "./validators";
import { getAuth } from "./firebaseAdmin";
import { respondForCharacter, chooseCharacter, isUnsafeUtterance } from "./speechHelpers";
import { buildTelemetryWaveform, checkAlarms } from "./telemetry";
import { Runtime } from "./typesRuntime";
import { createOrderHandler } from "./orders";
import { shouldAutoReply } from "./autoReplyGuard";
import { createTransport, send, ClientContext } from "./transport";
import { getAuscultationClips } from "./data/auscultation";

const PORT = Number(process.env.PORT || 8081);
const sessionManager = new SessionManager();
const eventLog = new InMemoryEventLog();
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
// Default to secure WebSocket auth; only allow insecure for local dev/tunnels when explicitly set.
const allowInsecureWs = process.env.ALLOW_INSECURE_VOICE_WS === "true";
if (allowInsecureWs && process.env.NODE_ENV === "production") {
  log(
    "[warn] ALLOW_INSECURE_VOICE_WS=true in production; require Firebase ID tokens or set ALLOW_INSECURE_VOICE_WS=false."
  );
}
const timingEnabled = process.env.GATEWAY_TIMING === "true";

const runtimes: Map<string, Runtime> = new Map();
const scenarioTimers: Map<string, NodeJS.Timeout> = new Map();
const hydratedSessions: Set<string> = new Set();

const CHARACTER_VOICE_MAP: Partial<Record<CharacterId, string>> = {
  patient: process.env.OPENAI_TTS_VOICE_PATIENT,
  nurse: process.env.OPENAI_TTS_VOICE_NURSE,
  tech: process.env.OPENAI_TTS_VOICE_TECH,
  consultant: process.env.OPENAI_TTS_VOICE_CONSULTANT,
  imaging: process.env.OPENAI_TTS_VOICE_TECH,
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
      send(ws, { type: "error", message: "unauthorized" });
      logEvent("ws.auth.denied", { sessionId: parsed.sessionId, userId: parsed.userId });
      ws.close();
      return;
    }
    ctx.joined = true;
    ctx.sessionId = parsed.sessionId;
    ctx.role = parsed.role;
    sessionManager.addClient(parsed.sessionId, parsed.role, ws);
    send(ws, { type: "joined", sessionId: parsed.sessionId, role: parsed.role });
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
      const result = sessionManager.requestFloor(simId, parsed.userId);
      if (!result.granted) {
        send(ws, { type: "error", message: "floor_taken" });
        return;
      }
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
          handleOrder(simId, orderType as any);
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
          handleTreatment(simId, treatmentType, parsed.payload);
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
                sessionManager.broadcastToPresenters(simId, {
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
  if (!openai || routedCharacter !== "patient") {
    log(openai ? "force_reply stub (non-patient)" : "OPENAI_API_KEY not set; using stub patient response");
    const text = respondForCharacter(routedCharacter, doctorUtterance, latestOrderSummary);
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
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "idle",
      character: routedCharacter,
    });
    return;
  }

  const engine = getOrCreatePatientEngine(sessionId);
  const personaPrompt = getPersonaPrompt(routedCharacter, engine.getCase());
  const doctorPrompt =
    doctorUtterance && doctorUtterance.length > 0
      ? doctorUtterance
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
      sessionManager.broadcastToPresenters(sessionId, {
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
        sessionManager.broadcastToPresenters(sessionId, {
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

function startScenarioHeartbeat(sessionId: string) {
  if (scenarioTimers.has(sessionId)) return;
  const tick = () => {
    const runtime = runtimes.get(sessionId);
    if (!runtime) return;
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
        budget: runtime.cost.getState?.(),
      });
    } else if (telemetryWaveform) {
      broadcastSimState(sessionId, {
        ...runtime.scenarioEngine.getState(),
        stageIds: runtime.scenarioEngine.getStageIds(),
        telemetryWaveform,
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
    telemetry?: boolean;
    rhythmSummary?: string;
    telemetryWaveform?: number[];
    fallback: boolean;
    budget?: any;
    stageIds?: string[];
    scenarioId?: string;
    findings?: string[];
    orders?: { id: string; type: "vitals" | "ekg" | "labs" | "imaging"; status: "pending" | "complete"; result?: OrderResult; completedAt?: number }[];
    ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
    telemetryHistory?: { ts: number; rhythm?: string; note?: string }[];
    treatmentHistory?: { ts: number; treatmentType: string; note?: string }[];
  }
) {
  const validated = validateSimStateMessage(state);
  if (!validated) {
    logError("sim_state validation failed; skipping broadcast", state);
    return;
  }
  const scenarioId = (validated.scenarioId ?? getScenarioForSession(sessionId)) as PatientScenarioId;
  const examAudio = getAuscultationClips(scenarioId, validated.stageId);

  // Full state for presenters - they see everything for monitoring
  const fullState = {
    type: "sim_state" as const,
    sessionId,
    stageId: validated.stageId,
    stageIds: validated.stageIds,
    scenarioId,
    vitals: validated.vitals ?? {},
    exam: validated.exam ?? {},
    examAudio,
    telemetry: validated.telemetry,
    rhythmSummary: validated.rhythmSummary,
    telemetryWaveform: validated.telemetryWaveform,
    findings: validated.findings ?? [],
    fallback: validated.fallback,
    budget: validated.budget,
    orders: validated.orders,
    ekgHistory: (state as any).ekgHistory,
    telemetryHistory: (state as any).telemetryHistory,
    treatmentHistory: (state as any).treatmentHistory,
    stageEnteredAt: (state as any).stageEnteredAt,
  };

  // Send full state to presenters
  sessionManager.broadcastToPresenters(sessionId, fullState);

  // For participants: only show vitals/telemetry if they've ordered them
  // Check completed orders to determine what participant can see
  const completedOrders = (validated.orders ?? []).filter(o => o.status === "complete");
  const hasVitalsOrder = completedOrders.some(o => o.type === "vitals");
  const hasEkgOrder = completedOrders.some(o => o.type === "ekg");
  const hasTelemetryEnabled = validated.telemetry === true;

  // Participants only see:
  // - Vitals if they ordered vitals OR telemetry is on (continuous monitoring)
  // - Telemetry/rhythm if they ordered EKG or turned on telemetry
  // - Exam findings only if they examined the patient
  const participantState = {
    type: "sim_state" as const,
    sessionId,
    stageId: validated.stageId,
    scenarioId,
    // Vitals revealed when ordered or telemetry on
    vitals: (hasVitalsOrder || hasTelemetryEnabled) ? (validated.vitals ?? {}) : {},
    // Exam available if they did physical exam (check findings)
    exam: (validated.findings?.length ?? 0) > 0 ? (validated.exam ?? {}) : {},
    examAudio: (validated.findings?.length ?? 0) > 0 ? examAudio : [],
    // Telemetry/rhythm only if EKG ordered or telemetry enabled
    telemetry: hasTelemetryEnabled,
    rhythmSummary: (hasEkgOrder || hasTelemetryEnabled) ? validated.rhythmSummary : undefined,
    telemetryWaveform: (hasEkgOrder || hasTelemetryEnabled) ? validated.telemetryWaveform : undefined,
    findings: validated.findings ?? [],
    fallback: validated.fallback,
    // Orders always visible (so they know status)
    orders: validated.orders,
    ekgHistory: (hasEkgOrder || hasTelemetryEnabled) ? (state as any).ekgHistory : undefined,
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
      : "You are a teen with exertional chest pain. Stay in character with short answers, no diagnoses or treatments.";
  return `${persona}\nKeep answers to 1-3 sentences. If unsure, say you are not sure.`;
}

main();

function handleExamRequest(sessionId: string, examType?: string) {
  const runtime = ensureRuntime(sessionId);
  const state = runtime.scenarioEngine.getState();
  const exam = state.exam ?? {};
  const maneuver = examType ?? (runtime as any).lastManeuver as string | undefined;

  // Add finding to reveal exam/audio to participants
  // This allows participants to see exam findings and play heart/lung sounds
  const currentFindings = new Set(state.findings ?? []);
  currentFindings.add("physical_exam_performed");
  if (maneuver === "cardiac" || maneuver === "auscultation") {
    currentFindings.add("cardiac_exam");
  }
  if (maneuver === "pulmonary" || maneuver === "lungs") {
    currentFindings.add("pulmonary_exam");
  }

  // Update findings in state
  runtime.scenarioEngine.applyIntent({
    type: "intent_revealFinding",
    findingId: "physical_exam_performed",
  });

  const summary = [
    exam.general && `General: ${exam.general}`,
    exam.cardio && `CV: ${exam.cardio}`,
    exam.lungs && `Lungs: ${exam.lungs}`,
    exam.perfusion && `Perfusion: ${exam.perfusion}`,
    exam.neuro && `Neuro: ${exam.neuro}`,
  ]
    .filter(Boolean)
    .join(" | ");

  // Nurse reports exam findings
  const text = summary || "Exam unchanged from prior check.";
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_state",
    sessionId,
    state: "speaking",
    character: "nurse",
  });
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_transcript_delta",
    sessionId,
    text: maneuver ? `${maneuver} exam: ${text}` : text,
    character: "nurse",
  });

  // If auscultation, prompt about listening
  if (maneuver === "cardiac" || maneuver === "auscultation" || maneuver === "heart") {
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: "Heart sounds available - use your headphones to listen.",
      character: "nurse",
    });
  }
  if (maneuver === "pulmonary" || maneuver === "lungs") {
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

  // Broadcast updated state with findings (allows participants to see examAudio)
  broadcastSimState(sessionId, {
    ...runtime.scenarioEngine.getState(),
    stageIds: runtime.scenarioEngine.getStageIds(),
  });

  logSimEvent(sessionId, { type: "exam.requested", payload: { maneuver: maneuver ?? "standard" } }).catch(() => {});
}

function handleTelemetryToggle(sessionId: string, enabled: boolean) {
  const runtime = ensureRuntime(sessionId);
  runtime.scenarioEngine.setTelemetry(enabled, runtime.scenarioEngine.getState().rhythmSummary);
  const telemetryWaveform = enabled ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90) : [];
  const telemetryHistory = runtime.scenarioEngine.getState().telemetryHistory ?? [];
  broadcastSimState(sessionId, {
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
  logSimEvent(sessionId, { type: "telemetry.toggle", payload: { enabled } }).catch(() => {});
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
  broadcastSimState(sessionId, {
    ...runtime.scenarioEngine.getState(),
    stageIds: runtime.scenarioEngine.getStageIds(),
    telemetryWaveform,
  });
  logSimEvent(sessionId, { type: "ekg.viewed", payload: { summary, imageUrl } }).catch(() => {});
}

/**
 * Enhanced treatment handler supporting:
 * - Weight-based medication dosing (mg/kg)
 * - Specific routes (IV, IO, IM, etc.)
 * - Cardioversion/defibrillation (J/kg)
 * - Nurse confirmation of exact dose given
 */
function handleTreatment(
  sessionId: string,
  treatmentType?: string,
  payload?: Record<string, unknown>
) {
  const runtime = ensureRuntime(sessionId);
  const weightKg = runtime.scenarioEngine.getPatientWeight();
  const demographics = runtime.scenarioEngine.getDemographics();

  const key = `${sessionId}:${(treatmentType ?? "").toLowerCase()}`;
  const now = Date.now();
  const last = lastTreatmentAt.get(key) || 0;

  // Minimum interval between same treatments (prevents spam)
  const minIntervalMs = treatmentType === "cardioversion" || treatmentType === "defibrillation" ? 3000 : 8000;
  if (now - last < minIntervalMs) {
    sessionManager.broadcastToPresenters(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: "Treatment already given; wait a moment before re-dosing.",
      character: "nurse",
    });
    return;
  }
  lastTreatmentAt.set(key, now);

  const delta: any = {};
  let nurseResponse = "";
  let techResponse: string | undefined;
  let decayMs = 120000;
  let decayIntent: ToolIntent | null = null;

  // Extract dose/route from payload
  const doseOrdered = payload?.dose as number | undefined;
  const routeOrdered = payload?.route as string | undefined;
  const joules = payload?.joules as number | undefined;

  switch ((treatmentType ?? "").toLowerCase()) {
    // ===== SUPPORTIVE CARE =====
    case "oxygen":
    case "o2": {
      delta.spo2 = 3;
      delta.hr = -3;
      nurseResponse = "Oxygen on. SpO2 should improve.";
      techResponse = "Oxygenation improving on the monitor.";
      decayIntent = { type: "intent_updateVitals", delta: { spo2: -2, hr: 2 } as any };
      break;
    }
    case "fluids":
    case "bolus": {
      // Standard: 20 mL/kg NS bolus
      const volumeMl = doseOrdered ?? Math.round(20 * weightKg);
      delta.hr = -4;
      delta.sbpPerMin = 6;
      delta.dbpPerMin = 4;
      nurseResponse = `NS bolus ${volumeMl} mL IV running in. That's ${Math.round(volumeMl / weightKg)} mL/kg.`;
      techResponse = "Perfusion improving with fluids.";
      decayIntent = { type: "intent_updateVitals", delta: { hr: 2, sbpPerMin: -4, dbpPerMin: -3 } as any };
      break;
    }
    case "position":
    case "knee-chest": {
      delta.spo2 = 4;
      delta.hr = -5;
      nurseResponse = "Got them into knee-chest position. Sats improving.";
      techResponse = "Squatting/knee-chest reducing right-to-left shunt; sats coming up.";
      decayIntent = { type: "intent_updateVitals", delta: { spo2: -3, hr: 3 } as any };
      break;
    }

    // ===== CARDIAC MEDICATIONS =====
    case "adenosine": {
      // PALS: First dose 0.1 mg/kg IV rapid push (max 6mg), second dose 0.2 mg/kg (max 12mg)
      // Must be given rapid IV push followed immediately by NS flush
      const maxFirst = 6;
      const recommendedDose = doseOrdered ?? Math.min(0.1 * weightKg, maxFirst);
      const actualDose = Math.round(recommendedDose * 100) / 100;
      delta.hr = -80; // SVT conversion
      decayMs = 10000; // Half-life <10 seconds
      nurseResponse = `Adenosine ${actualDose} mg IV rapid push given. That's ${(actualDose / weightKg).toFixed(2)} mg/kg. Flushing with 5 mL NS.`;
      techResponse = "Rate dropping... watching for conversion...";
      decayIntent = { type: "intent_updateVitals", delta: { hr: 60 } as any }; // May revert if not converted
      break;
    }
    case "amiodarone": {
      // 5 mg/kg IV over 20-60 min (max 300mg for arrest)
      const recommendedDose = doseOrdered ?? Math.min(5 * weightKg, 300);
      const actualDose = Math.round(recommendedDose);
      delta.hr = -15;
      decayMs = 300000; // Long-acting
      nurseResponse = `Amiodarone ${actualDose} mg IV loading. That's ${(actualDose / weightKg).toFixed(1)} mg/kg. Running over 20 minutes.`;
      techResponse = "Rate control medication infusing. Should see gradual effect.";
      decayIntent = { type: "intent_updateVitals", delta: { hr: 5 } as any };
      break;
    }
    case "epinephrine":
    case "epi": {
      // Arrest: 0.01 mg/kg IV/IO (1:10,000) = 0.1 mL/kg
      // Anaphylaxis: 0.01 mg/kg IM (1:1,000)
      const route = routeOrdered ?? "iv";
      const recommendedDose = doseOrdered ?? 0.01 * weightKg;
      const actualDose = Math.round(recommendedDose * 1000) / 1000; // mg
      delta.hr = 20;
      delta.sbpPerMin = 10;
      decayMs = 180000;
      const concentration = route.toLowerCase() === "im" ? "1:1,000" : "1:10,000";
      nurseResponse = `Epinephrine ${actualDose} mg ${route.toUpperCase()} given (${concentration}). That's ${(actualDose / weightKg * 1000).toFixed(0)} mcg/kg.`;
      techResponse = "Heart rate increasing, perfusion improving.";
      decayIntent = { type: "intent_updateVitals", delta: { hr: -10, sbpPerMin: -5 } as any };
      break;
    }
    case "atropine": {
      // PALS: 0.02 mg/kg IV/IO (min 0.1mg to avoid paradoxical bradycardia, max 0.5mg child / 1mg adolescent)
      // May repeat once; total max 1mg child, 2mg adolescent
      const minDose = 0.1;
      const maxDose = demographics.ageYears >= 12 ? 1.0 : 0.5;
      const recommendedDose = doseOrdered ?? Math.max(minDose, Math.min(0.02 * weightKg, maxDose));
      const actualDose = Math.round(recommendedDose * 100) / 100;
      delta.hr = 20;
      decayMs = 180000;
      nurseResponse = `Atropine ${actualDose} mg IV push given. That's ${(actualDose / weightKg * 1000).toFixed(0)} mcg/kg (${(actualDose * 1000).toFixed(0)} mcg).`;
      techResponse = "Watching for rate increase...";
      decayIntent = { type: "intent_updateVitals", delta: { hr: -10 } as any };
      break;
    }
    case "morphine": {
      // 0.05-0.1 mg/kg IV (max 4mg)
      const recommendedDose = doseOrdered ?? Math.min(0.1 * weightKg, 4);
      const actualDose = Math.round(recommendedDose * 100) / 100;
      delta.hr = -5;
      decayMs = 240000;
      nurseResponse = `Morphine ${actualDose} mg IV given slowly. That's ${(actualDose / weightKg).toFixed(2)} mg/kg. Monitoring respiratory status.`;
      break;
    }
    case "prostaglandin":
    case "pge1":
    case "alprostadil": {
      // 0.05-0.1 mcg/kg/min infusion for ductal-dependent lesions
      const infusionRate = doseOrdered ?? 0.05;
      delta.spo2 = 5;
      delta.hr = -5;
      decayMs = 600000; // Continuous infusion
      nurseResponse = `PGE1 infusion started at ${infusionRate} mcg/kg/min. That's ${(infusionRate * weightKg).toFixed(2)} mcg/min total.`;
      techResponse = "Watching for duct reopening. Sats should improve.";
      break;
    }
    case "lidocaine": {
      // PALS: 1 mg/kg IV/IO bolus (max 100mg), then 20-50 mcg/kg/min infusion
      // Used for VF/pVT refractory to defibrillation
      const recommendedDose = doseOrdered ?? Math.min(1 * weightKg, 100);
      const actualDose = Math.round(recommendedDose);
      delta.hr = -5;
      decayMs = 600000;
      nurseResponse = `Lidocaine ${actualDose} mg IV bolus given. That's ${(actualDose / weightKg).toFixed(1)} mg/kg.`;
      techResponse = "Antiarrhythmic on board.";
      decayIntent = { type: "intent_updateVitals", delta: { hr: 3 } as any };
      break;
    }
    case "calcium":
    case "calcium_chloride":
    case "cacl": {
      // PALS: Calcium chloride 20 mg/kg IV slow push (max 2g) - only for hypocalcemia, hyperkalemia, Ca-blocker OD
      // CaCl2 10% = 100 mg/mL = 27.2 mg/mL elemental Ca
      const recommendedDose = doseOrdered ?? Math.min(20 * weightKg, 2000);
      const actualDose = Math.round(recommendedDose);
      const volumeMl = Math.round(actualDose / 100 * 10) / 10; // 10% solution
      delta.hr = 5;
      delta.sbpPerMin = 5;
      decayMs = 300000;
      nurseResponse = `Calcium chloride ${actualDose} mg (${volumeMl} mL of 10%) IV slow push over 30 seconds. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
      techResponse = "Monitoring for improved contractility.";
      break;
    }
    case "sodium_bicarbonate":
    case "bicarb":
    case "nahco3": {
      // PALS: 1 mEq/kg IV slow push - only for documented acidosis, hyperkalemia, TCA OD
      // 8.4% solution = 1 mEq/mL
      const recommendedDose = doseOrdered ?? weightKg; // 1 mEq/kg
      const actualDose = Math.round(recommendedDose);
      decayMs = 300000;
      nurseResponse = `Sodium bicarbonate ${actualDose} mEq (${actualDose} mL of 8.4%) IV slow push. That's ${(actualDose / weightKg).toFixed(1)} mEq/kg.`;
      techResponse = "Bicarb given. Check follow-up gas.";
      break;
    }
    case "magnesium":
    case "mag":
    case "mgso4": {
      // PALS: 25-50 mg/kg IV over 10-20 min (max 2g) - for torsades, hypomagnesemia
      const recommendedDose = doseOrdered ?? Math.min(50 * weightKg, 2000);
      const actualDose = Math.round(recommendedDose);
      delta.hr = -10;
      decayMs = 600000;
      nurseResponse = `Magnesium sulfate ${actualDose} mg IV over 15 minutes. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
      techResponse = "Magnesium infusing for rhythm stabilization.";
      break;
    }
    case "procainamide": {
      // PALS: 15 mg/kg IV over 30-60 min (max 17 mg/kg or 1g)
      // For SVT unresponsive to adenosine, wide-complex tachycardia
      const recommendedDose = doseOrdered ?? Math.min(15 * weightKg, 1000);
      const actualDose = Math.round(recommendedDose);
      delta.hr = -20;
      decayMs = 600000;
      nurseResponse = `Procainamide ${actualDose} mg IV infusing over 30 minutes. That's ${Math.round(actualDose / weightKg)} mg/kg. Monitoring BP and QRS.`;
      techResponse = "Watching QRS width and BP during infusion.";
      break;
    }

    // ===== CARDIOVERSION / DEFIBRILLATION =====
    case "cardioversion":
    case "sync_cardioversion": {
      // Synchronized cardioversion: 0.5-1 J/kg, may increase to 2 J/kg
      const joulesOrdered = joules ?? Math.round(0.5 * weightKg);
      delta.hr = -80; // Convert rhythm
      nurseResponse = `Synchronized cardioversion at ${joulesOrdered} J delivered. That's ${(joulesOrdered / weightKg).toFixed(1)} J/kg. Patient sedated.`;
      techResponse = "Shock delivered... watching rhythm... ";
      break;
    }
    case "defibrillation":
    case "defib": {
      // VF/pVT: 2 J/kg first, then 4 J/kg
      const joulesOrdered = joules ?? Math.round(2 * weightKg);
      delta.hr = 0; // Pulseless - either converts or stays in arrest
      nurseResponse = `Defibrillation at ${joulesOrdered} J delivered! That's ${(joulesOrdered / weightKg).toFixed(0)} J/kg. Resuming compressions.`;
      techResponse = "Shock delivered. Checking rhythm...";
      break;
    }

    // ===== OTHER TREATMENTS =====
    case "ibuprofen":
    case "motrin": {
      // 10 mg/kg PO (max 400mg)
      const recommendedDose = doseOrdered ?? Math.min(10 * weightKg, 400);
      const actualDose = Math.round(recommendedDose);
      delta.temp = -0.5;
      decayMs = 21600000; // 6 hours
      nurseResponse = `Ibuprofen ${actualDose} mg PO given. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
      break;
    }
    case "acetaminophen":
    case "tylenol": {
      // 15 mg/kg PO (max 1000mg)
      const recommendedDose = doseOrdered ?? Math.min(15 * weightKg, 1000);
      const actualDose = Math.round(recommendedDose);
      delta.temp = -0.5;
      decayMs = 14400000; // 4 hours
      nurseResponse = `Acetaminophen ${actualDose} mg PO given. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
      break;
    }
    case "aspirin":
    case "asa": {
      // Kawasaki: 80-100 mg/kg/day divided q6h (high dose) or 3-5 mg/kg/day (low dose)
      const recommendedDose = doseOrdered ?? Math.min(20 * weightKg, 650); // Single dose
      const actualDose = Math.round(recommendedDose);
      nurseResponse = `Aspirin ${actualDose} mg PO given. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
      break;
    }

    default:
      // Unknown treatment - nurse asks for clarification
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: `I need the medication name, dose, and route. Patient weighs ${weightKg} kg.`,
        character: "nurse",
      });
      return;
  }

  // Apply vitals changes
  runtime.scenarioEngine.applyVitalsAdjustment(delta);

  // Update rhythm based on new vitals (treatments affecting HR change the rhythm)
  const newRhythm = runtime.scenarioEngine.getDynamicRhythm();
  runtime.scenarioEngine.setRhythm(newRhythm, `treatment: ${treatmentType}`);

  const telemetryWaveform = runtime.scenarioEngine.getState().telemetry
    ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90)
    : undefined;

  maybeAdvanceStageFromTreatment(runtime, treatmentType);

  // Record in treatment history
  const history = runtime.scenarioEngine.getState().treatmentHistory ?? [];
  runtime.scenarioEngine.setTreatmentHistory([
    ...history,
    { ts: Date.now(), treatmentType: treatmentType ?? "unknown", note: nurseResponse },
  ]);

  // Broadcast updated state
  broadcastSimState(sessionId, {
    ...runtime.scenarioEngine.getState(),
    stageIds: runtime.scenarioEngine.getStageIds(),
    telemetryWaveform,
    treatmentHistory: runtime.scenarioEngine.getState().treatmentHistory,
  });

  // Nurse confirms dose
  if (nurseResponse) {
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: nurseResponse,
      character: "nurse",
    });
    if (techResponse && runtime.scenarioEngine.getState().telemetry) {
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: techResponse,
        character: "tech",
      });
    }
  }

  logSimEvent(sessionId, {
    type: "treatment.applied",
    payload: { treatmentType, weightKg, ...payload, nurseResponse },
  }).catch(() => {});

  // Schedule effect decay
  if (decayIntent) {
    setTimeout(() => {
      const rt = runtimes.get(sessionId);
      if (!rt) return;
      rt.scenarioEngine.applyIntent(decayIntent);
      broadcastSimState(sessionId, {
        ...rt.scenarioEngine.getState(),
        stageIds: rt.scenarioEngine.getStageIds(),
        telemetryWaveform: rt.scenarioEngine.getState().telemetry
          ? buildTelemetryWaveform(rt.scenarioEngine.getState().vitals.hr ?? 90)
          : undefined,
      });
    }, decayMs);
  }
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
        if (sessionId) sendDegradedNotice(sessionId, `${label.toUpperCase()} temporarily unavailable.`);
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

function maybeAdvanceStageFromTreatment(runtime: Runtime, treatmentType?: string) {
  const scenarioId = runtime.scenarioEngine.getState().scenarioId as PatientScenarioId;
  const stageId = runtime.scenarioEngine.getState().stageId;
  const t = (treatmentType ?? "").toLowerCase();
  if (scenarioId === "palpitations_svt" && stageId === "stage_2_episode" && t.includes("rate")) {
    runtime.scenarioEngine.setStage("stage_3_post_episode");
  }
  if (scenarioId === "ductal_shock" && stageId === "stage_1_shock" && (t.includes("fluid") || t.includes("bolus"))) {
    runtime.scenarioEngine.setStage("stage_2_improving");
  }
  if (scenarioId === "cyanotic_spell" && stageId === "stage_2_spell" && (t.includes("oxygen") || t.includes("knee") || t.includes("position"))) {
    runtime.scenarioEngine.setStage("stage_3_recovery");
  }
}
