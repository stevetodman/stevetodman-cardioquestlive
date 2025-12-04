import React from "react";
import { IndividualScore } from "../hooks/useIndividualScores";

interface Props {
  players: IndividualScore[];
}

export function IndividualScoreboard({ players }: Props) {
  if (!players || players.length === 0) return null;

  return (
    <div className="pointer-events-none select-none">
      <div className="bg-slate-900/85 border border-slate-800 rounded-2xl shadow-2xl shadow-black/30 px-3 py-2 w-64 backdrop-blur-sm">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-1">
          Top players
        </div>
        <div className="divide-y divide-slate-800/70">
          {players.map((player, idx) => (
            <div key={player.userId} className="py-1 flex items-center gap-2">
              <span className="text-[11px] w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 text-slate-300 font-semibold">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-100 truncate">Player {idx + 1}</div>
                <div className="text-[10px] text-slate-500 truncate">{player.teamName}</div>
              </div>
              <div className="text-[11px] font-semibold text-emerald-300">{player.points} pts</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
