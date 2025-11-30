import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, updateDoc, db } from "../utils/firestore"; // Updated import
import { SessionData, Question } from "../types";
import { ResponsesChart } from "../components/ResponsesChart";
import { sanitizeHtml } from "../utils/sanitizeHtml";

export default function PresenterSession() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (!session) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
          <div className="text-center space-y-4">
            <p className="text-xl">Session not found.</p>
            <Link to="/" className="text-sky-400 underline">Return Home</Link>
          </div>
        </div>
      );
  }

  const slides = [...session.slides].sort((a, b) => a.index - b.index);
  const currentSlide = slides[session.currentSlideIndex] ?? slides[0];

  const questionsMap = new Map<string, Question>(
    session.questions.map((q) => [q.id, q])
  );

  const sanitizedSlideHtml = sanitizeHtml(currentSlide.html);
  const currentQuestion =
    currentSlide.type === "question" && currentSlide.questionId
      ? questionsMap.get(currentSlide.questionId)
      : null;

  const goToSlide = async (delta: number) => {
    const newIndex = Math.max(
      0,
      Math.min(slides.length - 1, session.currentSlideIndex + delta)
    );
    await updateDoc(doc(db, "sessions", sessionId), {
      currentSlideIndex: newIndex,
      currentQuestionId: null, // Close question when moving slides
      showResults: false,
    });
  };

  const openQuestion = async () => {
    if (!currentQuestion) return;
    await updateDoc(doc(db, "sessions", sessionId), {
      currentQuestionId: currentQuestion.id,
      showResults: false,
    });
  };

  const toggleResults = async () => {
    await updateDoc(doc(db, "sessions", sessionId), {
      showResults: !session.showResults,
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-50 overflow-hidden">
      {/* Main slide area */}
      <div className="flex-1 flex items-center justify-center bg-slate-950 p-4 md:p-8 relative">
        <div
          className="w-full max-w-5xl aspect-video rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
          dangerouslySetInnerHTML={{ __html: sanitizedSlideHtml }}
        />
        
        {/* Mobile controls overlay (visible only on small screens) */}
        <div className="md:hidden absolute bottom-6 left-0 right-0 flex justify-center gap-4 px-4">
            <button onClick={() => goToSlide(-1)} className="bg-slate-800/80 p-3 rounded-full text-white backdrop-blur">◀</button>
            <button onClick={() => goToSlide(1)} className="bg-slate-800/80 p-3 rounded-full text-white backdrop-blur">▶</button>
        </div>
      </div>

      {/* Control panel (Sidebar on desktop, hidden on mobile usually but here responsive) */}
      <div className="hidden md:flex w-80 border-l border-slate-800 bg-slate-950 flex-col z-10">
        <div className="p-5 border-b border-slate-800 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold">
            Live Session
          </div>
          <div className="font-semibold text-lg leading-tight">{session.title}</div>
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex flex-col gap-1">
             <span className="text-xs text-slate-400">Student Join Code</span>
             <span className="font-mono text-2xl text-sky-400 font-bold tracking-widest">
              {session.joinCode}
            </span>
          </div>
        </div>

        <div className="p-4 flex gap-2 border-b border-slate-800">
          <button
            onClick={() => goToSlide(-1)}
            disabled={session.currentSlideIndex === 0}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ◀ Prev
          </button>
          <button
            onClick={() => goToSlide(1)}
            disabled={session.currentSlideIndex === slides.length - 1}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next ▶
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="text-xs text-slate-500 flex justify-between">
                <span>Slide {session.currentSlideIndex + 1} of {slides.length}</span>
                <span>{currentSlide.type === 'question' ? 'Question Slide' : 'Content Slide'}</span>
            </div>

            {currentQuestion ? (
            <div className="space-y-4 animate-slide-up">
                <div className="space-y-2">
                    <div className="text-xs font-bold text-sky-500 uppercase tracking-wider">
                    Interact
                    </div>
                    <button
                    onClick={openQuestion}
                    className={`w-full rounded-lg font-semibold py-3 text-sm shadow-lg transition-all
                        ${session.currentQuestionId === currentQuestion.id 
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/50' 
                            : 'bg-sky-600 hover:bg-sky-500 text-white'}
                    `}
                    >
                    {session.currentQuestionId === currentQuestion.id ? "Question is OPEN" : "Open Question"}
                    </button>
                    
                    {session.currentQuestionId === currentQuestion.id && (
                        <button
                        onClick={toggleResults}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 text-slate-200 py-3 text-sm hover:bg-slate-700 transition-colors"
                        >
                        {session.showResults ? "Hide Results" : "Reveal Results"}
                        </button>
                    )}
                </div>

                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                    <ResponsesChart
                        sessionId={sessionId}
                        questionId={currentQuestion.id}
                        options={currentQuestion.options}
                        correctIndex={currentQuestion.correctIndex}
                        showResults={session.showResults}
                    />
                </div>
                
                 {session.showResults && currentQuestion.explanation && (
                     <div className="text-xs text-slate-400 bg-slate-900 p-3 rounded border border-slate-800">
                        <span className="font-semibold text-emerald-400">Explanation:</span> {currentQuestion.explanation}
                     </div>
                 )}
            </div>
            ) : (
                <div className="text-center text-slate-600 text-sm py-10">
                    No active question on this slide.
                </div>
            )}
        </div>

        <div className="p-4 border-t border-slate-800">
          <Link to="/" className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Exit Session
          </Link>
        </div>
      </div>
    </div>
  );
}
