import "dotenv/config";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { SessionManager } from "./sessionManager";
import { ClientToServerMessage, ServerToClientMessage } from "./messageTypes";
import { log, logError } from "./logger";
import { getOpenAIClient, MODEL } from "./openaiClient";
import { getOrCreatePatientEngine, setScenarioForSession, getScenarioForSession } from "./patientEngine";
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
import { persistSimState, logSimEvent } from "./persistence";
import { validateMessage } from "./validators";
import { getAuth } from "./firebaseAdmin";

const PORT = Number(process.env.PORT || 8081);
const sessionManager = new SessionManager();
const eventLog = new InMemoryEventLog();
const realtimeModel = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-mini-realtime-preview";
const realtimeApiKey = process.env.OPENAI_API_KEY || "";
const softBudgetUsd = Number(process.env.SOFT_BUDGET_USD || 3.5);
const hardBudgetUsd = Number(process.env.HARD_BUDGET_USD || 4.5);
const allowInsecureWs = process.env.ALLOW_INSECURE_VOICE_WS !== "false";

type Runtime = {
  realtime?: RealtimePatientClient;
  fallback: boolean;
  scenarioEngine: ScenarioEngine;
  toolGate: ToolGate;
  cost: CostController;
};

const runtimes: Map<string, Runtime> = new Map();

type ClientContext = {
  joined: boolean;
  sessionId: string | null;
  role: "presenter" | "participant" | null;
};

