import React from "react";
import { TeamScore } from "../hooks/useTeamScores";
import { IndividualScore } from "../hooks/useIndividualScores";

export type SessionSummaryProps = {
  teams: TeamScore[];
  players: IndividualScore[];
  participantCount: number;
  overallAccuracy: number; // 0-1
  totalQuestions: number;
  questionsAnsweredCount: number;
  questionsAnsweredPct: number;
  totalResponses: number;
  avgResponsesPerQuestion: number;
  questionStats: QuestionStat[];
};

export type QuestionStat = {
  questionId: string;
  questionIndex: number; // 1-based
  correctCount: number;
  totalCount: number;
  accuracyPct: number;
};

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0%";
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

export function SessionSummary({
  teams,
  players,
  participantCount,
  overallAccuracy,
  totalQuestions,
  questionsAnsweredCount,
  questionsAnsweredPct,
  totalResponses,
  avgResponsesPerQuestion,
  questionStats,
}: SessionSummaryProps) {
  const challenging = [...(questionStats || [])]
    .filter((q) => q.totalCount > 0)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 3);

  const hasResponses = totalResponses > 0 || questionsAnsweredCount > 0;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950/90 border border-slate-800 rounded-2xl shadow-2xl shadow-black/30 text-slate-50 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Session Summary</div>
          <div className="text-xl font-semibold text-white">Results & Standings</div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Participants</div>
            <div className="text-lg font-semibold text-white">{participantCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Accuracy</div>
            <div className="text-lg font-semibold text-emerald-300 font-mono">{formatPercent(overallAccuracy)}</div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 grid grid-cols-2 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Questions in deck</div>
          <div className="text-lg font-semibold text-white">{totalQuestions}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Questions answered</div>
          <div className="flex items-baseline gap-2">
            <div className="text-lg font-semibold text-white">{questionsAnsweredCount}</div>
            <div className="text-sm font-mono text-slate-400">{formatPercent(questionsAnsweredPct)}</div>
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Total responses</div>
          <div className="text-lg font-semibold text-white">{totalResponses}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Avg responses / question</div>
          <div className="text-lg font-semibold text-white">
            {Number.isFinite(avgResponsesPerQuestion) ? avgResponsesPerQuestion.toFixed(1) : "0.0"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-auto">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-300 font-semibold mb-3">Team rankings</div>
          {teams.length === 0 ? (
            <div className="text-sm text-slate-500">No scores yet — waiting for answers…</div>
          ) : (
            <div className="space-y-2">
              {teams.map((team, idx) => (
                <div
                  key={team.teamId}
                  className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2"
                >
                  <span
                    className={`text-xs w-7 h-7 rounded-full flex items-center justify-center font-semibold ${
                      idx === 0 ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${idx === 0 ? "text-white font-semibold" : "text-slate-100"}`}>
                      {team.teamName}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-sky-300 font-mono tabular-nums">{team.points} pts</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-300 font-semibold mb-3">Top players</div>
          {players.length === 0 ? (
            <div className="text-sm text-slate-500">No scores yet — waiting for answers…</div>
          ) : (
            <div className="space-y-2">
              {players.map((player, idx) => (
                <div
                  key={player.userId}
                  className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2"
                >
                  <span
                    className={`text-xs w-7 h-7 rounded-full flex items-center justify-center font-semibold ${
                      idx === 0 ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${idx === 0 ? "text-white font-semibold" : "text-slate-100"}`}>
                      {player.displayName || `Player ${idx + 1}`}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{player.teamName}</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-300 font-mono tabular-nums">
                    {player.points} pts
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="text-[11px] uppercase tracking-[0.12em] text-slate-300 font-semibold mb-2">
          Most challenging questions
        </div>
        {!hasResponses || challenging.length === 0 ? (
          <div className="text-sm text-slate-500">No question-level data yet — waiting for responses…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {challenging.map((q) => (
              <div
                key={q.questionId}
                className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 space-y-1"
              >
                <div className="text-xs text-slate-200 font-semibold">Question {q.questionIndex}</div>
                <div className="text-sm text-rose-300 font-mono">{formatPercent(q.accuracyPct / 100)}</div>
                <div className="text-[11px] text-slate-500">
                  {q.correctCount}/{q.totalCount} correct
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
