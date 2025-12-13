/**
 * useTranscriptManager - Manages transcript state for presenter sessions.
 * Extracted from PresenterSession.tsx for better maintainability.
 *
 * Handles:
 * - Transcript turns (live voice turns)
 * - Transcript log (persistent transcript history)
 * - Timeline extras (NPC interjections, assessments, etc.)
 * - Turn ID management for correlating doctor/patient turns
 */

import React, { useState, useCallback, useRef, useMemo } from "react";
import { TranscriptTurn } from "../components/VoicePatientOverlay";
import { TranscriptLogTurn } from "../components/SessionTranscriptPanel";
import { CharacterId } from "../types/voiceGateway";

export type TimelineExtra = {
  id: string;
  ts: number;
  label: string;
  detail: string;
};

export type TranscriptManagerState = {
  transcriptTurns: TranscriptTurn[];
  transcriptLog: TranscriptLogTurn[];
  timelineExtras: TimelineExtra[];
  patientAudioUrl: string | null;
  doctorQuestionText: string;
};

export type TranscriptManagerActions = {
  setTranscriptTurns: React.Dispatch<React.SetStateAction<TranscriptTurn[]>>;
  setTranscriptLog: React.Dispatch<React.SetStateAction<TranscriptLogTurn[]>>;
  setTimelineExtras: React.Dispatch<React.SetStateAction<TimelineExtra[]>>;
  setPatientAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setDoctorQuestionText: React.Dispatch<React.SetStateAction<string>>;
  makeTurnId: () => string;
  logDoctorQuestion: (text?: string) => void;
  clearTranscript: () => void;
  resetTranscriptState: () => void;
};

export type TranscriptManagerRefs = {
  currentTurnIdRef: React.MutableRefObject<string | null>;
  currentTurnCharacterRef: React.MutableRefObject<string | undefined>;
  lastDoctorTurnIdRef: React.MutableRefObject<string | null>;
  lastAutoForcedRef: React.MutableRefObject<string | null>;
  loggedOrderIdsRef: React.MutableRefObject<Set<string>>;
};

export type TranscriptManagerResult = TranscriptManagerState &
  TranscriptManagerActions & {
    refs: TranscriptManagerRefs;
    transcriptText: string;
  };

export function useTranscriptManager(): TranscriptManagerResult {
  // Core state
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptTurn[]>([]);
  const [transcriptLog, setTranscriptLog] = useState<TranscriptLogTurn[]>([]);
  const [timelineExtras, setTimelineExtras] = useState<TimelineExtra[]>([]);
  const [patientAudioUrl, setPatientAudioUrl] = useState<string | null>(null);
  const [doctorQuestionText, setDoctorQuestionText] = useState<string>("");

  // Refs for tracking turn correlation
  const currentTurnIdRef = useRef<string | null>(null);
  const currentTurnCharacterRef = useRef<string | undefined>("patient");
  const lastDoctorTurnIdRef = useRef<string | null>(null);
  const lastAutoForcedRef = useRef<string | null>(null);
  const loggedOrderIdsRef = useRef<Set<string>>(new Set());

  // Generate unique turn IDs
  const makeTurnId = useCallback(
    () => `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  // Log doctor questions with correlation tracking
  const logDoctorQuestion = useCallback(
    (text?: string) => {
      const questionText = text?.trim();
      if (!questionText) return;
      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      lastDoctorTurnIdRef.current = id;
      setTranscriptLog((prev) => [
        ...prev,
        { id, role: "doctor", timestamp: Date.now(), text: questionText },
      ]);
      setDoctorQuestionText(questionText);
    },
    []
  );

  // Clear live transcript turns
  const clearTranscript = useCallback(() => {
    currentTurnIdRef.current = null;
    setTranscriptTurns([]);
  }, []);

  // Reset all transcript state (e.g., on scenario change)
  const resetTranscriptState = useCallback(() => {
    setTranscriptTurns([]);
    setTranscriptLog([]);
    setPatientAudioUrl(null);
    setDoctorQuestionText("");
    lastDoctorTurnIdRef.current = null;
    currentTurnIdRef.current = null;
    lastAutoForcedRef.current = null;
  }, []);

  // Computed transcript text for exports
  const transcriptText = useMemo(() => {
    const parts: string[] = [];
    transcriptLog.forEach((t) => {
      const ts = new Date(t.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const speaker = t.character ?? t.role ?? "unknown";
      parts.push(`${ts} ${speaker}: ${t.text}`);
    });
    return parts.join("\n");
  }, [transcriptLog]);

  return {
    // State
    transcriptTurns,
    transcriptLog,
    timelineExtras,
    patientAudioUrl,
    doctorQuestionText,

    // Actions
    setTranscriptTurns,
    setTranscriptLog,
    setTimelineExtras,
    setPatientAudioUrl,
    setDoctorQuestionText,
    makeTurnId,
    logDoctorQuestion,
    clearTranscript,
    resetTranscriptState,

    // Refs
    refs: {
      currentTurnIdRef,
      currentTurnCharacterRef,
      lastDoctorTurnIdRef,
      lastAutoForcedRef,
      loggedOrderIdsRef,
    },

    // Computed
    transcriptText,
  };
}
