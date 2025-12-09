import React, { useState } from "react";
import { TEXT_INPUT_MAX_LENGTH } from "../constants";

type Props = {
  onSubmit: (text: string) => Promise<void> | void;
  disabled?: boolean;
};

export function TextQuestionInput({ onSubmit, disabled = false }: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const limit = TEXT_INPUT_MAX_LENGTH;
  const remaining = limit - text.length;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || pending || disabled) return;
    setPending(true);
    try {
      await onSubmit(text.trim());
      setText("");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
        Type your question
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, limit))}
        maxLength={limit}
        rows={3}
        className="w-full rounded-lg border border-slate-700 bg-slate-900/80 text-slate-100 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
        placeholder="Ask the patient or nurse in text..."
        disabled={pending || disabled}
      />
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{remaining} chars left</span>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!text.trim() || pending || disabled}
            className="px-3 py-1.5 rounded-lg border border-sky-500/60 text-sky-100 bg-sky-900/40 hover:border-sky-400 hover:bg-sky-900/60 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-semibold"
          >
            {pending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </form>
  );
}
