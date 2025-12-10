/**
 * Scoring utilities for gamification.
 * Formula: BASE_POINTS × streak_multiplier × time_bonus
 * - No difficulty multiplier (all questions equal base value)
 * - Streak bonus rewards consecutive correct answers
 * - Time bonus rewards faster responses
 */

export const STREAK_THRESHOLDS = {
  2: 1.1,
  3: 1.2,
  4: 1.5, // max
} as const;

export const BASE_POINTS = 100;

// Time bonus: answer within X seconds for bonus multiplier
export const TIME_BONUS = {
  FAST_THRESHOLD_MS: 5000,    // Under 5 seconds = fast bonus
  MEDIUM_THRESHOLD_MS: 10000, // Under 10 seconds = medium bonus
  FAST_MULTIPLIER: 1.3,       // 30% bonus for very fast
  MEDIUM_MULTIPLIER: 1.15,    // 15% bonus for moderately fast
} as const;

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
 * Get time bonus multiplier based on response time.
 * @param responseTimeMs - Time taken to answer in milliseconds
 */
export function getTimeBonus(responseTimeMs: number): number {
  if (responseTimeMs <= TIME_BONUS.FAST_THRESHOLD_MS) {
    return TIME_BONUS.FAST_MULTIPLIER;
  }
  if (responseTimeMs <= TIME_BONUS.MEDIUM_THRESHOLD_MS) {
    return TIME_BONUS.MEDIUM_MULTIPLIER;
  }
  return 1.0;
}

/**
 * Calculate points for a correct answer.
 * @param currentStreak - Number of consecutive correct answers
 * @param responseTimeMs - Time taken to answer (optional, defaults to no bonus)
 */
export function calculatePoints(
  currentStreak = 0,
  responseTimeMs?: number
): number {
  const streakMult = getStreakMultiplier(currentStreak);
  const timeMult = responseTimeMs != null ? getTimeBonus(responseTimeMs) : 1.0;
  return Math.round(BASE_POINTS * streakMult * timeMult);
}
