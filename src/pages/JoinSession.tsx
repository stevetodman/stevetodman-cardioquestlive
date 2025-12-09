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
  character?: CharacterId
) {
  sendVoiceCommand(sessionId, { type, payload, character }).catch((err: unknown) => {
    console.error("Failed to queue voice command", err);
  });
  try {
    voiceGatewayClient.sendVoiceCommand(type as any, payload, character);
  } catch (err) {
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
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [showVoiceGuide, setShowVoiceGuide] = useState<boolean>(false);
  const [showAdvancedVoice, setShowAdvancedVoice] = useState(false);
  const [isVoiceExpanded, setIsVoiceExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
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
      <div className="flex flex-wrap gap-2 text-[11px]">
        {!fallbackActive && !showExam && (
          <button
            type="button"
            onClick={() =>
              emitCommand(sessionId!, "exam", {}, "nurse").then(() => {
                setShowExam(true);
                setToast({ message: "Exam requested", ts: Date.now() });
              })
            }
            className="px-3 py-2 rounded-lg bg-indigo-600/10 border border-indigo-500/60 text-indigo-100 hover:border-indigo-400 hover:bg-indigo-600/20 transition-colors"
          >
            Check exam
          </button>
        )}
        {!fallbackActive && !simState?.telemetry && (
          <button
            type="button"
            onClick={() =>
              emitCommand(sessionId!, "toggle_telemetry", { enabled: true }, "tech").then(() =>
                setToast({ message: "Telemetry requested", ts: Date.now() })
              )
            }
            className="px-3 py-2 rounded-lg bg-emerald-600/10 border border-emerald-500/60 text-emerald-100 hover:border-emerald-400 hover:bg-emerald-600/20 transition-colors"
          >
            Start telemetry
          </button>
        )}
        {latestEkg && !showEkg && (
          <button
            type="button"
            onClick={() => {
              emitCommand(sessionId!, "show_ekg", {}, "tech");
              setShowEkg(true);
              setToast({ message: "EKG opened", ts: Date.now() });
            }}
            className="px-3 py-2 rounded-lg border text-amber-100 bg-amber-600/10 border-amber-500/60 hover:border-amber-400 hover:bg-amber-600/20 transition-colors animate-pulse-slow"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              View EKG results
            </span>
          </button>
        )}
      </div>

      {targetCharacter !== "patient" && (
        <div className="mt-3 flex items-center gap-3 flex-wrap text-xs">
          <span className="text-[11px] text-slate-400">
            Asking: <span className="font-semibold text-slate-200 capitalize">{targetCharacter}</span>
          </span>
          <button
            type="button"
            onClick={() => setTargetCharacter("patient")}
            className="text-[11px] text-sky-400 hover:text-sky-300 underline"
          >
            Switch back to patient
          </button>
        </div>
      )}

      <div className="mt-2 border-t border-slate-800 pt-2">
        <button
          type="button"
          onClick={() => setShowAdvancedVoice((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-2 w-full"
        >
          <span>Advanced options</span>
          <svg
            className={`w-3 h-3 transition-transform ${showAdvancedVoice ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvancedVoice && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label
                htmlFor="target-character"
                className="text-[11px] uppercase tracking-[0.14em] text-slate-300 font-semibold"
              >
                Ask
              </label>
              <select
                id="target-character"
                value={targetCharacter}
                onChange={(e) => setTargetCharacter(e.target.value as CharacterId)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
              >
                <option value="patient">Patient</option>
                <option value="nurse">Nurse</option>
                <option value="tech">Tech</option>
                <option value="imaging">Imaging</option>
                <option value="consultant">Consultant</option>
              </select>
              <span className="text-[11px] text-slate-500">Choose who to direct your question to</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3">
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
        <div className="mt-1 text-[11px] text-slate-500">
          {waitingCount > 1 ? `${waitingCount} residents waiting to speak` : waitingCount === 1 ? "1 resident waiting to speak" : "Queue is clear"}
        </div>
        <div className="text-[11px] text-slate-500">
          Mic check: {micStatus === "blocked" ? "blocked" : micLevel > 0.2 ? "input detected" : "no input yet"}
        </div>
        <button
          type="button"
          onClick={() => setShowVoiceGuide((v) => !v)}
          className="mt-2 text-[11px] text-sky-300 underline"
        >
          {showVoiceGuide ? "Hide voice guide" : "Show voice guide"}
        </button>
        {showVoiceGuide && (
          <div className="mt-1 text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-1">
            <div className="font-semibold text-slate-200">Voice steps</div>
            <ol className="list-decimal list-inside space-y-1">
              <li>Wait for Voice: Ready.</li>
              <li>Hold to speak. Floor is taken automatically.</li>
              <li>Release to stop. Floor auto-releases after 2s (and 60s idle safety).</li>
              <li>If no input, check mic or allow permissions.</li>
              <li>If fallback on, use typed questions until voice resumes.</li>
            </ol>
          </div>
        )}
      </div>

      {!isMobile && (
        <div className="mt-3 space-y-2">
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
                ? "Recording… release when you're done. Floor auto-releases after 2s."
                : voiceStatusData.status === "ready"
                ? "Hold to take the floor automatically and speak."
                : voiceStatusData.status === "waiting"
                ? voiceStatusData.detail ?? "Wait for your turn."
                : voiceStatusData.detail ?? "Voice is not available right now."
            }
          />
          {voiceError && <div className="text-[11px] text-rose-300">{voiceError}</div>}
        </div>
      )}
      {voiceError && isMobile && <div className="text-[11px] text-rose-300">{voiceError}</div>}

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
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                Auscultation (headphones recommended)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {simState.examAudio.map((clip) => (
                  <button
                    key={`${clip.type}-${clip.url}`}
                    type="button"
                    onClick={() => handlePlayExamClip(clip)}
                    className={`px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                      playingClipId === clip.url
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                        : "border-slate-700 bg-slate-900/70 text-slate-100 hover:border-slate-500"
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {clip.type === "heart" ? "Heart" : "Lungs"}
                    </div>
                    <div className="font-semibold">{clip.label}</div>
                    <div className="text-[11px] text-slate-400">
                      {playingClipId === clip.url ? "Pause" : "Play clip"}
                    </div>
                  </button>
                ))}
              </div>
              {audioError && <div className="text-[11px] text-rose-300">{audioError}</div>}
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
    if (micStatus !== "blocked" && micLevel < 0.05) {
      setVoiceError("No mic input detected. Check your input device or unmute in system settings.");
      return;
    }
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
  const stopExamAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingClipId(null);
  };

  const handlePlayExamClip = (clip: { url: string; label: string }) => {
    setAudioError(null);
    const isSame = playingClipId === clip.url;
    if (isSame) {
      stopExamAudio();
      return;
    }
    stopExamAudio();
    const el = new Audio(clip.url);
    audioRef.current = el;
    setPlayingClipId(clip.url);
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

  const handleRetryVoice = () => {
    if (!sessionId || !userId) return;
    voiceGatewayClient.disconnect();
    voiceGatewayClient.connect(sessionId, userId, userDisplayName, "participant");
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

  const handleRecheckMic = async () => {
    try {
      await voicePatientService.recheckPermission();
    } catch (err) {
      console.error("Mic recheck failed", err);
    }
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
      <header className="p-4 border-b border-slate-900 bg-slate-950 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 shadow-lg shadow-black/20">
        <div className="font-bold text-slate-200 tracking-tight">CardioQuest</div>
        <div className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-sky-400 border border-slate-800">
          {session.joinCode}
        </div>
        <div
          className={`text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full border ${
            connectionStatus.state === "ready"
              ? "border-emerald-500/60 text-emerald-200"
              : connectionStatus.state === "connecting"
              ? "border-sky-500/60 text-sky-200"
              : "border-slate-700 text-slate-400"
          }`}
        >
          Voice: {connectionStatus.state}
        </div>
        <button
          type="button"
          onClick={handleLeaveSession}
          className="text-xs px-3 py-1 rounded-lg border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-slate-600 transition-colors"
        >
          Leave session
        </button>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col gap-6 pb-[env(safe-area-inset-bottom)]">
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
                voiceGatewayClient.sendVoiceCommand("assessment_ack" as any, { ts }).catch((err: unknown) => {
                  console.error("Failed to ack assessment", err);
                });
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
      {isMobile && voice.enabled && (
        <FloatingMicButton
          disabled={holdDisabled}
          onPressStart={handlePressStart}
          onPressEnd={handlePressEnd}
          statusLabel={voiceStatusData.message}
        />
      )}
    </div>
  );
}
