import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
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
  updateDoc,
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
import { CaseTimeline } from "../components/CaseTimeline";
import { TeamChat } from "../components/TeamChat";
import { useTeamChat } from "../hooks/useTeamChat";
import { useTeamLead } from "../hooks/useTeamLead";
import { TeamRoleBadge } from "../components/TeamRoleBadge";
import { EkgViewer } from "../components/EkgViewer";
import { CxrViewer } from "../components/CxrViewer";
import { QuickActionsBar, CharacterSelector, ExamFindingsPanel, ParticipantOrdersPanel, ParticipantHeader, QuestionSection, QuestionPlaceholder } from "../components/participant";
import { CardPanel, SectionLabel } from "../components/ui";
import { FLOOR_AUTO_RELEASE_MS, FLOOR_RELEASE_DELAY_MS, DEFAULT_TIMEOUT_MS } from "../constants";
import { getStreakMultiplier, calculatePoints } from "../utils/scoringUtils";
import { useNotifications } from "../hooks/useNotifications";
import { getOrCreateRandomName } from "../utils/names";

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
  const [displayName, setDisplayName] = useState<string>(
    auth?.currentUser?.displayName ?? getOrCreateRandomName()
  );
  const [micLevel, setMicLevel] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [targetCharacter, setTargetCharacter] = useState<CharacterId>("patient");
  const [connectionStatus, setConnectionStatus] = useState<VoiceConnectionStatus>({
    state: "disconnected",
    lastChangedAt: Date.now(),
  });
  const [voiceInsecureMode, setVoiceInsecureMode] = useState(false);
  const [simState, setSimState] = useState<{
    stageId: string;
    vitals: Record<string, unknown>;
    exam?: Record<string, string | undefined>;
    examAudio?: { type: "heart" | "lung"; label: string; url: string }[];
    telemetry?: boolean;
    rhythmSummary?: string;
    telemetryWaveform?: number[];
    fallback: boolean;
    voiceFallback?: boolean;
    correlationId?: string;
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
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [lastFloorHolder, setLastFloorHolder] = useState<string | null>(null);
  const [lastFallback, setLastFallback] = useState<boolean | null>(null);
  const [assessmentRequest, setAssessmentRequest] = useState<{ ts: number; stage?: string } | null>(null);
  const [preferTextInput, setPreferTextInput] = useState<boolean>(() => {
    const stored = localStorage.getItem("cq_prefer_text_input");
    return stored === "true";
  });
  const characterAudioRef = useRef<HTMLAudioElement | null>(null);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [showVoiceGuide, setShowVoiceGuide] = useState<boolean>(false);
  const [showAdvancedVoice, setShowAdvancedVoice] = useState(false);
  const [isVoiceExpanded, setIsVoiceExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [showVitalsPanel, setShowVitalsPanel] = useState(false);
  const [myTeam, setMyTeam] = useState<{ teamId: string; teamName: string } | null>(null);
  const [viewingEkgOrder, setViewingEkgOrder] = useState<{
    imageUrl?: string;
    summary?: string;
    timestamp?: number;
    orderedBy?: { name: string };
  } | null>(null);
  const [viewingCxrOrder, setViewingCxrOrder] = useState<{
    imageUrl?: string;
    summary?: string;
    timestamp?: number;
    orderedBy?: { name: string };
    viewType?: "PA" | "AP" | "Lateral";
  } | null>(null);
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
  const voiceFromFirestore = useVoiceState(sessionId);
  const [mockVoiceEnabled, setMockVoiceEnabled] = useState(false);
  // Allow test override of voice.enabled via mockVoiceEnabled query param
  const voice = mockVoiceEnabled ? { ...voiceFromFirestore, enabled: true } : voiceFromFirestore;
  const userDisplayName = displayName;
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
    // Test hook for mock fallback state (E2E testing)
    const mockFallbackParam = params.get("mockFallback");
    if (mockFallbackParam === "true") {
      setMockVoiceEnabled(true); // Enable voice panel so banner is visible
      setSimState({
        stageId: "mock-fallback",
        vitals: {},
        fallback: true,
        voiceFallback: true,
      });
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUserId(user?.uid ?? null);
      if (user) {
        // If user has no displayName, assign a random one
        if (!user.displayName) {
          const randomName = getOrCreateRandomName();
          try {
            await updateProfile(user, { displayName: randomName });
            setDisplayName(randomName);
          } catch (err) {
            console.error("Failed to set random display name", err);
            setDisplayName(randomName); // Still use it locally
          }
        } else {
          setDisplayName(user.displayName);
        }
      }
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

  // Refresh auth token before reconnects so secure gateways accept joins after token expiry
  useEffect(() => {
    if (!auth) return;
    voiceGatewayClient.setTokenRefresher(async () => {
      if (!auth.currentUser?.getIdToken) return undefined;
      try {
        return await auth.currentUser.getIdToken(true);
      } catch {
        return undefined;
      }
    });
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
    const unsub = voiceGatewayClient.onStatus((status) => {
      setConnectionStatus(status);
      if (status.state === "ready") {
        setVoiceInsecureMode(voiceGatewayClient.isInsecureMode());
      }
    });
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

  // Reset local selection and track question start time when question changes
  useEffect(() => {
    setSelectedChoice(null);
    if (session?.currentQuestionId) {
      setQuestionStartTime(Date.now());
    }
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
            displayName,
            inactive: false,
          };
          tx.set(participantRef, participantDoc);
        });
      } catch (err) {
        console.error("Failed to ensure participant doc", err);
      }
    }
    ensureParticipantDoc();
  }, [sessionId, userId, displayName]);

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

  // Track active/inactive status for participant
  useEffect(() => {
    if (!sessionId || !userId) return;
    const participantRef = doc(db, "sessions", sessionId, "participants", userId);

    // Mark as active on mount/reconnect
    const markActive = () => {
      updateDoc(participantRef, { inactive: false }).catch(() => {
        // Ignore errors (doc might not exist yet)
      });
    };

    // Mark as inactive when leaving
    const markInactive = () => {
      updateDoc(participantRef, { inactive: true }).catch(() => {
        // Ignore errors
      });
    };

    // Mark active on mount
    markActive();

    // Mark inactive on page unload
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery during unload
      markInactive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markInactive();
      } else if (document.visibilityState === "visible") {
        markActive();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Mark inactive on cleanup (component unmount)
      markInactive();
    };
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
  const latestImaging = useMemo(() => {
    const imgs = (simState?.orders ?? []).filter((o) => o.type === "imaging" && o.status === "complete");
    return imgs.length ? imgs[imgs.length - 1] : null;
  }, [simState?.orders]);
  const voiceStatusData = useSimplifiedVoiceState({
    voice,
    connectionStatus,
    micStatus,
    fallbackActive,
    voiceFallback: simState?.voiceFallback,
    userId,
    queueCount: waitingCount,
    mockStatus: mockVoice as any,
    insecureMode: voiceInsecureMode,
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
      // Use requestPermission which works on Safari (triggers actual getUserMedia prompt)
      await voicePatientService.requestPermission();
    } catch (err) {
      console.error("Mic recheck failed", err);
    }
  };

  const voiceStatusBar = (
    <div className="w-full flex flex-col gap-1">
      <div className="flex items-center gap-3">
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
      {voiceStatusData.insecureMode && (
        <div className="text-[10px] text-amber-400 bg-amber-900/30 border border-amber-700/50 rounded px-2 py-0.5">
          ⚠️ Insecure voice WS (dev only)
        </div>
      )}
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
      {!fallbackActive && (
        <QuickActionsBar
          sessionId={sessionId!}
          showExam={showExam}
          hasTelemetry={!!simState?.telemetry}
          hasEkg={!!latestEkg}
          showEkg={showEkg}
          onRequestExam={() =>
            emitCommand(sessionId!, "exam", {}, "nurse", logAndToast).then(() => {
              setShowExam(true);
              showToast("Exam requested");
            })
          }
          onRequestTelemetry={() =>
            emitCommand(sessionId!, "toggle_telemetry", { enabled: true }, "tech", logAndToast).then(() => {
              showToast("Telemetry requested");
            })
          }
          onViewEkg={() => {
            emitCommand(sessionId!, "show_ekg", {}, "tech", logAndToast);
            setShowEkg(true);
            showToast("EKG opened");
          }}
        />
      )}

      {/* Character Selector - Always visible */}
      <CharacterSelector
        selectedCharacter={targetCharacter}
        onSelect={setTargetCharacter}
      />

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
          <SectionLabel>Text fallback</SectionLabel>
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

      {showExam && simState?.exam && Object.values(simState.exam).some(v => v) && (
        <ExamFindingsPanel
          exam={simState.exam}
          examAudio={simState.examAudio}
        />
      )}
      {simState?.orders && simState.orders.length > 0 && (
        <ParticipantOrdersPanel
          orders={simState.orders as any}
          onViewEkg={(order) => setViewingEkgOrder({
            imageUrl: order.result?.imageUrl,
            summary: order.result?.summary,
            timestamp: order.completedAt,
            orderedBy: order.orderedBy,
          })}
          onViewCxr={(order) => setViewingCxrOrder({
            imageUrl: order.result?.imageUrl,
            summary: order.result?.summary,
            timestamp: order.completedAt,
            orderedBy: order.orderedBy,
            viewType: "PA",
          })}
        />
      )}
      {showEkg && latestEkg && (
        <div className="mt-2 bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel>EKG</SectionLabel>
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
        <SectionLabel>Scoring</SectionLabel>
        <div>Base: 100 points per correct answer.</div>
        <div>Difficulty: easy x1.0 · medium x1.3 · hard x1.6.</div>
        <div>Streak bonus: +10% for 2 in a row, +20% for 3, +50% for 4+.</div>
      </div>
    </CollapsibleVoicePanel>
  ) : (
    <section className="bg-slate-900/50 rounded-xl p-4 border border-slate-800/50">
      <div className="text-center">
        <SectionLabel className="mb-2">Voice Interaction</SectionLabel>
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

    // Calculate response time for time bonus
    const responseTimeMs = questionStartTime ? Date.now() - questionStartTime : undefined;

    try {
      const responseId = `${userId}_${currentQuestion.id}`;
      const responseRef = doc(db, "sessions", sessionId, "responses", responseId);
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      const isCorrect = choiceIndex === currentQuestion.correctIndex;

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
          // New scoring: base 100 × streak × time bonus (no difficulty)
          const questionScore = isCorrect ? calculatePoints(currentStreak, responseTimeMs) : 0;
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
            displayName: existing.displayName ?? displayName,
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
      <ParticipantHeader
        joinCode={session.joinCode}
        connectionState={connectionStatus.state}
        vitals={simState?.vitals ? {
          hr: simState.vitals.hr as number | undefined,
          spo2: simState.vitals.spo2 as number | undefined,
          bp: simState.vitals.bp as string | undefined,
          rr: simState.vitals.rr as number | undefined,
        } : undefined}
        rhythmSummary={simState?.rhythmSummary}
        showVitals={Boolean(simState?.vitals && (simState.telemetry || simState.orders?.some(o => o.type === "vitals" && o.status === "complete")))}
        showVitalsPanel={showVitalsPanel}
        onToggleVitalsPanel={() => setShowVitalsPanel(v => !v)}
        onCloseVitalsPanel={() => setShowVitalsPanel(false)}
        onLeave={handleLeaveSession}
      />

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
          <QuestionSection
            question={currentQuestion}
            isActive={isQuestionActive}
            showResults={session.showResults}
            selectedChoice={selectedChoice}
            submitting={submitting}
            submitError={submitError}
            onSelectChoice={handleChoice}
          />
        ) : (
          <QuestionPlaceholder />
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

      {/* Full-screen EKG Viewer Modal */}
      {viewingEkgOrder && (
        <EkgViewer
          imageUrl={viewingEkgOrder.imageUrl}
          summary={viewingEkgOrder.summary}
          timestamp={viewingEkgOrder.timestamp}
          orderedBy={viewingEkgOrder.orderedBy}
          patientName={simState?.scenarioId ? simState.scenarioId.replace(/_/g, " ") : "Patient"}
          onClose={() => setViewingEkgOrder(null)}
        />
      )}

      {/* Full-screen CXR Viewer Modal */}
      {viewingCxrOrder && (
        <CxrViewer
          imageUrl={viewingCxrOrder.imageUrl}
          summary={viewingCxrOrder.summary}
          timestamp={viewingCxrOrder.timestamp}
          orderedBy={viewingCxrOrder.orderedBy}
          patientName={simState?.scenarioId ? simState.scenarioId.replace(/_/g, " ") : "Patient"}
          viewType={viewingCxrOrder.viewType}
          onClose={() => setViewingCxrOrder(null)}
        />
      )}
    </div>
  );
}
