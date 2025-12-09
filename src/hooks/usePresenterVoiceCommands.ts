import { useState, useCallback, useRef, useEffect } from "react";
import { VoiceCommandType } from "../types";
import { CharacterId } from "../types/voiceGateway";

/**
 * Voice command definition with trigger phrases and action details.
 */
export interface VoiceCommandMapping {
  /** Phrases that trigger this command (lowercase, matched via includes) */
  triggers: string[];
  /** The command type to dispatch */
  commandType: VoiceCommandType;
  /** Optional payload for the command */
  payload?: Record<string, unknown>;
  /** Target character for the command */
  character?: CharacterId;
  /** Human-readable label for UI feedback */
  label: string;
  /** Risk level - high risk commands may require confirmation */
  risk: "low" | "medium" | "high";
}

/**
 * Default command mappings - spoken phrases to system commands.
 * Ordered by specificity (more specific phrases first).
 */
export const DEFAULT_VOICE_COMMANDS: VoiceCommandMapping[] = [
  // AI control
  { triggers: ["pause", "pause ai", "stop ai", "hold on"], commandType: "pause_ai", label: "Pause AI", risk: "low" },
  { triggers: ["resume", "resume ai", "continue", "go ahead"], commandType: "resume_ai", label: "Resume AI", risk: "low" },
  { triggers: ["end turn", "stop turn", "cut off"], commandType: "end_turn", label: "End Turn", risk: "medium" },

  // Force reply variants
  { triggers: ["force reply", "reply now", "respond", "patient respond", "answer that"], commandType: "force_reply", label: "Force Reply", risk: "low" },

  // Nurse commands
  { triggers: ["get vitals", "check vitals", "vitals please", "grab vitals"], commandType: "force_reply", payload: { doctorUtterance: "Please grab a fresh set of vitals." }, character: "nurse", label: "Nurse: Vitals", risk: "low" },
  { triggers: ["order labs", "get labs", "labs please", "draw labs"], commandType: "order", payload: { orderType: "labs" }, character: "nurse", label: "Order Labs", risk: "low" },
  { triggers: ["give oxygen", "start oxygen", "o2", "oxygen please"], commandType: "treatment", payload: { treatmentType: "oxygen" }, character: "nurse", label: "Give Oxygen", risk: "low" },
  { triggers: ["fluids", "bolus", "give fluids", "fluid bolus"], commandType: "treatment", payload: { treatmentType: "fluids" }, character: "nurse", label: "Fluids Bolus", risk: "low" },
  { triggers: ["knee chest", "knee-chest", "position knee chest"], commandType: "treatment", payload: { treatmentType: "knee-chest" }, character: "nurse", label: "Knee-Chest Position", risk: "low" },
  { triggers: ["rate control", "give rate control", "slow the rate"], commandType: "treatment", payload: { treatmentType: "rate-control" }, character: "nurse", label: "Rate Control", risk: "medium" },
  { triggers: ["bedside exam", "do exam", "examine patient", "physical exam"], commandType: "exam", character: "nurse", label: "Bedside Exam", risk: "low" },

  // Tech commands
  { triggers: ["get ekg", "order ekg", "ekg please", "12 lead", "twelve lead"], commandType: "order", payload: { orderType: "ekg" }, character: "tech", label: "Order EKG", risk: "low" },
  { triggers: ["show ekg", "display ekg", "pull up ekg"], commandType: "show_ekg", character: "tech", label: "Show EKG", risk: "low" },
  { triggers: ["start telemetry", "telemetry on", "put on monitor"], commandType: "toggle_telemetry", payload: { enabled: true }, character: "tech", label: "Start Telemetry", risk: "low" },
  { triggers: ["order imaging", "get imaging", "x-ray", "chest x-ray", "imaging please"], commandType: "order", payload: { orderType: "imaging" }, character: "tech", label: "Order Imaging", risk: "low" },

  // Consultant
  { triggers: ["call cardiology", "page cardiology", "consult cardiology", "call consultant", "get consultant"], commandType: "force_reply", payload: { doctorUtterance: "Please join at bedside for cardiology consult." }, character: "consultant", label: "Call Consultant", risk: "low" },
];

/**
 * Smart routing patterns for natural language commands.
 * These detect patterns like "ask the patient about X" and route to the right character.
 */
export interface SmartRouteResult {
  /** The detected character to route to */
  character: CharacterId;
  /** The extracted question/utterance to pass */
  utterance: string;
  /** Human-readable label for feedback */
  label: string;
}

/**
 * Character keywords for smart routing detection.
 */
