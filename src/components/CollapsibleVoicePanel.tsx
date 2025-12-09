import React, { useEffect, useRef } from "react";

interface CollapsibleVoicePanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  statusBar: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleVoicePanel({
  isExpanded,
  onToggle,
  statusBar,
  children,
}: CollapsibleVoicePanelProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    if (isExpanded) {
      const scrollHeight = el.scrollHeight;
      el.style.maxHeight = `${scrollHeight}px`;
      requestAnimationFrame(() => {
        el.style.maxHeight = "999px";
      });
    } else {
      el.style.maxHeight = `${el.scrollHeight}px`;
      requestAnimationFrame(() => {
        el.style.maxHeight = "0px";
      });
    }
  }, [isExpanded]);

  return (
    <section className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-3 text-left hover:bg-slate-800/60 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex-1 min-w-0">{statusBar}</div>
        <span
          className={`ml-3 text-slate-400 text-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isExpanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ⌃
        </span>
      </button>
      <div
        ref={contentRef}
        className="transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden"
        style={{ maxHeight: isExpanded ? "999px" : "0px" }}
      >
        <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>
      </div>
    </section>
  );
}
