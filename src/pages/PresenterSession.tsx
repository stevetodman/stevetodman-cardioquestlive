import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, updateDoc, db } from "../utils/firestore"; // Updated import
import { SessionData, Question } from "../types";
import { ResponsesChart } from "../components/ResponsesChart";

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

  const slides = session ? [...session.slides].sort((a, b) => a.index - b.index) : [];
  const currentSlide = session ? slides[session.currentSlideIndex] ?? slides[0] : null;

  const questionsMap = new Map<string, Question>(
    session ? session.questions.map((q) => [q.id, q]) : []
  );

    const currentQuestion =
    currentSlide?.type === "question" && currentSlide.questionId
      ? questionsMap.get(currentSlide.questionId)
      : null;

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

  return (
    <div className="h-screen bg-slate-950 text-slate-50 overflow-hidden relative flex flex-col">
      <div className="flex items-center justify-between px-3 md:px-5 py-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">
          {session.title}
        </div>
        <div className="text-[10px] text-slate-400 font-mono bg-slate-900/80 border border-slate-700 rounded px-2 py-1">
          Join: {session.joinCode}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 md:px-8 pb-4 gap-2">
        <div className="w-full max-w-[1800px] aspect-video relative">
          <div
            className="absolute inset-0 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
            dangerouslySetInnerHTML={{ __html: currentSlide?.html ?? "" }}
          />
        </div>
      </div>
    </div>
  );
}
