import React from "react";
import { CharacterId, ROLE_COLORS } from "../types/voiceGateway";

type Props = {
  character: CharacterId;
  state: "idle" | "listening" | "speaking" | "error";
  displayName?: string;
};

const AVATAR_MAP: Record<CharacterId, string> = {
  patient: "/avatars/patient.png",
  parent: "/avatars/parent.png",
  nurse: "/avatars/nurse.png",
  tech: "/avatars/tech.png",
  imaging: "/avatars/imaging.png",
  consultant: "/avatars/consultant.png",
};

export function VoiceCharacterTile({ character, state, displayName }: Props) {
  const colors = ROLE_COLORS[character] ?? ROLE_COLORS.patient;
  const pulse =
    state === "speaking"
      ? "animate-pulse-slow shadow-[0_0_20px_rgba(16,185,129,0.35)]"
      : state === "listening"
      ? "border-emerald-500/60"
      : "border-slate-700";

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-slate-900/80 ${colors.border} ${pulse}`}
      style={{ minWidth: 180 }}
    >
      <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-800 bg-slate-800/80 flex items-center justify-center">
        <img
          src={AVATAR_MAP[character]}
          alt={character}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="text-xs text-slate-500">{AVATAR_MAP[character] ? "" : character}</span>
      </div>
      <div className="flex flex-col">
        <div className={`text-sm font-semibold ${colors.text}`}>
          {displayName ?? character.charAt(0).toUpperCase() + character.slice(1)}
        </div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          {state === "speaking" ? "Speaking" : state === "listening" ? "Listening" : state === "error" ? "Error" : "Idle"}
        </div>
      </div>
    </div>
  );
}
