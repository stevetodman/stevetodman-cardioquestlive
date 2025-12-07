/**
 * PresenterSession renders a session's slides for the presenter:
 * - Top bar with title/join code and poll controls.
 * - Slide container that renders raw slide HTML (trusted) with Gemini chrome.
 * - In-slide poll results overlay, gated by showResults and responseTotal > 0 to avoid empty overlays.
 * Keyboard nav (arrows/Space) and in-slide nav buttons drive slide changes.
 */
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, updateDoc, db, collection, query, where, addDoc } from "../utils/firestore"; // Updated import
import { SessionData } from "../types";
import { ResponsesChart } from "../components/ResponsesChart";
import { useTeamScores } from "../hooks/useTeamScores";
import { useIndividualScores } from "../hooks/useIndividualScores";
import { TeamScoreboard } from "../components/TeamScoreboard";
import { IndividualScoreboard } from "../components/IndividualScoreboard";
import { SessionSummary } from "../components/SessionSummary";
import { Question } from "../types";
import { useVoiceState, releaseFloor, setVoiceEnabled } from "../hooks/useVoiceState";
import { auth } from "../firebase";
import { VoicePatientOverlay, TranscriptTurn } from "../components/VoicePatientOverlay";
import { PresenterVoiceControls } from "../components/PresenterVoiceControls";
import { VoiceCharacterTile } from "../components/VoiceCharacterTile";
import { voiceGatewayClient } from "../services/VoiceGatewayClient";
import {
  PatientState,
  PatientScenarioId,
  DebriefTurn,
  AnalysisResult,
  VoiceConnectionStatus,
  CharacterId,
  ROLE_COLORS,
} from "../types/voiceGateway";
import { getScenarioSnapshot } from "../data/scenarioSummaries";
import { SessionTranscriptPanel, TranscriptLogTurn } from "../components/SessionTranscriptPanel";
import { sendVoiceCommand } from "../services/voiceCommands";
import { DebriefPanel } from "../components/DebriefPanel";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import { Select } from "../components/Select";

type SnapshotProps = {
  chiefComplaint: string;
  hpi: string[];
  exam: string[];
  labs: { name: string; status: "pending" | "result"; summary: string }[];
  imaging: { name: string; status: "pending" | "result"; summary: string }[];
};

