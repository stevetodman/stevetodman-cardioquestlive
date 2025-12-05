/**
 * PresenterSession renders a session's slides for the presenter:
 * - Top bar with title/join code and poll controls.
 * - Slide container that renders raw slide HTML (trusted) with Gemini chrome.
 * - In-slide poll results overlay, gated by showResults and responseTotal > 0 to avoid empty overlays.
 * Keyboard nav (arrows/Space) and in-slide nav buttons drive slide changes.
 */
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, updateDoc, db, collection, query, where } from "../utils/firestore"; // Updated import
import { SessionData } from "../types";
import { ResponsesChart } from "../components/ResponsesChart";
import { useTeamScores } from "../hooks/useTeamScores";
import { useIndividualScores } from "../hooks/useIndividualScores";
import { TeamScoreboard } from "../components/TeamScoreboard";
import { IndividualScoreboard } from "../components/IndividualScoreboard";
import { SessionSummary } from "../components/SessionSummary";
import { Question } from "../types";
import { useVoiceState, releaseFloor, setVoiceEnabled } from "../hooks/useVoiceState";
import { auth } from "../firebase";
import { VoicePatientOverlay } from "../components/VoicePatientOverlay";
import { PresenterVoiceControls } from "../components/PresenterVoiceControls";
import { sendVoiceCommand } from "../services/voiceCommands";

