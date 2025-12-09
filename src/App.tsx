import React, { useEffect, useState, Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { ensureSignedIn, isConfigured } from "./firebase";
import { SessionSkeleton } from "./components/SessionSkeleton";
import { ErrorBoundary } from "./components/ErrorBoundary";

const CreateDemoSession = lazy(() => import("./pages/CreateDemoSession"));
const PresenterSession = lazy(() => import("./pages/PresenterSession"));
const JoinSession = lazy(() => import("./pages/JoinSession"));
const AdminDeckEditor = lazy(() => import("./pages/AdminDeckEditor"));

function Home() {
    const [joinCode, setJoinCode] = useState("");
    const [shake, setShake] = useState(false);
    const [lastCode, setLastCode] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const saved = localStorage.getItem("cq_last_join_code");
        if (saved) setLastCode(saved);
    }, []);

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = joinCode.trim().toUpperCase();
        if (trimmed.length === 4) {
            localStorage.setItem("cq_last_join_code", trimmed);
            navigate(`/join/${trimmed}`);
            return;
        }
        setShake(true);
        setTimeout(() => setShake(false), 300);
    };

    const handleChange = (value: string) => {
        const next = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
        setJoinCode(next);
    };

    const handleRejoin = () => {
        if (!lastCode) return;
        navigate(`/join/${lastCode}`);
    };

    const isComplete = joinCode.length === 4;

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4" id="main-content">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-8 relative overflow-hidden">
              
              {/* Cloud Status Indicator */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-emerald-950/30 border border-emerald-900/50 rounded-full">
                <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-orange-500'}`}></span>
                <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">
                    {isConfigured ? 'Cloud Live' : 'Local Demo'}
                </span>
              </div>

              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
                  CardioQuest Live
                </h1>
                <p className="text-sm text-slate-400">
                  Interactive Pediatric Cardiology Learning
                </p>
              </div>

             <div className="space-y-4">
                 <form onSubmit={handleJoin} className="space-y-2">
                    <label htmlFor="join-code" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Student Join</label>
                    <div className="flex gap-2">
                        <input 
                            id="join-code"
                            type="text" 
                            value={joinCode}
                            onChange={(e) => handleChange(e.target.value)}
                            placeholder="CODE"
                            aria-describedby="join-code-help"
                            className={`flex-1 bg-slate-950 border rounded-lg px-4 py-3 text-center font-mono text-lg tracking-widest uppercase focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all placeholder:text-slate-700 ${
                              isComplete ? "border-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]" : "border-slate-700"
                            } ${shake ? "animate-shake" : ""}`}
                            maxLength={4}
                        />
                        {isComplete && (
                          <span className="self-center text-emerald-400 text-sm font-semibold" aria-hidden="true">✓</span>
                        )}
                        <button 
                            type="submit"
                            disabled={!joinCode}
                            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-semibold px-6 rounded-lg transition-colors"
                        >
                            Join
                        </button>
                    </div>
                    <p id="join-code-help" className="text-[11px] text-slate-500">
                      Enter the 4-character code from the presenter (letters or numbers).
                    </p>
                 </form>
                 {lastCode && (
                   <button
                     type="button"
                     onClick={handleRejoin}
                     className="w-full text-center rounded-lg border border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-800 py-2 text-sm transition-colors"
                   >
                     Rejoin session {lastCode}
                   </button>
                 )}

                 <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-600">or</span></div>
                 </div>

                <div className="space-y-2">
                   <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Presenter</label>
                   <Link
                    to="/create-demo"
                    className="block w-full text-center rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 text-sm shadow-lg shadow-sky-900/20 transition-all hover:scale-[1.02]"
                  >
                    Create New Session
                  </Link>
                </div>
              </div>
              
              <div className="text-center pt-4">
                  <p className="text-[10px] text-slate-600">
                    Ductal-Dependent Lesions Module • v1.0
                  </p>
                  <Link
                    to="/admin"
                    className="text-[10px] text-slate-500 hover:text-slate-300 underline block mt-1"
                  >
                    Admin
                  </Link>
              </div>
            </div>
        </div>
    );
}

export default function App() {
  useEffect(() => {
    ensureSignedIn().catch((error) =>
      console.error("Failed to initialize auth", error)
    );
  }, []);

  const PageLoader = (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4">
      <SessionSkeleton />
    </div>
  );

  return (
    <HashRouter>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-sky-700 focus:text-white focus:px-3 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>
      <ErrorBoundary>
        <Suspense fallback={PageLoader}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create-demo" element={<CreateDemoSession />} />
            <Route path="/presenter/:sessionId" element={<PresenterSession />} />
            <Route path="/join/:joinCode" element={<JoinSession />} />
            <Route path="/admin" element={<AdminDeckEditor />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  );
}