function ScenarioSnapshotCard({ snapshot }: { snapshot: SnapshotProps | null }) {
  if (!snapshot) return null;
  const statusBadge = (status: "pending" | "result") =>
    status === "result"
      ? "bg-emerald-500/15 text-emerald-100 border-emerald-500/50"
      : "bg-slate-800 text-slate-200 border-slate-700";

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-3 shadow-sm shadow-black/30">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-1">
        Patient snapshot
      </div>
      <div className="text-sm font-semibold text-slate-50 mb-3">{snapshot.chiefComplaint}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">HPI highlights</div>
          <ul className="text-sm text-slate-200 space-y-1 list-disc list-inside">
            {snapshot.hpi.map((item, idx) => (
              <li key={`hpi-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Exam</div>
          <ul className="text-sm text-slate-200 space-y-1 list-disc list-inside">
            {snapshot.exam.map((item, idx) => (
              <li key={`exam-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 mt-3">
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Labs</div>
          <ul className="space-y-1.5">
            {snapshot.labs.map((lab, idx) => (
              <li key={`lab-${idx}`} className="text-sm text-slate-200 flex items-start gap-2">
                <span className={`px-2 py-0.5 rounded-full border text-[11px] ${statusBadge(lab.status)}`}>
                  {lab.status === "result" ? "result" : "pending"}
                </span>
                <div>
                  <div className="font-semibold">{lab.name}</div>
                  <div className="text-slate-400 text-[13px] leading-tight">{lab.summary}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Imaging</div>
          <ul className="space-y-1.5">
            {snapshot.imaging.map((img, idx) => (
              <li key={`img-${idx}`} className="text-sm text-slate-200 flex items-start gap-2">
                <span className={`px-2 py-0.5 rounded-full border text-[11px] ${statusBadge(img.status)}`}>
                  {img.status === "result" ? "result" : "pending"}
                </span>
                <div>
                  <div className="font-semibold">{img.name}</div>
                  <div className="text-slate-400 text-[13px] leading-tight">{img.summary}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function PresenterSession() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseTotal, setResponseTotal] = useState(0);
  const [showTeamScores, setShowTeamScores] = useState(true);
  const [showIndividualScores, setShowIndividualScores] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [overallAccuracy, setOverallAccuracy] = useState<number>(0);
  const [questionsAnsweredCount, setQuestionsAnsweredCount] = useState<number>(0);
  const [totalResponses, setTotalResponses] = useState<number>(0);
  const [questionStats, setQuestionStats] = useState<
    { questionId: string; questionIndex: number; correctCount: number; totalCount: number; accuracyPct: number }[]
  >([]);
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptTurn[]>([]);
  const [patientState, setPatientState] = useState<PatientState>("idle");
  const [gatewayStatus, setGatewayStatus] = useState<VoiceConnectionStatus>({
    state: "disconnected",
    lastChangedAt: Date.now(),
  });
  const [simState, setSimState] = useState<{
    stageId: string;
    vitals: Record<string, unknown>;
    exam?: Record<string, string | undefined>;
    telemetry?: boolean;
    rhythmSummary?: string;
    telemetryWaveform?: number[];
    fallback: boolean;
    findings?: string[];
    budget?: { usdEstimate?: number; voiceSeconds?: number; throttled?: boolean; fallback?: boolean };
    scenarioId?: PatientScenarioId;
    stageIds?: string[];
    orders?: { id: string; type: "vitals" | "ekg" | "labs" | "imaging"; status: "pending" | "complete"; result?: any; completedAt?: number }[];
  } | null>(null);
  const [transcriptLog, setTranscriptLog] = useState<TranscriptLogTurn[]>([]);
  const [patientAudioUrl, setPatientAudioUrl] = useState<string | null>(null);
  const [freezeStatus, setFreezeStatus] = useState<"live" | "frozen">("live");
  const [showEkg, setShowEkg] = useState(false);
  const [availableStages, setAvailableStages] = useState<string[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [doctorQuestionText, setDoctorQuestionText] = useState<string>("");
const [autoForceReply, setAutoForceReply] = useState(false);
const [targetCharacter, setTargetCharacter] = useState<CharacterId>("patient");
const [selectedScenario, setSelectedScenario] =
  useState<PatientScenarioId>("exertional_chest_pain");
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [debriefResult, setDebriefResult] = useState<AnalysisResult | null>(null);
const [timelineCopyStatus, setTimelineCopyStatus] = useState<"idle" | "copied" | "error">("idle");
const [timelineFilter, setTimelineFilter] = useState<string>("all");
  const [timelineSaveStatus, setTimelineSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [transcriptSaveStatus, setTranscriptSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
const [timelineSearch, setTimelineSearch] = useState<string>("");
  const [voiceLocked, setVoiceLocked] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<{ character: CharacterId; state: PatientState } | null>(null);
  const snapshot = useMemo(
    () => getScenarioSnapshot(simState?.scenarioId ?? selectedScenario),
    [selectedScenario, simState?.scenarioId]
  );
  const latestEkg = useMemo(() => {
    const ekgs = (simState?.orders ?? []).filter((o) => o.type === "ekg" && o.status === "complete");
    return ekgs.length ? ekgs[ekgs.length - 1] : null;
  }, [simState?.orders]);
  const ekgHistory = useMemo(() => {
    if ((simState as any)?.ekgHistory) return (simState as any).ekgHistory;
    const ekgs = (simState?.orders ?? []).filter((o) => o.type === "ekg" && o.status === "complete");
    return ekgs.slice(-3).reverse();
  }, [simState?.orders, (simState as any)?.ekgHistory]);
  const timelineItems = useMemo(() => {
    const items: { id: string; ts: number; label: string; detail: string }[] = [];
    transcriptLog.forEach((t) => {
      items.push({
        id: `turn-${t.id}`,
        ts: t.timestamp,
        label: t.character ? t.character : t.role === "doctor" ? "Doctor" : "Patient",
        detail: t.text,
      });
    });
    (simState?.telemetryHistory ?? []).forEach((h, idx) => {
      items.push({
        id: `telemetry-${idx}-${h.ts ?? Date.now()}`,
        ts: h.ts ?? Date.now(),
        label: "Telemetry",
        detail: h.rhythm ?? "Rhythm update",
      });
    });
    (ekgHistory ?? []).forEach((ekg, idx) => {
      items.push({
        id: `ekg-${idx}-${ekg.ts ?? Date.now()}`,
        ts: ekg.ts ?? Date.now(),
        label: "EKG",
        detail: ekg.summary ?? "EKG",
      });
    });
    (simState?.orders ?? [])
      .filter((o) => o.status === "complete")
      .forEach((o) => {
        items.push({
          id: `order-${o.id}`,
          ts: o.completedAt ?? Date.now(),
          label: o.type.toUpperCase(),
          detail:
            o.result?.type === "vitals"
              ? `HR ${o.result.hr ?? "—"} BP ${o.result.bp ?? "—"} SpO₂ ${o.result.spo2 ?? "—"}`
              : o.result?.summary ?? "Result ready",
        });
      });
    if (simState?.exam) {
      items.push({
        id: `exam-${simState.stageId}-${Date.now()}`,
        ts: Date.now(),
        label: "Exam",
        detail: [
          simState.exam.general && `General: ${simState.exam.general}`,
          simState.exam.cardio && `CV: ${simState.exam.cardio}`,
          simState.exam.lungs && `Lungs: ${simState.exam.lungs}`,
          simState.exam.perfusion && `Perfusion: ${simState.exam.perfusion}`,
          simState.exam.neuro && `Neuro: ${simState.exam.neuro}`,
        ]
          .filter(Boolean)
          .join(" | "),
      });
    }
    return items
      .sort((a, b) => a.ts - b.ts)
      .filter((item, idx, arr) => arr.findIndex((it) => it.id === item.id) === idx)
      .slice(-20);
  }, [transcriptLog, simState?.orders]);
  const filteredTimeline = useMemo(
    () =>
      (timelineFilter === "all"
        ? timelineItems
        : timelineItems.filter((item) => item.label.toLowerCase() === timelineFilter)
      ).filter((item) => (timelineSearch ? `${item.label} ${item.detail}`.toLowerCase().includes(timelineSearch.toLowerCase()) : true)),
    [timelineItems, timelineFilter, timelineSearch]
  );
  const timelineText = useMemo(() => {
    return timelineItems
      .map((item) => {
        const ts = new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        return `${ts} ${item.label}: ${item.detail}`;
      })
      .join("\n");
  }, [timelineItems]);
  const transcriptText = useMemo(() => {
    return transcriptLog
      .map((t) => {
        const ts = new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const speaker = t.character ?? t.role ?? "unknown";
        return `${ts} ${speaker}: ${t.text}`;
      })
      .join("\n");
  }, [transcriptLog]);
  const debriefReportText = useMemo(() => {
    if (!debriefResult) return "";
    const parts: string[] = [];
    parts.push("# CardioQuest Debrief");
    if (sessionId) parts.push(`Session: ${sessionId}`);
    parts.push(`Generated: ${new Date().toISOString()}`);
    if (debriefResult.summary) {
      parts.push("## Summary", debriefResult.summary);
    }
    if (debriefResult.strengths?.length) {
      parts.push("## Strengths", debriefResult.strengths.map((s) => `- ${s}`).join("\n"));
    }
    if (debriefResult.opportunities?.length) {
      parts.push("## Opportunities", debriefResult.opportunities.map((s) => `- ${s}`).join("\n"));
    }
    if (debriefResult.teachingPoints?.length) {
      parts.push("## Teaching Points", debriefResult.teachingPoints.map((s) => `- ${s}`).join("\n"));
    }
    if (timelineItems.length > 0) {
      parts.push("## Timeline (last 20 events)", timelineText || "—");
    }
    return parts.join("\n\n");
  }, [debriefResult, sessionId, timelineItems.length, timelineText]);

  const saveTimelineToSession = useCallback(async () => {
    if (!sessionId || !timelineText || timelineItems.length === 0) return;
    setTimelineSaveStatus("saving");
    try {
      const tlCollection = collection(db, "sessions", sessionId, "timeline");
      await addDoc(tlCollection, {
        createdBy: auth.currentUser?.uid ?? "unknown",
        createdAt: new Date().toISOString(),
        text: timelineText,
      });
      setTimelineSaveStatus("saved");
      setTimeout(() => setTimelineSaveStatus("idle"), 1500);
    } catch {
      setTimelineSaveStatus("error");
      setTimeout(() => setTimelineSaveStatus("idle"), 1500);
    }
  }, [sessionId, timelineItems.length, timelineText]);

  const saveTranscriptToSession = useCallback(async () => {
    if (!sessionId || !transcriptText || transcriptLog.length === 0) return;
    setTranscriptSaveStatus("saving");
    try {
      const trCollection = collection(db, "sessions", sessionId, "transcripts");
      await addDoc(trCollection, {
        createdBy: auth.currentUser?.uid ?? "unknown",
        createdAt: new Date().toISOString(),
        text: transcriptText,
      });
      setTranscriptSaveStatus("saved");
      setTimeout(() => setTranscriptSaveStatus("idle"), 1500);
    } catch {
      setTranscriptSaveStatus("error");
      setTimeout(() => setTranscriptSaveStatus("idle"), 1500);
    }
  }, [sessionId, transcriptLog.length, transcriptText]);
  const groupedTranscript = useMemo(() => {
    const order = ["patient", "nurse", "tech", "consultant", "doctor"];
    const buckets = new Map<string, TranscriptLogTurn[]>();
    transcriptLog.forEach((t) => {
      const key = t.character ?? (t.role === "doctor" ? "doctor" : "patient");
      buckets.set(key, [...(buckets.get(key) ?? []), t]);
    });
    const ordered = order.filter((k) => buckets.has(k)).map((k) => ({ key: k, turns: buckets.get(k)! }));
    const extras = Array.from(buckets.entries())
      .filter(([k]) => !order.includes(k))
      .map(([key, turns]) => ({ key, turns }));
    return [...ordered, ...extras];
  }, [transcriptLog]);
  const roleColor = useCallback((role: string) => {
    const colors = ROLE_COLORS[role as keyof typeof ROLE_COLORS] ?? ROLE_COLORS.patient;
    return `${colors.text} ${colors.border}`;
  }, []);

  const timelineBadge = useCallback((label: string) => {
    const lowered = label.toLowerCase();
    const colors = ROLE_COLORS[lowered as keyof typeof ROLE_COLORS];
    if (colors) {
      return `${colors.border} ${colors.text} px-2 py-0.5 rounded border text-[10px] uppercase tracking-[0.14em]`;
    }
    return "px-2 py-0.5 rounded border border-slate-700 text-[10px] uppercase tracking-[0.14em] text-slate-200";
  }, []);
  const slideRef = useRef<HTMLDivElement>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const currentTurnCharacterRef = useRef<string | undefined>("patient");
  const lastDoctorTurnIdRef = useRef<string | null>(null);
  const lastAutoForcedRef = useRef<string | null>(null);
  const loggedOrderIdsRef = useRef<Set<string>>(new Set());
  const teams = useTeamScores(sessionId);
  const players = useIndividualScores(sessionId);
  const voice = useVoiceState(sessionId ?? undefined);
  const makeTurnId = useCallback(
    () => `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );
  const scenarioOptions: { id: PatientScenarioId; label: string }[] = [
    { id: "exertional_chest_pain", label: "Exertional chest pain & palpitations (Taylor)" },
    { id: "syncope", label: "Syncope during exercise" },
    { id: "palpitations_svt", label: "Recurrent palpitations (SVT)" },
    { id: "myocarditis", label: "Viral prodrome with myocarditis" },
    { id: "exertional_syncope_hcm", label: "Exertional presyncope (HCM suspicion)" },
    { id: "ductal_shock", label: "Infant shock (duct-dependent lesion)" },
    { id: "cyanotic_spell", label: "Cyanotic spell (tet spell-like)" },
  ];

  const generateDebrief = useCallback(() => {
    if (!sessionId || transcriptLog.length === 0) return;
    const turns: DebriefTurn[] = transcriptLog.map((t) => ({
      role: t.role,
      text: t.text,
      timestamp: t.timestamp,
    }));
    setIsAnalyzing(true);
    setDebriefResult(null);
    voiceGatewayClient.sendAnalyzeTranscript(turns);
  }, [sessionId, transcriptLog]);

  useEffect(() => {
    if (!sessionId) return;
    const ref = doc(db, "sessions", sessionId);
    const unsub = onSnapshot(ref, (snap: any) => {
      setLoading(false);
      if (snap.exists()) {
        setSession({ ...(snap.data() as SessionData), id: snap.id });
      }
    });
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!autoForceReply) {
      lastAutoForcedRef.current = null;
    }
  }, [autoForceReply]);

  const slides = session ? [...session.slides].sort((a, b) => a.index - b.index) : [];
  const currentSlide = session ? slides[session.currentSlideIndex] ?? slides[0] : null;
  const currentSlideHtml = currentSlide?.html ? sanitizeHtml(currentSlide.html) : "";

  const questionsMap = new Map<string, Question>(
    session ? session.questions.map((q) => [q.id, q]) : []
  );

  const currentQuestion =
    currentSlide?.type === "question" && currentSlide.questionId
      ? questionsMap.get(currentSlide.questionId)
      : null;
  const isQuestionOpen =
    session && currentQuestion ? session.currentQuestionId === currentQuestion.id : false;
  const isShowingResults = session?.showResults ?? false;
  const isQuestionSlide = Boolean(currentQuestion);
  const showResultsOverlay = isQuestionSlide && isShowingResults && responseTotal > 0;

  const goToSlide = useCallback(
    async (delta: number) => {
      if (!session) return;
      const sorted = [...session.slides].sort((a, b) => a.index - b.index);
      const newIndex = Math.max(
        0,
        Math.min(sorted.length - 1, session.currentSlideIndex + delta)
      );
      await updateDoc(doc(db, "sessions", sessionId), {
        currentSlideIndex: newIndex,
        currentQuestionId: null, // Close question when moving slides
        showResults: false,
      });
    },
    [session, sessionId]
  );

  const toggleVoice = useCallback(async () => {
    if (!sessionId) return;
    await setVoiceEnabled(sessionId, !voice.enabled);
  }, [sessionId, voice.enabled]);

  const handleReleaseFloor = useCallback(async () => {
    if (!sessionId) return;
    await releaseFloor(sessionId);
  }, [sessionId]);

  const handleFreezeToggle = useCallback(
    (next: "freeze" | "unfreeze") => {
      if (!sessionId) return;
      sendVoiceCommand(sessionId, { type: next === "freeze" ? "freeze" : "unfreeze" });
      setFreezeStatus(next === "freeze" ? "frozen" : "live");
    },
    [sessionId]
  );

  const handleResumeVoice = useCallback(() => {
    if (!sessionId) return;
    sendVoiceCommand(sessionId, { type: "resume_ai" });
    setFreezeStatus("live");
  }, [sessionId, auth?.currentUser?.uid]);

  const handleForceReply = useCallback(() => {
    if (!sessionId) return;
    const trimmed = doctorQuestionText.trim();
    sendVoiceCommand(sessionId, {
      type: "force_reply",
      payload: trimmed ? { doctorUtterance: trimmed } : undefined,
      character: targetCharacter,
    });
    try {
      voiceGatewayClient.sendVoiceCommand("force_reply", trimmed ? { doctorUtterance: trimmed } : undefined, targetCharacter);
    } catch (err) {
      console.error("Failed to send WS voice command", err);
    }
  }, [sessionId, doctorQuestionText, targetCharacter]);

  const handleRevealClue = useCallback(() => {
    if (!sessionId) return;
    const hint = doctorQuestionText.trim() || "Hint: ask about symptom timing, triggers, and family history.";
    sendVoiceCommand(sessionId, {
      type: "force_reply",
      payload: { doctorUtterance: hint },
      character: targetCharacter,
    });
    try {
      voiceGatewayClient.sendVoiceCommand("force_reply", { doctorUtterance: hint }, targetCharacter);
    } catch (err) {
      console.error("Failed to send WS voice command", err);
    }
  }, [sessionId, doctorQuestionText, targetCharacter]);

  const handleSkipStage = useCallback(() => {
    if (!sessionId || !selectedStage) return;
    sendVoiceCommand(sessionId, {
      type: "skip_stage",
      payload: { stageId: selectedStage },
    });
  }, [sessionId, selectedStage]);

  const handleScenarioSelect = useCallback((scenarioId: PatientScenarioId) => {
    setSelectedScenario(scenarioId);
    try {
      voiceGatewayClient.sendSetScenario(scenarioId);
    } catch (err) {
      console.error("Failed to send scenario change", err);
    }
    setTranscriptTurns([]);
    setTranscriptLog([]);
    setPatientAudioUrl(null);
    setDoctorQuestionText("");
    lastDoctorTurnIdRef.current = null;
    currentTurnIdRef.current = null;
    lastAutoForcedRef.current = null;
    setDebriefResult(null);
    setIsAnalyzing(false);
  }, []);

  const handleClearTranscript = useCallback(() => {
    currentTurnIdRef.current = null;
    setTranscriptTurns([]);
  }, []);

  const logDoctorQuestion = useCallback(
    (text?: string) => {
      const questionText = text?.trim();
      if (!questionText) return;
      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      lastDoctorTurnIdRef.current = id;
      setTranscriptLog((prev) => [
        ...prev,
        { id, role: "doctor", timestamp: Date.now(), text: questionText },
      ]);
      // also keep question text synced
      setDoctorQuestionText(questionText);
    },
    []
  );

  const forceReplyWithQuestion = useCallback(
    (text?: string) => {
      if (!sessionId) return;
      const trimmed = text?.trim();
      if (trimmed) {
        logDoctorQuestion(trimmed);
      }
      lastAutoForcedRef.current = trimmed ?? null;
      const payload = trimmed ? { doctorUtterance: trimmed } : undefined;
      sendVoiceCommand(sessionId, { type: "force_reply", payload, character: targetCharacter }).catch((err) =>
        console.error("Failed to write voice command to Firestore", err)
      );
      try {
        voiceGatewayClient.sendVoiceCommand("force_reply", payload, targetCharacter);
      } catch (err) {
        console.error("Failed to send WS voice command", err);
      }
    },
    [logDoctorQuestion, sessionId, targetCharacter]
  );

  const handleScenarioChange = useCallback(
    (id: PatientScenarioId) => {
      setSelectedScenario(id);
      if (sessionId) {
        try {
          voiceGatewayClient.sendSetScenario(id);
        } catch (err) {
          console.error("Failed to send scenario change", err);
        }
      }
    },
    [sessionId]
  );

  // keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!session) return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      const isTypingTarget =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        active?.getAttribute("contenteditable") === "true";

      // Ignore keyboard nav while typing in any text field
      if (isTypingTarget) return;

      const patientInteractionLock = Boolean(voice?.enabled && voice.mode && voice.mode !== "idle");
      const isNavKey =
        e.code === "Space" ||
        e.key === " " ||
        e.key === "Spacebar" ||
        e.code === "ArrowRight" ||
        e.code === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowLeft";

      if (patientInteractionLock && isNavKey) {
        e.preventDefault();
        return;
      }

      if (["ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
        goToSlide(1);
      }
      if (["ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        goToSlide(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session, goToSlide, voice]);

  // Voice gateway wiring for presenter
  useEffect(() => {
    const unsubStatus = voiceGatewayClient.onStatus((status) => setGatewayStatus(status));
    const unsubSim = voiceGatewayClient.onSimState((state) => {
      setSimState(state);
      setAvailableStages(state.stageIds ?? []);
      if (!selectedStage && state.stageIds && state.stageIds.length > 0) {
        setSelectedStage(state.stageIds[0]);
      }
      // Log newly completed orders into transcript for debrief/visibility
      const completed = (state.orders ?? []).filter((o) => o.status === "complete");
      const seen = loggedOrderIdsRef.current;
      const newOnes = completed.filter((o) => !seen.has(o.id));
      if (newOnes.length > 0) {
        const entries: TranscriptLogTurn[] = newOnes.map((o) => {
          let text = `${o.type.toUpperCase()} result ready`;
          if (o.result?.type === "vitals") {
            text = `Vitals: HR ${o.result.hr ?? "—"} BP ${o.result.bp ?? "—"} SpO₂ ${o.result.spo2 ?? "—"}`;
          } else if (o.result?.summary) {
            text = `${o.type.toUpperCase()}: ${o.result.summary}`;
          }
          return {
            id: `order-${o.id}`,
            role: "patient",
            character: o.type,
            text,
            timestamp: Date.now(),
          };
        });
        entries.forEach((e) => seen.add(e.id));
        setTranscriptLog((prev) => [...prev, ...entries]);
      }
    });
    const unsubVoiceState = voiceGatewayClient.onVoiceState?.((voiceState) => {
      if (voiceState && typeof voiceState.locked === "boolean") {
        setVoiceLocked(voiceState.locked);
      }
    });
    const unsubPatient = voiceGatewayClient.onPatientState((state, character?: string) => {
      setPatientState(state);
      if (character) {
        setActiveCharacter({ character: character as CharacterId, state });
        if (state !== "speaking") {
          setTimeout(() => setActiveCharacter((prev) => (prev?.state === "speaking" ? prev : null)), 1200);
        }
      }

      if (state === "speaking") {
        currentTurnCharacterRef.current = character ?? "patient";
        setTranscriptTurns((prev) => {
          const currentId = currentTurnIdRef.current;
          if (currentId) {
            const existing = prev.find((t) => t.id === currentId);
            if (existing && !existing.isComplete) {
              return prev;
            }
          }
          const newId = makeTurnId();
          currentTurnIdRef.current = newId;
          return [...prev, { id: newId, role: "patient", character: character ?? "patient", text: "", isComplete: false }];
        });
      } else if (state === "idle" || state === "listening" || state === "error") {
        const currentId = currentTurnIdRef.current;
        if (currentId) {
          let finalText = "";
          setTranscriptTurns((prev) => {
            const next = prev.map((t) => {
              if (t.id === currentId) {
                finalText = t.text;
                return { ...t, isComplete: true };
              }
              return t;
            });
            return next;
          });
          if (finalText) {
            const logId = `patient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const related = lastDoctorTurnIdRef.current ?? undefined;
            setTranscriptLog((prev) => [
              ...prev,
              {
                id: logId,
                role: "patient",
                timestamp: Date.now(),
                text: finalText,
                relatedTurnId: related,
                character: currentTurnCharacterRef.current ?? "patient",
              },
            ]);
            lastDoctorTurnIdRef.current = null;
          }
          currentTurnIdRef.current = null;
          currentTurnCharacterRef.current = "patient";
        }
      }
    });
    const unsubTranscript = voiceGatewayClient.onPatientTranscriptDelta((text, character?: string) => {
      setTranscriptTurns((prev) => {
        let turnId = currentTurnIdRef.current;
        const next = [...prev];
        let idx = turnId ? next.findIndex((t) => t.id === turnId) : -1;
        if (idx === -1) {
          turnId = makeTurnId();
          currentTurnIdRef.current = turnId;
          next.push({ id: turnId, role: "patient", character: character ?? currentTurnCharacterRef.current, text: "", isComplete: false });
          idx = next.length - 1;
        }
        const target = next[idx];
        const effectiveCharacter = character ?? target.character ?? "patient";
        currentTurnCharacterRef.current = effectiveCharacter;
        next[idx] = { ...target, character: effectiveCharacter, text: `${target.text}${text}` };
        return next;
      });
    });
    const unsubDoctor = voiceGatewayClient.onDoctorUtterance((text, _userId, character?: string) => {
      setDoctorQuestionText(text);
      if (autoForceReply) {
        const trimmed = text.trim();
        if (trimmed && lastAutoForcedRef.current !== trimmed) {
          lastAutoForcedRef.current = trimmed;
          forceReplyWithQuestion(trimmed);
        }
      }
      if (character && character !== "patient") {
        const id = `doctor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setTranscriptLog((prev) => [
          ...prev,
          { id, role: "doctor", text, timestamp: Date.now(), relatedTurnId: undefined, character },
        ]);
      }
    });
    const unsubAudio = voiceGatewayClient.onPatientAudio((url) => setPatientAudioUrl(url));
    const unsubScenario = voiceGatewayClient.onScenarioChanged((scenarioId) => {
      setSelectedScenario(scenarioId);
      setTranscriptTurns([]);
      setTranscriptLog([]);
      setPatientAudioUrl(null);
      setDoctorQuestionText("");
      lastDoctorTurnIdRef.current = null;
      currentTurnIdRef.current = null;
      lastAutoForcedRef.current = null;
      setDebriefResult(null);
      setIsAnalyzing(false);
    });
    const unsubAnalysis = voiceGatewayClient.onAnalysisResult((res) => {
      setIsAnalyzing(false);
      setDebriefResult({
        summary: res.summary,
        strengths: res.strengths ?? [],
        opportunities: res.opportunities ?? [],
        teachingPoints: res.teachingPoints ?? [],
      });
    });
    return () => {
      unsubStatus();
      unsubSim();
      unsubVoiceState?.();
      unsubPatient();
      unsubTranscript();
      unsubDoctor();
      unsubAudio();
      unsubScenario();
      unsubAnalysis();
    };
  }, [makeTurnId, autoForceReply, forceReplyWithQuestion]);

  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;
    (async () => {
      const uid = auth?.currentUser?.uid ?? "presenter-local";
      const displayName = auth?.currentUser?.displayName ?? "Presenter";
      const authToken = auth?.currentUser?.getIdToken ? await auth.currentUser.getIdToken() : undefined;
      if (!mounted) return;
      voiceGatewayClient.connect(sessionId, uid, displayName, "presenter", authToken);
    })();
    return () => {
      mounted = false;
      voiceGatewayClient.disconnect();
    };
  }, [sessionId]);

  // Wire in-slide nav buttons to presenter navigation
  useEffect(() => {
    if (!slideRef.current) return;
    const root = slideRef.current;
    const nav = root.querySelector(".cq-nav");
    if (!nav) return;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest(".cq-btn") as HTMLElement | null;
      if (!btn) return;
      e.preventDefault();
      const isNext = btn.classList.contains("cq-btnPrimary");
      goToSlide(isNext ? 1 : -1);
    };

    nav.addEventListener("click", handleClick);

    return () => {
      nav.removeEventListener("click", handleClick);
    };
  }, [currentSlide, goToSlide]);

  // Track responses for current question to know when to show overlay
  useEffect(() => {
    if (!sessionId || !currentQuestion) {
      setResponseTotal(0);
      return;
    }
    const q = query(
      collection(db, "sessions", sessionId, "responses"),
      where("questionId", "==", currentQuestion.id)
    );
    const unsub = onSnapshot(q, (snapshot: any) => {
      setResponseTotal(snapshot?.size ?? 0);
    });
    return () => unsub();
  }, [sessionId, currentQuestion?.id]);

  // Aggregate participant stats for summary (count + overall accuracy)
  useEffect(() => {
    if (!sessionId) return;
    const ref = collection(db, "sessions", sessionId, "participants");
    const unsub = onSnapshot(ref, (snapshot: any) => {
      const docs = snapshot.docs ?? snapshot;
      let totalCorrect = 0;
      let totalIncorrect = 0;
      docs.forEach((docSnap: any) => {
        const data = docSnap.data?.() ?? docSnap.data();
        totalCorrect += data?.correctCount ?? 0;
        totalIncorrect += data?.incorrectCount ?? 0;
      });
      const count = docs.length ?? 0;
      setParticipantCount(count);
      const totalAnswered = totalCorrect + totalIncorrect;
      setOverallAccuracy(totalAnswered > 0 ? totalCorrect / totalAnswered : 0);
    });
    return () => unsub();
  }, [sessionId]);

  // Aggregate response stats per question for summary
  useEffect(() => {
    if (!sessionId || !session) return;
    const ref = collection(db, "sessions", sessionId, "responses");
    const questions = session.questions ?? [];
    const questionIndexMap = new Map<string, number>();
    questions.forEach((q, idx) => questionIndexMap.set(q.id, idx + 1));

    const unsub = onSnapshot(ref, (snapshot: any) => {
      const docs = snapshot.docs ?? snapshot;
      const perQuestion = new Map<
        string,
        { questionId: string; totalCount: number; correctCount: number }
      >();
      let totalResp = 0;

      docs.forEach((docSnap: any) => {
        const data = docSnap.data?.() ?? docSnap.data();
        const qid = data?.questionId;
        const choiceIndex = data?.choiceIndex;
        if (!qid) return;
        totalResp += 1;
        const q = perQuestion.get(qid) ?? { questionId: qid, totalCount: 0, correctCount: 0 };
        q.totalCount += 1;
        const correctIndex = questions.find((qq) => qq.id === qid)?.correctIndex ?? -1;
        if (correctIndex === choiceIndex) {
          q.correctCount += 1;
        }
        perQuestion.set(qid, q);
      });

      const stats = Array.from(perQuestion.values()).map((entry) => {
        const idx = questionIndexMap.get(entry.questionId) ?? 0;
        const accuracy = entry.totalCount > 0 ? entry.correctCount / entry.totalCount : 0;
        return {
          questionId: entry.questionId,
          questionIndex: idx,
          correctCount: entry.correctCount,
          totalCount: entry.totalCount,
          accuracyPct: Math.round(accuracy * 100),
        };
      });

      setTotalResponses(totalResp);
      setQuestionsAnsweredCount(stats.length);
      setQuestionStats(stats);
    });

    return () => unsub();
  }, [sessionId, session]);

  const openQuestion = async () => {
    if (!currentQuestion) return;
    await updateDoc(doc(db, "sessions", sessionId), {
      currentQuestionId: currentQuestion.id,
      showResults: false,
    });
  };

  const toggleResults = async () => {
    if (!session) return;
    await updateDoc(doc(db, "sessions", sessionId), {
      showResults: !session.showResults,
    });
  };

  const closeQuestion = async () => {
    if (!session) return;
    await updateDoc(doc(db, "sessions", sessionId), {
      currentQuestionId: null,
      showResults: false,
    });
  };

  if (!sessionId) {
    return <div className="p-8 text-rose-500">Error: No session ID provided.</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-400">Loading Session...</span>
        </div>
      </div>
    );
  }

  if (!session || !currentSlide) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
          <div className="text-center space-y-4">
            <p className="text-xl">Session not found.</p>
            <Link to="/" className="text-sky-400 underline">Return Home</Link>
          </div>
      </div>
    );
  }

  const totalQuestions = session.questions?.length ?? 0;
  const questionsAnsweredPct =
    totalQuestions > 0 ? Math.min(1, Math.max(0, questionsAnsweredCount / totalQuestions)) : 0;
  const avgResponsesPerQuestion =
    questionsAnsweredCount > 0 ? totalResponses / questionsAnsweredCount : 0;
  const fallbackActive = Boolean(simState?.fallback || simState?.budget?.fallback);
  const overlayMode: "idle" | "resident-speaking" | "ai-speaking" | "disabled" | "disconnected" =
    !voice.enabled
      ? "disabled"
      : gatewayStatus.state !== "ready"
      ? "disconnected"
      : patientState === "speaking"
      ? "ai-speaking"
      : patientState === "listening"
      ? "resident-speaking"
      : patientState === "error"
      ? "disconnected"
      : "idle";

  return (
    <div className="h-screen bg-slate-950 text-slate-50 overflow-hidden relative flex flex-col">
      <div className="flex items-center justify-between px-3 md:px-4 py-1.5">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">
          {session.title}
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="hidden md:flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm shadow-black/20">
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
              Gamification
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSummary((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                  showSummary
                    ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-100 shadow-sm shadow-indigo-900/30"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                Session summary
              </button>
              <button
                type="button"
                onClick={() => setShowTeamScores((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                  showTeamScores
                    ? "bg-sky-600/20 border-sky-500/60 text-sky-100 shadow-sm shadow-sky-900/30"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                Team scores
              </button>
              <button
                type="button"
                onClick={() => setShowIndividualScores((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                  showIndividualScores
                    ? "bg-emerald-600/15 border-emerald-500/60 text-emerald-100 shadow-sm shadow-emerald-900/30"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                Top players
              </button>
            </div>
          </div>
          {sessionId && (
            <PresenterVoiceControls
              sessionId={sessionId}
              voice={voice}
              doctorQuestion={doctorQuestionText}
              onDoctorQuestionChange={setDoctorQuestionText}
              onForceReply={forceReplyWithQuestion}
              autoForceReply={autoForceReply}
              onToggleAutoForceReply={setAutoForceReply}
              scenarioId={selectedScenario}
              scenarioOptions={scenarioOptions}
              onScenarioChange={handleScenarioSelect}
              character={targetCharacter}
              onCharacterChange={setTargetCharacter}
            />
          )}
          {simState && (
            <div className="mt-2 text-[12px] text-slate-300 flex flex-wrap items-center gap-3">
              <span className="px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-800">
                Stage: {simState.stageId || "unknown"}
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-800 text-[11px] text-slate-300">
                Findings revealed: {simState.findings?.length ?? 0}
              </span>
              <span className="text-[11px] text-slate-400">
                Vitals: {simState.vitals?.hr ? `HR ${simState.vitals.hr}` : "—"} {simState.vitals?.bp ? `BP ${simState.vitals.bp}` : ""}
              </span>
              {simState.budget && (
                <span
                  className={`px-2 py-1 rounded-lg border ${
                    simState.budget.fallback
                      ? "bg-rose-600/10 border-rose-500/60 text-rose-100"
                      : simState.budget.throttled
                      ? "bg-amber-500/10 border-amber-500/60 text-amber-100"
                      : "bg-emerald-500/10 border-emerald-500/50 text-emerald-100"
                  }`}
                >
                  {simState.budget.fallback
                    ? "Voice: TEXT-ONLY (budget)"
                    : simState.budget.throttled
                    ? "Voice: THROTTLED"
                    : "Voice: ON"}
                  {typeof simState.budget.usdEstimate === "number" && (
                    <span className="ml-1 text-[10px] text-slate-400">
                      ~${simState.budget.usdEstimate.toFixed(2)}
                    </span>
                  )}
                </span>
              )}
              {simState.fallback && (
                <span className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/60 text-amber-100">
                  Voice fallback active (text mode)
                </span>
              )}
              {simState.exam && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 w-full">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold mb-1">
                    <span>Exam</span>
                    <span className="text-[10px] text-slate-500">On-demand bedside</span>
                  </div>
                  <div className="grid gap-1.5 text-sm text-slate-200 md:grid-cols-2">
                    {simState.exam.general && <div><span className="text-slate-400 text-[11px] mr-1">General:</span>{simState.exam.general}</div>}
                    {simState.exam.cardio && <div><span className="text-slate-400 text-[11px] mr-1">CV:</span>{simState.exam.cardio}</div>}
                    {simState.exam.lungs && <div><span className="text-slate-400 text-[11px] mr-1">Lungs:</span>{simState.exam.lungs}</div>}
                    {simState.exam.perfusion && <div><span className="text-slate-400 text-[11px] mr-1">Perfusion:</span>{simState.exam.perfusion}</div>}
                    {simState.exam.neuro && <div><span className="text-slate-400 text-[11px] mr-1">Neuro:</span>{simState.exam.neuro}</div>}
                  </div>
                </div>
              )}
              {simState.telemetry && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 w-full">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold mb-1">
                    <span>Telemetry</span>
                    <span className="text-[10px] text-slate-500">Presenter only</span>
                  </div>
                  <div className="text-sm text-emerald-100">
                    {simState.rhythmSummary ?? "Rhythm available"}
                  </div>
                  {simState.telemetryWaveform && simState.telemetryWaveform.length > 0 && (
                    <svg viewBox={`0 0 ${simState.telemetryWaveform.length} 2`} className="w-full h-16 mt-2">
                      <polyline
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="0.08"
                        points={simState.telemetryWaveform
                          .map((v, idx) => `${idx},${1 - v}`)
                          .join(" ")}
                      />
                    </svg>
                  )}
                  {simState.telemetryHistory && simState.telemetryHistory.length > 0 && (
                    <div className="mt-2 text-[12px] text-slate-300 space-y-1">
                      {simState.telemetryHistory.slice(-4).reverse().map((h, idx) => (
                        <div key={`telemetry-history-${idx}`} className="flex justify-between">
                          <span>{h.rhythm ?? "Rhythm"}</span>
                          <span className="text-[10px] text-slate-500">
                            {h.ts ? new Date(h.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {simState.orders && simState.orders.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
                  {simState.orders.slice(-6).map((order) => {
                    const isDone = order.status === "complete";
                    const header =
                      order.type === "vitals"
                        ? "Vitals"
                        : order.type === "ekg"
                        ? "EKG"
                        : order.type === "labs"
                        ? "Labs"
                        : "Imaging";
                    return (
                      <div
                        key={order.id}
                        className={`rounded-lg border px-3 py-2 text-[12px] ${
                          isDone ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-100" : "border-slate-700 bg-slate-900/80 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{header}</div>
                          <div className="text-[10px] uppercase tracking-[0.14em]">
                            {isDone ? "Complete" : "Pending"}
                          </div>
                        </div>
                        {isDone && order.completedAt && (
                          <div className="text-[10px] text-slate-400">
                            {new Date(order.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </div>
                        )}
                        {isDone && order.result?.type === "vitals" && (
                          <div className="text-slate-300 text-[12px] mt-1">
                            HR {order.result.hr ?? "—"} · BP {order.result.bp ?? "—"} · SpO₂ {order.result.spo2 ?? "—"}
                          </div>
                        )}
                        {isDone && order.result?.type === "ekg" && (
                          <div className="text-slate-300 text-[12px] mt-1">
                            {order.result.summary ?? "EKG ready"}
                          </div>
                        )}
                        {isDone && order.result?.type === "labs" && (
                          <div className="text-slate-300 text-[12px] mt-1">
                            {order.result.summary ?? "Labs ready"}
                          </div>
                        )}
                        {isDone && order.result?.type === "imaging" && (
                          <div className="text-slate-300 text-[12px] mt-1">
                            {order.result.summary ?? "Imaging ready"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {latestEkg && (
                <div className="flex items-center justify-between w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
                  <div className="text-sm text-slate-200">Latest EKG ready</div>
                  <button
                    type="button"
                    onClick={() => setShowEkg(true)}
                    className="px-2.5 py-1 text-[12px] rounded-lg border border-slate-700 text-slate-100 hover:border-slate-500"
                  >
                    Show EKG
                  </button>
                </div>
              )}
              {showEkg && latestEkg && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-3 w-full shadow-sm shadow-black/40">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-100">EKG</div>
                    <button
                      type="button"
                      onClick={() => setShowEkg(false)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Close
                    </button>
                  </div>
                  <div className="text-slate-200 text-sm mt-2 whitespace-pre-wrap">
                    {latestEkg.result?.summary ?? "Strip available for review."}
                  </div>
                  {latestEkg.result?.meta && (
                    <div className="text-[12px] text-slate-400 mt-1">
                      {latestEkg.result.meta.rate && <div>Rate: {latestEkg.result.meta.rate}</div>}
                      {latestEkg.result.meta.intervals && <div>Intervals: {latestEkg.result.meta.intervals}</div>}
                      {latestEkg.result.meta.axis && <div>Axis: {latestEkg.result.meta.axis}</div>}
                    </div>
                  )}
                  {latestEkg.result?.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={latestEkg.result.imageUrl}
                        alt="EKG strip"
                        className="w-full max-h-52 object-contain rounded border border-slate-800"
                      />
                    </div>
                  )}
                  {ekgHistory.length > 1 && (
                    <div className="mt-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold mb-1">
                        Prior EKGs
                      </div>
                      <ul className="space-y-1 text-[12px] text-slate-300">
                        {ekgHistory.slice(1).map((ekg, idx) => (
                          <li key={`ekg-history-${idx}`}>
                            {new Date(ekg.completedAt ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} —{" "}
                            {ekg.result?.summary ?? "EKG"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="hidden md:flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm shadow-black/20">
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
              Voice
            </span>
            <div className="flex items-center gap-1.5">
              <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                voice.enabled ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100" : "border-slate-800 bg-slate-900 text-slate-400"
              }`}>
                {voice.enabled ? "Enabled" : "Disabled"}
              </div>
              {voice.enabled && (
                <div className="text-[11px] text-slate-400">
                  {voice.floorHolderName ? `Floor: ${voice.floorHolderName}` : "Floor open"}
                </div>
              )}
              <div
                className={`text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-full border ${
                  gatewayStatus.state === "ready"
                    ? "border-emerald-500/60 text-emerald-200"
                    : gatewayStatus.state === "connecting"
                    ? "border-sky-500/60 text-sky-200"
                    : "border-slate-700 text-slate-400"
                }`}
              >
                {gatewayStatus.state}
              </div>
              <button
                type="button"
                onClick={toggleVoice}
                className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-semibold bg-slate-900 hover:border-slate-600"
              >
                {voice.enabled ? "Turn off" : "Turn on"}
              </button>
              {voice.enabled && voice.floorHolderId && (
                <button
                  type="button"
                  onClick={handleReleaseFloor}
                  className="px-2 py-1 rounded-lg border border-slate-700 text-[11px] font-semibold bg-slate-900 hover:border-slate-600"
                >
                  Release floor
                </button>
              )}
            </div>
          </div>
          {isQuestionSlide && (
            <div className="hidden md:flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={openQuestion}
                disabled={isQuestionOpen}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                  isQuestionOpen
                    ? "border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed"
                    : "border-emerald-500/70 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                }`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={toggleResults}
                disabled={!isQuestionOpen && !isShowingResults}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                  !isQuestionOpen && !isShowingResults
                    ? "border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed"
                    : "border-amber-500/70 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                }`}
              >
                {isShowingResults ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={closeQuestion}
                disabled={!isQuestionOpen && !isShowingResults}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                  !isQuestionOpen && !isShowingResults
                    ? "border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed"
                    : "border-slate-700 bg-slate-800/70 text-slate-100 hover:bg-slate-800"
                }`}
              >
                Close
              </button>
            </div>
          )}
          <div className="text-[10px] text-slate-400 font-mono bg-slate-900/80 border border-slate-700 rounded px-2 py-1">
            Join: {session.joinCode}
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-200">
            <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1.5">
              <span className="uppercase tracking-[0.14em] text-slate-500 font-semibold">Case</span>
              <span className="px-2 py-0.5 rounded-full border border-slate-700 text-slate-100 text-xs">
                {snapshot?.chiefComplaint ?? selectedScenario}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1.5">
              <span className="uppercase tracking-[0.14em] text-slate-500 font-semibold">Voice</span>
              <span
                className={`px-2 py-0.5 rounded-full border text-xs ${
                  freezeStatus === "frozen"
                    ? "border-amber-500/60 text-amber-100"
                    : voiceLocked
                    ? "border-rose-500/60 text-rose-100"
                    : "border-emerald-500/60 text-emerald-100"
                }`}
              >
                {voiceLocked ? "Locked" : freezeStatus === "frozen" ? "Paused" : "Live"}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1.5">
              <span className="uppercase tracking-[0.14em] text-slate-500 font-semibold">Budget</span>
              <span className="font-mono text-xs text-slate-200">
                ${simState?.budget?.usdEstimate?.toFixed(2) ?? "0.00"} · {simState?.budget?.voiceSeconds ? `${Math.round(simState.budget.voiceSeconds)}s` : "0s"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 md:px-6 pb-2 gap-2">
        <div className="w-full max-w-[1800px] grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-3 items-start">
          <div className="flex flex-col gap-3">
            <div className="relative flex-1 min-h-[62vh] max-h-[78vh]">
              {showSummary ? (
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <SessionSummary
                    teams={teams}
                    players={players}
                    participantCount={participantCount}
                    overallAccuracy={overallAccuracy}
                    totalQuestions={totalQuestions}
                    questionsAnsweredCount={questionsAnsweredCount}
                    questionsAnsweredPct={questionsAnsweredPct}
                    totalResponses={totalResponses}
                    avgResponsesPerQuestion={avgResponsesPerQuestion}
                    questionStats={questionStats}
                  />
                </div>
              ) : (
                <>
                  <VoicePatientOverlay
                    voiceMode={(overlayMode as any) ?? "idle"}
                    enabled={voice.enabled}
                    floorHolderName={voice.floorHolderName ?? undefined}
                    transcriptTurns={transcriptTurns}
                    patientAudioUrl={patientAudioUrl}
                    onClearTranscript={() => setTranscriptTurns([])}
                  />
                  {activeCharacter && (
                    <div className="absolute top-4 left-4 z-30">
                      <VoiceCharacterTile
                        character={activeCharacter.character}
                        state={activeCharacter.state}
                      />
                    </div>
                  )}
                  <div
                    className="absolute inset-0 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
                    ref={slideRef}
                    dangerouslySetInnerHTML={{ __html: currentSlideHtml }}
                  />

                  {showTeamScores && (teams?.length ?? 0) > 0 && (
                    <div className="absolute top-4 right-4 z-30 pointer-events-none">
                      <TeamScoreboard teams={teams} />
                    </div>
                  )}

                  {showIndividualScores && (players?.length ?? 0) > 0 && (
                    <div className="absolute bottom-4 right-4 z-30 pointer-events-none">
                      <IndividualScoreboard players={players} />
                    </div>
                  )}

                  {showResultsOverlay && currentQuestion && (
                    <div className="absolute inset-x-3 bottom-3 pointer-events-none">
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 shadow-lg shadow-black/30 pointer-events-auto">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                          <span className="uppercase tracking-[0.12em] text-slate-300">Poll Results</span>
                          <span className="font-mono text-[10px]">
                            {isQuestionOpen ? "Open" : "Closed"} {isShowingResults ? "· Showing results" : ""}
                          </span>
                        </div>
                        <ResponsesChart
                          sessionId={sessionId}
                          questionId={currentQuestion.id}
                          options={currentQuestion.options}
                          correctIndex={currentQuestion.correctIndex ?? 0}
                          showResults={isShowingResults}
                          mode="presenter"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-200">Transcript (by role)</div>
                <div className="text-[10px] text-slate-500">Latest turns per role</div>
              </div>
              {groupedTranscript.length === 0 ? (
                <div className="text-xs text-slate-500">No transcript yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupedTranscript.map((group) => (
                    <div key={group.key} className="space-y-1">
                      <div
                        className={`text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-1 rounded border ${roleColor(
                          group.key
                        )}`}
                      >
                        {group.key}
                      </div>
                      {group.turns.slice(-3).map((turn) => (
                        <div
                          key={turn.id}
                          className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                        >
                          <div className="text-[10px] text-slate-500 mb-1">
                            {new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </div>
                          <div className="leading-snug whitespace-pre-wrap">{turn.text}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-slate-100 space-y-2">
              <div className="text-sm font-semibold text-slate-200 flex items-center justify-between">
                <span>Voice & Roles</span>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  {freezeStatus === "frozen" ? "Voice paused" : "Voice live"}
                </div>
              </div>
              <PresenterVoiceControls
                sessionId={sessionId!}
                voice={voice}
                doctorQuestion={doctorQuestionText}
                onDoctorQuestionChange={setDoctorQuestionText}
                onForceReply={handleForceReply}
                autoForceReply={autoForceReply}
                onToggleAutoForceReply={setAutoForceReply}
                scenarioId={selectedScenario}
                scenarioOptions={scenarioOptions}
                onScenarioChange={handleScenarioChange}
                character={targetCharacter}
                onCharacterChange={setTargetCharacter}
              />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-200">Orders & Status</div>
                <div className="text-[10px] text-slate-500">
                  {simState?.orders?.length ? `${simState.orders.length} orders` : "Live sim state"}
                </div>
              </div>
              <div className="space-y-2">
                {(simState?.orders ?? []).length === 0 && (
                  <div className="text-xs text-slate-500">No orders yet.</div>
                )}
                {(simState?.orders ?? []).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.14em] ${
                        o.status === "complete"
                          ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/40"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {o.type} {o.status}
                    </span>
                    <div className="text-slate-100 leading-snug">
                      {o.result?.summary ||
                        (o.result?.type === "vitals"
                          ? `HR ${o.result.hr ?? "—"} BP ${o.result.bp ?? "—"} SpO₂ ${o.result.spo2 ?? "—"}`
                          : "In progress")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-slate-100 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm font-semibold text-slate-200">Timeline</div>
                  <div className="flex items-center gap-2">
                    <select
                      value={timelineFilter}
                      onChange={(e) => setTimelineFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-[10px] text-slate-200 rounded px-2 py-1"
                    >
                      <option value="all">All</option>
                      <option value="patient">Patient</option>
                      <option value="doctor">Doctor</option>
                      <option value="nurse">Nurse</option>
                      <option value="tech">Tech</option>
                      <option value="consultant">Consultant</option>
                      <option value="VITALS">Vitals</option>
                      <option value="EKG">EKG</option>
                      <option value="LABS">Labs</option>
                      <option value="IMAGING">Imaging</option>
                    </select>
                    <input
                      value={timelineSearch}
                      onChange={(e) => setTimelineSearch(e.target.value)}
                      placeholder="Search"
                      className="bg-slate-900 border border-slate-700 text-[10px] text-slate-200 rounded px-2 py-1"
                    />
                    <div className="text-[10px] text-slate-500">Last 20 events</div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                        await navigator.clipboard.writeText(timelineText);
                        setTimelineCopyStatus("copied");
                        setTimeout(() => setTimelineCopyStatus("idle"), 1200);
                      } catch {
                        setTimelineCopyStatus("error");
                        setTimeout(() => setTimelineCopyStatus("idle"), 1200);
                      }
                    }}
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-[10px] text-slate-200"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const blob = new Blob([timelineText], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `cardioquest-timeline-${sessionId ?? "session"}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        // ignore
                      }
                    }}
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-[10px] text-slate-200"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    disabled={!sessionId || timelineItems.length === 0 || timelineSaveStatus === "saving"}
                    onClick={saveTimelineToSession}
                    className={`px-2 py-1 rounded border text-[10px] ${
                      !sessionId || timelineItems.length === 0
                        ? "border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed"
                        : "border-emerald-600/60 bg-emerald-600/10 text-emerald-100 hover:border-emerald-500"
                    }`}
                  >
                    {timelineSaveStatus === "saving" ? "Saving…" : "Save to session"}
                  </button>
                  <button
                    type="button"
                    disabled={!sessionId || transcriptLog.length === 0 || transcriptSaveStatus === "saving"}
                    onClick={saveTranscriptToSession}
                    className={`px-2 py-1 rounded border text-[10px] ${
                      !sessionId || transcriptLog.length === 0
                        ? "border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed"
                        : "border-indigo-600/60 bg-indigo-600/10 text-indigo-100 hover:border-indigo-500"
                    }`}
                  >
                    {transcriptSaveStatus === "saving" ? "Saving transcript…" : "Save transcript"}
                  </button>
                  {timelineCopyStatus === "copied" && <span className="text-[10px] text-emerald-300">Copied</span>}
                  {timelineCopyStatus === "error" && <span className="text-[10px] text-rose-300">Copy failed</span>}
                  {timelineSaveStatus === "saved" && <span className="text-[10px] text-emerald-300">Saved</span>}
                  {timelineSaveStatus === "error" && <span className="text-[10px] text-rose-300">Save failed</span>}
                  {transcriptSaveStatus === "saved" && <span className="text-[10px] text-emerald-300">Transcript saved</span>}
                  {transcriptSaveStatus === "error" && <span className="text-[10px] text-rose-300">Transcript save failed</span>}
                </div>
              </div>
              {(filteredTimeline.length === 0) ? (
                <div className="text-xs text-slate-500">No events match.</div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {filteredTimeline.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm text-slate-100">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500 w-20">
                        {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span className={timelineBadge(item.label)}>{item.label}</span>
                      <span className="text-slate-200 leading-snug">{item.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3 text-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-200">Live Captions</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  {freezeStatus === "frozen" ? "Voice paused" : "Voice live"}
                </div>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 text-sm">
                {transcriptTurns.length === 0 && (
                  <div className="text-slate-500 text-xs">No captions yet.</div>
                )}
                {transcriptTurns.slice(-8).map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-lg px-2 py-1 ${
                      t.role === "doctor"
                        ? "bg-slate-800/70 text-amber-100"
                        : "bg-emerald-900/50 text-emerald-100"
                    }`}
                  >
                    <span className="text-[10px] uppercase mr-1 opacity-70">
                      {t.role === "doctor" ? "Doctor" : "Patient"}
                    </span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3 text-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-200">Voice Controls</div>
                <div className="flex items-center gap-2">
                  <div
                    className={`text-[10px] uppercase tracking-wide ${
                      freezeStatus === "frozen" ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {freezeStatus === "frozen" ? "Frozen" : "Live"}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Cost: ${simState?.budget?.usdEstimate?.toFixed(2) ?? "0.00"} ·{" "}
                    {simState?.budget?.voiceSeconds ? `${Math.round(simState.budget.voiceSeconds)}s` : "0s"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleFreezeToggle(freezeStatus === "frozen" ? "unfreeze" : "freeze")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    freezeStatus === "frozen"
                      ? "bg-emerald-700 text-emerald-50 hover:bg-emerald-600"
                      : "bg-amber-700 text-amber-50 hover:bg-amber-600"
                  }`}
                >
                  {freezeStatus === "frozen" ? "Unfreeze patient" : "Freeze patient"}
                </button>
                <button
                  type="button"
                  onClick={handleForceReply}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-700 text-sky-50 hover:bg-sky-600"
                >
                  Force reply
                </button>
                <button
                  type="button"
                  onClick={handleRevealClue}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-700 text-purple-50 hover:bg-purple-600"
                >
                  Reveal clue
                </button>
                <div className="flex items-center gap-1 text-xs text-slate-300">
                  Stage:
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                  >
                    {(availableStages.length ? availableStages : simState?.stageIds ?? []).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSkipStage}
                    className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-700 text-slate-50 hover:bg-slate-600"
                    disabled={!selectedStage}
                  >
                    Skip
                  </button>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  Current: <span className="text-slate-200 font-semibold">{simState?.stageId ?? "?"}</span>
                </div>
              </div>
            </div>
            {fallbackActive && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Voice paused to protect budget</div>
                    <div className="text-xs text-amber-100/80">
                      Continue in text mode or resume voice when ready.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResumeVoice}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-700 text-emerald-50 hover:bg-emerald-600"
                    >
                      Resume voice
                    </button>
                  </div>
                </div>
              </div>
            )}
            <ScenarioSnapshotCard snapshot={snapshot} />
            <DebriefPanel
              result={debriefResult}
              isAnalyzing={isAnalyzing}
              onGenerate={generateDebrief}
              disabled={transcriptLog.length === 0}
              reportText={debriefReportText}
              sessionId={sessionId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
