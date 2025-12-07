import React, { useEffect, useMemo, useState } from "react";
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
  sendVoiceCommand(sessionId, { type, payload, character }).catch(() => {});
  try {
    voiceGatewayClient.sendVoiceCommand(type as any, payload, character);
  } catch {
    // ignore
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
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(
    isConfigured ? auth?.currentUser?.uid ?? null : getLocalUserId()
  );
  const [voiceActionPending, setVoiceActionPending] = useState(false);
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
  const voice = useVoiceState(sessionId);
  const userDisplayName = auth?.currentUser?.displayName ?? "Resident";

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
  }, [joinCode, userId]);

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

  useEffect(() => {
    const unsub = voicePatientService.onPermissionChange((status) => setMicStatus(status));
    voicePatientService.recheckPermission().catch(() => {});
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
    const unsub = voiceGatewayClient.onSimState((state) => setSimState(state));
    return () => unsub();
  }, []);

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

  // Ensure participant doc exists and assign a team (transaction to avoid race)
  useEffect(() => {
    async function ensureParticipantDoc() {
      if (!sessionId || !userId) return;
      const participantRef = doc(db, "sessions", sessionId, "participants", userId);
      try {
        await runTransaction(db, async (tx) => {
          const existing = await tx.get(participantRef);
          if (existing.exists()) return;

          // Compute least-loaded team inside the transaction to avoid races.
          const snap = await tx.get(collection(db, "sessions", sessionId, "participants"));
          const counts = TEAM_OPTIONS.reduce<Record<string, number>>((acc, t) => {
            acc[t.id] = 0;
            return acc;
          }, {});
          const applyDoc = (docSnap: any) => {
            const data =
              typeof docSnap?.data === "function"
                ? docSnap.data()
                : typeof docSnap?.data === "object"
                ? docSnap.data
                : {};
            const teamId = data?.teamId;
            if (teamId && counts[teamId] !== undefined) {
              counts[teamId] += 1;
            }
          };
          if (typeof (snap as any)?.forEach === "function") {
            (snap as any).forEach(applyDoc);
          } else {
            const docsArray = Array.isArray((snap as any)?.docs) ? (snap as any).docs : [];
            docsArray.forEach(applyDoc);
          }
          const chosenTeam =
            [...TEAM_OPTIONS].sort((a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0))[0] ?? TEAM_OPTIONS[0];

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

  const connectionReady = connectionStatus.state === "ready";
  const hasFloor = voice.enabled && voice.floorHolderId === userId;
  const canSpeak =
    voice.enabled &&
    hasFloor &&
    connectionReady &&
    voice.mode !== "ai-speaking" &&
    micStatus !== "blocked";
  const fallbackActive = simState?.fallback === true;
  const canTakeFloor = voice.enabled && !voice.floorHolderId && connectionReady && !fallbackActive;
  const floorTakenByOther =
    voice.enabled && voice.floorHolderId !== null && voice.floorHolderId !== userId;
  const otherSpeaking = (activeSpeakerId && activeSpeakerId !== userId) || floorTakenByOther;
  const stageLabel = useMemo(() => simState?.stageId ?? "stage unknown", [simState]);
  const latestEkg = useMemo(() => {
    const ekgs = (simState?.orders ?? []).filter((o) => o.type === "ekg" && o.status === "complete");
    return ekgs.length ? ekgs[ekgs.length - 1] : null;
  }, [simState?.orders]);

  if (!joinCode) return <div className="p-8 text-center text-slate-400">No join code provided.</div>;

  if (loading && !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50">
        <div className="animate-pulse text-sky-400 font-semibold">Connecting to session...</div>
      </div>
    );
  }

  if (!session || !sessionId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50 space-y-4 p-6">
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-slate-700 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        </div>
        <h2 className="text-xl font-bold">Session Not Found</h2>
        <p className="text-slate-400 text-center max-w-xs">
            We couldn't find a session with code <span className="font-mono text-sky-400 bg-sky-950/30 px-2 py-1 rounded mx-1">{joinCode.toUpperCase()}</span>.
        </p>
        <Link to="/" className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors">
          Back to Home
        </Link>
      </div>
    );
  }

  const handleTakeFloor = async () => {
    if (!sessionId || !userId) return;
    if (fallbackActive) {
      setVoiceError("Voice is in fallback. Please use typed questions or wait for resume.");
      return;
    }
    if (!connectionReady) {
      setVoiceError("Voice is not connected yet.");
      return;
    }
    setVoiceActionPending(true);
    setVoiceError(null);
    console.log("[voice] takeFloor tapped", { sessionId, userId });
    try {
      await takeFloorTx(sessionId, { uid: userId, displayName: userDisplayName });
      console.log("[voice] takeFloor success", { sessionId, userId });
    } catch (err) {
      console.error("Failed to take floor", err);
      setVoiceError(
        "Could not take the floor. Ask the presenter to check voice settings/permissions."
      );
    } finally {
      setVoiceActionPending(false);
    }
  };

  const handleReleaseFloor = async () => {
    if (!sessionId) return;
    setVoiceActionPending(true);
    try {
      await releaseFloor(sessionId);
    } catch (err) {
      console.error("Failed to release floor", err);
    } finally {
      setVoiceActionPending(false);
    }
  };

  const handlePressStart = async () => {
    if (!canSpeak) return;
    try {
      setVoiceError(null);
      await voicePatientService.startCapture();
      voiceGatewayClient.startSpeaking(targetCharacter);
    } catch (err: any) {
      console.error("Failed to start capture", err);
      if (err?.message?.toLowerCase()?.includes("blocked")) {
        setMicStatus("blocked");
        setVoiceError("Microphone is blocked. Allow mic access and re-check.");
      } else {
        setVoiceError("Could not start microphone. Check permissions and try again.");
      }
    }
  };

  const handlePressEnd = async () => {
    voicePatientService.stopCapture();
    voiceGatewayClient.stopSpeaking(targetCharacter);
  };

  const handleRetryVoice = () => {
    if (!sessionId || !userId) return;
    voiceGatewayClient.disconnect();
    voiceGatewayClient.connect(sessionId, userId, userDisplayName, "participant");
  };

  const handleRecheckMic = async () => {
    try {
      await voicePatientService.recheckPermission();
    } catch {
      // ignore
    }
  };

  const handleChoice = async (choiceIndex: number) => {
    if (!currentQuestion || !isQuestionActive || !userId || !sessionId) return;
    if (submitting) return;
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

      setSelectedChoice(choiceIndex);
    } catch (err) {
        console.error("Failed to submit answer", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="p-4 border-b border-slate-900 bg-slate-950 sticky top-0 z-20 flex justify-between items-center shadow-lg shadow-black/20">
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
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col gap-6">
        <section className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                Voice mode
              </div>
              <div className="text-sm text-slate-200">
                {voice.enabled ? "Enabled" : "Disabled"}
                {voice.enabled && voice.mode === "ai-speaking" ? " · AI is speaking" : ""}
                {voice.enabled && voice.mode === "resident-speaking" ? " · Resident is speaking" : ""}
              </div>
              {voice.enabled && (
                <div className="text-xs text-slate-400">
                  {voice.floorHolderName
                    ? `Floor: ${voice.floorHolderName}`
                    : "Floor is open"}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {voice.enabled ? (
                <>
                  {canTakeFloor && (
                    <button
                      type="button"
                      onClick={handleTakeFloor}
                      disabled={voiceActionPending}
                      className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      Take floor
                    </button>
                  )}
                  {canSpeak && (
                    <button
                      type="button"
                      onClick={handleReleaseFloor}
                      disabled={voiceActionPending}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      Release floor
                    </button>
                  )}
                  {floorTakenByOther && !canSpeak && (
                    <span className="text-xs text-slate-400">You do not have the floor.</span>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-500">Voice mode is off</span>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-slate-300">
            <label className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
              Target
            </label>
            <select
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
            <span className="text-[11px] text-slate-500">
              Your question will be routed to this role.
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => emitCommand(sessionId!, "exam", {}, "nurse").then(() => setShowExam(true))}
              disabled={fallbackActive}
              className={`px-3 py-2 rounded-lg bg-indigo-600/10 border border-indigo-500/60 text-indigo-100 hover:border-indigo-400 ${
                fallbackActive ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              Check exam
            </button>
            <button
              type="button"
              onClick={() => emitCommand(sessionId!, "toggle_telemetry", { enabled: true }, "tech")}
              disabled={fallbackActive}
              className={`px-3 py-2 rounded-lg bg-emerald-600/10 border border-emerald-500/60 text-emerald-100 hover:border-emerald-400 ${
                fallbackActive ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              Start telemetry
            </button>
            <button
              type="button"
              disabled={!latestEkg}
              onClick={() => {
                emitCommand(sessionId!, "show_ekg", {}, "tech");
                setShowEkg(true);
              }}
              className="px-3 py-2 rounded-lg border text-amber-100 bg-amber-600/10 border-amber-500/60 disabled:opacity-50"
            >
              Show EKG
            </button>
            {latestEkg && (
              <span className="text-[11px] text-slate-400">EKG ready: latest strip available</span>
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
            />
            <div className="text-[11px] text-slate-500">
              {fallbackActive
                ? "Voice fallback active. Use typed questions if available."
                : `Stage: ${stageLabel}`}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <HoldToSpeakButton
              disabled={!canSpeak || fallbackActive}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
              labelIdle="Hold to ask your question"
              labelDisabled={
                fallbackActive
                  ? "Voice fallback is active"
                  : !voice.enabled
                  ? "Voice off"
                  : micStatus === "blocked"
                  ? "Mic blocked"
                  : !connectionReady
                  ? "Voice not ready"
                  : otherSpeaking
                  ? "Another resident is speaking"
                  : "You don't have the floor"
              }
              helperText={
                canSpeak
                  ? "Recording… release when you're done."
                  : micStatus === "blocked"
                  ? "Enable microphone in browser settings."
                  : otherSpeaking
                  ? "Wait for the other resident to finish."
                  : "Take the floor to speak."
              }
            />
            {voiceError && <div className="text-[11px] text-rose-300">{voiceError}</div>}
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
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
              Mic level
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, Math.round(micLevel * 140))}%` }}
              ></div>
            </div>
            {transcribing && (
              <div className="text-[11px] text-slate-400">Transcribing your question...</div>
            )}
          </div>
          {/* Mobile bottom sheet PTT */}
          <div className="sm:hidden fixed inset-x-0 bottom-0 z-40">
            <div className="bg-slate-950/95 border-t border-slate-800 px-3 py-3 shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between text-[11px] text-slate-300 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.14em] ${
                      canSpeak
                        ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/40"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}
                  >
                    {canSpeak ? "Floor free" : otherSpeaking ? "Other speaking" : "No floor"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.14em] border border-slate-700 text-slate-200">
                    {simState?.stageId ? `Stage: ${simState.stageId}` : "Stage unknown"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {connectionStatus.state === "ready" ? "Voice ready" : connectionStatus.state}
                </div>
              </div>
              <HoldToSpeakButton
                disabled={!canSpeak || fallbackActive}
                onPressStart={handlePressStart}
                onPressEnd={handlePressEnd}
                labelIdle="Hold to speak"
                labelDisabled={
                  fallbackActive
                    ? "Voice fallback active"
                    : !voice.enabled
                    ? "Voice off"
                    : micStatus === "blocked"
                    ? "Mic blocked"
                    : !connectionReady
                    ? "Voice not ready"
                    : otherSpeaking
                    ? "Someone else is speaking"
                    : "You don't have the floor"
                }
                helperText={canSpeak ? "Hold and ask, then release." : "Take floor to speak or wait."}
              />
            </div>
          </div>
        </section>

        {currentQuestion ? (
          <section className="animate-slide-up">
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
                <p className="text-sm font-semibold mb-4 leading-relaxed">
                    {currentQuestion.stem}
                </p>
                <div className="grid grid-cols-1 gap-3 relative z-10">
                {currentQuestion.options.map((opt, i) => {
                    const isSelected = selectedChoice === i;
                    const isCorrect = session.showResults && i === currentQuestion.correctIndex;
                    
                    // Determine button style state
                    let btnClass = "border-slate-700 bg-slate-900/80 hover:bg-slate-800/80"; // default
                    if (isSelected) btnClass = "border-sky-500 bg-sky-500/15 text-sky-100 ring-1 ring-sky-500/50";
                    if (isCorrect) btnClass = "border-emerald-500 bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/50";
                    if (!isQuestionActive && !session.showResults) btnClass = "opacity-50 cursor-not-allowed border-slate-800 bg-slate-900/70";

                    return (
                    <button
                        key={i}
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
            </div>
          </section>
        ) : (
          <div className="py-8 text-center text-slate-500 text-sm bg-slate-900/50 rounded-xl border border-slate-900 border-dashed">
            Waiting for the next question.
          </div>
        )}
      </main>
    </div>
  );
}