function send(ws: WebSocket, msg: ServerToClientMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

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
      ws.close();
      return;
    }
    ctx.joined = true;
    ctx.sessionId = parsed.sessionId;
    ctx.role = parsed.role;
    sessionManager.addClient(parsed.sessionId, parsed.role, ws);
    send(ws, { type: "joined", sessionId: parsed.sessionId, role: parsed.role });
    log("Client joined", parsed.sessionId, parsed.role, parsed.userId);
    return;
  }

  if (!ctx.joined || !ctx.sessionId || !ctx.role) {
    send(ws, { type: "error", message: "Must join first" });
    return;
  }

  switch (parsed.type) {
    case "start_speaking": {
      const result = sessionManager.requestFloor(ctx.sessionId, parsed.userId);
      if (!result.granted) {
        send(ws, { type: "error", message: "floor_taken" });
        return;
      }
      if (result.previous && result.previous !== parsed.userId) {
        sessionManager.broadcastToSession(ctx.sessionId, {
          type: "participant_state",
          sessionId: ctx.sessionId,
          userId: result.previous,
          speaking: false,
        });
      }
      sessionManager.broadcastToSession(ctx.sessionId, {
        type: "participant_state",
        sessionId: ctx.sessionId,
        userId: parsed.userId,
        speaking: true,
      });
      break;
    }
    case "stop_speaking": {
      const released = sessionManager.releaseFloor(ctx.sessionId, parsed.userId);
      sessionManager.broadcastToSession(ctx.sessionId, {
        type: "participant_state",
        sessionId: ctx.sessionId,
        userId: parsed.userId,
        speaking: false,
      });
      if (!released) {
        log("stop_speaking ignored (not floor holder)", ctx.sessionId, parsed.userId);
      }
      break;
    }
    case "doctor_audio": {
      handleDoctorAudio(ctx.sessionId, parsed.userId, parsed.audioBase64, parsed.contentType);
      break;
    }
    case "set_scenario": {
      handleScenarioChange(ctx.sessionId, parsed.scenarioId);
      break;
    }
    case "analyze_transcript": {
      handleAnalyzeTranscript(ctx.sessionId, parsed.turns);
      break;
    }
    case "voice_command": {
      log("Voice command", parsed.commandType, "by", parsed.userId, "session", ctx.sessionId);
      const runtime = ensureRuntime(ctx.sessionId);
      switch (parsed.commandType) {
        case "force_reply": {
          const doctorUtterance =
            typeof parsed.payload?.doctorUtterance === "string"
              ? parsed.payload.doctorUtterance.trim()
              : undefined;
          handleForceReply(ctx.sessionId, parsed.userId, doctorUtterance);
          break;
        }
        case "pause_ai":
        case "freeze": {
          sessionManager.broadcastToSession(ctx.sessionId, {
            type: "patient_state",
            sessionId: ctx.sessionId,
            state: "idle",
          });
          runtime.fallback = true;
          sessionManager.setFallback(ctx.sessionId, true);
          broadcastSimState(ctx.sessionId, {
            ...runtime.scenarioEngine.getState(),
            stageIds: runtime.scenarioEngine.getStageIds(),
            fallback: true,
            budget: runtime.cost.getState?.() ?? undefined,
          });
          break;
        }
        case "resume_ai":
        case "unfreeze": {
          runtime.fallback = false;
          sessionManager.setFallback(ctx.sessionId, false);
          sessionManager.broadcastToSession(ctx.sessionId, {
            type: "patient_state",
            sessionId: ctx.sessionId,
            state: "listening",
          });
          broadcastSimState(ctx.sessionId, {
            ...runtime.scenarioEngine.getState(),
            stageIds: runtime.scenarioEngine.getStageIds(),
            fallback: false,
            budget: runtime.cost.getState?.() ?? undefined,
          });
          break;
        }
        case "end_turn": {
          sessionManager.broadcastToSession(ctx.sessionId, {
            type: "patient_state",
            sessionId: ctx.sessionId,
            state: "idle",
          });
          break;
        }
        case "skip_stage": {
          const stageId = typeof parsed.payload?.stageId === "string" ? parsed.payload.stageId : undefined;
          if (stageId) {
            runtime.scenarioEngine.setStage(stageId);
            broadcastSimState(ctx.sessionId, {
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
  const server = http.createServer();
  const wss = new WebSocketServer({ server, path: "/ws/voice" });

  wss.on("connection", (ws) => {
    const ctx: ClientContext = { joined: false, sessionId: null, role: null };

    ws.on("message", (data) => {
      void handleMessage(ws, ctx, data);
    });

    ws.on("close", () => {
      if (ctx.joined && ctx.sessionId && ctx.role) {
        sessionManager.removeClient(ctx.sessionId, ctx.role, ws);
        log("Client disconnected", ctx.sessionId, ctx.role);
      }
    });

    ws.on("error", (err) => {
      logError("Socket error", err);
    });
  });

  server.listen(PORT, () => {
    log(`Voice gateway listening on :${PORT} (path: /ws/voice)`);
  });
}

async function handleForceReply(sessionId: string, userId: string, doctorUtterance?: string) {
  const openai = getOpenAIClient();
  if (!openai) {
    log("OPENAI_API_KEY not set; using stub patient response");
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "speaking",
    });
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: "Hi doctor, I’m here as a test patient.",
    });
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "idle",
    });
    return;
  }

  const engine = getOrCreatePatientEngine(sessionId);
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
    });

    const messages = engine.getHistory();
    let fullText = "";

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
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
      });
    }

    const finalText = fullText.trim();
    engine.appendPatientTurn(finalText);

    const audioBuffer = await synthesizePatientAudio(finalText);
    if (audioBuffer) {
      sessionManager.broadcastToPresenters(sessionId, {
        type: "patient_audio",
        sessionId,
        audioBase64: audioBuffer.toString("base64"),
      });
    }

    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "idle",
    });
    log("Patient reply complete", sessionId, "chars:", fullText.length);
  } catch (err) {
    logError("OpenAI force_reply error", err);
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "error",
    });
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: "I'm sorry, I'm having trouble answering right now.",
    });
  }
}

