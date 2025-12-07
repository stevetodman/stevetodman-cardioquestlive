import { addDoc, collection, db, serverTimestamp } from "../utils/firestore";
import { auth, ensureSignedIn, isConfigured } from "../firebase";
import { VoiceCommandType, VoiceCommandDoc } from "../types";
import { CharacterId } from "../types/voiceGateway";

export async function sendVoiceCommand(
  sessionId: string,
  cmd: { type: VoiceCommandType; payload?: Record<string, any>; character?: CharacterId }
) {
  if (isConfigured) {
    await ensureSignedIn();
  }
  const createdBy = auth?.currentUser?.uid ?? "local";
  const ref = collection(db, "sessions", sessionId, "voiceCommands");
  const doc: VoiceCommandDoc = {
    type: cmd.type,
    createdAt: serverTimestamp(),
    createdBy,
  };
  if (cmd.payload !== undefined) {
    (doc as any).payload = cmd.payload;
  }
  if (cmd.character) {
    (doc as any).character = cmd.character;
  }
  await addDoc(ref, doc as any);
}
