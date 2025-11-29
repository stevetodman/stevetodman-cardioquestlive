import React, { useState } from "react";
import { Link } from "react-router-dom";
import { isConfigured } from "../firebase";
import { addDoc, collection, db } from "../utils/firestore"; 
import { createInitialSessionData } from "../data/ductalDeck";
import { SessionData } from "../types";

export default function CreateDemoSession() {
  const [sessionInfo, setSessionInfo] = useState<SessionData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    // Removed isConfigured check to allow Mock mode
    setLoading(true);
    setError(null);
    try {
      const data = createInitialSessionData();
      const docRef = await addDoc(collection(db, "sessions"), data);
      setSessionId(docRef.id);
      setSessionInfo({ ...data, id: docRef.id });
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
            Create Demo Session
            </h1>
            <p className="text-sm text-slate-400">
            This will create a new session using the "Ductal-Dependent Lesions" deck.
            </p>
        </div>

        {!isConfigured && (
            <div className="bg-sky-900/30 border border-sky-600/50 p-4 rounded-lg">
                <h3 className="text-sky-500 font-semibold text-sm mb-1">Demo Mode Active</h3>
                <p className="text-xs text-sky-200">
                    Running in local demo mode since no Firebase config was found. 
                    Data will sync across tabs in this browser but will not persist if you clear your cache.
                </p>
            </div>
        )}

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

        {error && (
          <p className="text-sm text-rose-400 bg-rose-950/30 p-3 rounded border border-rose-900">
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