import { z } from "zod";
import { CharacterId, ClientToServerMessage, PatientScenarioId } from "./messageTypes";

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
  character: z.custom<CharacterId>((val: unknown) => typeof val === "string").optional(),
});

const stopSpeakingSchema = z.object({
  type: z.literal("stop_speaking"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  character: z.custom<CharacterId>((val: unknown) => typeof val === "string").optional(),
});

const voiceCommandSchema = z.object({
  type: z.literal("voice_command"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  character: z.custom<CharacterId>((val: unknown) => typeof val === "string").optional(),
  commandType: z.enum([
    "pause_ai",
    "resume_ai",
    "force_reply",
    "end_turn",
    "mute_user",
    "freeze",
    "unfreeze",
    "skip_stage",
    "order",
  ]),
  payload: z.record(z.any()).optional(),
});

const doctorAudioSchema = z.object({
  type: z.literal("doctor_audio"),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  character: z.custom<CharacterId>((val: unknown) => typeof val === "string").optional(),
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

const simStateSchema = z
  .object({
    stageId: z.string().min(1),
    stageIds: z.array(z.string().min(1)).optional(),
    scenarioId: z
      .union([
        z.literal("exertional_chest_pain"),
        z.literal("syncope"),
        z.literal("palpitations_svt"),
      ])
      .optional(),
    vitals: z
      .object({
        hr: z.number().optional(),
        bp: z.string().optional(),
        rr: z.number().optional(),
        spo2: z.number().optional(),
        temp: z.number().optional(),
      })
      .optional(),
    findings: z.array(z.string()).optional(),
    fallback: z.boolean(),
    budget: z
      .object({
        usdEstimate: z.number().optional(),
        voiceSeconds: z.number().optional(),
        throttled: z.boolean().optional(),
        fallback: z.boolean().optional(),
      })
      .optional(),
    orders: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum(["vitals", "ekg", "labs", "imaging"]),
          status: z.enum(["pending", "complete"]),
          result: z
            .object({
              type: z.enum(["vitals", "ekg", "labs", "imaging"]),
              hr: z.number().optional(),
              bp: z.string().optional(),
              rr: z.number().optional(),
              spo2: z.number().optional(),
              temp: z.number().optional(),
              summary: z.string().optional(),
            })
            .partial()
            .optional(),
          completedAt: z.number().optional(),
        })
      )
      .optional(),
  })
  .passthrough();

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

export function validateSimStateMessage(msg: unknown) {
  const parsed = simStateSchema.safeParse(msg);
  if (!parsed.success) return null;
  return parsed.data;
}
