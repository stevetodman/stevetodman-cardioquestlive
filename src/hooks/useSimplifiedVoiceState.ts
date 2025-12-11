import { useMemo } from "react";
import { VoiceConnectionStatus } from "../types/voiceGateway";
import { MicStatus } from "../services/VoicePatientService";
import { VoiceStatusBadgeProps } from "../components/VoiceStatusBadge";
import { VoiceState } from "../types";

export interface SimplifiedVoiceState extends VoiceStatusBadgeProps {
  insecureMode?: boolean;
}

interface SimplifiedVoiceStateOptions {
  voice: VoiceState;
  connectionStatus: VoiceConnectionStatus;
  micStatus: MicStatus;
  fallbackActive: boolean;
  userId: string | null;
  queueCount?: number;
  mockStatus?: "ready" | "waiting" | "unavailable" | "active";
  insecureMode?: boolean;
}

export function useSimplifiedVoiceState({
  voice,
  connectionStatus,
  micStatus,
  fallbackActive,
  userId,
  queueCount = 0,
  mockStatus,
  insecureMode = false,
}: SimplifiedVoiceStateOptions): SimplifiedVoiceState {
  return useMemo(() => {
    const baseInsecure = insecureMode;
    if (mockStatus) {
      if (mockStatus === "ready") return { status: "ready", message: "Ready to speak", detail: "Mock voice ready" };
      if (mockStatus === "waiting")
        return { status: "waiting", message: "Another resident is speaking", detail: "Mock queue" };
      if (mockStatus === "active") return { status: "active", message: "Recording", detail: "Mock speaking" };
      return { status: "unavailable", message: "Voice paused", detail: "Mock unavailable" };
    }

    if (!voice.enabled) {
      return {
        status: "unavailable",
        message: "Voice not available",
        detail: "Waiting for presenter to enable voice mode",
      };
    }

    if (voice.locked) {
      return {
        status: "unavailable",
        message: "Voice locked",
        detail: "Presenter has temporarily locked voice interactions",
      };
    }

    if (connectionStatus.state === "error" && connectionStatus.reason === "unauthorized") {
      return {
        status: "unavailable",
        message: "Sign back in to use voice",
        detail: "Your session has expired. Please sign back in.",
      };
    }

    if (connectionStatus.state === "disconnected" || connectionStatus.state === "error") {
      return {
        status: "unavailable",
        message: "Voice disconnected",
        detail: connectionStatus.reason === "reconnecting" ? "Reconnecting to voice system..." : "Connection lost",
      };
    }

    if (connectionStatus.state === "connecting") {
      return {
        status: "unavailable",
        message: "Voice connecting",
        detail: "Establishing connection, please wait",
      };
    }

    if (micStatus === "blocked") {
      return {
        status: "unavailable",
        message: "Microphone blocked",
        detail: "Enable microphone in browser settings to speak",
      };
    }

    if (fallbackActive) {
      return {
        status: "unavailable",
        message: "Voice paused",
        detail: "Budget limit reached. Presenter can resume voice mode.",
      };
    }

    if (voice.mode === "ai-speaking") {
      return {
        status: "active",
        message: "Patient is responding",
        detail: "Listen to the patient's answer",
      };
    }

    if (voice.floorHolderId && voice.floorHolderId !== userId) {
      return {
        status: "waiting",
        message: `${voice.floorHolderName ?? "Another resident"} is speaking`,
        detail:
          queueCount > 1
            ? `${queueCount} residents in queue`
            : queueCount === 1
            ? "1 resident waiting"
            : "You can speak when they finish",
      };
    }

    if (voice.mode === "resident-speaking" && voice.floorHolderId === userId) {
      return {
        status: "active",
        message: "You're speaking",
        detail: "Hold the button to continue recording",
      };
    }

    return {
      status: "ready",
      message: "Ready to speak",
      detail: "Hold the button below to ask the patient a question",
      insecureMode: baseInsecure,
    };
  }, [voice, connectionStatus.state, connectionStatus.reason, micStatus, fallbackActive, userId, queueCount, insecureMode]);
}
