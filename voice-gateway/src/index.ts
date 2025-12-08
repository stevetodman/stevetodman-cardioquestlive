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

const PORT = Number(process.env.PORT || 8081);
const sessionManager = new SessionManager();
const eventLog = new InMemoryEventLog();
const lastCommandAt: Map<string, number> = new Map();
const realtimeModel = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-mini-realtime-preview";
const realtimeApiKey = process.env.OPENAI_API_KEY || "";
const softBudgetUsd = Number(process.env.SOFT_BUDGET_USD || 3.5);
const hardBudgetUsd = Number(process.env.HARD_BUDGET_USD || 4.5);
const scenarioHeartbeatMs = Number(process.env.SCENARIO_HEARTBEAT_MS || 1000);
const commandCooldownMs = Number(process.env.COMMAND_COOLDOWN_MS || 3000);
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
          handleExamRequest(simId);
          break;
        }
        case "toggle_telemetry": {
          const enabled = parsed.payload?.enabled === true;
          handleTelemetryToggle(simId, enabled);
          break;
        }
        case "treatment": {
          const treatmentType = typeof parsed.payload?.treatmentType === "string" ? parsed.payload.treatmentType : undefined;
          handleTreatment(simId, treatmentType);
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

    const audioBuffer = await synthesizePatientAudio(finalText, CHARACTER_VOICE_MAP[routedCharacter]);
    if (audioBuffer) {
      sessionManager.broadcastToPresenters(sessionId, {
        type: "patient_audio",
        sessionId,
        audioBase64: audioBuffer.toString("base64"),
        character: routedCharacter,
      });
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
  const text = await transcribeDoctorAudio(audioBuffer, contentType);
  if (text && text.trim().length > 0) {
    log("STT transcript", sessionId, text.slice(0, 120));
    broadcastDoctorUtterance(sessionId, userId, text, character);
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
  sessionManager.broadcastToSession(sessionId, {
    type: "sim_state",
    sessionId,
    stageId: validated.stageId,
    stageIds: validated.stageIds,
    scenarioId: (validated.scenarioId ?? getScenarioForSession(sessionId)) as PatientScenarioId,
    stageIds: validated.stageIds,
    vitals: validated.vitals ?? {},
    exam: validated.exam ?? {},
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
  });
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

function handleExamRequest(sessionId: string) {
  const runtime = ensureRuntime(sessionId);
  const exam = runtime.scenarioEngine.getState().exam ?? {};
  const maneuver = (runtime as any).lastManeuver as string | undefined;
  const summary = [
    exam.general && `General: ${exam.general}`,
    exam.cardio && `CV: ${exam.cardio}`,
    exam.lungs && `Lungs: ${exam.lungs}`,
    exam.perfusion && `Perfusion: ${exam.perfusion}`,
    exam.neuro && `Neuro: ${exam.neuro}`,
  ]
    .filter(Boolean)
    .join(" | ");
  const text = summary || "Exam unchanged from prior check.";
  const audioUrl = (exam as any).audioUrl as string | undefined;
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_state",
    sessionId,
    state: "speaking",
    character: "nurse",
  });
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_transcript_delta",
    sessionId,
    text: maneuver ? `${maneuver}: ${text}` : text,
    character: "nurse",
  });
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_state",
    sessionId,
    state: "idle",
    character: "nurse",
  });
  logSimEvent(sessionId, { type: "exam.requested", payload: { maneuver: maneuver ?? "standard" } }).catch(() => {});
  if (audioUrl) {
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_audio",
      sessionId,
      audioBase64: "",
      character: "nurse",
    });
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: `Heart sounds: ${audioUrl}`,
      character: "nurse",
    });
  }
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

function handleTreatment(sessionId: string, treatmentType?: string) {
  const runtime = ensureRuntime(sessionId);
  const key = `${sessionId}:${(treatmentType ?? "").toLowerCase()}`;
  const now = Date.now();
  const last = lastTreatmentAt.get(key) || 0;
  if (now - last < 8000) {
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
  let note = "";
  let decayMs = 120000; // effects decay over ~2 minutes
  let rhythmNote: string | undefined;
  let decayIntent: ToolIntent | null = null;
  switch ((treatmentType ?? "").toLowerCase()) {
    case "oxygen":
    case "o2":
      delta.spo2 = 3;
      delta.hr = -3;
      note = "Oxygen applied";
      rhythmNote = "Improved oxygenation, rate easing slightly.";
      decayIntent = { type: "intent_updateVitals", delta: { spo2: -2, hr: 2 } as any };
      break;
    case "fluids":
    case "bolus":
      delta.hr = -4;
      delta.sbpPerMin = 6;
      delta.dbpPerMin = 4;
      note = "Fluid bolus given";
      rhythmNote = "Perfusion improving with fluids.";
      decayIntent = { type: "intent_updateVitals", delta: { hr: 2, sbpPerMin: -4, dbpPerMin: -3 } as any };
      break;
    case "position":
    case "knee-chest":
      delta.spo2 = 4;
      delta.hr = -5;
      note = "Position changed (knee-chest)";
      rhythmNote = "Squatting/knee-chest reduces shunt; sats improving.";
      decayIntent = { type: "intent_updateVitals", delta: { spo2: -3, hr: 3 } as any };
      break;
    case "medication":
    case "rate-control":
      delta.hr = -10;
      delta.spo2 = 1;
      decayMs = 180000;
      note = "Rate control medication administered";
      rhythmNote = "Rate slowing after medication.";
      decayIntent = { type: "intent_updateVitals", delta: { hr: 6, spo2: -1 } as any };
      break;
    default:
      return;
  }
  runtime.scenarioEngine.applyVitalsAdjustment(delta);
  const telemetryWaveform = runtime.scenarioEngine.getState().telemetry
    ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90)
    : undefined;
  maybeAdvanceStageFromTreatment(runtime, treatmentType);
  const history = runtime.scenarioEngine.getState().treatmentHistory ?? [];
  runtime.scenarioEngine.setTreatmentHistory([
    ...history,
    { ts: Date.now(), treatmentType: treatmentType ?? "unknown", note },
  ]);
  broadcastSimState(sessionId, {
    ...runtime.scenarioEngine.getState(),
    stageIds: runtime.scenarioEngine.getStageIds(),
    telemetryWaveform,
    treatmentHistory: runtime.scenarioEngine.getState().treatmentHistory,
  });
  if (note) {
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: `${note}. Vitals updating.`,
      character: "nurse",
    });
    if (rhythmNote && runtime.scenarioEngine.getState().telemetry) {
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: rhythmNote,
        character: "tech",
      });
    }
  }
  logSimEvent(sessionId, { type: "treatment.applied", payload: { treatmentType, note } }).catch(() => {});

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
