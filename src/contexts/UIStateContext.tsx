/**
 * UIStateContext - Manages UI visibility and display states.
 * Extracted from PresenterSession to reduce component complexity.
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

/** UI State context value */
export interface UIStateContextValue {
  // Panel visibility
  showTeamScores: boolean;
  setShowTeamScores: React.Dispatch<React.SetStateAction<boolean>>;
  showIndividualScores: boolean;
  setShowIndividualScores: React.Dispatch<React.SetStateAction<boolean>>;
  showSummary: boolean;
  setShowSummary: React.Dispatch<React.SetStateAction<boolean>>;
  showDebugPanel: boolean;
  setShowDebugPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showInterventions: boolean;
  setShowInterventions: React.Dispatch<React.SetStateAction<boolean>>;
  showEkg: boolean;
  setShowEkg: React.Dispatch<React.SetStateAction<boolean>>;
  showTelemetryPopout: boolean;
  setShowTelemetryPopout: React.Dispatch<React.SetStateAction<boolean>>;
  showQr: boolean;
  setShowQr: React.Dispatch<React.SetStateAction<boolean>>;
  voiceGuideOpen: boolean;
  setVoiceGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Viewers
  viewingEkgOrder: EkgOrderView | null;
  setViewingEkgOrder: React.Dispatch<React.SetStateAction<EkgOrderView | null>>;
  viewingCxrOrder: CxrOrderView | null;
  setViewingCxrOrder: React.Dispatch<React.SetStateAction<CxrOrderView | null>>;

  // Toasts and alerts
  copyToast: string | null;
  setCopyToast: React.Dispatch<React.SetStateAction<string | null>>;

  // Loading state
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // Toggle helpers
  toggleTeamScores: () => void;
  toggleIndividualScores: () => void;
  toggleDebugPanel: () => void;
  toggleInterventions: () => void;
  toggleEkg: () => void;
  toggleQr: () => void;
}

export interface EkgOrderView {
  imageUrl?: string;
  summary?: string;
  timestamp?: number;
  orderedBy?: { name: string };
}

export interface CxrOrderView {
  imageUrl?: string;
  summary?: string;
  timestamp?: number;
  orderedBy?: { name: string };
  viewType?: "PA" | "AP" | "Lateral";
}

const UIStateContext = createContext<UIStateContextValue | null>(null);

export function useUIState(): UIStateContextValue {
  const context = useContext(UIStateContext);
  if (!context) {
    throw new Error("useUIState must be used within a UIStateProvider");
  }
  return context;
}

export function useUIStateOptional(): UIStateContextValue | null {
  return useContext(UIStateContext);
}

interface UIStateProviderProps {
  children: ReactNode;
}

export function UIStateProvider({ children }: UIStateProviderProps) {
  // Panel visibility
  const [showTeamScores, setShowTeamScores] = useState(true);
  const [showIndividualScores, setShowIndividualScores] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showInterventions, setShowInterventions] = useState(false);
  const [showEkg, setShowEkg] = useState(false);
  const [showTelemetryPopout, setShowTelemetryPopout] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [voiceGuideOpen, setVoiceGuideOpen] = useState(false);

  // Viewers
  const [viewingEkgOrder, setViewingEkgOrder] = useState<EkgOrderView | null>(null);
  const [viewingCxrOrder, setViewingCxrOrder] = useState<CxrOrderView | null>(null);

  // Toasts and alerts
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Loading
  const [loading, setLoading] = useState(true);

  // Toggle helpers
  const toggleTeamScores = useCallback(() => setShowTeamScores((v) => !v), []);
  const toggleIndividualScores = useCallback(() => setShowIndividualScores((v) => !v), []);
  const toggleDebugPanel = useCallback(() => setShowDebugPanel((v) => !v), []);
  const toggleInterventions = useCallback(() => setShowInterventions((v) => !v), []);
  const toggleEkg = useCallback(() => setShowEkg((v) => !v), []);
  const toggleQr = useCallback(() => setShowQr((v) => !v), []);

  const value: UIStateContextValue = {
    showTeamScores,
    setShowTeamScores,
    showIndividualScores,
    setShowIndividualScores,
    showSummary,
    setShowSummary,
    showDebugPanel,
    setShowDebugPanel,
    showInterventions,
    setShowInterventions,
    showEkg,
    setShowEkg,
    showTelemetryPopout,
    setShowTelemetryPopout,
    showQr,
    setShowQr,
    voiceGuideOpen,
    setVoiceGuideOpen,
    viewingEkgOrder,
    setViewingEkgOrder,
    viewingCxrOrder,
    setViewingCxrOrder,
    copyToast,
    setCopyToast,
    loading,
    setLoading,
    toggleTeamScores,
    toggleIndividualScores,
    toggleDebugPanel,
    toggleInterventions,
    toggleEkg,
    toggleQr,
  };

  return (
    <UIStateContext.Provider value={value}>
      {children}
    </UIStateContext.Provider>
  );
}
