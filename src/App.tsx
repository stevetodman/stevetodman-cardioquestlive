import React, { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import CreateDemoSession from "./pages/CreateDemoSession";
import PresenterSession from "./pages/PresenterSession";
import JoinSession from "./pages/JoinSession";
import AdminDeckEditor from "./pages/AdminDeckEditor";
import { ensureSignedIn, isConfigured } from "./firebase";
import { DevGatewayBadge } from "./components/DevGatewayBadge";

function Home() {
    const [joinCode, setJoinCode] = useState("");
    const navigate = useNavigate();

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if(joinCode.trim().length > 0) {
            navigate(`/join/${joinCode.trim().toUpperCase()}`);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-4">
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
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Student Join</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="CODE"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-center font-mono text-lg tracking-widest uppercase focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all placeholder:text-slate-700"
                            maxLength={4}
                        />
                        <button 
                            type="submit"
                            disabled={!joinCode}
                            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold px-6 rounded-lg transition-colors"
                        >
                            Join
                        </button>
                    </div>
                 </form>

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

  return (
    <HashRouter>
      <DevGatewayBadge />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create-demo" element={<CreateDemoSession />} />
        <Route path="/presenter/:sessionId" element={<PresenterSession />} />
        <Route path="/join/:joinCode" element={<JoinSession />} />
        <Route path="/admin" element={<AdminDeckEditor />} />
      </Routes>
    </HashRouter>
  );
}
