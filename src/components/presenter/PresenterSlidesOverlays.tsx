/**
 * Slide overlays for presenter view (scoreboards, poll results).
 * Extracted from PresenterSession to reduce file size and token consumption.
 */

import React from "react";
import { TeamScoreboard } from "../TeamScoreboard";
import { IndividualScoreboard } from "../IndividualScoreboard";
import { ResponsesChart } from "../ResponsesChart";
import type { Question } from "../../types";

// ============================================================================
// Types
// ============================================================================

export interface TeamScore {
  teamId: string;
  teamName: string;
  points: number;
  memberCount: number;
}

export interface IndividualScore {
  odcId: string;
  userId: string;
  displayName?: string;
  points: number;
  teamId: string;
  teamName: string;
}

export interface PresenterSlidesOverlaysProps {
  // Session
  sessionId: string;

  // Current question
  currentQuestion: Question | null;
  isQuestionOpen: boolean;
  isShowingResults: boolean;
  showResultsOverlay: boolean;

  // Scoreboards
  showTeamScores: boolean;
  showIndividualScores: boolean;
  teams: TeamScore[];
  players: IndividualScore[];
}

// ============================================================================
// Component
// ============================================================================

export function PresenterSlidesOverlays({
  sessionId,
  currentQuestion,
  isQuestionOpen,
  isShowingResults,
  showResultsOverlay,
  showTeamScores,
  showIndividualScores,
  teams,
  players,
}: PresenterSlidesOverlaysProps) {
  return (
    <>
      {/* Team Scoreboard - top right */}
      {showTeamScores && teams.length > 0 && (
        <div className="absolute top-4 right-4 z-30 pointer-events-none">
          <TeamScoreboard teams={teams} />
        </div>
      )}

      {/* Individual Scoreboard - bottom right */}
      {showIndividualScores && players.length > 0 && (
        <div className="absolute bottom-4 right-4 z-30 pointer-events-none">
          <IndividualScoreboard players={players} />
        </div>
      )}

      {/* Poll Results Overlay - bottom */}
      {showResultsOverlay && currentQuestion && (
        <div className="absolute inset-x-3 bottom-3 pointer-events-none">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 shadow-lg shadow-black/30 pointer-events-auto">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
              <span className="uppercase tracking-[0.12em] text-slate-300">Poll Results</span>
              <span className="font-mono text-[10px]">
                {isQuestionOpen ? "Open" : "Closed"} {isShowingResults ? "· Showing results" : ""}
              </span>
            </div>
            <ResponsesChart
              sessionId={sessionId}
              questionId={currentQuestion.id}
              options={currentQuestion.options}
              correctIndex={currentQuestion.correctIndex ?? 0}
              showResults={isShowingResults}
              mode="presenter"
            />
          </div>
        </div>
      )}
    </>
  );
}
