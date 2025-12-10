/**
 * Scoring utilities for gamification.
 * Extracted to reduce token consumption and ensure consistency.
 */

import type { Question } from "../types";

// Constants for scoring multipliers
export const DIFFICULTY_MULTIPLIERS = {
  easy: 1.0,
  medium: 1.3,
  hard: 1.6,
} as const;

export const STREAK_THRESHOLDS = {
  2: 1.1,
  3: 1.2,
  4: 1.5, // max
} as const;

export const BASE_POINTS = 100;

/**
 * Get the difficulty multiplier for a question.
 * Defaults to 1.0 (easy) if difficulty is not specified.
 */
export function getDifficultyMultiplier(difficulty?: Question["difficulty"]): number {
  if (difficulty === "medium") return DIFFICULTY_MULTIPLIERS.medium;
  if (difficulty === "hard") return DIFFICULTY_MULTIPLIERS.hard;
  return DIFFICULTY_MULTIPLIERS.easy;
}

/**
 * Get the streak multiplier based on current streak.
 * Capped at 1.5 for streaks of 4+.
 */
export function getStreakMultiplier(currentStreak: number): number {
  if (currentStreak >= 4) return STREAK_THRESHOLDS[4];
  if (currentStreak === 3) return STREAK_THRESHOLDS[3];
  if (currentStreak === 2) return STREAK_THRESHOLDS[2];
  return 1.0;
}

/**
 * Calculate points for a correct answer.
 */
export function calculatePoints(
  difficulty?: Question["difficulty"],
  currentStreak = 0
): number {
  const diffMult = getDifficultyMultiplier(difficulty);
  const streakMult = getStreakMultiplier(currentStreak);
  return Math.round(BASE_POINTS * diffMult * streakMult);
}
