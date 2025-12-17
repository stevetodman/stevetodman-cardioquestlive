/**
 * usePresenterVoice - Handles voice gateway subscriptions and callbacks for presenter view.
 * Extracted from PresenterSession to reduce component complexity.
 */
import React, { useEffect, useRef, useCallback } from "react";
import { voiceGatewayClient } from "../services/VoiceGatewayClient";
import { useSimulation, useDebrief, type TranscriptLogTurn } from "../contexts";
import type { TranscriptTurn } from "../components/VoicePatientOverlay";
import type { CharacterId } from "../types/voiceGateway";

interface UsePresenterVoiceOptions {
  sessionId: string | undefined;
  autoForceReply: boolean;
  setTranscriptTurns: React.Dispatch<React.SetStateAction<TranscriptTurn[]>>;
  setDoctorQuestionText: React.Dispatch<React.SetStateAction<string>>;
  setVoiceInsecureMode: React.Dispatch<React.SetStateAction<boolean>>;
  forceReplyWithQuestion: (text?: string) => void;
}

interface UsePresenterVoiceReturn {
  currentTurnIdRef: React.MutableRefObject<string | null>;
  currentTurnCharacterRef: React.MutableRefObject<string | undefined>;
  lastDoctorTurnIdRef: React.MutableRefObject<string | null>;
  lastAutoForcedRef: React.MutableRefObject<string | null>;
  loggedOrderIdsRef: React.MutableRefObject<Set<string>>;
  characterAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
  makeTurnId: () => string;
}