function handleScenarioChange(sessionId: string, scenarioId: PatientScenarioId) {
  const allowed: PatientScenarioId[] = [
    "exertional_chest_pain",
    "syncope",
    "palpitations_svt",
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
  contentType: string
) {
  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    log("Doctor audio received", sessionId, "bytes:", audioBuffer.length);
    if (sessionManager.isFallback(sessionId)) {
      log("Session in fallback; routing legacy STT only", sessionId);
      await handleDoctorAudioLegacy(sessionId, userId, audioBuffer, contentType);
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
      return;
    }
    await handleDoctorAudioLegacy(sessionId, userId, audioBuffer, contentType);
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
  contentType: string
) {
  const text = await transcribeDoctorAudio(audioBuffer, contentType);
  if (text && text.trim().length > 0) {
    log("STT transcript", sessionId, text.slice(0, 120));
    sessionManager.broadcastToPresenters(sessionId, {
      type: "doctor_utterance",
      sessionId,
      userId,
      text,
    });
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
  broadcastSimState(sessionId, { ...runtime.scenarioEngine.getState(), stageIds: runtime.scenarioEngine.getStageIds() });
  return runtime;
}

function handleToolIntent(sessionId: string, intent: ToolIntent) {
  const runtime = ensureRuntime(sessionId);
  const stageId = runtime.scenarioEngine.getState().stageId;
  const stageDef = runtime.scenarioEngine.getStageDef(stageId);
  const decision = runtime.toolGate.validate(sessionId, stageDef, intent);
  if (!decision.allowed) {
    eventLog.append({
      id: `${Date.now()}-${Math.random()}`,
      ts: Date.now(),
      simId: sessionId,
      type: "tool.intent.rejected",
      payload: { intent, reason: decision.reason },
    });
    return;
  }
  const result = runtime.scenarioEngine.applyIntent(intent);
  eventLog.append({
    id: `${Date.now()}-${Math.random()}`,
    ts: Date.now(),
    simId: sessionId,
    type: "tool.intent.approved",
    payload: intent as any,
  });
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
  broadcastSimState(sessionId, result.nextState);
}

function handleBudgetSoftLimit(sessionId: string) {
  logSimEvent(sessionId, { type: "budget.soft_limit" }).catch(() => {});
  console.warn("[budget] soft limit reached", sessionId);
}

function handleBudgetHardLimit(sessionId: string) {
  const runtime = runtimes.get(sessionId);
  logSimEvent(sessionId, { type: "budget.hard_limit" }).catch(() => {});
  console.warn("[budget] hard limit reached, switching to fallback", sessionId);
  if (runtime) {
    runtime.fallback = true;
    runtime.scenarioEngine.setFallback(true);
    runtime.realtime?.close();
    sessionManager.setFallback(sessionId, true);
    broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      fallback: true,
    });
  }
}

function broadcastSimState(
  sessionId: string,
  state: { stageId: string; vitals: any; fallback: boolean; budget?: any; stageIds?: string[]; scenarioId?: string }
) {
  sessionManager.broadcastToSession(sessionId, {
    type: "sim_state",
    sessionId,
    stageId: state.stageId,
    scenarioId: (state.scenarioId ?? getScenarioForSession(sessionId)) as PatientScenarioId,
    stageIds: state.stageIds,
    vitals: state.vitals,
    fallback: state.fallback,
    budget: state.budget,
  });
  persistSimState(sessionId, state as any).catch(() => {});
}

function buildSystemPrompt(scenario: PatientScenarioId): string {
  const persona =
    scenario === "syncope"
      ? "You are a teen with exertional syncope. Answer as the patient with short, concrete answers. Do not diagnose or recommend treatments."
      : scenario === "palpitations_svt"
      ? "You are a teen with recurrent palpitations. Stay in character with short answers, no diagnoses or treatments."
      : "You are a teen with exertional chest pain. Stay in character with short answers, no diagnoses or treatments.";
  return `${persona}\nKeep answers to 1-3 sentences. If unsure, say you are not sure.`;
}

main();
