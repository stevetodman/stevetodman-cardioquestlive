import React, { useEffect, useState } from "react";
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
import { GatewayStatus } from "../types/voiceGateway";

function getLocalUserId(): string {
  const key = "cq_live_user_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
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
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>("disconnected");
  const [voiceError, setVoiceError] = useState<string | null>(null);
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
    const unsub = voicePatientService.onTurnComplete(async (blob) => {
      if (!sessionId || !userId) return;
      if (!blob || blob.size === 0) return;
      try {
        setTranscribing(true);
        await voiceGatewayClient.sendDoctorAudio(blob);
      } catch (err) {
        console.error("Failed to send doctor audio", err);
      } finally {
        setTranscribing(false);
      }
    });
    return () => unsub();
  }, [sessionId, userId]);

  useEffect(() => {
    const unsub = voiceGatewayClient.onStatus((status) => setGatewayStatus(status));
    return () => unsub();
  }, []);

  // Connect to voice gateway once we know session/user
  useEffect(() => {
    if (!sessionId || !userId) return;
    voiceGatewayClient.connect(sessionId, userId, userDisplayName, "participant");
    return () => voiceGatewayClient.disconnect();
  }, [sessionId, userId, userDisplayName]);

  // Reset local selection when question changes
  useEffect(() => {
    setSelectedChoice(null);
  }, [session?.currentQuestionId]);

  // Ensure participant doc exists and assign a team
  useEffect(() => {
    async function ensureParticipantDoc() {
      if (!sessionId || !userId) return;
      try {
        const participantRef = doc(db, "sessions", sessionId, "participants", userId);
        const existing = await getDoc(participantRef);
        if (existing.exists && existing.exists()) return;

        // Fetch current counts to do simple round-robin/least-loaded assignment
        let chosenTeam = TEAM_OPTIONS[0];
        try {
          const snap = await getDocs(collection(db, "sessions", sessionId, "participants"));
          const counts = TEAM_OPTIONS.reduce<Record<string, number>>((acc, t) => {
            acc[t.id] = 0;
            return acc;
          }, {});
          const docsArray = Array.isArray((snap as any)?.docs) ? (snap as any).docs : [];
          const iterate = (fn: (docSnap: any) => void) => {
            if (typeof (snap as any)?.forEach === "function") {
              (snap as any).forEach(fn);
            } else {
              docsArray.forEach(fn);
            }
          };
          iterate((docSnap: any) => {
            const rawData = typeof docSnap.data === "function" ? docSnap.data() : docSnap.data;
            const teamId = rawData?.teamId;
            if (teamId && counts[teamId] !== undefined) {
              counts[teamId] += 1;
            }
          });
          const sortedByLoad = [...TEAM_OPTIONS].sort((a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0));
          chosenTeam = sortedByLoad[0] ?? chosenTeam;
        } catch (err) {
          console.warn("Failed to compute team load; using default team", err);
        }

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
        await setDoc(participantRef, participantDoc);
      } catch (err) {
        console.error("Failed to ensure participant doc", err);
      }
    }
    ensureParticipantDoc();
  }, [sessionId, userId]);

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

  const slides = [...session.slides].sort((a, b) => a.index - b.index);
  const currentSlide = slides[session.currentSlideIndex] ?? slides[0];

  const questionsMap = new Map<string, Question>(
    session.questions.map((q) => [q.id, q])
  );

  const currentQuestion =
    currentSlide.type === "question" && currentSlide.questionId
      ? questionsMap.get(currentSlide.questionId)
      : null;

  // Question is "active" for the user if it's the current slide AND the presenter has opened it
  // Or if it's open but we are just showing results.
  const isQuestionActive = currentQuestion && session.currentQuestionId === currentQuestion.id;

  const canSpeak = voice.enabled && voice.floorHolderId === userId && voice.mode !== "ai-speaking";
  const canTakeFloor = voice.enabled && !voice.floorHolderId;
  const floorTakenByOther =
    voice.enabled && voice.floorHolderId !== null && voice.floorHolderId !== userId;

  const handleTakeFloor = async () => {
    if (!sessionId || !userId) return;
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
    await voicePatientService.ensureMic();
    await voicePatientService.startCapture();
    voiceGatewayClient.startSpeaking();
  };

  const handlePressEnd = async () => {
    voicePatientService.stopCapture();
    voiceGatewayClient.stopSpeaking();
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
            gatewayStatus === "connected"
              ? "border-emerald-500/60 text-emerald-200"
              : gatewayStatus === "connecting"
              ? "border-sky-500/60 text-sky-200"
              : "border-slate-700 text-slate-400"
          }`}
        >
          Voice: {gatewayStatus}
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
          <div className="mt-3 space-y-2">
            <HoldToSpeakButton
              disabled={!canSpeak}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
              labelIdle="Hold to speak"
              labelDisabled={voice.enabled ? "You don't have the floor" : "Voice off"}
            />
            {voiceError && <div className="text-[11px] text-rose-300">{voiceError}</div>}
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
