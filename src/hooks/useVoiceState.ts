import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp, db } from "../utils/firestore";
import { VoiceState, VoiceMode } from "../types";

export const defaultVoiceState: VoiceState = {
  enabled: false,
  floorHolderId: null,
  floorHolderName: null,
  since: null,
  mode: "idle",
};

function normalizeVoiceState(raw: Partial<VoiceState> | undefined | null): VoiceState {
  if (!raw) return defaultVoiceState;
  return {
    enabled: Boolean(raw.enabled),
    floorHolderId: raw.floorHolderId ?? null,
    floorHolderName: raw.floorHolderName ?? null,
    since: raw.since ?? null,
    mode: (raw.mode as VoiceMode) ?? "idle",
  };
}

export function useVoiceState(sessionId?: string | null) {
  const [voice, setVoice] = useState<VoiceState>(defaultVoiceState);

  useEffect(() => {
    if (!sessionId) {
      setVoice(defaultVoiceState);
      return;
    }
    const ref = doc(db, "sessions", sessionId);
    const unsub = onSnapshot(ref, (snap: any) => {
      const data = snap.data?.() ?? snap.data();
      const voiceData = data?.voice;
      setVoice(normalizeVoiceState(voiceData));
    });
    return () => unsub();
  }, [sessionId]);

  return voice;
}

export async function takeFloor(
  sessionId: string,
  user: { uid: string; displayName?: string | null }
) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    "voice.floorHolderId": user.uid,
    "voice.floorHolderName": user.displayName ?? "Resident",
    "voice.since": serverTimestamp(),
    "voice.mode": "resident-speaking" as VoiceMode,
  });
}

export async function releaseFloor(sessionId: string) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    "voice.floorHolderId": null,
    "voice.floorHolderName": null,
    "voice.since": null,
    "voice.mode": "idle" as VoiceMode,
  });
}

export async function setAIMode(sessionId: string) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { "voice.mode": "ai-speaking" as VoiceMode });
}

export async function setVoiceEnabled(sessionId: string, enabled: boolean) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    "voice.enabled": enabled,
    "voice.mode": enabled ? ("idle" as VoiceMode) : ("idle" as VoiceMode),
    "voice.floorHolderId": enabled ? null : null,
    "voice.floorHolderName": enabled ? null : null,
    "voice.since": enabled ? null : null,
  });
}
