/**
 * DebriefContext - Manages debrief and analysis state.
 * Extracted from PresenterSession to reduce component complexity.
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnalysisResult, ComplexDebriefResult } from "../types/voiceGateway";

/** Timeline event for debrief */
export interface TimelineExtra {
  id: string;
  ts: number;
  label: string;
  detail: string;
}

/** Debrief context value */
export interface DebriefContextValue {
  // Analysis state
  isAnalyzing: boolean;
  setIsAnalyzing: React.Dispatch<React.SetStateAction<boolean>>;
  debriefResult: AnalysisResult | null;
  setDebriefResult: React.Dispatch<React.SetStateAction<AnalysisResult | null>>;
  complexDebriefResult: ComplexDebriefResult | null;
  setComplexDebriefResult: React.Dispatch<React.SetStateAction<ComplexDebriefResult | null>>;

  // Timeline state
  timelineCopyStatus: "idle" | "copied" | "error";
  setTimelineCopyStatus: React.Dispatch<React.SetStateAction<"idle" | "copied" | "error">>;
  timelineFilter: string;
  setTimelineFilter: React.Dispatch<React.SetStateAction<string>>;
  timelineSaveStatus: "idle" | "saving" | "saved" | "error";
  setTimelineSaveStatus: React.Dispatch<React.SetStateAction<"idle" | "saving" | "saved" | "error">>;
  timelineSearch: string;
  setTimelineSearch: React.Dispatch<React.SetStateAction<string>>;
  timelineExtras: TimelineExtra[];
  setTimelineExtras: React.Dispatch<React.SetStateAction<TimelineExtra[]>>;

  // Export state
  transcriptSaveStatus: "idle" | "saving" | "saved" | "error";
  setTranscriptSaveStatus: React.Dispatch<React.SetStateAction<"idle" | "saving" | "saved" | "error">>;
  exportStatus: "idle" | "exporting" | "exported" | "error";
  setExportStatus: React.Dispatch<React.SetStateAction<"idle" | "exporting" | "exported" | "error">>;

  // Helpers
  addTimelineExtra: (label: string, detail: string) => void;
  clearDebrief: () => void;
}

const DebriefContext = createContext<DebriefContextValue | null>(null);

export function useDebrief(): DebriefContextValue {
  const context = useContext(DebriefContext);
  if (!context) {
    throw new Error("useDebrief must be used within a DebriefProvider");
  }
  return context;
}

export function useDebriefOptional(): DebriefContextValue | null {
  return useContext(DebriefContext);
}

interface DebriefProviderProps {
  children: ReactNode;
}

export function DebriefProvider({ children }: DebriefProviderProps) {
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [debriefResult, setDebriefResult] = useState<AnalysisResult | null>(null);
  const [complexDebriefResult, setComplexDebriefResult] = useState<ComplexDebriefResult | null>(null);

  // Timeline state
  const [timelineCopyStatus, setTimelineCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [timelineFilter, setTimelineFilter] = useState<string>("all");
  const [timelineSaveStatus, setTimelineSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [timelineSearch, setTimelineSearch] = useState<string>("");
  const [timelineExtras, setTimelineExtras] = useState<TimelineExtra[]>([]);

  // Export state
  const [transcriptSaveStatus, setTranscriptSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "exported" | "error">("idle");

  // Helpers
  const addTimelineExtra = useCallback((label: string, detail: string) => {
    const ts = Date.now();
    setTimelineExtras((prev) => [
      ...prev,
      { id: `extra-${ts}-${Math.random().toString(36).slice(2, 8)}`, ts, label, detail },
    ]);
  }, []);

  const clearDebrief = useCallback(() => {
    setDebriefResult(null);
    setComplexDebriefResult(null);
    setIsAnalyzing(false);
  }, []);

  const value: DebriefContextValue = {
    isAnalyzing,
    setIsAnalyzing,
    debriefResult,
    setDebriefResult,
    complexDebriefResult,
    setComplexDebriefResult,
    timelineCopyStatus,
    setTimelineCopyStatus,
    timelineFilter,
    setTimelineFilter,
    timelineSaveStatus,
    setTimelineSaveStatus,
    timelineSearch,
    setTimelineSearch,
    timelineExtras,
    setTimelineExtras,
    transcriptSaveStatus,
    setTranscriptSaveStatus,
    exportStatus,
    setExportStatus,
    addTimelineExtra,
    clearDebrief,
  };

  return (
    <DebriefContext.Provider value={value}>
      {children}
    </DebriefContext.Provider>
  );
}
