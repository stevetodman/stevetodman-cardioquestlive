import React from "react";

interface TeamRoleBadgeProps {
  teamName: string;
  isTeamLead: boolean;
  canClaimLead: boolean;
  onClaimLead?: () => void;
  onResignLead?: () => void;
  compact?: boolean;
}

export function TeamRoleBadge({
  teamName,
  isTeamLead,
  canClaimLead,
  onClaimLead,
  onResignLead,
  compact = false,
}: TeamRoleBadgeProps) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "text-[10px]" : "text-xs"}`}>
      {/* Team name badge */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-lg border border-slate-700">
        <span className="text-slate-400">Team:</span>
        <span className="text-slate-100 font-medium">{teamName}</span>
      </div>

      {/* Role badge */}
      {isTeamLead ? (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/40">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="font-semibold">Team Lead</span>
          </div>
          {onResignLead && (
            <button
              type="button"
              onClick={onResignLead}
              className="px-2 py-1 text-[9px] text-slate-400 hover:text-slate-300 bg-slate-800/50 rounded border border-slate-700 hover:border-slate-600 transition-colors"
            >
              Resign
            </button>
          )}
        </div>
      ) : canClaimLead ? (
        <button
          type="button"
          onClick={onClaimLead}
          className="flex items-center gap-1 px-2 py-1 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 rounded-lg border border-sky-500/40 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <span className="font-medium">Claim Lead</span>
        </button>
      ) : (
        <div className="px-2 py-1 text-slate-500 bg-slate-800/50 rounded-lg border border-slate-700">
          Member
        </div>
      )}
    </div>
  );
}

// Compact inline badge for displaying in lists/headers
export function TeamLeadIndicator({ isLead, size = "sm" }: { isLead: boolean; size?: "xs" | "sm" }) {
  if (!isLead) return null;

  const sizeClasses = size === "xs"
    ? "w-3 h-3 text-[8px]"
    : "w-4 h-4 text-[10px]";

  return (
    <div
      className={`${sizeClasses} flex items-center justify-center rounded-full bg-amber-500/30 text-amber-400`}
      title="Team Lead"
    >
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    </div>
  );
}
