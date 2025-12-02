import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
  setDoc,
  db
} from "../utils/firestore"; // Updated import
import { SessionData, Question } from "../types";
import { SlidePreview } from "../components/SlidePreview";
import { auth, ensureSignedIn, isConfigured } from "../firebase";

function getLocalUserId(): string {
  const key = "cq_live_user_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
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

  // Reset local selection when question changes
  useEffect(() => {
    setSelectedChoice(null);
  }, [session?.currentQuestionId]);

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

  const handleChoice = async (choiceIndex: number) => {
    if (!currentQuestion || !isQuestionActive || !userId) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const responseId = `${userId}_${currentQuestion.id}`;
      await setDoc(
        doc(db, "sessions", sessionId, "responses", responseId),
        {
          sessionId,
          userId,
          questionId: currentQuestion.id,
          choiceIndex,
          createdAt: new Date().toISOString(),
        }
      );
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
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col gap-6">
        <section>
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Live Slide</h3>
             <SlidePreview html={currentSlide.html} />
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
                    let btnClass = "border-slate-700 bg-slate-900 hover:bg-slate-800"; // default
                    if (isSelected) btnClass = "border-sky-500 bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/50";
                    if (isCorrect) btnClass = "border-emerald-500 bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/50";
                    if (!isQuestionActive && !session.showResults) btnClass = "opacity-50 cursor-not-allowed border-slate-800 bg-slate-900";

                    return (
                    <button
                        key={i}
                        disabled={submitting || (!isQuestionActive && !session.showResults)}
                        onClick={() => handleChoice(i)}
                        className={`w-full text-left rounded-xl border px-4 py-3 text-base sm:text-lg transition-all duration-200 relative overflow-hidden group
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
            View the slide above.<br/>Wait for the next question.
          </div>
        )}
      </main>
    </div>
  );
}