const CHARACTER_KEYWORDS: Record<string, CharacterId> = {
  patient: "patient",
  mom: "parent",
  mother: "parent",
  dad: "parent",
  father: "parent",
  parent: "parent",
  nurse: "nurse",
  tech: "tech",
  technician: "tech",
  imaging: "imaging",
  radiology: "imaging",
  consultant: "consultant",
  cardiology: "consultant",
  cardiologist: "consultant",
};

/**
 * Patterns that indicate a question/request to a character.
 * Captures the character and the content to pass.
 */
const SMART_ROUTE_PATTERNS: RegExp[] = [
  // "ask the patient about X" / "ask patient X"
  /ask\s+(?:the\s+)?(\w+)\s+(?:about\s+)?(.+)/i,
  // "tell the nurse to X" / "have the nurse X"
  /(?:tell|have)\s+(?:the\s+)?(\w+)\s+(?:to\s+)?(.+)/i,
  // "patient, X" (direct address)
  /^(\w+),\s*(.+)/i,
  // "what does the patient say about X"
  /what\s+(?:does|did)\s+(?:the\s+)?(\w+)\s+(?:say|think)\s+(?:about\s+)?(.+)/i,
  // "can the nurse X" / "could the tech X"
  /(?:can|could|would)\s+(?:the\s+)?(\w+)\s+(.+)/i,
];

/**
 * Try to extract a smart route from natural language.
 * Returns null if no pattern matches.
 */
export function extractSmartRoute(transcript: string): SmartRouteResult | null {
  const lower = transcript.toLowerCase().trim();

  for (const pattern of SMART_ROUTE_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      const [, characterWord, content] = match;
      const character = CHARACTER_KEYWORDS[characterWord.toLowerCase()];

      if (character && content && content.length > 2) {
        // Clean up the content
        const utterance = content
          .replace(/\?$/, "") // Remove trailing question mark
          .trim();

        return {
          character,
          utterance,
          label: `Ask ${character}: "${utterance.slice(0, 30)}${utterance.length > 30 ? "..." : ""}"`,
        };
      }
    }
  }

  return null;
}

export type ListeningState = "idle" | "listening" | "processing" | "error" | "unsupported" | "wake_listening" | "activated";

export interface VoiceCommandResult {
  /** The transcript that was recognized */
  transcript: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Matched command, if any */
  matchedCommand: VoiceCommandMapping | null;
  /** Whether the command was executed */
  executed: boolean;
  /** Timestamp */
  timestamp: number;
}

/**
 * Wake word configuration for hands-free activation.
 */
export interface WakeWordConfig {
  /** The wake word phrase (e.g., "hey cardio", "okay quest") */
  phrase: string;
  /** How long after wake word activation before it times out (ms, default 10000) */
  timeoutMs?: number;
}

