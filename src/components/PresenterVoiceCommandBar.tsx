import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  usePresenterVoiceCommands,
  VoiceCommandMapping,
  ListeningState,
  SmartRouteResult,
} from "../hooks/usePresenterVoiceCommands";
import { VoiceCommandType } from "../types";
import { CharacterId } from "../types/voiceGateway";

interface PresenterVoiceCommandBarProps {
  sessionId: string;
  onCommand: (
    type: VoiceCommandType,
    payload?: Record<string, unknown>,
    character?: CharacterId
  ) => void;
  /** Whether voice commands are enabled */
  enabled?: boolean;
  /** Require confirmation for medium/high risk commands */
  requireConfirmation?: boolean;
  /** Play audio feedback on command execution */
  audioFeedback?: boolean;
  /** Initial automation mode (hands-free with wake word) */
  initialAutomationMode?: boolean;
}

const stateLabels: Record<ListeningState, string> = {
  idle: "Voice commands off",
  listening: "Listening...",
  processing: "Processing...",
  error: "Error",
  unsupported: "Not supported",
  wake_listening: "Say wake word...",
  activated: "Activated!",
};

const stateColors: Record<ListeningState, string> = {
  idle: "bg-slate-800 border-slate-700 text-slate-400",
  listening: "bg-emerald-600/20 border-emerald-500/60 text-emerald-200",
  processing: "bg-sky-600/20 border-sky-500/60 text-sky-200",
  error: "bg-rose-600/20 border-rose-500/60 text-rose-200",
  unsupported: "bg-slate-800 border-slate-700 text-slate-500",
  wake_listening: "bg-amber-600/20 border-amber-500/60 text-amber-200",
  activated: "bg-emerald-600/30 border-emerald-400/80 text-emerald-100",
};

/** Default wake word for hands-free mode */
const DEFAULT_WAKE_WORD = "hey cardio";

/** Simple beep for audio feedback using Web Audio API */
function playBeep(type: "success" | "confirm" | "error") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    // Different tones for different feedback
    if (type === "success") {
      oscillator.frequency.value = 880; // A5 - pleasant confirmation
      gain.gain.value = 0.1;
    } else if (type === "confirm") {
      oscillator.frequency.value = 440; // A4 - attention needed
      gain.gain.value = 0.15;
    } else {
      oscillator.frequency.value = 220; // A3 - error
      gain.gain.value = 0.1;
    }

    oscillator.type = "sine";
    oscillator.start();

    // Quick fade out
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available
  }
}

/**
 * Compact voice command bar for presenter view.
 * Shows microphone toggle, listening state, and recent command feedback.
 */
