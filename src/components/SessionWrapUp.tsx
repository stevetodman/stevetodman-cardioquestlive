/**
 * Session wrap-up component for end of slides deck.
 * Shows:
 * - Answer recap with correct options and one-line rationale
 * - Score snapshot: top team, top player, overall accuracy
 * - Thank you message
 */

import React from "react";
import { Question } from "../types";
import { TeamScore } from "../hooks/useTeamScores";
import { IndividualScore } from "../hooks/useIndividualScores";

export interface SessionWrapUpProps {
  questions: Question[];
  teams: TeamScore[];
  players: IndividualScore[];
  overallAccuracy: number; // 0-1
  participantCount: number;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0%";
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

export function SessionWrapUp({
  questions,
  teams,
  players,
  overallAccuracy,
  participantCount,
}: SessionWrapUpProps) {
  const topTeam = teams[0];
  const topPlayer = players[0];

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-slate-950 to-slate-900 text-slate-50 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800 text-center">
        <div className="text-3xl font-bold text-white mb-2">Session Complete!</div>
        <div className="text-slate-400">Thank you for participating</div>
      </div>

      {/* Score Snapshot */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {/* Top Team */}
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400 mb-1">Top Team</div>
            {topTeam ? (
              <>
                <div className="text-lg font-bold text-sky-300">{topTeam.teamName}</div>
                <div className="text-sm text-slate-400 font-mono">{topTeam.points} pts</div>
              </>
            ) : (
              <div className="text-sm text-slate-500">-</div>
            )}
          </div>

          {/* Top Player */}
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400 mb-1">Top Player</div>
            {topPlayer ? (
              <>
                <div className="text-lg font-bold text-emerald-300">
                  {topPlayer.displayName || "Player 1"}
                </div>
                <div className="text-sm text-slate-400 font-mono">{topPlayer.points} pts</div>
              </>
            ) : (
              <div className="text-sm text-slate-500">-</div>
            )}
          </div>

          {/* Overall Accuracy */}
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400 mb-1">Accuracy</div>
            <div className="text-lg font-bold text-amber-300">{formatPercent(overallAccuracy)}</div>
            <div className="text-sm text-slate-400">{participantCount} participants</div>
          </div>
        </div>
      </div>

      {/* Answer Recap */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-3">
          Answer Recap
        </div>
        <div className="space-y-3 max-w-3xl">
          {questions.map((q, idx) => (
            <AnswerRecapCard key={q.id} question={q} index={idx + 1} />
          ))}
        </div>
      </div>

      {/* Thank You Footer */}
      <div className="px-6 py-5 border-t border-slate-800 text-center bg-slate-900/70">
        <div className="text-xl font-semibold text-white mb-1">
          Thank you for playing!
        </div>
        <div className="text-sm text-slate-400">
          CardioQuest Live - Learning through gamification
        </div>
      </div>
    </div>
  );
}

interface AnswerRecapCardProps {
  question: Question;
  index: number;
}

function AnswerRecapCard({ question, index }: AnswerRecapCardProps) {
  const correctLetter = String.fromCharCode(65 + (question.correctIndex ?? 0));
  const correctOption = question.options[question.correctIndex ?? 0];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold">
          Q{index}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 font-medium mb-2 leading-relaxed">
            {question.stem}
          </p>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded text-xs text-emerald-300 font-semibold">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {correctLetter}
            </span>
            <span className="text-sm text-slate-300">{correctOption}</span>
          </div>
          {question.explanation && (
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {question.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
