import { z } from "zod";
import { ClientToServerMessage, PatientScenarioId } from "./messageTypes";

const joinSchema = z.object({
  type: z.literal("join"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().optional(),
  role: z.union([z.literal("presenter"), z.literal("participant")]),
  authToken: z.string().min(1).optional(),
});

const startSpeakingSchema = z.object({
  type: z.literal("start_speaking"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
});

const stopSpeakingSchema = z.object({
  type: z.literal("stop_speaking"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
});

const voiceCommandSchema = z.object({
  type: z.literal("voice_command"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  commandType: z.enum(["pause_ai", "resume_ai", "force_reply", "end_turn", "mute_user"]),
  payload: z.record(z.any()).optional(),
});

const doctorAudioSchema = z.object({
  type: z.literal("doctor_audio"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  audioBase64: z.string().min(1),
  contentType: z.string().min(1),
});

const setScenarioSchema = z.object({
  type: z.literal("set_scenario"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  scenarioId: z.custom<PatientScenarioId>((val: unknown) => typeof val === "string" && val.length > 0),
});

const analyzeTranscriptSchema = z.object({
  type: z.literal("analyze_transcript"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  turns: z.array(
    z.object({
      role: z.union([z.literal("doctor"), z.literal("patient")]),
      text: z.string(),
      timestamp: z.number().optional(),
    })
  ),
});

const pingSchema = z.object({
  type: z.literal("ping"),
  sessionId: z.string().optional(),
});

const messageSchema = z.discriminatedUnion("type", [
  joinSchema,
  startSpeakingSchema,
  stopSpeakingSchema,
  voiceCommandSchema,
  doctorAudioSchema,
  setScenarioSchema,
  analyzeTranscriptSchema,
  pingSchema,
]);

export function validateMessage(msg: unknown): ClientToServerMessage | null {
  const parsed = messageSchema.safeParse(msg);
  if (!parsed.success) return null;
  return parsed.data as ClientToServerMessage;
}
