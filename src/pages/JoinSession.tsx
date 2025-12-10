import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  onSnapshot,
  query,
  where,
  setDoc,
  db,
  runTransaction
} from "../utils/firestore"; // Updated import
import { SessionData, Question, ParticipantDoc } from "../types";
import { SlidePreview } from "../components/SlidePreview";
import { auth, ensureSignedIn, isConfigured } from "../firebase";
import { useVoiceState, takeFloorTx, releaseFloor } from "../hooks/useVoiceState";
import { HoldToSpeakButton } from "../components/HoldToSpeakButton";
import { voicePatientService } from "../services/VoicePatientService";
import { voiceGatewayClient } from "../services/VoiceGatewayClient";
import { VoiceConnectionStatus, CharacterId } from "../types/voiceGateway";
import { MicStatus } from "../services/VoicePatientService";
import { ParticipantVoiceStatusBanner } from "../components/ParticipantVoiceStatusBanner";
import { sendVoiceCommand } from "../services/voiceCommands";
import { useSimplifiedVoiceState } from "../hooks/useSimplifiedVoiceState";
import { CollapsibleVoicePanel } from "../components/CollapsibleVoicePanel";
import { FloatingMicButton } from "../components/FloatingMicButton";
import { SessionSkeleton } from "../components/SessionSkeleton";
import { TextQuestionInput } from "../components/TextQuestionInput";
import { VoiceStatusBadge } from "../components/VoiceStatusBadge";
import { CompactVitalsChip } from "../components/CompactVitalsChip";
import { CaseTimeline } from "../components/CaseTimeline";
import { TeamChat } from "../components/TeamChat";
import { useTeamChat } from "../hooks/useTeamChat";
import { useTeamLead } from "../hooks/useTeamLead";
import { TeamRoleBadge } from "../components/TeamRoleBadge";
import { FLOOR_AUTO_RELEASE_MS, FLOOR_RELEASE_DELAY_MS, DEFAULT_TIMEOUT_MS } from "../constants";

