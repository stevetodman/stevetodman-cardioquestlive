/**
 * Audio playback hook for exam auscultation clips.
 * Handles loading states, play/pause toggle, and error handling.
 */

import { useState, useRef, useCallback } from "react";

export interface AudioClip {
  url: string;
  label: string;
}

export interface UseAudioPlaybackReturn {
  playingClipId: string | null;
  loadingClipId: string | null;
  audioError: string | null;
  playClip: (clip: AudioClip) => void;
  stopAudio: () => void;
  isPlaying: (url: string) => boolean;
  isLoading: (url: string) => boolean;
}

/**
 * Hook for managing audio playback state.
 * Supports single audio at a time, toggle play/pause, loading states.
 */
export function useAudioPlayback(): UseAudioPlaybackReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingClipId(null);
    setLoadingClipId(null);
  }, []);

  const playClip = useCallback((clip: AudioClip) => {
    setAudioError(null);

    // Toggle off if same clip
    const isSame = playingClipId === clip.url || loadingClipId === clip.url;
    if (isSame) {
      stopAudio();
      return;
    }

    // Stop any current audio first
    stopAudio();

    // Create and configure new audio element
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

  const isPlaying = useCallback((url: string) => playingClipId === url, [playingClipId]);
  const isLoading = useCallback((url: string) => loadingClipId === url, [loadingClipId]);

  return {
    playingClipId,
    loadingClipId,
    audioError,
    playClip,
    stopAudio,
    isPlaying,
    isLoading,
  };
}
