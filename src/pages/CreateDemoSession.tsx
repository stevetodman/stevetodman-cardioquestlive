import React, { useState } from "react";
import { Link } from "react-router-dom";
import { auth, ensureSignedIn } from "../firebase";
import { addDoc, collection, db } from "../utils/firestore"; 
import { createInitialSessionData, defaultDeck } from "../data/ductalDeck";
import { fetchDeck } from "../utils/deckService";
import { SessionData } from "../types";

export default function CreateDemoSession() {
  const [sessionInfo, setSessionInfo] = useState<SessionData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureSignedIn();
      let deck = defaultDeck;
      try {
        deck = await fetchDeck();
      } catch (deckError) {
        console.warn("Falling back to default deck", deckError);
      }
      const data = createInitialSessionData(deck);
      const createdBy = auth?.currentUser?.uid;
      const docData = createdBy ? { ...data, createdBy } : data;
      const docRef = await addDoc(collection(db, "sessions"), docData);
      setSessionId(docRef.id);
      setSessionInfo({ ...data, createdBy: createdBy ?? undefined, id: docRef.id });
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to create session. Check console/network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">
            Create Session
            </h1>
            <p className="text-sm text-slate-400">
            This will create a new live session using the "Ductal-Dependent Lesions" deck.
            </p>
        </div>

        {sessionInfo && sessionId ? (
          <div className="p-4 rounded-lg bg-slate-800 border border-slate-600 space-y-4 animate-fade-in">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Session Created</p>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Join Code:</span>
                <span className="text-2xl font-mono text-sky-400 tracking-widest">{sessionInfo.joinCode}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
                 <Link 
                    to={`/presenter/${sessionId}`}
                    className="block w-full text-center rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 text-sm transition-colors"
                 >
                    Launch Presenter View
                 </Link>
                 <Link 
                    to={`/join/${sessionInfo.joinCode}`}
                    target="_blank"
                    className="block w-full text-center rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-300 font-semibold py-3 text-sm transition-colors"
                 >
                    Open Student View (New Tab)
                 </Link>
            </div>
          </div>
        ) : (
             <button
                onClick={handleCreate}
                disabled={loading}
                className={`w-full rounded-lg font-semibold py-3 text-sm transition-all
                    ${loading ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg hover:shadow-sky-500/20'}
                `}
            >
                {loading ? "Creating session..." : "Create New Session"}
            </button>
        )}

        <div className="bg-slate-950 rounded p-3 border border-slate-800 flex gap-3 items-start">
            <span className="text-xl">💡</span>
            <div className="text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Customize Content:</span>
                <br />
                Edit <code className="text-sky-300 bg-slate-900 px-1 rounded">src/data/ductalDeck.ts</code> to add your own slides and questions.
            </div>
        </div>

        {error && (
          <p
            className="text-sm text-rose-400 bg-rose-950/30 p-3 rounded border border-rose-900"
            role="status"
            aria-live="polite"
          >
            Error: {error}
          </p>
        )}
        
        <div className="pt-4 border-t border-slate-800 text-center">
            <Link to="/" className="text-xs text-slate-500 hover:text-slate-300 underline">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