export function PresenterVoiceCommandBar({
  sessionId,
  onCommand,
  enabled = true,
  requireConfirmation = true,
  audioFeedback = true,
  initialAutomationMode = false,
}: PresenterVoiceCommandBarProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "info" | "warning">("info");
  const [pendingCommand, setPendingCommand] = useState<{
    command: VoiceCommandMapping;
    transcript: string;
    confidence: number;
  } | null>(null);
  const [automationMode, setAutomationMode] = useState(initialAutomationMode);
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Execute command (after confirmation if needed)
  const executeCommand = useCallback(
    (command: VoiceCommandMapping, confidence: number) => {
      onCommand(command.commandType, command.payload, command.character);

      // Show feedback
      const confidencePercent = Math.round(confidence * 100);
      setFeedback(`${command.label} (${confidencePercent}%)`);
      setFeedbackType("success");

      if (audioFeedback) {
        playBeep("success");
      }
    },
    [onCommand, audioFeedback]
  );

  // Handle confirmation
  const confirmCommand = useCallback(() => {
    if (pendingCommand) {
      executeCommand(pendingCommand.command, pendingCommand.confidence);
      setPendingCommand(null);
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
        confirmTimeoutRef.current = null;
      }
    }
  }, [pendingCommand, executeCommand]);

  const cancelCommand = useCallback(() => {
    setPendingCommand(null);
    setFeedback("Command cancelled");
    setFeedbackType("info");
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
  }, []);

  const handleCommand = useCallback(
    (command: VoiceCommandMapping, transcript: string, confidence: number) => {
      // Check if confirmation is needed for risky commands
      if (requireConfirmation && (command.risk === "medium" || command.risk === "high")) {
        setPendingCommand({ command, transcript, confidence });
        setFeedback(`Confirm: "${command.label}"?`);
        setFeedbackType("warning");

        if (audioFeedback) {
          playBeep("confirm");
        }

        // Auto-cancel after 5 seconds if not confirmed
        if (confirmTimeoutRef.current) {
          clearTimeout(confirmTimeoutRef.current);
        }
        confirmTimeoutRef.current = setTimeout(() => {
          setPendingCommand(null);
          setFeedback("Command timed out");
          setFeedbackType("info");
        }, 5000);

        return;
      }

      // Execute immediately for low-risk commands
      executeCommand(command, confidence);
    },
    [requireConfirmation, audioFeedback, executeCommand]
  );

  const handleTranscript = useCallback((transcript: string, confidence: number) => {
    // Check for "yes" / "confirm" to confirm pending command
    if (pendingCommand) {
      const lower = transcript.toLowerCase();
      if (lower.includes("yes") || lower.includes("confirm") || lower.includes("do it")) {
        confirmCommand();
        return;
      }
      if (lower.includes("no") || lower.includes("cancel") || lower.includes("nevermind")) {
        cancelCommand();
        return;
      }
    }

    // Show what was heard even if no command matched
    if (confidence < 0.6) {
      setFeedback(`Heard: "${transcript}" (low confidence)`);
      setFeedbackType("warning");
    }
  }, [pendingCommand, confirmCommand, cancelCommand]);

  /**
   * Handle smart-routed natural language commands.
   * E.g., "ask the patient about their chest pain" -> force_reply to patient
   */
  const handleSmartRoute = useCallback(
    (route: SmartRouteResult, transcript: string, confidence: number) => {
      // Execute as a force_reply with the extracted utterance
      onCommand("force_reply", { doctorUtterance: route.utterance }, route.character);

      // Show feedback
      const confidencePercent = Math.round(confidence * 100);
      setFeedback(`${route.label} (${confidencePercent}%)`);
      setFeedbackType("success");

      if (audioFeedback) {
        playBeep("success");
      }
    },
    [onCommand, audioFeedback]
  );

  const handleWakeWord = useCallback(() => {
    setFeedback("Listening for command...");
    setFeedbackType("success");
    if (audioFeedback) {
      playBeep("confirm");
    }
  }, [audioFeedback]);

  const {
    state,
    isListening,
    isActivated,
    isSupported,
    interimTranscript,
    lastResult,
    errorMessage,
    toggleListening,
    stopListening,
  } = usePresenterVoiceCommands({
    onCommand: handleCommand,
    onSmartRoute: handleSmartRoute,
    onTranscript: handleTranscript,
    continuous: true,
    confidenceThreshold: 0.6,
    enableSmartRouting: true,
    wakeWord: automationMode ? { phrase: DEFAULT_WAKE_WORD, timeoutMs: 10000 } : undefined,
    onWakeWord: handleWakeWord,
  });

  // Clear feedback after delay (but not while confirming)
  useEffect(() => {
    if (feedback && !pendingCommand) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback, pendingCommand]);

  // Cleanup confirmation timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  // Stop listening when disabled
  useEffect(() => {
    if (!enabled && isListening) {
      stopListening();
    }
  }, [enabled, isListening, stopListening]);

  // Show unmatched transcript
  useEffect(() => {
    if (lastResult && !lastResult.matchedCommand && lastResult.confidence >= 0.6) {
      setFeedback(`No command: "${lastResult.transcript}"`);
      setFeedbackType("info");
    }
  }, [lastResult]);

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-500">
        <MicOffIcon />
        <span>Voice commands not supported in this browser</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm shadow-black/20">
      {/* Microphone toggle */}
      <button
        type="button"
        onClick={toggleListening}
        disabled={!enabled}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
          isListening
            ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-900/40"
            : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
        } ${!enabled ? "opacity-50 cursor-not-allowed" : ""}`}
        title={isListening ? "Stop listening" : "Start voice commands"}
        aria-label={isListening ? "Stop listening" : "Start voice commands"}
      >
        {isListening ? <MicOnIcon /> : <MicOffIcon />}
        {isListening && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Status and transcript */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${stateColors[state]}`}
          >
            {stateLabels[state]}
          </span>
          {errorMessage && state === "error" && (
            <span className="text-[10px] text-rose-400">{errorMessage}</span>
          )}
        </div>

        {/* Interim transcript (what's being heard in real-time) */}
        {interimTranscript && (
          <div className="mt-1 text-xs text-slate-400 italic truncate">
            "{interimTranscript}"
          </div>
        )}

        {/* Confirmation buttons for risky commands */}
        {pendingCommand && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-amber-300">
              {pendingCommand.command.label}?
            </span>
            <button
              type="button"
              onClick={confirmCommand}
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600/20 border border-emerald-500/60 text-emerald-200 hover:bg-emerald-600/30"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={cancelCommand}
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
            >
              No
            </button>
            <span className="text-[10px] text-slate-500">or say "yes"/"no"</span>
          </div>
        )}

        {/* Feedback for executed commands */}
        {feedback && !interimTranscript && !pendingCommand && (
          <div
            className={`mt-1 text-xs truncate ${
              feedbackType === "success"
                ? "text-emerald-300"
                : feedbackType === "warning"
                ? "text-amber-300"
                : "text-slate-400"
            }`}
          >
            {feedbackType === "success" && "✓ "}
            {feedback}
          </div>
        )}
      </div>

      {/* Automation mode toggle */}
      <div className="flex flex-col items-end gap-1">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span className="text-[10px] text-slate-500">Auto</span>
          <button
            type="button"
            onClick={() => setAutomationMode(!automationMode)}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              automationMode ? "bg-emerald-600" : "bg-slate-700"
            }`}
            title={automationMode ? "Disable hands-free mode" : "Enable hands-free mode (say 'hey cardio')"}
            aria-pressed={automationMode}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                automationMode ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
        {/* Help hint */}
        <div className="hidden sm:block text-[10px] text-slate-500 max-w-[140px] text-right">
          {automationMode
            ? `Say "${DEFAULT_WAKE_WORD}" then your command`
            : 'Say "pause", "order labs"...'}
        </div>
      </div>
    </div>
  );
}

function MicOnIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
    >
      <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" />
      <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
    >
      <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" />
      <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
    </svg>
  );
}
