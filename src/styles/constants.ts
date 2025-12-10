/**
 * Reusable Tailwind class compositions.
 * Centralizes repeated styling patterns to reduce token usage and ensure consistency.
 */

// ============================================================================
// Typography
// ============================================================================

/** Extra-small label: "ORDERS", "STATUS", section headers */
export const LABEL_XS = "text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold";

/** Small label variant with slate-400 */
export const LABEL_XS_MUTED = "text-[10px] uppercase tracking-[0.14em] text-slate-400";

/** Standard small text (11px) */
export const TEXT_SM = "text-[11px]";

/** Standard base text (12px) */
export const TEXT_BASE = "text-[12px]";

/** Section header label (11px uppercase) */
export const SECTION_HEADER = "text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold";

/** Wide tracking for emphasis */
export const LABEL_WIDE = "text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold";

// ============================================================================
// Containers & Cards
// ============================================================================

/** Standard card container with dark background */
export const CARD = "bg-slate-900/60 border border-slate-800 rounded-lg";

/** Card with padding */
export const CARD_PADDED = `${CARD} p-3`;

/** Darker card variant */
export const CARD_DARK = "bg-slate-950/70 border border-slate-800 rounded-lg";

/** Transparent card for overlays */
export const CARD_OVERLAY = "bg-slate-900/80 border border-slate-800 rounded-lg";

// ============================================================================
// Badges & Pills
// ============================================================================

/** Base badge styling */
export const BADGE_BASE = "px-2 py-0.5 rounded border text-[10px] uppercase tracking-[0.14em]";

/** Pill-shaped badge */
export const BADGE_PILL = "px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.14em]";

/** Success badge (green) */
export const BADGE_SUCCESS = "bg-emerald-500/20 border-emerald-500/60 text-emerald-100";

/** Warning badge (amber) */
export const BADGE_WARNING = "bg-amber-500/20 border-amber-500/60 text-amber-100";

/** Error badge (rose) */
export const BADGE_ERROR = "bg-rose-500/20 border-rose-500/60 text-rose-100";

/** Info badge (sky) */
export const BADGE_INFO = "bg-sky-500/20 border-sky-500/60 text-sky-100";

/** Neutral badge */
export const BADGE_NEUTRAL = "border-slate-700 text-slate-200";

/** Active/highlight badge (indigo) */
export const BADGE_ACTIVE = "bg-indigo-500/20 border-indigo-500/60 text-indigo-100";

// ============================================================================
// Buttons
// ============================================================================

/** Primary button base */
export const BTN_PRIMARY = "px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors";

/** Secondary button */
export const BTN_SECONDARY = "px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition-colors";

/** Ghost button */
export const BTN_GHOST = "px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 text-sm font-medium transition-colors";

/** Danger button */
export const BTN_DANGER = "px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors";

/** Small button variant */
export const BTN_SM = "px-2 py-1 rounded text-xs font-medium transition-colors";

// ============================================================================
// Status Indicators
// ============================================================================

/** Connected/online status */
export const STATUS_CONNECTED = "text-emerald-400";

/** Disconnected/offline status */
export const STATUS_DISCONNECTED = "text-slate-500";

/** Warning/pending status */
export const STATUS_WARNING = "text-amber-400";

/** Error/critical status */
export const STATUS_ERROR = "text-rose-400";

// ============================================================================
// Vitals Display
// ============================================================================

/** Normal vital value */
export const VITAL_NORMAL = "text-emerald-400";

/** Abnormal vital value */
export const VITAL_ABNORMAL = "text-amber-300";

/** Critical vital value */
export const VITAL_CRITICAL = "text-rose-400";

// ============================================================================
// Animation Classes
// ============================================================================

/** Pulse animation for attention */
export const ANIMATE_PULSE = "animate-pulse";

/** Glow effect for changes */
export const GLOW_AMBER = "ring-2 ring-amber-400/50";

/** Transition for smooth state changes */
export const TRANSITION_BASE = "transition-all duration-200";

// ============================================================================
// Layout Helpers
// ============================================================================

/** Flex row with gap */
export const FLEX_ROW = "flex items-center gap-2";

/** Flex column with gap */
export const FLEX_COL = "flex flex-col gap-2";

/** Space between items */
export const FLEX_BETWEEN = "flex items-center justify-between";

/** Center content */
export const FLEX_CENTER = "flex items-center justify-center";