export function usePresenterVoice({
  sessionId,
  autoForceReply,
  setTranscriptTurns,
  setDoctorQuestionText,
  setVoiceInsecureMode,
  forceReplyWithQuestion,
}: UsePresenterVoiceOptions): UsePresenterVoiceReturn {
  // Get context values
  const {
    setSimState,
    setPatientState,
    setGatewayStatus,
    setActiveCharacter,
    setAvailableStages,
    setSelectedStage,
    selectedStage,
    setBudgetAlert,
    setAlarmNotice,
    setPatientAudioUrl,
    setTranscriptLog,
  } = useSimulation();

  const {
    setIsAnalyzing,
    setDebriefResult,
    setComplexDebriefResult,
  } = useDebrief();

  // Refs for tracking turns
  const currentTurnIdRef = useRef<string | null>(null);
  const currentTurnCharacterRef = useRef<string | undefined>("patient");
  const lastDoctorTurnIdRef = useRef<string | null>(null);
  const lastAutoForcedRef = useRef<string | null>(null);
  const loggedOrderIdsRef = useRef<Set<string>>(new Set());
  const characterAudioRef = useRef<HTMLAudioElement | null>(null);

  const makeTurnId = useCallback(
    () => `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  // Voice gateway subscriptions
  useEffect(() => {
    const unsubStatus = voiceGatewayClient.onStatus((status) => {
      setGatewayStatus(status);
      if (status.state === "ready") {
        setVoiceInsecureMode(voiceGatewayClient.isInsecureMode());
      }
    });

    const unsubSim = voiceGatewayClient.onSimState((state) => {
      setSimState(state as any);
      setAvailableStages(state.stageIds ?? []);
      if (!selectedStage && state.stageIds && state.stageIds.length > 0) {
        setSelectedStage(state.stageIds[0]);
      }
      if (state.budget?.throttled) {
        setBudgetAlert({ level: "soft", message: "AI usage near limit; responses may slow." });
      } else if (state.budget?.fallback) {
        setBudgetAlert({ level: "hard", message: "AI paused due to budget cap. Resume when ready." });
      } else {
        setBudgetAlert(null);
      }
      const alarmFinding = (state.findings ?? []).find((f: string) => typeof f === "string" && f.startsWith("ALARM:"));
      setAlarmNotice(alarmFinding || null);

      // Log newly completed orders into transcript
      const completed = (state.orders ?? []).filter((o: any) => o.status === "complete");
      const seen = loggedOrderIdsRef.current;
      const newOnes = completed.filter((o: any) => !seen.has(o.id));
      if (newOnes.length > 0) {
        const entries: TranscriptLogTurn[] = newOnes.map((o: any) => {
          let text = `${o.type.toUpperCase()} result ready`;
          if (o.result?.type === "vitals") {
            text = `Vitals: HR ${o.result.hr ?? "—"} BP ${o.result.bp ?? "—"} SpO₂ ${o.result.spo2 ?? "—"}`;
          } else if (o.result?.summary) {
            text = `${o.type.toUpperCase()}: ${o.result.summary}`;
          }
          return {
            id: `order-${o.id}`,
            timestamp: Date.now(),
            text,
            character: o.type as CharacterId,
          };
        });
        entries.forEach((e) => seen.add(e.id));
        setTranscriptLog((prev) => [...prev, ...entries]);
      }
    });

    const unsubPatient = voiceGatewayClient.onPatientState((state, character?: string) => {
      setPatientState(state);
      if (character) {
        setActiveCharacter({ character: character as CharacterId, state });
        if (state !== "speaking") {
          setTimeout(() => setActiveCharacter((prev) => (prev?.state === "speaking" ? prev : null)), 1200);
        }
      }

      if (state === "speaking") {
        currentTurnCharacterRef.current = character ?? "patient";
        setTranscriptTurns((prev) => {
          const currentId = currentTurnIdRef.current;
          if (currentId) {
            const existing = prev.find((t) => t.id === currentId);
            if (existing && !existing.isComplete) {
              return prev;
            }
          }
          const newId = makeTurnId();
          currentTurnIdRef.current = newId;
          return [...prev, { id: newId, role: "patient", character: character ?? "patient", text: "", isComplete: false }];
        });
      } else if (state === "idle" || state === "listening" || state === "error") {
        const currentId = currentTurnIdRef.current;
        if (currentId) {
          let finalText = "";
          setTranscriptTurns((prev) => {
            const next = prev.map((t) => {
              if (t.id === currentId) {
                finalText = t.text;
                return { ...t, isComplete: true };
              }
              return t;
            });
            return next;
          });
          if (finalText) {
            const logId = `patient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const related = lastDoctorTurnIdRef.current ?? undefined;
            setTranscriptLog((prev) => [
              ...prev,
              {
                id: logId,
                timestamp: Date.now(),
                text: finalText,
                character: (currentTurnCharacterRef.current ?? "patient") as CharacterId,
              },
            ]);
            lastDoctorTurnIdRef.current = null;
          }
          currentTurnIdRef.current = null;
          currentTurnCharacterRef.current = "patient";
        }
      }
    });

    const unsubTranscript = voiceGatewayClient.onPatientTranscriptDelta((text, character?: string) => {
      setTranscriptTurns((prev) => {
        let turnId = currentTurnIdRef.current;
        const next = [...prev];
        let idx = turnId ? next.findIndex((t) => t.id === turnId) : -1;
        if (idx === -1) {
          turnId = makeTurnId();
          currentTurnIdRef.current = turnId;
          next.push({ id: turnId, role: "patient", character: character ?? currentTurnCharacterRef.current, text: "", isComplete: false });
          idx = next.length - 1;
        }
        const target = next[idx];
        const effectiveCharacter = character ?? target.character ?? "patient";
        currentTurnCharacterRef.current = effectiveCharacter;
        next[idx] = { ...target, character: effectiveCharacter, text: `${target.text}${text}` };
        return next;
      });
    });

    const unsubDoctor = voiceGatewayClient.onDoctorUtterance((text, _userId, character?: string) => {
      setDoctorQuestionText(text);
      if (autoForceReply) {
        const trimmed = text.trim();
        if (trimmed && lastAutoForcedRef.current !== trimmed) {
          lastAutoForcedRef.current = trimmed;
          forceReplyWithQuestion(trimmed);
        }
      }
    });

    const unsubAudio = voiceGatewayClient.onPatientAudio((url, character?: string) => {
      setPatientAudioUrl(url);
      if (characterAudioRef.current) {
        characterAudioRef.current.pause();
        characterAudioRef.current.src = "";
      }
      const audio = new Audio(url);
      characterAudioRef.current = audio;
      audio.play().catch((err) => console.warn("Audio play blocked", err));
    });

    const unsubAnalysis = voiceGatewayClient.onAnalysisResult((result) => {
      setIsAnalyzing(false);
      setDebriefResult(result);
    });

    const unsubComplexDebrief = voiceGatewayClient.onComplexDebrief((result) => {
      setComplexDebriefResult(result);
    });

    return () => {
      unsubStatus();
      unsubSim();
      unsubPatient();
      unsubTranscript();
      unsubDoctor();
      unsubAudio();
      unsubAnalysis();
      unsubComplexDebrief();
    };
  }, [
    sessionId,
    autoForceReply,
    selectedStage,
    makeTurnId,
    forceReplyWithQuestion,
    setTranscriptTurns,
    setDoctorQuestionText,
    setVoiceInsecureMode,
  ]);

  return {
    currentTurnIdRef,
    currentTurnCharacterRef,
    lastDoctorTurnIdRef,
    lastAutoForcedRef,
    loggedOrderIdsRef,
    characterAudioRef,
    makeTurnId,
  };
}
