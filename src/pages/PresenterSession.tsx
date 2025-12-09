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
import { AutonomousSimPanel } from "../components/AutonomousSimPanel";
import { VoiceCharacterTile } from "../components/VoiceCharacterTile";
import { VitalsMonitor } from "../components/VitalsMonitor";
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
import { QRCodeOverlay } from "../components/QRCodeOverlay";
import { FLOOR_AUTO_RELEASE_MS } from "../constants";
import { PresenterModeTabs } from "../components/PresenterModeTabs";
import { usePresenterMode } from "../hooks/usePresenterMode";

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
  const [presenterMode, setPresenterMode] = usePresenterMode();

  // Test hook: allow Playwright/local to supply a mock session without Firestore.
  const mockSessionParam = useMemo(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashQueryIndex = hash.indexOf("?");
    const params =
      hashQueryIndex !== -1
        ? new URLSearchParams(hash.substring(hashQueryIndex))
        : new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return params.get("mockSession");
  }, []);

  // Test hook: allow Playwright/local to mock voice status in presenter view.
  const mockVoiceState = useMemo(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashQueryIndex = hash.indexOf("?");
    const params =
      hashQueryIndex !== -1
        ? new URLSearchParams(hash.substring(hashQueryIndex))
        : new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const fromQs = params.get("mockVoice");
    if (fromQs) return fromQs;
    try {
      const stored = localStorage.getItem("cq_voice_mock_state");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.status ?? parsed;
      }
    } catch {
      // ignore parse errors
    }
    return null;
  }, []);

  const mockSessionStored = useMemo(() => {
    try {
      const stored = localStorage.getItem("cq_mock_session");
      if (!stored) return null;
      return JSON.parse(stored) as { joinCode: string; sessionId?: string };
    } catch {
      return null;
    }
  }, []);

  const mockSessionData = useMemo(() => {
    const joinCodeSource = mockSessionParam || mockSessionStored?.joinCode;
    const idSource = mockSessionStored?.sessionId || "MOCK-SESSION";
    if (!joinCodeSource) return null;
    return {
      id: idSource,
      joinCode: joinCodeSource.toUpperCase(),
      title: "Mock Session",
      createdAt: new Date().toISOString(),
      currentSlideIndex: 0,
      slides: [
        {
          id: "mock-slide-1",
          index: 0,
          type: "question",
          questionId: "mock-q1",
          html: "<p>Mock question</p>",
        },
      ],
      questions: [
        {
          id: "mock-q1",
          stem: "Mock question?",
          options: ["A) Mock A", "B) Mock B", "C) Mock C", "D) Mock D"],
          correctIndex: 2,
        },
      ],
      currentQuestionId: "mock-q1",
      showResults: false,
      isQuestionSlide: true,
    };
  }, [mockSessionParam, mockSessionStored]);
  const [session, setSession] = useState<SessionData | null>(null);
  const [mockQuestionOpen, setMockQuestionOpen] = useState(false);
  const [mockShowResults, setMockShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [responseTotal, setResponseTotal] = useState(0);
  const [showTeamScores, setShowTeamScores] = useState(true);
  const [showIndividualScores, setShowIndividualScores] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
const [participantCount, setParticipantCount] = useState<number>(0);
const [voiceGuideOpen, setVoiceGuideOpen] = useState<boolean>(false);
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
  const [budgetAlert, setBudgetAlert] = useState<{ level: "soft" | "hard"; message: string } | null>(null);
  const [alarmNotice, setAlarmNotice] = useState<string | null>(null);
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
const [timelineExtras, setTimelineExtras] = useState<{ id: string; ts: number; label: string; detail: string }[]>([]);
const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "exported" | "error">("idle");
const [voiceLocked, setVoiceLocked] = useState(false);
const [activeCharacter, setActiveCharacter] = useState<{ character: CharacterId; state: PatientState } | null>(null);
const [assessmentEnabled, setAssessmentEnabled] = useState(true);
const [lastAssessmentAt, setLastAssessmentAt] = useState<number>(Date.now());
const [lastNpcInterjectAt, setLastNpcInterjectAt] = useState<number>(0);
const [showTelemetryPopout, setShowTelemetryPopout] = useState(false);
const [assessmentResponse, setAssessmentResponse] = useState<string>("");
const [assessmentPromptOpen, setAssessmentPromptOpen] = useState(false);
const [lastContextStage, setLastContextStage] = useState<string | null>(null);
const [assessmentDifferential, setAssessmentDifferential] = useState<string[]>([]);
const [assessmentPlan, setAssessmentPlan] = useState<string[]>([]);
const [npcCooldowns, setNpcCooldowns] = useState<Record<string, number>>({});
const [scoringTrend, setScoringTrend] = useState<{ current: number; delta: number }>({ current: 0, delta: 0 });
const lastRhythmRef = useRef<string | null>(null);
const [rhythmAlert, setRhythmAlert] = useState<string | null>(null);
const [showQr, setShowQr] = useState(false);
const [copyToast, setCopyToast] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const snapshot = useMemo(
    () => getScenarioSnapshot(simState?.scenarioId ?? selectedScenario),
    [selectedScenario, simState?.scenarioId]
  );
  const latestEkg = useMemo(() => {
    const ekgs = (simState?.orders ?? []).filter((o) => o.type === "ekg" && o.status === "complete");
    return ekgs.length ? ekgs[ekgs.length - 1] : null;
  }, [simState?.orders]);
  const latestEkgMeta = useMemo(() => latestEkg?.result?.meta, [latestEkg]);
  const examAudio = useMemo(() => {
    const heart = (simState as any)?.exam?.heartAudioUrl as string | undefined;
    const lung = (simState as any)?.exam?.lungAudioUrl as string | undefined;
    return { heart, lung };
  }, [simState]);
  const joinUrl = session ? `${window.location.origin}/#/join/${session.joinCode}` : "";

  useEffect(() => {
    if (!copyToast) return;
    const t = setTimeout(() => setCopyToast(null), 1500);
    return () => clearTimeout(t);
  }, [copyToast]);

  useEffect(() => {
    if (!showSummary) return;
    const container = summaryRef.current;
    if (!container) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const allFocusable = container.querySelectorAll<HTMLElement>(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const focusable: HTMLElement[] = [];
    allFocusable.forEach((el) => {
      if (!el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true") {
        focusable.push(el);
      }
    });
    const first = focusable[0] || container;
    first.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showSummary) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSummary(false);
        return;
      }
      if (e.key !== "Tab") return;
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (currentIndex <= 0) {
          e.preventDefault();
          focusable[focusable.length - 1].focus();
        }
      } else {
        if (currentIndex === focusable.length - 1) {
          e.preventDefault();
          focusable[0].focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previousFocusRef.current?.focus?.();
    };
  }, [showSummary]);

  useEffect(() => {
    // Reset assessment timer on stage change
    if (simState?.stageEnteredAt) {
      setLastAssessmentAt(simState.stageEnteredAt);
    }
    if (simState?.stageId && simState.stageId !== lastContextStage) {
      const ts = Date.now();
      const contextByScenario: Record<string, Record<string, string>> = {
        kawasaki: {
          stage_1_fever: "Parent: \"She’s been febrile and fussy all day.\"",
          stage_2_incomplete: "Parent: \"Her hands look red and swollen.\"",
        },
        coarctation_shock: {
          stage_1_shock: "Nurse: \"Leg pulses feel weak compared to arms.\"",
          stage_2_after_bolus: "Nurse: \"BP is a bit better up top; legs still cool.\"",
        },
        arrhythmogenic_syncope: {
          stage_1_baseline: "Parent: \"He collapsed during practice and seems anxious.\"",
          stage_2_irritable: "Nurse: \"Telemetry is picking up some irregular beats.\"",
          stage_3_vtach_risk: "Nurse: \"Rhythm looks more unstable—be ready.\"",
        },
        syncope: {
          stage_1_baseline: "Parent: \"She nearly fainted when standing—seems pale.\"",
          stage_2_decomp: "Nurse: \"Blood pressure is softer when she stands.\"",
        },
        myocarditis: {
          stage_1_baseline: "Nurse: \"Tired and tachy—listen for rub or gallop.\"",
          stage_2_decomp: "Nurse: \"Crackles increased; pulses feel weak.\"",
        },
        cyanotic_spell: {
          stage_1_baseline: "Parent: \"He squats when upset—it helps him breathe.\"",
          stage_2_spell: "Nurse: \"Cyanotic and irritable—maybe a spell.\"",
        },
        ductal_shock: {
          stage_1_shock: "Nurse: \"Lower extremity pulses are barely palpable.\"",
          stage_2_decomp: "Nurse: \"After support, upper pulses better than lower.\"",
        },
        exertional_syncope_hcm: {
          stage_1_baseline: "Parent: \"He gets dizzy after running; murmur louder standing.\"",
          stage_2_decomp: "Nurse: \"HR up and still dizzy when upright.\"",
        },
      };
      const scenarioContext = contextByScenario[simState.scenarioId ?? ""] ?? {};
      const msg = scenarioContext[simState.stageId] ?? null;
      if (msg) {
        setTranscriptLog((prev) => [
          ...prev,
          { id: `ctx-${ts}`, timestamp: ts, text: msg, character: "nurse" },
        ]);
        setTimelineExtras((prev) => [...prev, { id: `ctx-tl-${ts}`, ts, label: "NPC", detail: msg }]);
      }
      setLastContextStage(simState.stageId);
    }
  }, [simState?.stageEnteredAt]);
  useEffect(() => {
    if (!assessmentEnabled) return;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastAssessmentAt >= 180000) {
        const ts = now;
        setTimelineExtras((prev) => [
          ...prev,
          {
            id: `assessment-${ts}`,
            ts,
            label: "Assessment",
            detail: "Checkpoint: Ask for differential and plan.",
          },
        ]);
        setAssessmentPromptOpen(true);
        setLastAssessmentAt(now);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [assessmentEnabled, lastAssessmentAt]);
  useEffect(() => {
    // Stage-aware NPC interjection with cooldowns and distress cues
    const vitals = simState?.vitals ?? {};
    const now = Date.now();
    if (!vitals) return;
    const hr = (vitals as any).hr as number | undefined;
    const spo2 = (vitals as any).spo2 as number | undefined;
    const temp = (vitals as any).temp as number | undefined;

    const stageScripts: Record<string, string[]> = {
      stage_1_fever: ['Parent: "She’s so warm—can we cool her down?"'],
      stage_2_incomplete: ['Parent: "Her lips still look red—what’s next?"'],
      stage_1_shock: ['Nurse: "Weak femoral pulses; BP low in legs."'],
      stage_2_after_bolus: ['Nurse: "Upper BP better, legs still cool."'],
      stage_3_vtach_risk: ['Nurse: "Telemetry shows more irregular beats—prepare meds?"'],
      stage_2_irritable: ['Nurse: "He’s anxious and asking if he will pass out again."'],
      stage_2_spell: ['Parent: "He is squatting again and breathing fast."'],
    };

    const distress: string[] = [];
    if (spo2 && spo2 < 88) distress.push("SpO₂ dropping, patient looks worse.");
    if (hr && hr > 170) distress.push("Heart rate is very fast.");
    if (temp && temp > 38.5) distress.push('Parent: "They’re burning up—please help."');
    if (hr && hr > 150 && !spo2) distress.push('Nurse: "Patient looks anxious and is breathing faster."');

    const stageKey = simState?.stageId ?? "";
    const stageLines = stageScripts[stageKey] ?? [];
    const messages = [...stageLines, ...distress];
    if (messages.length === 0) return;

    const canEmit = messages.filter((msg) => {
      const last = npcCooldowns[msg] ?? 0;
      return now - last > FLOOR_AUTO_RELEASE_MS;
    });
    if (canEmit.length === 0) return;

    setNpcCooldowns((prev) => {
      const next = { ...prev };
      canEmit.forEach((msg) => (next[msg] = now));
      return next;
    });

    setLastNpcInterjectAt(now);
    setTranscriptLog((prev) => [
      ...prev,
      {
        id: `npc-${now}`,
        timestamp: now,
        text: canEmit.join(" "),
        character: "nurse",
      },
    ]);
    setTimelineExtras((prev) => [
      ...prev,
      {
        id: `npc-timeline-${now}`,
        ts: now,
        label: "NPC",
        detail: canEmit.join(" "),
      },
    ]);
  }, [simState?.vitals, lastNpcInterjectAt, simState?.stageId, npcCooldowns]);
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
    (simState?.treatmentHistory ?? []).forEach((th, idx) => {
      items.push({
        id: `treatment-${idx}-${th.ts ?? Date.now()}`,
        ts: th.ts ?? Date.now(),
        label: "Treatment",
        detail: `${th.treatmentType}${th.note ? `: ${th.note}` : ""}`,
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
    timelineExtras.forEach((extra) => items.push(extra));
    return items
      .sort((a, b) => a.ts - b.ts)
      .filter((item, idx, arr) => arr.findIndex((it) => it.id === item.id) === idx)
      .slice(-20);
  }, [transcriptLog, simState?.orders, timelineExtras]);
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
  const scoringSummary = useMemo(() => {
    const stageStart = (simState as any)?.stageEnteredAt as number | undefined;
    const secsSinceStart = (ts?: number) =>
      ts && stageStart ? Math.max(0, Math.round((ts - stageStart) / 1000)) : null;
    const describeTiming = (label: string, ts?: number) => {
      const delta = secsSinceStart(ts);
      return delta === null ? `${label}: not recorded` : `${label}: ${delta}s`;
    };

    const ordersComplete = (simState?.orders ?? []).filter((o) => o.status === "complete");
    const treatments = simState?.treatmentHistory ?? [];

    const ekgDone = ordersComplete.some((o) => o.type === "ekg");
    const labsDone = ordersComplete.some((o) => o.type === "labs");
    const imagingDone = ordersComplete.some((o) => o.type === "imaging");
    const vitalsOrders = ordersComplete.filter((o) => o.type === "vitals").length;

    const oxygenGiven = treatments.some((t) => t.treatmentType.toLowerCase().includes("oxygen"));
    const fluidsGiven = treatments.some((t) => t.treatmentType.toLowerCase().includes("fluid") || t.treatmentType.toLowerCase().includes("bolus"));
    const rateControl = treatments.some((t) => t.treatmentType.toLowerCase().includes("rate"));
    const kneeChest = treatments.some((t) => t.treatmentType.toLowerCase().includes("knee") || t.treatmentType.toLowerCase().includes("position"));

    const firstVitals = ordersComplete.find((o) => o.type === "vitals")?.completedAt;
    const firstOxygen = treatments.find((t) => t.treatmentType.toLowerCase().includes("oxygen"))?.ts;
    const firstFluids = treatments.find((t) => t.treatmentType.toLowerCase().includes("fluid") || t.treatmentType.toLowerCase().includes("bolus"))?.ts;
    const firstRate = treatments.find((t) => t.treatmentType.toLowerCase().includes("rate"))?.ts;

    let score = 100;
    const items: string[] = [];

    if (!firstVitals) {
      score -= 10;
      items.push("Vitals refresh not recorded");
    } else {
      const delta = secsSinceStart(firstVitals);
      if (delta !== null && delta > 120) score -= 5;
      items.push(describeTiming("Vitals refreshed", firstVitals));
    }

    if (!oxygenGiven) {
      score -= 15;
      items.push("Oxygen not given");
    } else {
      const delta = secsSinceStart(firstOxygen);
      if (delta !== null && delta > 180) score -= 5;
      items.push(describeTiming("Oxygen given", firstOxygen));
    }

    if (!fluidsGiven) {
      score -= 10;
      items.push("Fluids/bolus not given");
    } else {
      items.push(describeTiming("Fluids given", firstFluids));
    }

    if (!rateControl) {
      items.push("Rate control not given");
    } else {
      items.push(describeTiming("Rate control given", firstRate));
    }

    if (kneeChest) items.push("Positioning/knee-chest applied");

    if (ekgDone) {
      items.push("EKG completed");
    } else {
      score -= 5;
      items.push("EKG pending");
    }
    if (labsDone) items.push("Labs completed");
    if (imagingDone) items.push("Imaging completed");
    if (vitalsOrders > 1) items.push(`Vitals refreshed x${vitalsOrders}`);

    score = Math.max(0, Math.min(100, score));
    return { score, items };
  }, [simState?.orders, simState?.treatmentHistory, (simState as any)?.stageEnteredAt]);

  useEffect(() => {
    setScoringTrend((prev) => ({
      current: scoringSummary.score,
      delta: scoringSummary.score - (prev.current ?? scoringSummary.score),
    }));
  }, [scoringSummary.score]);
  useEffect(() => {
    const rhythm = simState?.rhythmSummary ?? null;
    if (rhythm && rhythm !== lastRhythmRef.current) {
      setRhythmAlert(rhythm);
      lastRhythmRef.current = rhythm;
    }
  }, [simState?.rhythmSummary]);
  const transcriptText = useMemo(() => {
    const parts: string[] = [];
    transcriptLog.forEach((t) => {
      const ts = new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const speaker = t.character ?? t.role ?? "unknown";
      parts.push(`${ts} ${speaker}: ${t.text}`);
    });
    (simState?.treatmentHistory ?? []).forEach((th) => {
      const ts = th.ts ? new Date(th.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
      parts.push(`${ts} Treatment: ${th.treatmentType}${th.note ? ` (${th.note})` : ""}`);
    });
    (simState?.telemetryHistory ?? []).forEach((h) => {
      const ts = h.ts ? new Date(h.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
      parts.push(`${ts} Telemetry: ${h.rhythm ?? "update"}${h.note ? ` (${h.note})` : ""}`);
    });
    (simState?.ekgHistory ?? []).forEach((e) => {
      const ts = e.ts ? new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
      parts.push(`${ts} EKG: ${e.summary ?? "strip"}`);
    });
    const vitalsTrend = (simState?.vitalsHistory as any[]) ?? [];
    vitalsTrend.slice(-5).forEach((v, idx) => {
      const ts = v.ts ? new Date(v.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : `vitals-${idx}`;
      parts.push(`${ts} Vitals: HR ${v.hr ?? "—"} BP ${v.bp ?? "—"} SpO2 ${v.spo2 ?? "—"}`);
    });
    return parts.join("\n");
  }, [transcriptLog, simState?.treatmentHistory, simState?.telemetryHistory, simState?.ekgHistory]);
  const handlePlayExamAudio = useCallback(
    async (type: "heart" | "lung") => {
      const url = type === "heart" ? examAudio.heart : examAudio.lung;
      if (!url) return;
      try {
        const audio = new Audio(url);
        await audio.play();
        const ts = Date.now();
      setTranscriptLog((prev) => [
        ...prev,
        {
          id: `exam-audio-${type}-${ts}`,
          timestamp: ts,
          text: `${type === "heart" ? "Heart" : "Lung"} sounds played`,
          character: "tech",
        },
      ]);
      setTimelineExtras((prev) => [
        ...prev,
        {
          id: `exam-audio-tl-${type}-${ts}`,
          ts,
          label: "Exam",
            detail: `${type === "heart" ? "Heart" : "Lung"} sounds played`,
          },
        ]);
      } catch (err) {
        console.error(err);
      }
    },
    [examAudio]
  );
  const buildExportText = useCallback(() => {
    const lines: string[] = [];
    lines.push("# CardioQuest Session Export");
    lines.push(`Session: ${sessionId ?? "unknown"}`);
    lines.push(`Scenario: ${simState?.scenarioId ?? selectedScenario}`);
    lines.push(`Stage: ${simState?.stageId ?? "n/a"}`);
    if (simState?.vitals) {
      lines.push(`Vitals: HR ${simState.vitals?.hr ?? "—"} BP ${simState.vitals?.bp ?? "—"} SpO2 ${simState.vitals?.spo2 ?? "—"}`);
    }
    lines.push("");
    lines.push("## Scoring Summary");
    lines.push(`Score: ${scoringSummary.score}`);
    scoringSummary.items.forEach((i) => lines.push(`- ${i}`));
    lines.push("");
    lines.push("## Orders (complete)");
    (simState?.orders ?? [])
      .filter((o) => o.status === "complete")
      .forEach((o) => {
        lines.push(
          `- ${o.type.toUpperCase()} @ ${
            o.completedAt ? new Date(o.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "n/a"
          }: ${
            o.result?.type === "vitals"
              ? `HR ${o.result.hr ?? "—"} BP ${o.result.bp ?? "—"} SpO2 ${o.result.spo2 ?? "—"}`
              : o.result?.summary ?? "Result"
          }`
        );
      });
    lines.push("");
    lines.push("## Treatments");
    (simState?.treatmentHistory ?? []).forEach((t) => {
      lines.push(
        `- ${t.treatmentType}${t.note ? `: ${t.note}` : ""} @ ${
          t.ts ? new Date(t.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "n/a"
        }`
      );
    });
    lines.push("");
    lines.push("## Telemetry History");
    (simState?.telemetryHistory ?? []).forEach((h) => {
      lines.push(
        `- ${h.rhythm ?? "Rhythm"} @ ${
          h.ts ? new Date(h.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "n/a"
        } ${h.note ? `(${h.note})` : ""}`
      );
    });
    lines.push("");
    lines.push("## EKG History");
    (simState as any)?.ekgHistory?.forEach?.((ekg: any) => {
      lines.push(
        `- ${ekg.summary ?? "EKG"} @ ${
          ekg.ts ? new Date(ekg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "n/a"
        } ${ekg.imageUrl ? `(image: ${ekg.imageUrl})` : ""}`
      );
    });
    lines.push("");
    lines.push("## Vitals Trend (last 5)");
    const vitalsTrend = (simState?.vitalsHistory as any[]) ?? [];
    vitalsTrend
      .slice(-5)
      .forEach((v, idx) => {
        lines.push(
          `- ${v.ts ? new Date(v.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : `vitals-${idx}`}: HR ${
            v.hr ?? "—"
          } BP ${v.bp ?? "—"} SpO2 ${v.spo2 ?? "—"}`
        );
      });
    lines.push("");
    lines.push("## Transcript (last 30)");
    transcriptLog
      .slice(-30)
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((t) => {
        lines.push(
          `[${new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}] ${t.character ?? t.role ?? "speaker"}: ${
            t.text
          }`
        );
      });
    lines.push("");
    lines.push("## Timeline (last 30)");
    const sortedTimeline = [...timelineItems].sort((a, b) => a.ts - b.ts).slice(-30);
    sortedTimeline.forEach((item) => {
      lines.push(
        `[${new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}] ${item.label}: ${item.detail}`
      );
    });
    const audioEvents = sortedTimeline.filter((t) => t.label === "Exam" && t.detail.toLowerCase().includes("sounds"));
    if (audioEvents.length > 0) {
      lines.push("");
      lines.push("## Audio Exam Events");
      audioEvents.forEach((ev) => {
        lines.push(
          `[${new Date(ev.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}] ${ev.detail}`
        );
      });
    }
    const assessmentAcks = sortedTimeline.filter((t) => t.label === "Assessment" && t.detail.toLowerCase().includes("ack"));
    if (assessmentAcks.length > 0) {
      lines.push("");
      lines.push("## Assessment Acknowledgements");
      assessmentAcks.forEach((ev) => {
        lines.push(
          `[${new Date(ev.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}] ${ev.detail}`
        );
      });
    }
    return lines.join("\n");
  }, [sessionId, simState, selectedScenario, scoringSummary, transcriptLog, timelineItems]);
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
    const audioEvents = timelineItems.filter((t) => t.label === "Exam" && t.detail.toLowerCase().includes("sounds"));
    if (audioEvents.length > 0) {
      parts.push(
        "## Audio Exam Events",
        audioEvents
          .slice(-10)
          .sort((a, b) => a.ts - b.ts)
          .map(
            (ev) =>
              `[${new Date(ev.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}] ${ev.detail}`
          )
          .join("\n")
      );
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
    // If mock session is present, short-circuit Firestore fetch.
    if (mockSessionData) {
      setSession(mockSessionData as any);
      setLoading(false);
      return;
    }
    if (!sessionId) return;
    const ref = doc(db, "sessions", sessionId);
    const unsub = onSnapshot(ref, (snap: any) => {
      setLoading(false);
      if (snap.exists()) {
        setSession({ ...(snap.data() as SessionData), id: snap.id });
      }
    });
    return () => unsub();
  }, [sessionId, mockSessionData]);

  useEffect(() => {
    if (!sessionId) return;
    const ref = collection(db, "sessions", sessionId, "participants");
    const unsub = onSnapshot(ref as any, (snap: any) => {
      if (!snap) return;
      const docsArray = (typeof snap.forEach === "function" && !Array.isArray(snap))
        ? (() => { const arr: any[] = []; snap.forEach((d: any) => arr.push(d)); return arr; })()
        : snap.docs ?? [];
      setParticipantCount(docsArray.length ?? 0);
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
      if (state.budget?.throttled) {
        setBudgetAlert({ level: "soft", message: "AI usage near limit; responses may slow." });
      } else if (state.budget?.fallback) {
        setBudgetAlert({ level: "hard", message: "AI paused due to budget cap. Resume when ready." });
      } else {
        setBudgetAlert(null);
      }
      const alarmFinding = (state.findings ?? []).find((f: string) => typeof f === "string" && f.startsWith("ALARM:"));
      setAlarmNotice(alarmFinding || null);
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
      setBudgetAlert(null);
      setAlarmNotice(null);
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

  if (!sessionId && !mockSessionData) {
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

  const handlePresenterLeave = () => {
    const shouldLeave = window.confirm("Leave this session?");
    if (!shouldLeave) return;
    try {
      voiceGatewayClient.disconnect();
    } catch {
      // best effort disconnect
    }
    window.location.assign("/#/");
  };

  if (mockSessionParam) {
    const mockJoinUrl = `${window.location.origin}/#/join/${(mockSessionParam || "MOCK").toUpperCase()}`;
    const mockVoiceBadge = mockVoiceState === "unavailable" ? "Voice: disabled" : "Voice: ready";
    const mockStateLabel = mockShowResults ? "Showing results" : mockQuestionOpen ? "Accepting answers" : "Closed";
    const mockStateTone = mockShowResults
      ? "bg-sky-500/15 border-sky-500/50 text-sky-100"
      : mockQuestionOpen
      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-100"
      : "bg-slate-800 border-slate-700 text-slate-300";
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-4">
        <div
          className="flex flex-wrap items-center justify-between gap-3 py-2 px-2 md:px-3 border-b border-slate-900"
          data-testid="presenter-header"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-sm font-semibold text-slate-100">Presenter View</div>
            <div className="text-xs text-slate-400 truncate">Session: {(mockSessionParam || "MOCK").toUpperCase()}</div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap max-w-full">
            <div className="flex items-center gap-1 bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1 min-w-[160px]">
              <span className="text-[10px] text-slate-400 uppercase tracking-[0.14em]">Join</span>
              <span className="font-mono text-xs text-sky-200 truncate">{(mockSessionParam || "MOCK").toUpperCase()}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(mockJoinUrl);
                    setCopyToast("Join link copied");
                  } catch {
                    setCopyToast("Copy failed");
                  }
                }}
                className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap"
              >
                Copy
              </button>
            </div>
            <div className={`text-[10px] px-2 py-0.5 rounded-full border ${mockStateTone}`}>
              {mockStateLabel}
            </div>
            <div className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-slate-200 whitespace-nowrap">
              Responses: 0
            </div>
            <div className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-slate-200 whitespace-nowrap">
              {mockVoiceBadge}
            </div>
            <button
              type="button"
              onClick={handlePresenterLeave}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap"
            >
              Leave
            </button>
          </div>
        </div>
        <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-900 space-y-4">
          <div className="text-sm font-semibold text-slate-100">Mock slide</div>
          <div className="text-slate-300 text-sm" dangerouslySetInnerHTML={{ __html: "<p>Mock content</p>" }} />
        </div>
        <div className="mt-4 flex items-center gap-2" data-testid="mock-question-controls">
          <button
            type="button"
            data-testid="open-question"
            onClick={() => setMockQuestionOpen(true)}
            disabled={mockQuestionOpen}
            className="px-3 py-2 rounded-lg border border-emerald-500/70 bg-emerald-500/15 text-emerald-100 text-xs font-semibold"
          >
            Open
          </button>
          <button
            type="button"
            data-testid="toggle-results"
            onClick={() => setMockShowResults((v) => !v)}
            disabled={!mockQuestionOpen}
            className="px-3 py-2 rounded-lg border border-amber-500/70 bg-amber-500/15 text-amber-100 text-xs font-semibold"
          >
            {mockShowResults ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            data-testid="close-question"
            onClick={() => {
              setMockQuestionOpen(false);
              setMockShowResults(false);
            }}
            disabled={!mockQuestionOpen && !mockShowResults}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/70 text-slate-100 text-xs font-semibold"
          >
            Close
          </button>
        </div>
        <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-900 space-y-2" data-testid="mock-responses">
          <div className="text-sm font-semibold text-slate-100">Responses</div>
          <div className="text-slate-400 text-sm">
            Mock view: responses will appear here when participants answer.
          </div>
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

  const questionStateLabel = isQuestionOpen
    ? "Accepting answers"
    : isShowingResults
    ? "Showing results"
    : "Closed";
  const questionStateTone = isQuestionOpen
    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-100"
    : isShowingResults
    ? "bg-sky-500/15 border-sky-500/50 text-sky-100"
    : "bg-slate-800 border-slate-700 text-slate-300";
  const mockVoiceEnabled = mockVoiceState === "ready";
  const mockVoiceUnavailable = mockVoiceState === "unavailable";

  const presenterHeader = (
    <div
      className="flex flex-wrap items-center justify-between gap-3 py-2 px-3 md:px-4 border-b border-slate-900"
      data-testid="presenter-header"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-sm font-semibold text-slate-100">Presenter View</div>
        <div className="text-[11px] text-slate-400 truncate">Session: {session.joinCode}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-full">
            <div className="flex items-center gap-1 bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1 min-w-[160px]">
              <span className="text-[10px] text-slate-400 uppercase tracking-[0.14em]">Join</span>
              <span className="font-mono text-xs text-sky-200 truncate">{session.joinCode}</span>
          <button
            type="button"
            onClick={async () => {
              if (!joinUrl) return;
              try {
                if ((navigator as any).share) {
                  await (navigator as any).share({ url: joinUrl, text: `Join CardioQuest Live: ${session.joinCode}` });
                  return;
                }
              } catch {
                // ignore share errors
              }
              try {
                await navigator.clipboard.writeText(joinUrl);
                setCopyToast("Join link copied");
              } catch {
                setCopyToast("Copy failed");
              }
            }}
            className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap"
          >
            Copy
          </button>
        </div>
        <div className={`text-[10px] px-2 py-0.5 rounded-full border ${questionStateTone}`}>
          {questionStateLabel}
        </div>
        <div className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-slate-200 whitespace-nowrap">
          Responses: {responseTotal}
        </div>
        <div className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-slate-200 whitespace-nowrap">
          Voice: {mockVoiceUnavailable ? "disabled" : mockVoiceEnabled || gatewayStatus.state === "ready" ? "ready" : "disconnected"}
        </div>
        <button
          type="button"
          onClick={handlePresenterLeave}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500 transition-colors whitespace-nowrap"
        >
          Leave
        </button>
      </div>
    </div>
  );

  const totalQuestions = session.questions?.length ?? 0;
  const questionsAnsweredPct =
    totalQuestions > 0 ? Math.min(1, Math.max(0, questionsAnsweredCount / totalQuestions)) : 0;
  const avgResponsesPerQuestion =
    questionsAnsweredCount > 0 ? totalResponses / questionsAnsweredCount : 0;
  const fallbackActive = Boolean(simState?.fallback || simState?.budget?.fallback);
  const overlayMode: "idle" | "resident-speaking" | "ai-speaking" | "disabled" | "disconnected" =
    mockVoiceUnavailable || (!mockVoiceEnabled && !voice.enabled)
      ? "disabled"
      : gatewayStatus.state !== "ready" && !mockVoiceEnabled
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
      {presenterHeader}
      {copyToast && (
        <div className="fixed top-4 right-4 bg-slate-900 border border-slate-700 text-slate-100 px-3 py-2 rounded-lg shadow-lg text-sm z-50">
          {copyToast}
        </div>
      )}
      <div className="flex items-center justify-between px-3 md:px-4 py-1.5">
        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">
            {session.title}
          </div>
          <PresenterModeTabs activeMode={presenterMode} onModeChange={setPresenterMode} />
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {presenterMode === "slides" && (
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
          )}
          {/* Autonomous Simulation Panel - replaces complex voice controls */}
          {sessionId && presenterMode === "sim" && (
            <AutonomousSimPanel
              sessionId={sessionId}
              voice={voice}
              connectionStatus={gatewayStatus}
              transcriptLog={transcriptLog}
              simState={simState ? {
                stageId: simState.stageId,
                vitals: simState.vitals,
                budget: simState.budget,
              } : undefined}
              scenarioId={selectedScenario}
              scenarioOptions={scenarioOptions}
              onScenarioChange={handleScenarioSelect}
            />
          )}
          {presenterMode === "sim" && simState && (
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
                  <div className="flex items-center gap-2 text-sm text-emerald-100">
                    <span>{simState.rhythmSummary ?? "Rhythm available"}</span>
                    <span className="px-2 py-0.5 rounded-full border border-emerald-500/40 text-[10px] text-emerald-200">
                      {simState.telemetryHistory?.slice(-1)[0]?.rhythm ?? "Live"}
                    </span>
                    {rhythmAlert && (
                      <span className="px-2 py-0.5 rounded-full border border-amber-500/60 text-[10px] text-amber-200">
                        Rhythm changed
                      </span>
                    )}
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
                  {latestEkgMeta && (
                    <div className="mt-2 text-[12px] text-slate-400 space-y-0.5">
                      {latestEkgMeta.rate && <div>Rate: {latestEkgMeta.rate}</div>}
                      {latestEkgMeta.intervals && <div>Intervals: {latestEkgMeta.intervals}</div>}
                      {latestEkgMeta.axis && <div>Axis: {latestEkgMeta.axis}</div>}
                    </div>
                  )}
                  {rhythmAlert && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ts = Date.now();
                          setTimelineExtras((prev) => [
                            ...prev,
                            {
                              id: `rhythm-pin-${ts}`,
                              ts,
                              label: "Telemetry",
                              detail: `Rhythm: ${rhythmAlert}`,
                            },
                          ]);
                          setRhythmAlert(null);
                        }}
                        className="px-2 py-1 rounded border border-amber-500/60 text-[11px] text-amber-100 bg-amber-500/10 hover:border-amber-400"
                      >
                        Pin rhythm change
                      </button>
                    </div>
                  )}
                </div>
              )}
              <VitalsMonitor
                vitals={simState.vitals as any}
                telemetryWaveform={simState.telemetryWaveform as any}
                telemetryOn={simState.telemetry}
              />
              {simState.telemetry && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTelemetryPopout(true)}
                    className="px-2 py-1 text-[12px] rounded-lg border border-slate-700 text-slate-100 hover:border-slate-500"
                  >
                    Pop-out rhythm
                  </button>
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
                            {order.result.abnormal && <div className="text-amber-200 text-[11px]">Key abnormal: {order.result.abnormal}</div>}
                            {order.result.nextAction && <div className="text-slate-300 text-[11px]">Next: {order.result.nextAction}</div>}
                          </div>
                        )}
                        {isDone && order.result?.type === "labs" && (
                          <div className="text-slate-300 text-[12px] mt-1">
                            {order.result.summary ?? "Labs ready"}
                            {order.result.abnormal && <div className="text-amber-200 text-[11px]">Key abnormal: {order.result.abnormal}</div>}
                            {order.result.nextAction && <div className="text-slate-300 text-[11px]">Next: {order.result.nextAction}</div>}
                          </div>
                        )}
                        {isDone && order.result?.type === "imaging" && (
                          <div className="text-slate-300 text-[12px] mt-1">
                            {order.result.summary ?? "Imaging ready"}
                            {order.result.abnormal && <div className="text-amber-200 text-[11px]">Key abnormal: {order.result.abnormal}</div>}
                            {order.result.nextAction && <div className="text-slate-300 text-[11px]">Next: {order.result.nextAction}</div>}
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
          {presenterMode === "sim" && (
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
          )}
          {isQuestionSlide && (
            <div className="hidden md:flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={openQuestion}
                disabled={isQuestionOpen}
                data-testid="open-question"
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
                data-testid="toggle-results"
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
                data-testid="close-question"
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
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={async () => {
                    if (!joinUrl) return;
                    try {
                      if ((navigator as any).share) {
                        await (navigator as any).share({ url: joinUrl, text: `Join CardioQuest Live: ${session.joinCode}` });
                        return;
                      }
                    } catch {
                      // ignore share errors
                    }
                    try {
                      await navigator.clipboard.writeText(joinUrl);
                      setCopyToast("Copied!");
                    } catch {
                      setCopyToast("Copy failed");
                    }
                  }}
                  className="text-[10px] px-2 py-1 rounded-lg border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors"
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => setShowQr(true)}
                  className="text-[10px] px-2 py-1 rounded-lg border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors"
                >
                  Show QR
                </button>
              </div>
              <div className="text-[10px] text-slate-400">Participants: {participantCount}</div>
            </div>
        </div>
      </div>
      {/* Simulation-specific status bar - only in sim mode */}
      {presenterMode === "sim" && (
        <div className="flex flex-col gap-2 px-3 md:px-4 py-2 border-b border-slate-800/50">
          <button
            type="button"
            onClick={() => setVoiceGuideOpen((v) => !v)}
            className="text-[10px] text-sky-300 underline self-start"
          >
            {voiceGuideOpen ? "Hide voice guide" : "Show voice guide"}
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] text-slate-200">
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
              <span className="uppercase tracking-[0.14em] text-slate-500 font-semibold">Queue</span>
              <span className="px-2 py-0.5 rounded-full border border-slate-700 text-slate-100 text-xs">
                {participantCount}
              </span>
              {participantCount > 1 && voice.floorHolderId && (
                <span className="text-[10px] text-slate-500">Waiting: {Math.max(0, participantCount - 1)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1.5">
              <span className="uppercase tracking-[0.14em] text-slate-500 font-semibold">Budget</span>
              <span className="font-mono text-xs text-slate-200">
                ${simState?.budget?.usdEstimate?.toFixed(2) ?? "0.00"} · {simState?.budget?.voiceSeconds ? `${Math.round(simState.budget.voiceSeconds)}s` : "0s"}
              </span>
              {budgetAlert && (
                <span
                  className={`px-2 py-0.5 rounded-full border text-[10px] ${
                    budgetAlert.level === "hard"
                      ? "border-red-600 text-red-200 bg-red-900/50"
                      : "border-amber-500 text-amber-100 bg-amber-900/40"
                  }`}
                >
                  ! {budgetAlert.message}
                </span>
              )}
              {alarmNotice && (
                <span className="px-2 py-0.5 rounded-full border text-[10px] border-red-600 text-red-200 bg-red-900/40">
                  ! {alarmNotice.replace("ALARM: ", "")}
                </span>
              )}
            </div>
          </div>
          {voiceGuideOpen && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 space-y-1">
              <div className="text-slate-200 font-semibold">Voice guide</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>Check status: Voice {gatewayStatus.state}. If disconnected, tap Retry in banner.</li>
                <li>Manage floor: Take/Release or Lock floor to control resident speaking.</li>
                <li>Queue: if residents waiting, keep turns brief; floor auto-releases after 60s idle.</li>
                <li>Fallback: switch to text Q&amp;A; resume voice when budget allows.</li>
                <li>Mic issues: ask resident to re-check mic; if blocked, have them allow permissions.</li>
              </ol>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 flex flex-col items-center px-4 md:px-6 pb-2 gap-2">
        <div className="w-full max-w-[1800px] grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-3 items-start">
          <div className="flex flex-col gap-3">
            <div className="relative flex-1 min-h-[62vh] max-h-[78vh]">
              {showSummary ? (
                <div
                  className="absolute inset-0 rounded-2xl overflow-hidden"
                  ref={summaryRef}
                  tabIndex={-1}
                  aria-label="Session summary"
                >
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
                    <label htmlFor="timeline-filter" className="sr-only">Timeline filter</label>
                    <select
                      id="timeline-filter"
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
                    <label htmlFor="timeline-search" className="sr-only">Search timeline</label>
                    <input
                      id="timeline-search"
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
                <label className="flex items-center gap-1 text-[10px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={assessmentEnabled}
                    onChange={(e) => setAssessmentEnabled(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  Timed assessment prompts
                </label>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      const ts = Date.now();
                      setAssessmentPromptOpen(true);
                      setTimelineExtras((prev) => [
                        ...prev,
                        { id: `assessment-manual-${ts}`, ts, label: "Assessment", detail: "Presenter prompted assessment." },
                      ]);
                      setLastAssessmentAt(ts);
                    }}
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200"
                  >
                    Prompt now
                  </button>
                  {assessmentPromptOpen && <span className="text-amber-300">Awaiting response</span>}
                </div>
                <div className="flex flex-col gap-2 text-[10px] text-slate-200">
                  <label className="text-slate-400">Differential</label>
                  <div className="flex flex-wrap gap-1">
                    {["HCM", "Myocarditis", "Coarctation", "Arrhythmia", "Pulmonary cause"].map((dx) => {
                      const active = assessmentDifferential.includes(dx);
                      return (
                        <button
                          key={dx}
                          type="button"
                          onClick={() =>
                            setAssessmentDifferential((prev) =>
                              active ? prev.filter((p) => p !== dx) : [...prev, dx]
                            )
                          }
                          className={`px-2 py-1 rounded-full border text-[10px] ${
                            active
                              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                              : "border-slate-700 bg-slate-900 text-slate-300"
                          }`}
                        >
                          {dx}
                        </button>
                      );
                    })}
                  </div>
                  <label className="text-slate-400">Plan</label>
                  <div className="flex flex-wrap gap-1">
                    {["Oxygen", "Fluids", "Beta-blocker", "EKG", "Labs", "Imaging"].map((plan) => {
                      const active = assessmentPlan.includes(plan);
                      return (
                        <button
                          key={plan}
                          type="button"
                          onClick={() =>
                            setAssessmentPlan((prev) =>
                              active ? prev.filter((p) => p !== plan) : [...prev, plan]
                            )
                          }
                          className={`px-2 py-1 rounded-full border text-[10px] ${
                            active
                              ? "border-sky-500/60 bg-sky-500/10 text-sky-100"
                              : "border-slate-700 bg-slate-900 text-slate-300"
                          }`}
                        >
                          {plan}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-[10px] text-slate-200">
                  <label className="text-slate-400" htmlFor="assessment-response">
                    Log assessment response
                  </label>
                  <textarea
                    id="assessment-response"
                    value={assessmentResponse}
                    onChange={(e) => setAssessmentResponse(e.target.value)}
                    placeholder="Document differential, plan, next steps…"
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[12px] text-slate-100 h-16 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!assessmentResponse.trim()}
                      onClick={() => {
                        if (!assessmentResponse.trim()) return;
                        const ts = Date.now();
                        const detailParts = [];
                        if (assessmentDifferential.length) detailParts.push(`Dx: ${assessmentDifferential.join(", ")}`);
                        if (assessmentPlan.length) detailParts.push(`Plan: ${assessmentPlan.join(", ")}`);
                        detailParts.push(assessmentResponse.trim());
                        setTimelineExtras((prev) => [
                          ...prev,
                          {
                            id: `assessment-response-${ts}`,
                            ts,
                            label: "Assessment",
                            detail: detailParts.join(" | "),
                          },
                        ]);
                        setTranscriptLog((prev) => [
                          ...prev,
                          {
                            id: `assessment-response-log-${ts}`,
                            timestamp: ts,
                            text: detailParts.join(" | "),
                            character: "doctor",
                          },
                        ]);
                        setAssessmentResponse("");
                        setAssessmentPromptOpen(false);
                        setLastAssessmentAt(ts);
                    }}
                      className={`px-2 py-1 rounded border text-[10px] ${
                        assessmentResponse.trim()
                          ? "border-emerald-600/60 bg-emerald-600/10 text-emerald-100 hover:border-emerald-500"
                          : "border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed"
                      }`}
                    >
                      Save assessment
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssessmentResponse("")}
                      className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-[10px] text-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                {examAudio.heart && (
                  <button
                    type="button"
                    onClick={() => handlePlayExamAudio("heart")}
                    className="px-2 py-1 rounded border border-pink-500/60 bg-pink-500/10 text-pink-100 text-[10px] hover:border-pink-400"
                    >
                      Play heart sounds
                    </button>
                  )}
                  {examAudio.lung && (
                    <button
                      type="button"
                      onClick={() => handlePlayExamAudio("lung")}
                      className="px-2 py-1 rounded border border-sky-500/60 bg-sky-500/10 text-sky-100 text-[10px] hover:border-sky-400"
                    >
                      Play lung sounds
                    </button>
                  )}
                <button
                  type="button"
                  disabled={exportStatus === "exporting" || timelineItems.length === 0}
                  onClick={() => {
                    try {
                      setExportStatus("exporting");
                      const text = buildExportText();
                      const blob = new Blob([text], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `cardioquest-session-${sessionId ?? "session"}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setExportStatus("exported");
                      setTimeout(() => setExportStatus("idle"), 2000);
                    } catch (err) {
                      setExportStatus("error");
                      console.error(err);
                    }
                  }}
                    className={`px-2 py-1 rounded border text-[10px] ${
                      exportStatus === "exporting"
                        ? "border-slate-800 bg-slate-900 text-slate-500 cursor-wait"
                        : "border-sky-600/60 bg-sky-600/10 text-sky-100 hover:border-sky-500"
                    }`}
                  >
                    {exportStatus === "exporting" ? "Exporting…" : "Export session"}
                  </button>
                  <div role="status" aria-live="polite" className="flex flex-wrap gap-1 items-center">
                    {timelineCopyStatus === "copied" && <span className="text-[10px] text-emerald-300">Copied</span>}
                    {timelineCopyStatus === "error" && <span className="text-[10px] text-rose-300">Copy failed</span>}
                    {timelineSaveStatus === "saved" && <span className="text-[10px] text-emerald-300">Saved</span>}
                    {timelineSaveStatus === "error" && <span className="text-[10px] text-rose-300">Save failed</span>}
                    {transcriptSaveStatus === "saved" && <span className="text-[10px] text-emerald-300">Transcript saved</span>}
                    {transcriptSaveStatus === "error" && <span className="text-[10px] text-rose-300">Transcript save failed</span>}
                    {exportStatus === "exported" && <span className="text-[10px] text-emerald-300">Exported</span>}
                    {exportStatus === "error" && <span className="text-[10px] text-rose-300">Export failed</span>}
                  </div>
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
                  <label htmlFor="stage-select" className="text-xs text-slate-300">
                    Stage:
                  </label>
                  <select
                    id="stage-select"
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
                    className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-700 text-slate-50 hover:bg-slate-600 disabled:opacity-70 disabled:cursor-not-allowed"
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
              <div
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-50"
                role="status"
                aria-live="polite"
              >
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
      {showTelemetryPopout && simState?.telemetry && simState.telemetryWaveform && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-slate-50">Telemetry</div>
                <div className="text-[12px] text-slate-400">{simState.rhythmSummary ?? "Live rhythm"}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowTelemetryPopout(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <svg viewBox={`0 0 ${simState.telemetryWaveform.length} 2`} className="w-full h-40 bg-slate-900 rounded-lg border border-slate-800">
              <polyline
                fill="none"
                stroke="#34d399"
                strokeWidth="0.08"
                points={simState.telemetryWaveform.map((v: number, idx: number) => `${idx},${1 - v}`).join(" ")}
              />
            </svg>
            {latestEkgMeta && (
              <div className="mt-2 text-[12px] text-slate-400 space-y-0.5">
                {latestEkgMeta.rate && <div>Rate: {latestEkgMeta.rate}</div>}
                {latestEkgMeta.intervals && <div>Intervals: {latestEkgMeta.intervals}</div>}
                {latestEkgMeta.axis && <div>Axis: {latestEkgMeta.axis}</div>}
              </div>
            )}
          </div>
        </div>
      )}
      {showQr && (
        <QRCodeOverlay
          open={showQr}
          onClose={() => setShowQr(false)}
          code={session.joinCode}
          joinUrl={joinUrl}
        />
      )}
    </div>
  );
}
