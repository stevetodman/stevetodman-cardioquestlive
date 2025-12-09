import React from "react";
import { TeamScore } from "../hooks/useTeamScores";

interface Props {
  teams: TeamScore[];
}

export function TeamScoreboard({ teams }: Props) {
  if (!teams || teams.length === 0) return null;

  return (
    <div
      className="select-none"
      role="region"
      aria-label="Team scores"
    >
      <div className="bg-slate-900/85 border border-slate-800 rounded-2xl shadow-2xl shadow-black/30 px-3.5 py-2.5 w-[270px] max-w-xs backdrop-blur-sm">
        <div className="text-[11px] uppercase tracking-[0.12em] text-slate-200 font-semibold mb-2 flex items-center justify-between">
          <span>Team scores</span>
          <span className="text-[10px] text-slate-400">Live</span>
        </div>
        <ul className="divide-y divide-slate-800/70" role="list">
          {teams.map((team, idx) => (
            <li
              key={team.teamId}
              className="py-1.5 flex items-center gap-2 transition-all"
            >
              <span
                className={`text-[11px] w-6 h-6 rounded-full flex items-center justify-center bg-slate-800 text-slate-200 font-semibold ${
                  idx === 0 ? "bg-sky-600/60 text-white" : ""
                }`}
              >
                #{idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm truncate ${idx === 0 ? "text-white font-semibold" : "text-slate-100"}`}>
                  {team.teamName}
                </div>
              </div>
              <div className="text-[12px] font-semibold text-sky-300 font-mono tabular-nums">
                {team.points} pts
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