function getLocalUserId(): string {
  const key = "cq_live_user_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

async function emitCommand(
  sessionId: string,
  type: "exam" | "toggle_telemetry" | "show_ekg" | "order",
  payload?: Record<string, any>,
  character?: CharacterId,
  onError?: (message: string, err: unknown) => void
) {
  sendVoiceCommand(sessionId, { type, payload, character }).catch((err: unknown) => {
    if (onError) {
      onError("Failed to queue voice command", err);
      return;
    }
    console.error("Failed to queue voice command", err);
  });
  try {
    voiceGatewayClient.sendVoiceCommand(type as any, payload, character);
  } catch (err) {
    if (onError) {
      onError("Failed to send voice command to gateway", err);
      return;
    }
    console.error("Failed to send voice command to gateway", err);
  }
}

const TEAM_OPTIONS = [
  { id: "team_ductus", name: "Team Ductus" },
  { id: "team_cyanosis", name: "Team Cyanosis" },
  { id: "team_qpqs", name: "Team QpQs" },
];

function getDifficultyMultiplier(difficulty?: Question["difficulty"]) {
  if (difficulty === "medium") return 1.3;
  if (difficulty === "hard") return 1.6;
  return 1.0;
}

function getStreakMultiplier(currentStreak: number) {
  if (currentStreak >= 4) return 1.5;
  if (currentStreak === 3) return 1.2;
  if (currentStreak === 2) return 1.1;
  return 1.0;
}

export default function JoinSession() {
  const { joinCode } = useParams();
  const getSearchParams = () => {
    // Hash router keeps query params after the # segment.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashQueryIndex = hash.indexOf("?");
    if (hashQueryIndex !== -1) {
      return new URLSearchParams(hash.substring(hashQueryIndex));
    }
    return new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  };
  const [findAttempt, setFindAttempt] = useState(0);
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mockVoice, setMockVoice] = useState<string | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(
    isConfigured ? auth?.currentUser?.uid ?? null : getLocalUserId()
  );
  const [micLevel, setMicLevel] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [targetCharacter, setTargetCharacter] = useState<CharacterId>("patient");
  const [connectionStatus, setConnectionStatus] = useState<VoiceConnectionStatus>({
    state: "disconnected",
    lastChangedAt: Date.now(),
  });
  const [simState, setSimState] = useState<{
    stageId: string;
    vitals: Record<string, unknown>;
    exam?: Record<string, string | undefined>;
    examAudio?: { type: "heart" | "lung"; label: string; url: string }[];
    telemetry?: boolean;
    rhythmSummary?: string;
    telemetryWaveform?: number[];
    fallback: boolean;
    budget?: { usdEstimate?: number; voiceSeconds?: number; throttled?: boolean; fallback?: boolean };
    scenarioId?: string;
    stageIds?: string[];
    orders?: { id: string; type: string; status: string; result?: any; completedAt?: number }[];
    treatmentHistory?: { ts: number; treatmentType: string; note?: string }[];
    ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
    scenarioStartedAt?: number;
  } | null>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>("unknown");
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showExam, setShowExam] = useState(false);
  const [showEkg, setShowEkg] = useState(false);
  const [toast, setToast] = useState<{ message: string; ts: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastFloorHolder, setLastFloorHolder] = useState<string | null>(null);
  const [lastFallback, setLastFallback] = useState<boolean | null>(null);
  const [assessmentRequest, setAssessmentRequest] = useState<{ ts: number; stage?: string } | null>(null);
  const [preferTextInput, setPreferTextInput] = useState<boolean>(() => {
    const stored = localStorage.getItem("cq_prefer_text_input");
    return stored === "true";
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const characterAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [showVoiceGuide, setShowVoiceGuide] = useState<boolean>(false);
  const [showAdvancedVoice, setShowAdvancedVoice] = useState(false);
  const [isVoiceExpanded, setIsVoiceExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [showVitalsPanel, setShowVitalsPanel] = useState(false);
  const [myTeam, setMyTeam] = useState<{ teamId: string; teamName: string } | null>(null);
  const showToast = useCallback((message: string) => {
    setToast({ message, ts: Date.now() });
  }, []);
  const logAndToast = useCallback(
    (message: string, err: unknown) => {
      console.error(message, err);
      showToast(message);
    },
    [showToast]
  );
  const handleInlineCodeChange = useCallback((value: string) => {
    const trimmed = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (!trimmed) return;
    window.location.hash = `#/join/${trimmed}`;
  }, []);
  const voice = useVoiceState(sessionId);
  const userDisplayName = auth?.currentUser?.displayName ?? "Resident";
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setIsMobile(false);
      return;
    }
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = (matches: boolean) => setIsMobile(matches);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener?.("change", handler);
    const stored = localStorage.getItem("cq_voice_panel_expanded");
    if (stored !== null) {
      setIsVoiceExpanded(stored === "true");
    } else {
      setIsVoiceExpanded(!mq.matches); // default collapsed on mobile
    }
    // Test hook for mock voice state
    const params = getSearchParams();
    const mockVoiceParam = params.get("mockVoice");
    if (mockVoiceParam) {
      setMockVoice(mockVoiceParam);
    }
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  useEffect(() => {
    if (!voice) return;
    if (voice.floorHolderId !== lastFloorHolder) {
      if (voice.floorHolderId === userId) {
        setToast({ message: "You have the floor", ts: Date.now() });
      } else if (voice.floorHolderId) {
        setToast({ message: `${voice.floorHolderName ?? "Another resident"} has the floor`, ts: Date.now() });
      } else if (lastFloorHolder) {
        setToast({ message: "Floor is now free", ts: Date.now() });
      }
      setLastFloorHolder(voice.floorHolderId ?? null);
    }
  }, [voice.floorHolderId, voice.floorHolderName, userId, lastFloorHolder]);
  useEffect(() => {
    const currentFallback = simState?.fallback ?? false;
    if (lastFallback === null) {
      setLastFallback(currentFallback);
      return;
    }
    if (currentFallback !== lastFallback) {
      setToast({
        message: currentFallback ? "Voice fallback on. Use text/typed questions." : "Voice live again.",
        ts: Date.now(),
      });
      setLastFallback(currentFallback);
    }
  }, [simState?.fallback, lastFallback]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Subscribe to patient/character audio from voice gateway and play it
  useEffect(() => {
    const unsub = voiceGatewayClient.onPatientAudio((audioUrl) => {
      // Stop any currently playing character audio
      if (characterAudioRef.current) {
        characterAudioRef.current.pause();
        characterAudioRef.current = null;
      }
      // Create and play new audio
      const audio = new Audio(audioUrl);
      characterAudioRef.current = audio;
      audio.play().catch((err) => {
        console.error("Failed to play character audio", err);
      });
    });
    return () => {
      unsub();
      if (characterAudioRef.current) {
        characterAudioRef.current.pause();
        characterAudioRef.current = null;
      }
    };
  }, []);

  // Auto-release floor after inactivity (60s) to reduce stuck states
  useEffect(() => {
    if (!sessionId || !userId) return;
    const interval = setInterval(() => {
      if (!voice.floorHolderId || voice.floorHolderId !== userId || !voice.since) return;
      const sinceTs = (voice.since as any)?.toMillis
        ? (voice.since as any).toMillis()
        : typeof voice.since === "number"
        ? voice.since
        : Date.parse(voice.since as any);
      if (!sinceTs || Number.isNaN(sinceTs)) return;
      const elapsed = Date.now() - sinceTs;
      if (elapsed > FLOOR_AUTO_RELEASE_MS) {
        releaseFloor(sessionId).catch((err: unknown) => console.error("Failed to auto-release floor", err));
        setToast({ message: "Floor released after inactivity (60s)", ts: Date.now() });
      }
    }, DEFAULT_TIMEOUT_MS);
    return () => clearInterval(interval);
  }, [sessionId, userId, voice.floorHolderId, voice.since]);

  useEffect(() => {
    if (!isConfigured || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    ensureSignedIn().catch((error) =>
      console.error("Anonymous auth failed", error)
    );
    return () => unsubscribe();
  }, []);

  // Find session by joinCode once
  useEffect(() => {
    const params = getSearchParams();
    const storedMockRaw = localStorage.getItem("cq_mock_session");
    let storedMock: { joinCode?: string; sessionId?: string } | null = null;
    if (storedMockRaw) {
      try {
        storedMock = JSON.parse(storedMockRaw);
      } catch {
        // ignore malformed stored mock
      }
    }
    const mockSession = params.get("mockSession") || storedMock?.joinCode || storedMockRaw;
    const mockNotFoundFlag = params.get("mockNotFound");
    const mockVoiceParam = params.get("mockVoice");
    if (mockNotFoundFlag) {
      setSession(null);
      setSessionId(null);
      setLoading(false);
      return;
    }
    if (mockSession) {
      const code = mockSession.toUpperCase();
      const mockQuestion: Question = {
        id: "mock-q1",
        stem: "Mock question?",
        options: ["A) Mock A", "B) Mock B", "C) Mock C", "D) Mock D"],
        correctIndex: 2,
        difficulty: "easy",
      };
      const mockSlides: any[] = [
        { id: "mock-slide-1", index: 0, type: "question", questionId: mockQuestion.id, html: "" },
      ];
      const mock: SessionData = {
        id: storedMock?.sessionId ?? "MOCK",
        title: "Mock Session",
        joinCode: code,
        createdAt: new Date().toISOString(),
        currentSlideIndex: 0,
        currentQuestionId: mockQuestion.id,
        showResults: false,
        slides: mockSlides as any,
        questions: [mockQuestion as any],
      };
      setSession(mock);
      setSessionId(storedMock?.sessionId ?? "MOCK");
      setLoading(false);
      if (mockVoiceParam) {
        setMockVoice(mockVoiceParam);
      }
      return;
    }

    async function findSession() {
      if (!joinCode) return;
      if (isConfigured && !userId) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, "sessions"),
          where("joinCode", "==", joinCode.toUpperCase()),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          setSessionId(docSnap.id);
          setSession({ ...(docSnap.data() as SessionData), id: docSnap.id });
        } else {
          setSession(null);
          setSessionId(null);
        }
      } catch (e) {
        console.error("Error finding session:", e);
      } finally {
        setLoading(false);
      }
    }
    findSession();
  }, [joinCode, userId, findAttempt]);

  // Subscribe to session updates
  useEffect(() => {
    if (!sessionId) return;
    const ref = doc(db, "sessions", sessionId);
    const unsub = onSnapshot(ref, (snap: any) => {
      if (snap.exists()) {
        setSession({ ...(snap.data() as SessionData), id: snap.id });
      }
    });
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    const unsub = voicePatientService.onLevel((level) => setMicLevel(level));
    return () => unsub();
  }, []);

  // Track participant count for queue indicator
  useEffect(() => {
    if (!sessionId) return;
    const ref = collection(db, "sessions", sessionId, "participants");
    const unsub = onSnapshot(ref as any, (snap: any) => {
      if (!snap) return;
      const docsArray = (typeof snap.forEach === "function" && !Array.isArray(snap))
        ? (() => { const arr: any[] = []; snap.forEach((d: any) => arr.push(d)); return arr; })()
        : snap.docs ?? [];
      setParticipantCount(docsArray.length ?? 0);
    });
    return () => unsub();
  }, [sessionId]);

  // Offline / reconnect indicator
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsub = voicePatientService.onPermissionChange((status) => setMicStatus(status));
    voicePatientService.recheckPermission().catch((err: unknown) => console.error("Mic permission check failed", err));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = voicePatientService.onTurnComplete(async (blob) => {
      if (!sessionId || !userId) return;
      if (!blob || blob.size === 0) return;
      try {
        setTranscribing(true);
        await voiceGatewayClient.sendDoctorAudio(blob, { character: targetCharacter });
      } catch (err) {
        console.error("Failed to send doctor audio", err);
      } finally {
        setTranscribing(false);
      }
    });
    return () => unsub();
  }, [sessionId, userId, targetCharacter]);

  useEffect(() => {
    const unsub = voiceGatewayClient.onStatus((status) => setConnectionStatus(status));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = voiceGatewayClient.onSimState((state) => {
      setSimState(state);
      // Detect assessment prompt from timeline extras (label Assessment)
      const lastAssessment = (state as any)?.timelineExtras
        ? ((state as any).timelineExtras as any[])
            .filter((t) => t.label === "Assessment")
            .slice(-1)[0]
        : null;
      if (lastAssessment && (!assessmentRequest || lastAssessment.ts !== assessmentRequest.ts)) {
        setAssessmentRequest({ ts: lastAssessment.ts, stage: state.stageId });
        setToast({ message: "Presenter requests assessment", ts: Date.now() });
      }
    });
    return () => unsub();
  }, [assessmentRequest]);

  useEffect(() => {
    const unsub = voiceGatewayClient.onParticipantState(({ userId: speakerId, speaking }) => {
      setActiveSpeakerId((prev) => {
        if (!speaking && prev === speakerId) return null;
        if (speaking) return speakerId;
        return prev;
      });
    });
    return () => unsub();
  }, []);

  // Connect to voice gateway once we know session/user
  useEffect(() => {
    if (!sessionId || !userId) return;
    let mounted = true;
    (async () => {
      const authToken = auth?.currentUser?.getIdToken ? await auth.currentUser.getIdToken() : undefined;
      if (!mounted) return;
      voiceGatewayClient.connect(sessionId, userId, userDisplayName, "participant", authToken);
    })();
    return () => {
      mounted = false;
      voiceGatewayClient.disconnect();
    };
  }, [sessionId, userId, userDisplayName]);

  // Reset local selection when question changes
  useEffect(() => {
    setSelectedChoice(null);
  }, [session?.currentQuestionId]);

  // Ensure participant doc exists and assign a team (use transaction for creation; team counts from a snapshot)
  useEffect(() => {
    async function ensureParticipantDoc() {
      if (!sessionId || !userId) return;
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      try {
        // Snapshot current participants to balance teams (transactions do not support collection reads).
        const snap = await getDocs(collection(db, "sessions", sessionId, "participants"));
        const counts = TEAM_OPTIONS.reduce<Record<string, number>>((acc, t) => {
          acc[t.id] = 0;
          return acc;
        }, {});
        const participantDocs: ParticipantDoc[] = [];
        if (snap && typeof (snap as any).forEach === "function") {
          snap.forEach((docSnap: any) => {
            const data = typeof docSnap.data === "function" ? docSnap.data() : docSnap.data;
            if (data) participantDocs.push(data as ParticipantDoc);
          });
        } else if (Array.isArray((snap as any)?.docs)) {
          (snap as any).docs.forEach((docSnap: any) => {
            const data = typeof docSnap.data === "function" ? docSnap.data() : docSnap.data;
            if (data) participantDocs.push(data as ParticipantDoc);
          });
        }
        participantDocs.forEach((data) => {
          if (data?.teamId && counts[data.teamId] !== undefined) {
            counts[data.teamId] += 1;
          }
        });
        const chosenTeam =
          [...TEAM_OPTIONS].sort((a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0))[0] ?? TEAM_OPTIONS[0];

        await runTransaction(db, async (tx) => {
          const existing = await tx.get(participantRef);
          if (existing.exists()) return;

          const participantDoc: ParticipantDoc = {
            userId,
            sessionId,
            teamId: chosenTeam.id,
            teamName: chosenTeam.name,
            points: 0,
            streak: 0,
            correctCount: 0,
            incorrectCount: 0,
            createdAt: new Date().toISOString(),
          };
          tx.set(participantRef, participantDoc);
        });
      } catch (err) {
        console.error("Failed to ensure participant doc", err);
      }
    }
    ensureParticipantDoc();
  }, [sessionId, userId]);

  // Listen to participant doc for team info
  useEffect(() => {
    if (!sessionId || !userId) return;
    const participantRef = doc(db, "sessions", sessionId, "participants", userId);
    const unsub = onSnapshot(participantRef, (snap: any) => {
      const data = snap.data?.() ?? snap.data;
      if (data?.teamId && data?.teamName) {
        setMyTeam({ teamId: data.teamId, teamName: data.teamName });
      }
    });
    return () => unsub();
  }, [sessionId, userId]);

  // Team chat hook
  const teamChat = useTeamChat({
    sessionId,
    teamId: myTeam?.teamId ?? null,
    userId,
    senderName: userDisplayName,
  });

  // Team lead hook
  const teamLead = useTeamLead({
    sessionId,
    teamId: myTeam?.teamId ?? null,
    userId,
  });

  const slides = session ? [...session.slides].sort((a, b) => a.index - b.index) : [];
  const currentSlide = slides.length > 0 ? slides[session?.currentSlideIndex ?? 0] ?? slides[0] : null;

  const questionsMap = new Map<string, Question>(
    session ? session.questions.map((q) => [q.id, q]) : []
  );

  const currentQuestion =
    currentSlide?.type === "question" && currentSlide.questionId
      ? questionsMap.get(currentSlide.questionId)
      : null;

  // Question is "active" for the user if it's the current slide AND the presenter has opened it
  // Or if it's open but we are just showing results.
  const isQuestionActive = currentQuestion && session?.currentQuestionId === currentQuestion.id;

  const hasFloor = voice.enabled && voice.floorHolderId === userId;
  const fallbackActive = simState?.fallback === true;
  const floorTakenByOther =
    voice.enabled && voice.floorHolderId !== null && voice.floorHolderId !== userId;
  const otherSpeaking = (activeSpeakerId && activeSpeakerId !== userId) || floorTakenByOther;
  const waitingCount = Math.max(0, participantCount - (voice.floorHolderId ? 1 : 0));
  const latestEkg = useMemo(() => {
    const ekgs = (simState?.orders ?? []).filter((o) => o.type === "ekg" && o.status === "complete");
    return ekgs.length ? ekgs[ekgs.length - 1] : null;
  }, [simState?.orders]);
  const voiceStatusData = useSimplifiedVoiceState({
    voice,
    connectionStatus,
    micStatus,
    fallbackActive,
    userId,
    queueCount: waitingCount,
    mockStatus: mockVoice as any,
  });
  const showTextInput = fallbackActive || preferTextInput || voiceStatusData.status === "unavailable";
  const holdDisabled =
    voiceStatusData.status === "unavailable" ||
    voiceStatusData.status === "waiting" ||
    voice.mode === "ai-speaking";

  // Handlers must be defined before voicePanel JSX uses them
  const handlePressStart = async () => {
    if (!sessionId || !userId) return;
    if (voiceStatusData.status === "unavailable") {
      setVoiceError(voiceStatusData.detail ?? voiceStatusData.message);
      return;
    }
    if (voiceStatusData.status === "waiting") {
      setVoiceError(voiceStatusData.message);
      return;
    }
    if (voice.mode === "ai-speaking") {
      setVoiceError("Patient is speaking. Wait to ask your question.");
      return;
    }
    if (voice.locked) {
      setVoiceError("Voice is locked by the presenter right now.");
      return;
    }
    // Skip pre-flight mic level check on mobile - iOS Safari AudioContext may be suspended
    // until user gesture triggers actual capture. The real capture will fail with a
    // proper error if mic is truly unavailable.
    // if (micStatus !== "blocked" && micLevel < 0.05) {
    //   setVoiceError("No mic input detected. Check your input device or unmute in system settings.");
    //   return;
    // }
    try {
      setVoiceError(null);
      if (!hasFloor) {
        await takeFloorTx(sessionId, { uid: userId, displayName: userDisplayName }, true);
      }
      await voicePatientService.startCapture();
      voiceGatewayClient.startSpeaking(targetCharacter);
      setToast({ message: "Recording… speak now", ts: Date.now() });
    } catch (err: any) {
      console.error("Failed to start capture", err);
      if (err?.message?.toLowerCase()?.includes("blocked")) {
        setMicStatus("blocked");
        setVoiceError("Microphone is blocked. Allow mic access in the browser, then tap Re-check mic.");
      } else if (voice.floorHolderId && voice.floorHolderId !== userId) {
        setVoiceError(`${voice.floorHolderName ?? "Another resident"} is speaking right now.`);
      } else {
        setVoiceError("Could not start microphone. Check input device permissions or refresh, then try again.");
      }
    }
  };

  const handlePressEnd = async () => {
    voicePatientService.stopCapture();
    voiceGatewayClient.stopSpeaking(targetCharacter);
    if (sessionId) {
      setTimeout(() => {
        if (voice.floorHolderId === userId) {
          releaseFloor(sessionId).catch((err: unknown) => console.error("Failed to release floor", err));
        }
      }, FLOOR_RELEASE_DELAY_MS);
    }
  };

  const handleRetryVoice = () => {
    if (!sessionId || !userId) return;
    voiceGatewayClient.disconnect();
    voiceGatewayClient.connect(sessionId, userId, userDisplayName, "participant");
  };

  const handleRecheckMic = async () => {
    try {
      await voicePatientService.recheckPermission();
    } catch (err) {
      console.error("Mic recheck failed", err);
    }
  };

  const voiceStatusBar = (
    <div className="w-full flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <VoiceStatusBadge
          status={voiceStatusData.status}
          message={voiceStatusData.message}
          detail={voiceStatusData.detail}
        />
      </div>
      <div className="text-[11px] text-slate-400 whitespace-nowrap">
        {waitingCount > 1 ? `${waitingCount} waiting` : waitingCount === 1 ? "1 waiting" : "Queue clear"}
      </div>
    </div>
  );
  const voicePanel = (voice.enabled && mockVoice !== "unavailable") ? (
    <CollapsibleVoicePanel
      isExpanded={isVoiceExpanded}
      onToggle={() => {
        setIsVoiceExpanded((v) => {
          const next = !v;
          localStorage.setItem("cq_voice_panel_expanded", String(next));
          return next;
        });
      }}
      statusBar={voiceStatusBar}
    >
      {/* Voice Status Section */}
      <ParticipantVoiceStatusBanner
        connection={connectionStatus}
        micStatus={micStatus}
        hasFloor={hasFloor}
        otherSpeaking={otherSpeaking}
        fallback={fallbackActive}
        throttled={simState?.budget?.throttled}
        locked={voice.locked}
        onRetryVoice={handleRetryVoice}
        onRecheckMic={handleRecheckMic}
        onUseTextInstead={() => {
          setPreferTextInput(true);
          localStorage.setItem("cq_prefer_text_input", "true");
          setToast({ message: "Switched to text questions", ts: Date.now() });
        }}
      />

      {/* Hold to Speak Button - Desktop Only */}
      {!isMobile && (
        <div className="mt-3">
          <HoldToSpeakButton
            disabled={holdDisabled}
            onPressStart={handlePressStart}
            onPressEnd={handlePressEnd}
            labelIdle="Hold to ask your question"
            labelDisabled={
              voiceStatusData.status === "waiting"
                ? voiceStatusData.message
                : voiceStatusData.status === "unavailable"
                ? voiceStatusData.message
                : voice.mode === "ai-speaking"
                ? "Patient is speaking"
                : "Voice unavailable"
            }
            helperText={
              voiceStatusData.status === "active"
                ? "Recording… release when you're done."
                : voiceStatusData.status === "ready"
                ? "Hold to take the floor and speak."
                : voiceStatusData.status === "waiting"
                ? voiceStatusData.detail ?? "Wait for your turn."
                : voiceStatusData.detail ?? "Voice is not available right now."
            }
          />
          {voiceError && <div className="mt-1 text-[11px] text-rose-300">{voiceError}</div>}
        </div>
      )}
      {voiceError && isMobile && <div className="text-[11px] text-rose-300">{voiceError}</div>}

      {/* Quick Actions */}
      {(!fallbackActive && (!showExam || !simState?.telemetry || (latestEkg && !showEkg))) && (
        <div className="mt-3 pt-3 border-t border-slate-800/60">
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold mb-2">Quick actions</div>
          <div className="flex flex-wrap gap-2">
            {!showExam && (
              <button
                type="button"
                onClick={() =>
                  emitCommand(sessionId!, "exam", {}, "nurse", logAndToast).then(() => {
                    setShowExam(true);
                    showToast("Exam requested");
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 text-xs hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11 1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Exam
              </button>
            )}
            {!simState?.telemetry && (
              <button
                type="button"
                onClick={() =>
                  emitCommand(sessionId!, "toggle_telemetry", { enabled: true }, "tech", logAndToast).then(() => {
                    showToast("Telemetry requested");
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 text-xs hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Telemetry
              </button>
            )}
            {latestEkg && !showEkg && (
              <button
                type="button"
                onClick={() => {
                  emitCommand(sessionId!, "show_ekg", {}, "tech", logAndToast);
                  setShowEkg(true);
                  showToast("EKG opened");
                }}
                className="px-3 py-1.5 rounded-lg border text-amber-200 bg-amber-600/10 border-amber-500/50 hover:border-amber-400 hover:bg-amber-600/20 transition-colors flex items-center gap-1.5 text-xs animate-pulse-slow"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                View EKG
              </button>
            )}
          </div>
        </div>
      )}

      {/* Character Selector - Always visible */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-slate-400">Talk to:</span>
        <div className="flex gap-1 flex-wrap">
          {(["patient", "nurse", "tech", "consultant"] as const).map((char) => (
            <button
              key={char}
              type="button"
              onClick={() => setTargetCharacter(char)}
              className={`px-2.5 py-1 rounded-full capitalize transition-colors ${
                targetCharacter === char
                  ? "bg-sky-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {char}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div className="mt-3 pt-2 border-t border-slate-800/60">
        <button
          type="button"
          onClick={() => setShowAdvancedVoice((v) => !v)}
          className="text-[11px] text-slate-500 hover:text-slate-400 flex items-center gap-1.5 w-full"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showAdvancedVoice ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>More options</span>
        </button>

        {showAdvancedVoice && (
          <div className="mt-2 space-y-3 pl-4">
            {/* Queue and mic info */}
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <div>{waitingCount > 1 ? `${waitingCount} residents waiting` : waitingCount === 1 ? "1 resident waiting" : "Queue clear"}</div>
              <div>Mic: {micStatus === "blocked" ? "blocked" : micLevel > 0.2 ? "active" : "no input"}</div>
            </div>

            {/* Voice guide */}
            <button
              type="button"
              onClick={() => setShowVoiceGuide((v) => !v)}
              className="text-[11px] text-sky-400 hover:text-sky-300"
            >
              {showVoiceGuide ? "Hide guide" : "Voice guide"}
            </button>
            {showVoiceGuide && (
              <div className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <ol className="list-decimal list-inside space-y-0.5 text-[10px]">
                  <li>Wait for "Voice ready" status</li>
                  <li>Hold mic button to speak</li>
                  <li>Release when done</li>
                  <li>Check mic permissions if needed</li>
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {showTextInput && (
        <div className="mt-3 bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-2">
          {(fallbackActive || voiceStatusData.status === "unavailable") && (
            <div className="flex items-center gap-2 text-[11px] text-amber-200 bg-amber-900/40 border border-amber-800 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true"></span>
              Voice is unavailable right now—type your question below.
            </div>
          )}
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
            Text fallback
          </div>
          <TextQuestionInput
            disabled={submitting}
            onSubmit={async (text) => {
              if (!sessionId) return;
              setToast({ message: "Text question sent", ts: Date.now() });
              await sendVoiceCommand(sessionId, { type: "order" as any, payload: { text, mode: "text_fallback" } });
              try {
                voiceGatewayClient.sendVoiceCommand("order" as any, { text, mode: "text_fallback" }, "patient");
              } catch {
                // best-effort gateway send; Firestore command already queued
              }
            }}
          />
          {preferTextInput && (
            <button
              type="button"
              onClick={() => {
                setPreferTextInput(false);
                localStorage.setItem("cq_prefer_text_input", "false");
                setToast({ message: "Back to voice mode", ts: Date.now() });
              }}
              className="text-[11px] text-sky-300 underline"
            >
              Return to voice
            </button>
          )}
        </div>
      )}

      {showExam && simState?.exam && (
        <div className="mt-2 bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 space-y-1">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
            Exam
          </div>
          {simState.exam.general && <div><span className="text-slate-500 text-[11px] mr-1">General:</span>{simState.exam.general}</div>}
          {simState.exam.cardio && <div><span className="text-slate-500 text-[11px] mr-1">CV:</span>{simState.exam.cardio}</div>}
          {simState.exam.lungs && <div><span className="text-slate-500 text-[11px] mr-1">Lungs:</span>{simState.exam.lungs}</div>}
          {simState.exam.perfusion && <div><span className="text-slate-500 text-[11px] mr-1">Perfusion:</span>{simState.exam.perfusion}</div>}
          {simState.exam.neuro && <div><span className="text-slate-500 text-[11px] mr-1">Neuro:</span>{simState.exam.neuro}</div>}
          {simState.examAudio && simState.examAudio.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold flex items-center gap-2">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Auscultation (headphones recommended)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {simState.examAudio.map((clip) => {
                  const isPlaying = playingClipId === clip.url;
                  const isLoading = loadingClipId === clip.url;
                  const isActive = isPlaying || isLoading;
                  return (
                    <button
                      key={`${clip.type}-${clip.url}`}
                      type="button"
                      onClick={() => handlePlayExamClip(clip)}
                      disabled={isLoading}
                      className={`px-3 py-2.5 rounded-lg border text-left text-sm transition-all ${
                        isPlaying
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                          : isLoading
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-100"
                          : "border-slate-700 bg-slate-900/70 text-slate-100 hover:border-slate-500 active:scale-[0.98]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                            {clip.type === "heart" ? "Heart" : "Lungs"}
                          </div>
                          <div className="font-semibold truncate">{clip.label}</div>
                        </div>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          isPlaying ? "bg-emerald-500/20" : isLoading ? "bg-amber-500/20" : "bg-slate-800"
                        }`}>
                          {isLoading ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                            </svg>
                          ) : isPlaying ? (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="6" y="4" width="4" height="16" rx="1" />
                              <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className={`text-[11px] mt-1 ${isActive ? "opacity-90" : "text-slate-400"}`}>
                        {isLoading ? "Loading…" : isPlaying ? "Tap to pause" : "Tap to play"}
                      </div>
                    </button>
                  );
                })}
              </div>
              {audioError && (
                <div className="flex items-center gap-2 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {audioError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {simState?.orders && simState.orders.length > 0 && (
        <div className="mt-2 bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold flex items-center justify-between">
            <span>Orders</span>
            <span className="text-[10px] text-slate-400">Student view</span>
          </div>
          <div className="space-y-1">
            {simState.orders.slice(-6).map((order) => {
              const isDone = order.status === "complete";
              const header =
                order.type === "vitals"
                  ? "Vitals"
                  : order.type === "ekg"
                  ? "EKG"
                  : order.type === "labs"
                  ? "Labs"
                  : order.type === "imaging"
                  ? "Imaging"
                  : order.type;
              const eta =
                order.status === "pending"
                  ? `${order.type === "vitals" ? "≈10s" : order.type === "ekg" ? "≈20s" : "≈15s"}`
                  : null;
              const detail = order.result?.summary;
              const highlight =
                order.result?.summary &&
                /elevated|abnormal|shock|effusion|edema|ectasia|rvh|low|high|thickened/i.test(order.result.summary);
              const keyAbnormal = order.result?.abnormal;
              const nextAction = order.result?.nextAction;
              return (
                <div
                  key={order.id}
                  className={`rounded-lg border px-3 py-2 text-[12px] ${
                    isDone ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-100" : "border-slate-700 bg-slate-900/80 text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{header}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em]">
                      {isDone ? "Complete" : "Pending"}
                    </div>
                  </div>
                  {!isDone && eta && <div className="text-[11px] text-slate-400">Result in {eta}</div>}
                  {isDone && order.completedAt && (
                    <div className="text-[10px] text-slate-400">
                      {new Date(order.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                  )}
                  {isDone && detail && (
                    <div
                      className={`text-[12px] mt-1 whitespace-pre-wrap ${
                        highlight ? "text-amber-200" : "text-slate-300"
                      }`}
                    >
                      {detail}
                      {keyAbnormal && (
                        <div className="text-[11px] text-amber-200 mt-1">Key abnormal: {keyAbnormal}</div>
                      )}
                      {nextAction && (
                        <div className="text-[11px] text-slate-300 mt-1">Next: {nextAction}</div>
                      )}
                      {order.result?.rationale && (
                        <div className="text-[11px] text-slate-400 mt-1">{order.result.rationale}</div>
                      )}
                    </div>
                  )}
                  {!isDone && <div className="text-[12px] text-slate-400">Result on the way…</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {showEkg && latestEkg && (
        <div className="mt-2 bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">EKG</div>
            <button
              type="button"
              onClick={() => setShowEkg(false)}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>
          <div className="text-slate-200 whitespace-pre-wrap">
            {latestEkg.result?.summary ?? "EKG ready for review."}
          </div>
          {latestEkg.result?.imageUrl && (
            <div className="mt-2">
              <img
                src={latestEkg.result.imageUrl}
                alt="EKG strip"
                className="w-full max-h-48 object-contain rounded border border-slate-800"
              />
            </div>
          )}
        </div>
      )}
      {/* Case Timeline - shows orders, treatments, and EKGs */}
      {simState && (simState.orders?.length || simState.treatmentHistory?.length || simState.ekgHistory?.length) ? (
        <div className="mt-2">
          <CaseTimeline
            orders={simState.orders}
            treatmentHistory={simState.treatmentHistory}
            ekgHistory={simState.ekgHistory}
            scenarioStartedAt={simState.scenarioStartedAt}
            compact={isMobile}
            maxEvents={isMobile ? 5 : 10}
          />
        </div>
      ) : null}
      {/* Team Role Badge - shows team and lead status */}
      {myTeam && (
        <div className="mt-2">
          <TeamRoleBadge
            teamName={myTeam.teamName}
            isTeamLead={teamLead.isTeamLead}
            canClaimLead={teamLead.canClaimLead}
            onClaimLead={teamLead.claimTeamLead}
            onResignLead={teamLead.resignTeamLead}
            compact={isMobile}
          />
        </div>
      )}
      {/* Team Chat - private communication with teammates */}
      {myTeam && userId && (
        <div className="mt-2">
          <TeamChat
            teamName={myTeam.teamName}
            messages={teamChat.messages}
            currentUserId={userId}
            onSendMessage={teamChat.sendMessage}
            loading={teamChat.loading}
            error={teamChat.error}
            unreadCount={teamChat.unreadCount}
            onMarkAsRead={teamChat.markAsRead}
            compact={isMobile}
          />
        </div>
      )}
      <div className="mt-2 text-[12px] text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-1">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Scoring</div>
        <div>Base: 100 points per correct answer.</div>
        <div>Difficulty: easy x1.0 · medium x1.3 · hard x1.6.</div>
        <div>Streak bonus: +10% for 2 in a row, +20% for 3, +50% for 4+.</div>
      </div>
    </CollapsibleVoicePanel>
  ) : (
    <section className="bg-slate-900/50 rounded-xl p-4 border border-slate-800/50">
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold mb-2">
          Voice Interaction
        </div>
        <p className="text-sm text-slate-400">Voice will be available when the presenter enables it</p>
      </div>
    </section>
  );

  if (!joinCode) return <div className="p-8 text-center text-slate-400">No join code provided.</div>;

  useEffect(() => {
    if (!session?.currentQuestionId) return;
    const section = document.getElementById("question-section");
    if (!section) return;
    if (typeof section.scrollIntoView !== "function") return;
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  }, [session?.currentQuestionId]);

  if (loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4">
        <SessionSkeleton />
      </div>
    );
  }

  if (!session || !sessionId) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50 space-y-4 p-6"
        data-testid="session-not-found"
      >
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-slate-700 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        </div>
        <h2 className="text-xl font-bold">Session Not Found</h2>
        <p className="text-slate-400 text-center max-w-xs">
            We couldn't find a session with code{" "}
            <span className="font-mono text-sky-400 bg-sky-950/30 px-2 py-1 rounded mx-1">
              {(joinCode || "????").toUpperCase?.() ?? "????"}
            </span>.
        </p>
        <p className="text-slate-500 text-sm text-center max-w-xs">
          The session may have ended or the code might be incorrect.
        </p>
        <div className="w-full max-w-xs space-y-2">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-2">
            <label htmlFor="retry-code" className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
              Enter a join code
            </label>
            <input
              id="retry-code"
              type="text"
              inputMode="text"
              maxLength={4}
              defaultValue={joinCode?.toUpperCase() ?? ""}
              onChange={(e) => handleInlineCodeChange(e.target.value)}
              className="w-full text-center font-mono tracking-widest bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-lg uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="CODE"
            />
          </div>
          <button
            type="button"
            onClick={() => setFindAttempt((n) => n + 1)}
            className="w-full px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-700 text-slate-100"
          >
            Retry this code
          </button>
          <Link
            to="/"
            className="w-full inline-flex justify-center px-6 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm font-semibold transition-colors text-white"
          >
            Go to home
          </Link>
        </div>
        <p className="text-xs text-slate-500 text-center max-w-xs">
          Tip: Confirm the presenter’s latest join code and check for typos.
        </p>
      </div>
    );
  }

  const stopExamAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingClipId(null);
    setLoadingClipId(null);
  };

  const handlePlayExamClip = (clip: { url: string; label: string }) => {
    setAudioError(null);
    const isSame = playingClipId === clip.url || loadingClipId === clip.url;
    if (isSame) {
      stopExamAudio();
      return;
    }
    stopExamAudio();
    const el = new Audio(clip.url);
    audioRef.current = el;
    setLoadingClipId(clip.url);

    el.oncanplaythrough = () => {
      setLoadingClipId(null);
      setPlayingClipId(clip.url);
    };
    el.onended = () => stopExamAudio();
    el.onerror = () => {
      setAudioError("Audio unavailable. Please try again or check assets.");
      stopExamAudio();
    };
    el.play().catch(() => {
      setAudioError("Could not play audio. Check browser permissions.");
      stopExamAudio();
    });
  };

  const handleLeaveSession = () => {
    const shouldLeave = window.confirm("Leave this session?");
    if (!shouldLeave) return;
    try {
      voiceGatewayClient.disconnect();
    } catch {
      // best effort
    }
    window.location.assign("/#/");
  };

  const handleChoice = async (choiceIndex: number) => {
    if (!currentQuestion || !isQuestionActive || !userId || !sessionId) return;
    if (submitting) return;
    setSubmitError(null);
    setSelectedChoice(choiceIndex); // optimistic selection
    setSubmitting(true);
    try {
      const responseId = `${userId}_${currentQuestion.id}`;
      const responseRef = doc(db, "sessions", sessionId, "responses", responseId);
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      const isCorrect = choiceIndex === currentQuestion.correctIndex;
      const difficultyMultiplier = getDifficultyMultiplier(currentQuestion.difficulty);

      const existingResponse = await getDoc(responseRef);
      const isFirstResponse =
        !existingResponse ||
        (typeof existingResponse.exists === "function" ? !existingResponse.exists() : !existingResponse.exists);

      await setDoc(responseRef, {
        sessionId,
        userId,
        questionId: currentQuestion.id,
        choiceIndex,
        createdAt: new Date().toISOString(),
      });

      // Update participant score & streak in a transaction to avoid race conditions
      if (isFirstResponse) {
        await runTransaction(db, async (transaction: any) => {
          const participantSnap = await transaction.get(participantRef);
          const snapHasData =
            typeof participantSnap?.exists === "function"
              ? participantSnap.exists()
              : Boolean(participantSnap?.exists);
          const data = participantSnap?.data ? participantSnap.data() : participantSnap?.data?.();
          const existing: Partial<ParticipantDoc> = snapHasData ? data ?? {} : {};

          const currentStreak = existing.streak ?? 0;
          const streakMultiplier = getStreakMultiplier(currentStreak);
          const questionScore = isCorrect ? Math.round(100 * difficultyMultiplier * streakMultiplier) : 0;
          const nextStreak = isCorrect ? currentStreak + 1 : 0;

          const payload: ParticipantDoc = {
            userId,
            sessionId,
            teamId: existing.teamId ?? TEAM_OPTIONS[0].id,
            teamName: existing.teamName ?? TEAM_OPTIONS[0].name,
            points: (existing.points ?? 0) + questionScore,
            streak: nextStreak,
            correctCount: (existing.correctCount ?? 0) + (isCorrect ? 1 : 0),
            incorrectCount: (existing.incorrectCount ?? 0) + (isCorrect ? 0 : 1),
            createdAt: existing.createdAt ?? new Date().toISOString(),
          };

          if (snapHasData) {
            transaction.update(participantRef, payload);
          } else {
            transaction.set(participantRef, payload);
          }
        });
      }
    } catch (err) {
        console.error("Failed to submit answer", err);
        setSelectedChoice(null);
        setSubmitError("Could not record your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col" id="main-content">
      <header className="p-3 border-b border-slate-900 bg-slate-950 sticky top-0 z-20 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="font-bold text-slate-200 tracking-tight text-sm">CardioQuest</div>
            <div className="text-[11px] font-mono bg-slate-900 px-2 py-0.5 rounded text-sky-400 border border-slate-800">
              {session.joinCode}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Vitals chip - shown when telemetry/vitals ordered */}
            {simState?.vitals && (simState.telemetry || simState.orders?.some(o => o.type === "vitals" && o.status === "complete")) && (
              <CompactVitalsChip
                vitals={{
                  hr: simState.vitals.hr as number | undefined,
                  spo2: simState.vitals.spo2 as number | undefined,
                  bp: simState.vitals.bp as string | undefined,
                  rr: simState.vitals.rr as number | undefined,
                }}
                rhythmSummary={simState.rhythmSummary}
                onClick={() => setShowVitalsPanel(v => !v)}
              />
            )}
            <div
              className={`text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full border ${
                connectionStatus.state === "ready"
                  ? "border-emerald-500/60 text-emerald-200"
                  : connectionStatus.state === "connecting"
                  ? "border-sky-500/60 text-sky-200"
                  : "border-slate-700 text-slate-400"
              }`}
            >
              {connectionStatus.state === "ready" ? "Live" : connectionStatus.state}
            </div>
            <button
              type="button"
              onClick={handleLeaveSession}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600 transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
        {/* Expanded vitals panel */}
        {showVitalsPanel && simState?.vitals && (
          <div className="mt-2 bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2 animate-slide-down">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Vitals Monitor</div>
              <button
                type="button"
                onClick={() => setShowVitalsPanel(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-slate-100">{simState.vitals.hr ?? "—"}</div>
                <div className="text-[9px] text-slate-500 uppercase">HR</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-100">{simState.vitals.bp ?? "—"}</div>
                <div className="text-[9px] text-slate-500 uppercase">BP</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-100">{simState.vitals.spo2 ?? "—"}%</div>
                <div className="text-[9px] text-slate-500 uppercase">SpO₂</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-100">{simState.vitals.rr ?? "—"}</div>
                <div className="text-[9px] text-slate-500 uppercase">RR</div>
              </div>
            </div>
            {simState.rhythmSummary && (
              <div className="text-xs text-slate-300 border-t border-slate-800 pt-2 mt-2">
                <span className="text-slate-500">Rhythm:</span> {simState.rhythmSummary}
              </div>
            )}
          </div>
        )}
      </header>

      <main className={`flex-1 p-4 max-w-md mx-auto w-full flex flex-col gap-6 ${isMobile && voice.enabled ? "pb-36" : "pb-[env(safe-area-inset-bottom)]"}`}>
        {isOffline && (
          <div className="bg-amber-900/40 border border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-100 flex items-center gap-2" role="status" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true"></span>
            Reconnecting… check your connection; your progress is saved locally.
          </div>
        )}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Voice status: {voiceStatusData.message}
          {voiceStatusData.detail ? `, ${voiceStatusData.detail}` : ""}
          {voiceStatusData.status === "active" ? ", recording started" : ""}
          {voiceStatusData.status === "ready" && voice.mode === "ai-speaking" ? ", patient is responding" : ""}
        </div>
        {toast && (
          <div
            className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-[12px] text-slate-100 shadow-md shadow-black/30"
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        )}
        {assessmentRequest && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2 text-[12px] text-amber-100 shadow-sm shadow-amber-900/30 flex items-center justify-between">
            <div>
              <div className="font-semibold">Presenter requests assessment</div>
              <div className="text-[11px] text-amber-200/90">
                Stage: {assessmentRequest.stage ?? "unknown"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const ts = Date.now();
                setAssessmentRequest(null);
                try {
                  voiceGatewayClient.sendVoiceCommand("assessment_ack" as any, { ts });
                } catch (err: unknown) {
                  console.error("Failed to ack assessment", err);
                }
                setToast({ message: "Assessment acknowledged", ts });
              }}
              className="px-2 py-1 rounded border border-amber-500/60 text-[11px] text-amber-100 hover:border-amber-400"
            >
              Got it
            </button>
          </div>
        )}
        {!isMobile && voicePanel}


        {currentQuestion ? (
          <section id="question-section" className="scroll-mt-20 animate-slide-up">
            <div className="sr-only" aria-live="polite">
              {isQuestionActive
                ? "Question open for answers"
                : session.showResults
                ? "Results are shown"
                : "Waiting for presenter to open question"}
            </div>
            <h3 className="text-xs font-bold text-sky-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                {isQuestionActive ? (
                    <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Question
                    </>
                ) : (
                    <span className="text-slate-500">Wait for presenter...</span>
                )}
            </h3>
            
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-lg relative overflow-hidden">
                {!isQuestionActive && !session.showResults && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-amber-200 bg-amber-900/30 border border-amber-800 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true"></span>
                    Waiting for presenter to open this question
                  </div>
                )}
                <p className="text-sm font-semibold mb-4 leading-relaxed">
                    {currentQuestion.stem}
                </p>
                <div className="mb-3 text-[11px] text-slate-400 bg-slate-800/40 border border-slate-800 rounded-lg px-3 py-2">
                  Scoring: first answer counts. Base 100 × difficulty{" "}
                  {currentQuestion.difficulty === "hard"
                    ? "1.6x"
                    : currentQuestion.difficulty === "medium"
                    ? "1.3x"
                    : "1.0x"}{" "}
                  with streak bonus for consecutive correct answers (x1.1, x1.2, x1.5).
                </div>
                <div className="grid grid-cols-1 gap-3 relative z-10">
                {currentQuestion.options.map((opt, i) => {
                    const isSelected = selectedChoice === i;
                    const isCorrect = session.showResults && i === currentQuestion.correctIndex;
                    
                    // Determine button style state
                    let btnClass = "border-slate-700 bg-slate-900/80 hover:bg-slate-800/80"; // default
                    const motionAware = "transform-gpu transition-transform";
                    if (isSelected) btnClass = `border-sky-500 bg-sky-500/15 text-sky-100 ring-1 ring-sky-500/50 motion-safe:animate-select-pop ${motionAware}`;
                    if (isCorrect) btnClass = `border-emerald-500 bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/50 motion-safe:animate-correct-pulse ${motionAware}`;
                    if (!isQuestionActive && !session.showResults) btnClass = "opacity-70 cursor-not-allowed border-slate-800 bg-slate-900/70";

                    return (
                    <button
                        key={i}
                        data-testid={`answer-option-${i}`}
                        disabled={submitting || (!isQuestionActive && !session.showResults)}
                        onClick={() => handleChoice(i)}
                        className={`w-full text-left rounded-xl border px-4 py-3 text-base sm:text-lg transition-all duration-200 relative overflow-hidden group whitespace-normal break-words leading-tight shadow-sm
                        ${btnClass}
                        `}
                    >
                        <div className="flex items-start gap-3 relative z-10">
                            <span className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors
                                ${isSelected ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'}
                                ${isCorrect ? '!bg-emerald-500 !text-white' : ''}
                            `}>
                            {String.fromCharCode(65 + i)}
                            </span>
                            <span className="leading-snug">{opt}</span>
                        </div>
                    </button>
                    );
                })}
                </div>
                
                {session.showResults && (
                    <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-900/50 rounded-lg animate-fade-in">
                        <p className="text-xs text-emerald-400 font-semibold">
                        Correct Answer: {String.fromCharCode(65 + (currentQuestion.correctIndex ?? 0))}
                        </p>
                    </div>
                )}

                {/* Status Indicator */}
                <div className="mt-4 flex justify-center">
                    {selectedChoice !== null && !session.showResults && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-900/40 border border-sky-800 rounded-full text-xs text-sky-300 font-medium animate-fade-in">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Answer Recorded
                        </div>
                    )}
                    
                    {!isQuestionActive && !session.showResults && (
                        <div className="text-xs text-center text-slate-500 italic">
                            Waiting for presenter to open voting...
                        </div>
                    )}
                </div>
                {submitError && (
                  <div className="mt-3 text-center text-xs text-rose-300">
                    {submitError}
                  </div>
                )}
            </div>
          </section>
        ) : (
          <div className="py-8 text-center text-slate-500 text-sm bg-slate-900/50 rounded-xl border border-slate-900 border-dashed">
            Waiting for the next question.
          </div>
        )}
        {isMobile && voicePanel}
      </main>
      {/* Mobile Character Selector + Floating Mic */}
      {isMobile && voice.enabled && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
          {/* Character selector bar */}
          <div className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 px-4 py-2 flex items-center justify-center gap-1.5">
            <span className="text-[10px] text-slate-500 mr-1">Talk to:</span>
            {(["patient", "nurse", "tech", "consultant"] as const).map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => setTargetCharacter(char)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium capitalize transition-colors ${
                  targetCharacter === char
                    ? "bg-sky-600 text-white"
                    : "bg-slate-800 text-slate-400 active:bg-slate-700"
                }`}
              >
                {char}
              </button>
            ))}
          </div>
          {/* Floating mic button */}
          <div className="flex justify-center py-3 bg-slate-950/90">
            <FloatingMicButton
              disabled={holdDisabled}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
              statusLabel={voiceStatusData.message}
              connectionState={connectionStatus.state === "ready" ? "connected" : connectionStatus.state === "connecting" ? "connecting" : "disconnected"}
              aiSpeaking={voice.mode === "ai-speaking"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