export interface UsePresenterVoiceCommandsOptions {
  /** Custom command mappings (defaults to DEFAULT_VOICE_COMMANDS) */
  commands?: VoiceCommandMapping[];
  /** Minimum confidence threshold (0-1, default 0.7) */
  confidenceThreshold?: number;
  /** Callback when a command is recognized and should be executed */
  onCommand?: (command: VoiceCommandMapping, transcript: string, confidence: number) => void;
  /** Callback for smart-routed natural language (e.g., "ask the patient about X") */
  onSmartRoute?: (route: SmartRouteResult, transcript: string, confidence: number) => void;
  /** Callback for any transcript (even non-commands) */
  onTranscript?: (transcript: string, confidence: number) => void;
  /** Whether to auto-restart listening after each result (default true) */
  continuous?: boolean;
  /** Language for recognition (default "en-US") */
  language?: string;
  /** Enable smart routing for natural language (default true) */
  enableSmartRouting?: boolean;
  /** Wake word configuration for hands-free mode (optional) */
  wakeWord?: WakeWordConfig;
  /** Callback when wake word is detected */
  onWakeWord?: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

/**
 * Hook for voice-activated presenter commands using Web Speech API.
 * Listens for spoken phrases and maps them to system commands.
 */
export function usePresenterVoiceCommands(options: UsePresenterVoiceCommandsOptions = {}) {
  const {
    commands = DEFAULT_VOICE_COMMANDS,
    confidenceThreshold = 0.6,
    onCommand,
    onSmartRoute,
    onTranscript,
    continuous = true,
    language = "en-US",
    enableSmartRouting = true,
    wakeWord,
    onWakeWord,
  } = options;

  const [state, setState] = useState<ListeningState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastResult, setLastResult] = useState<VoiceCommandResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isActivated, setIsActivated] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const isManualStopRef = useRef(false);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for browser support
  const isSupported = typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  /**
   * Match transcript against command triggers.
   * Returns the first matching command or null.
   */
  const matchCommand = useCallback((transcript: string): VoiceCommandMapping | null => {
    const lower = transcript.toLowerCase().trim();
    for (const cmd of commands) {
      for (const trigger of cmd.triggers) {
        if (lower.includes(trigger)) {
          return cmd;
        }
      }
    }
    return null;
  }, [commands]);

  /**
   * Initialize speech recognition instance.
   */
  const initRecognition = useCallback(() => {
    if (!isSupported) {
      setState("unsupported");
      return null;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setState("unsupported");
      return null;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      // Set state based on whether we're in wake word mode
      if (wakeWord && !isActivated) {
        setState("wake_listening");
      } else {
        setState("listening");
      }
      setErrorMessage(null);
      isManualStopRef.current = false;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalTranscript = "";
      let finalConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          finalConfidence = result[0].confidence;
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimTranscript(interim);

      if (finalTranscript) {
        const lower = finalTranscript.toLowerCase();

        // Check for wake word if in wake word mode
        if (wakeWord && !isActivated) {
          if (lower.includes(wakeWord.phrase.toLowerCase())) {
            // Wake word detected - activate!
            setIsActivated(true);
            setState("activated");
            onWakeWord?.();

            // Remove wake word from transcript for command processing
            const commandPart = lower.replace(wakeWord.phrase.toLowerCase(), "").trim();

            // Set timeout to deactivate
            if (wakeWordTimeoutRef.current) {
              clearTimeout(wakeWordTimeoutRef.current);
            }
            wakeWordTimeoutRef.current = setTimeout(() => {
              setIsActivated(false);
              setState("wake_listening");
            }, wakeWord.timeoutMs ?? 10000);

            // If there's a command after the wake word, process it
            if (commandPart.length > 2) {
              finalTranscript = commandPart;
            } else {
              // Just the wake word, wait for next utterance
              setInterimTranscript("");
              return;
            }
          } else {
            // Not wake word, ignore in wake word mode
            setInterimTranscript("");
            return;
          }
        }

        setState("processing");
        setInterimTranscript("");

        // Notify of transcript
        onTranscript?.(finalTranscript, finalConfidence);

        // Try to match a command first
        const matched = matchCommand(finalTranscript);
        const meetsThreshold = finalConfidence >= confidenceThreshold;

        const result: VoiceCommandResult = {
          transcript: finalTranscript,
          confidence: finalConfidence,
          matchedCommand: meetsThreshold ? matched : null,
          executed: false,
          timestamp: Date.now(),
        };

        if (matched && meetsThreshold) {
          // Exact command match
          result.executed = true;
          onCommand?.(matched, finalTranscript, finalConfidence);
        } else if (enableSmartRouting && meetsThreshold && onSmartRoute) {
          // Try smart routing for natural language
          const smartRoute = extractSmartRoute(finalTranscript);
          if (smartRoute) {
            result.executed = true;
            onSmartRoute(smartRoute, finalTranscript, finalConfidence);
          }
        }

        setLastResult(result);

        // Return to appropriate listening state if continuous
        if (continuous && shouldRestartRef.current) {
          if (wakeWord && !isActivated) {
            setState("wake_listening");
          } else {
            setState("listening");
          }
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are not real errors
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }

      console.error("Speech recognition error:", event.error, event.message);
      setErrorMessage(event.error);
      setState("error");
    };

    recognition.onend = () => {
      // Auto-restart if continuous mode and not manually stopped
      if (continuous && shouldRestartRef.current && !isManualStopRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // May fail if already started
          setState("idle");
        }
      } else {
        setState("idle");
      }
    };

    return recognition;
  }, [isSupported, continuous, language, confidenceThreshold, matchCommand, onCommand, onTranscript]);

  /**
   * Start listening for voice commands.
   */
  const startListening = useCallback(() => {
    if (!isSupported) {
      setState("unsupported");
      setErrorMessage("Speech recognition not supported in this browser");
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
    }

    const recognition = initRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    shouldRestartRef.current = true;
    isManualStopRef.current = false;

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      setErrorMessage("Failed to start speech recognition");
      setState("error");
    }
  }, [isSupported, initRecognition]);

  /**
   * Stop listening for voice commands.
   */
  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    isManualStopRef.current = true;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    setState("idle");
    setInterimTranscript("");
  }, []);

  /**
   * Toggle listening state.
   */
  const toggleListening = useCallback(() => {
    if (state === "listening" || state === "processing") {
      stopListening();
    } else {
      startListening();
    }
  }, [state, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    state,
    isListening: state === "listening" || state === "processing" || state === "wake_listening" || state === "activated",
    isActivated,
    isSupported,
    interimTranscript,
    lastResult,
    errorMessage,

    // Actions
    startListening,
    stopListening,
    toggleListening,

    // Utilities
    matchCommand,
    commands,
  };
}
