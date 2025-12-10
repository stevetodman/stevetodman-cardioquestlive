/**
 * Exam findings panel for participant view.
 * Displays physical exam findings and auscultation audio clips.
 */

import React, { useState, useRef, useCallback } from "react";
import { SectionLabel } from "../ui";

export interface ExamFindings {
  general?: string;
  cardio?: string;
  lungs?: string;
  perfusion?: string;
  neuro?: string;
}

export interface ExamAudioClip {
  type: "heart" | "lung";
  label: string;
  url: string;
}

export interface ExamFindingsPanelProps {
  exam: ExamFindings;
  examAudio?: ExamAudioClip[];
}

export function ExamFindingsPanel({ exam, examAudio }: ExamFindingsPanelProps) {
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingClipId(null);
    setLoadingClipId(null);
  }, []);

  const handlePlayClip = useCallback((clip: ExamAudioClip) => {
    setAudioError(null);
    const isSame = playingClipId === clip.url || loadingClipId === clip.url;
    if (isSame) {
      stopAudio();
      return;
    }
    stopAudio();
    const el = new Audio(clip.url);
    audioRef.current = el;
    setLoadingClipId(clip.url);

    el.oncanplaythrough = () => {
      setLoadingClipId(null);
      setPlayingClipId(clip.url);
    };
    el.onended = () => stopAudio();
    el.onerror = () => {
      setAudioError("Audio unavailable. Please try again or check assets.");
      stopAudio();
    };
    el.play().catch(() => {
      setAudioError("Could not play audio. Check browser permissions.");
      stopAudio();
    });
  }, [playingClipId, loadingClipId, stopAudio]);

  return (
    <div className="mt-2 bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 space-y-1">
      <SectionLabel>Exam</SectionLabel>
      {exam.general && <ExamLine label="General" value={exam.general} />}
      {exam.cardio && <ExamLine label="CV" value={exam.cardio} />}
      {exam.lungs && <ExamLine label="Lungs" value={exam.lungs} />}
      {exam.perfusion && <ExamLine label="Perfusion" value={exam.perfusion} />}
      {exam.neuro && <ExamLine label="Neuro" value={exam.neuro} />}

      {examAudio && examAudio.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold flex items-center gap-2">
            <HeadphonesIcon />
            Auscultation (headphones recommended)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {examAudio.map((clip) => (
              <AudioClipButton
                key={`${clip.type}-${clip.url}`}
                clip={clip}
                isPlaying={playingClipId === clip.url}
                isLoading={loadingClipId === clip.url}
                onClick={() => handlePlayClip(clip)}
              />
            ))}
          </div>
          {audioError && <AudioErrorBanner message={audioError} />}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ExamLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500 text-[11px] mr-1">{label}:</span>
      {value}
    </div>
  );
}

function HeadphonesIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface AudioClipButtonProps {
  clip: ExamAudioClip;
  isPlaying: boolean;
  isLoading: boolean;
  onClick: () => void;
}

function AudioClipButton({ clip, isPlaying, isLoading, onClick }: AudioClipButtonProps) {
  const isActive = isPlaying || isLoading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`px-3 py-2.5 rounded-lg border text-left text-sm transition-all ${
        isPlaying
          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
          : isLoading
          ? "border-amber-500/60 bg-amber-500/10 text-amber-100"
          : "border-slate-700 bg-slate-900/70 text-slate-100 hover:border-slate-500 active:scale-[0.98]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            {clip.type === "heart" ? "Heart" : "Lungs"}
          </div>
          <div className="font-semibold truncate">{clip.label}</div>
        </div>
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          isPlaying ? "bg-emerald-500/20" : isLoading ? "bg-amber-500/20" : "bg-slate-800"
        }`}>
          {isLoading ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
        </div>
      </div>
      <div className={`text-[11px] mt-1 ${isActive ? "opacity-90" : "text-slate-400"}`}>
        {isLoading ? "Loading…" : isPlaying ? "Tap to pause" : "Tap to play"}
      </div>
    </button>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function AudioErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {message}
    </div>
  );
}
