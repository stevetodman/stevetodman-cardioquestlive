/**
 * Notifications hook for toast messages and error states.
 * Consolidates repeated notification patterns to reduce token cost.
 */

import { useState, useEffect, useCallback } from "react";

export interface ToastMessage {
  message: string;
  ts: number;
}

export interface NotificationState {
  toast: ToastMessage | null;
  voiceError: string | null;
  submitError: string | null;
  audioError: string | null;
}

export interface NotificationActions {
  showToast: (message: string) => void;
  clearToast: () => void;
  setVoiceError: (error: string | null) => void;
  setSubmitError: (error: string | null) => void;
  setAudioError: (error: string | null) => void;
  clearAllErrors: () => void;
}

export type UseNotificationsReturn = NotificationState & NotificationActions;

const TOAST_DURATION_MS = 3000;

/**
 * Hook for managing toast notifications and error states.
 * Auto-dismisses toasts after 3 seconds.
 */
export function useNotifications(): UseNotificationsReturn {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Auto-dismiss toast after duration
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string) => {
    setToast({ message, ts: Date.now() });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const clearAllErrors = useCallback(() => {
    setVoiceError(null);
    setSubmitError(null);
    setAudioError(null);
  }, []);

  return {
    toast,
    voiceError,
    submitError,
    audioError,
    showToast,
    clearToast,
    setVoiceError,
    setSubmitError,
    setAudioError,
    clearAllErrors,
  };
}
