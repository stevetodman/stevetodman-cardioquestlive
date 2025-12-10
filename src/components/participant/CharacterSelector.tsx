/**
 * Character selector for participant voice panel.
 * Allows selecting which NPC to direct questions to.
 */

import React from "react";
import type { CharacterId } from "../../types/voiceGateway";

const SELECTABLE_CHARACTERS: CharacterId[] = ["patient", "nurse", "tech", "consultant"];

export interface CharacterSelectorProps {
  selectedCharacter: CharacterId;
  onSelect: (character: CharacterId) => void;
}

export function CharacterSelector({ selectedCharacter, onSelect }: CharacterSelectorProps) {
  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <span className="text-slate-400">Talk to:</span>
      <div className="flex gap-1 flex-wrap">
        {SELECTABLE_CHARACTERS.map((char) => (
          <button
            key={char}
            type="button"
            onClick={() => onSelect(char)}
            className={`px-2.5 py-1 rounded-full capitalize transition-colors ${
              selectedCharacter === char
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
}