export default function PresenterSession() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseTotal, setResponseTotal] = useState(0);
  const [showTeamScores, setShowTeamScores] = useState(true);
  const [showIndividualScores, setShowIndividualScores] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [overallAccuracy, setOverallAccuracy] = useState<number>(0);
  const [questionsAnsweredCount, setQuestionsAnsweredCount] = useState<number>(0);
  const [totalResponses, setTotalResponses] = useState<number>(0);
  const [questionStats, setQuestionStats] = useState<
    { questionId: string; questionIndex: number; correctCount: number; totalCount: number; accuracyPct: number }[]
  >([]);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const slideRef = useRef<HTMLDivElement>(null);
  const teams = useTeamScores(sessionId);
  const players = useIndividualScores(sessionId);
  const voice = useVoiceState(sessionId ?? undefined);

  useEffect(() => {
    if (!sessionId) return;
    const ref = doc(db, "sessions", sessionId);
    const unsub = onSnapshot(ref, (snap: any) => {
      setLoading(false);
      if (snap.exists()) {
        setSession({ ...(snap.data() as SessionData), id: snap.id });
      }
    });
    return () => unsub();
  }, [sessionId]);

  const slides = session ? [...session.slides].sort((a, b) => a.index - b.index) : [];
  const currentSlide = session ? slides[session.currentSlideIndex] ?? slides[0] : null;

  const questionsMap = new Map<string, Question>(
    session ? session.questions.map((q) => [q.id, q]) : []
  );

  const currentQuestion =
    currentSlide?.type === "question" && currentSlide.questionId
      ? questionsMap.get(currentSlide.questionId)
      : null;
  const isQuestionOpen =
    session && currentQuestion ? session.currentQuestionId === currentQuestion.id : false;
  const isShowingResults = session?.showResults ?? false;
  const isQuestionSlide = Boolean(currentQuestion);
  const showResultsOverlay = isQuestionSlide && isShowingResults && responseTotal > 0;

  const goToSlide = useCallback(
    async (delta: number) => {
      if (!session) return;
      const sorted = [...session.slides].sort((a, b) => a.index - b.index);
      const newIndex = Math.max(
        0,
        Math.min(sorted.length - 1, session.currentSlideIndex + delta)
      );
      await updateDoc(doc(db, "sessions", sessionId), {
        currentSlideIndex: newIndex,
        currentQuestionId: null, // Close question when moving slides
        showResults: false,
      });
    },
    [session, sessionId]
  );

  const toggleVoice = useCallback(async () => {
    if (!sessionId) return;
    await setVoiceEnabled(sessionId, !voice.enabled);
  }, [sessionId, voice.enabled]);

  const handleReleaseFloor = useCallback(async () => {
    if (!sessionId) return;
    await releaseFloor(sessionId);
  }, [sessionId]);

  const handleClearTranscript = useCallback(() => {
    setTranscriptLines([]);
  }, []);

  const handleAddMockLine = useCallback(() => {
    setTranscriptLines((prev) => [...prev, `Mock line ${prev.length + 1}`]);
  }, []);

  // keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!session) return;
      if (["ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
        goToSlide(1);
      }
      if (["ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        goToSlide(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session, goToSlide]);

  // Wire in-slide nav buttons to presenter navigation
  useEffect(() => {
    if (!slideRef.current) return;
    const root = slideRef.current;
    const nav = root.querySelector(".cq-nav");
    if (!nav) return;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest(".cq-btn") as HTMLElement | null;
      if (!btn) return;
      e.preventDefault();
      const isNext = btn.classList.contains("cq-btnPrimary");
      goToSlide(isNext ? 1 : -1);
    };

    nav.addEventListener("click", handleClick);

    return () => {
      nav.removeEventListener("click", handleClick);
    };
  }, [currentSlide, goToSlide]);

  // Track responses for current question to know when to show overlay
  useEffect(() => {
    if (!sessionId || !currentQuestion) {
      setResponseTotal(0);
      return;
    }
    const q = query(
      collection(db, "sessions", sessionId, "responses"),
      where("questionId", "==", currentQuestion.id)
    );
    const unsub = onSnapshot(q, (snapshot: any) => {
      setResponseTotal(snapshot?.size ?? 0);
    });
    return () => unsub();
  }, [sessionId, currentQuestion?.id]);

  // Aggregate participant stats for summary (count + overall accuracy)
  useEffect(() => {
    if (!sessionId) return;
    const ref = collection(db, "sessions", sessionId, "participants");
    const unsub = onSnapshot(ref, (snapshot: any) => {
      const docs = snapshot.docs ?? snapshot;
      let totalCorrect = 0;
      let totalIncorrect = 0;
      docs.forEach((docSnap: any) => {
        const data = docSnap.data?.() ?? docSnap.data();
        totalCorrect += data?.correctCount ?? 0;
        totalIncorrect += data?.incorrectCount ?? 0;
      });
      const count = docs.length ?? 0;
      setParticipantCount(count);
      const totalAnswered = totalCorrect + totalIncorrect;
      setOverallAccuracy(totalAnswered > 0 ? totalCorrect / totalAnswered : 0);
    });
    return () => unsub();
  }, [sessionId]);

  // Aggregate response stats per question for summary
  useEffect(() => {
    if (!sessionId || !session) return;
    const ref = collection(db, "sessions", sessionId, "responses");
    const questions = session.questions ?? [];
    const questionIndexMap = new Map<string, number>();
    questions.forEach((q, idx) => questionIndexMap.set(q.id, idx + 1));

    const unsub = onSnapshot(ref, (snapshot: any) => {
      const docs = snapshot.docs ?? snapshot;
      const perQuestion = new Map<
        string,
        { questionId: string; totalCount: number; correctCount: number }
      >();
      let totalResp = 0;

      docs.forEach((docSnap: any) => {
        const data = docSnap.data?.() ?? docSnap.data();
        const qid = data?.questionId;
        const choiceIndex = data?.choiceIndex;
        if (!qid) return;
        totalResp += 1;
        const q = perQuestion.get(qid) ?? { questionId: qid, totalCount: 0, correctCount: 0 };
        q.totalCount += 1;
        const correctIndex = questions.find((qq) => qq.id === qid)?.correctIndex ?? -1;
        if (correctIndex === choiceIndex) {
          q.correctCount += 1;
        }
        perQuestion.set(qid, q);
      });

      const stats = Array.from(perQuestion.values()).map((entry) => {
        const idx = questionIndexMap.get(entry.questionId) ?? 0;
        const accuracy = entry.totalCount > 0 ? entry.correctCount / entry.totalCount : 0;
        return {
          questionId: entry.questionId,
          questionIndex: idx,
          correctCount: entry.correctCount,
          totalCount: entry.totalCount,
          accuracyPct: Math.round(accuracy * 100),
        };
      });

      setTotalResponses(totalResp);
      setQuestionsAnsweredCount(stats.length);
      setQuestionStats(stats);
    });

    return () => unsub();
  }, [sessionId, session]);

  const openQuestion = async () => {
    if (!currentQuestion) return;
    await updateDoc(doc(db, "sessions", sessionId), {
      currentQuestionId: currentQuestion.id,
      showResults: false,
    });
  };

  const toggleResults = async () => {
    if (!session) return;
    await updateDoc(doc(db, "sessions", sessionId), {
      showResults: !session.showResults,
    });
  };

  const closeQuestion = async () => {
    if (!session) return;
    await updateDoc(doc(db, "sessions", sessionId), {
      currentQuestionId: null,
      showResults: false,
    });
  };

  if (!sessionId) {
    return <div className="p-8 text-rose-500">Error: No session ID provided.</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-400">Loading Session...</span>
        </div>
      </div>
    );
  }

  if (!session || !currentSlide) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
          <div className="text-center space-y-4">
            <p className="text-xl">Session not found.</p>
            <Link to="/" className="text-sky-400 underline">Return Home</Link>
          </div>
      </div>
    );
  }

  const totalQuestions = session.questions?.length ?? 0;
  const questionsAnsweredPct =
    totalQuestions > 0 ? Math.min(1, Math.max(0, questionsAnsweredCount / totalQuestions)) : 0;
  const avgResponsesPerQuestion =
    questionsAnsweredCount > 0 ? totalResponses / questionsAnsweredCount : 0;
  const overlayMode = voice.enabled ? (voice.mode ?? "idle") : "disabled";

  return (
    <div className="h-screen bg-slate-950 text-slate-50 overflow-hidden relative flex flex-col">
      <div className="flex items-center justify-between px-3 md:px-4 py-1.5">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">
          {session.title}
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="hidden md:flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm shadow-black/20">
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
              Gamification
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSummary((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                  showSummary
                    ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-100 shadow-sm shadow-indigo-900/30"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                Session summary
              </button>
              <button
                type="button"
                onClick={() => setShowTeamScores((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                  showTeamScores
                    ? "bg-sky-600/20 border-sky-500/60 text-sky-100 shadow-sm shadow-sky-900/30"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                Team scores
              </button>
              <button
                type="button"
                onClick={() => setShowIndividualScores((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                  showIndividualScores
                    ? "bg-emerald-600/15 border-emerald-500/60 text-emerald-100 shadow-sm shadow-emerald-900/30"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                Top players
              </button>
            </div>
          </div>
          {sessionId && (
            <PresenterVoiceControls sessionId={sessionId} voice={voice} />
          )}
          <div className="hidden md:flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm shadow-black/20">
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
              Voice
            </span>
            <div className="flex items-center gap-1.5">
              <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                voice.enabled ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100" : "border-slate-800 bg-slate-900 text-slate-400"
              }`}>
                {voice.enabled ? "Enabled" : "Disabled"}
              </div>
              {voice.enabled && (
                <div className="text-[11px] text-slate-400">
                  {voice.floorHolderName ? `Floor: ${voice.floorHolderName}` : "Floor open"}
                </div>
              )}
              <button
                type="button"
                onClick={toggleVoice}
                className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-semibold bg-slate-900 hover:border-slate-600"
              >
                {voice.enabled ? "Turn off" : "Turn on"}
              </button>
              {voice.enabled && voice.floorHolderId && (
                <button
                  type="button"
                  onClick={handleReleaseFloor}
                  className="px-2 py-1 rounded-lg border border-slate-700 text-[11px] font-semibold bg-slate-900 hover:border-slate-600"
                >
                  Release floor
                </button>
              )}
            </div>
          </div>
          {isQuestionSlide && (
            <div className="hidden md:flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={openQuestion}
                disabled={isQuestionOpen}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                  isQuestionOpen
                    ? "border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed"
                    : "border-emerald-500/70 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                }`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={toggleResults}
                disabled={!isQuestionOpen && !isShowingResults}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                  !isQuestionOpen && !isShowingResults
                    ? "border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed"
                    : "border-amber-500/70 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                }`}
              >
                {isShowingResults ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={closeQuestion}
                disabled={!isQuestionOpen && !isShowingResults}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                  !isQuestionOpen && !isShowingResults
                    ? "border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed"
                    : "border-slate-700 bg-slate-800/70 text-slate-100 hover:bg-slate-800"
                }`}
              >
                Close
              </button>
            </div>
          )}
          <div className="text-[10px] text-slate-400 font-mono bg-slate-900/80 border border-slate-700 rounded px-2 py-1">
            Join: {session.joinCode}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 md:px-6 pb-2 gap-1">
        <div className="w-full max-w-[1800px] flex flex-col flex-1 gap-1.5">
          {/* Presenter layout: bias height toward the slide; chart overlays inside the slide for polls */}
          <div className="relative flex-1 min-h-[62vh] max-h-[78vh]">
            {showSummary ? (
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <SessionSummary
                  teams={teams}
                  players={players}
                  participantCount={participantCount}
                  overallAccuracy={overallAccuracy}
                  totalQuestions={totalQuestions}
                  questionsAnsweredCount={questionsAnsweredCount}
                  questionsAnsweredPct={questionsAnsweredPct}
                  totalResponses={totalResponses}
                  avgResponsesPerQuestion={avgResponsesPerQuestion}
                  questionStats={questionStats}
                />
              </div>
            ) : (
              <>
                <VoicePatientOverlay
                  voiceMode={(overlayMode as any) ?? "idle"}
                  enabled={voice.enabled}
                  floorHolderName={voice.floorHolderName}
                  transcriptLines={transcriptLines}
                  onClearTranscript={handleClearTranscript}
                  onAddMockTranscript={handleAddMockLine}
                />
                <div
                  className="absolute inset-0 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
                  ref={slideRef}
                  dangerouslySetInnerHTML={{ __html: currentSlide?.html ?? "" }}
                />

                {showTeamScores && (teams?.length ?? 0) > 0 && (
                  <div className="absolute top-4 right-4 z-30 pointer-events-none">
                    <TeamScoreboard teams={teams} />
                  </div>
                )}

                {showIndividualScores && (players?.length ?? 0) > 0 && (
                  <div className="absolute bottom-4 right-4 z-30 pointer-events-none">
                    <IndividualScoreboard players={players} />
                  </div>
                )}

                {showResultsOverlay && currentQuestion && (
                  <div className="absolute inset-x-3 bottom-3 pointer-events-none">
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 shadow-lg shadow-black/30 pointer-events-auto">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                        <span className="uppercase tracking-[0.12em] text-slate-300">Poll Results</span>
                        <span className="font-mono text-[10px]">
                          {isQuestionOpen ? "Open" : "Closed"} {isShowingResults ? "· Showing results" : ""}
                        </span>
                      </div>
                      <ResponsesChart
                        sessionId={sessionId}
                        questionId={currentQuestion.id}
                        options={currentQuestion.options}
                        correctIndex={currentQuestion.correctIndex ?? 0}
                        showResults={isShowingResults}
                        mode="presenter"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
