# CardioQuest Live: UI/UX Improvement Plan v2.0

> **Status**: Sprints 1-6 (original plan) largely complete. This document now covers the next phase of improvements identified in the December 2024 world-class UX audit.

---

## Completed (Sprints 1-6)

The following have already shipped:

- [x] Smart code input with validation, shake animation, rejoin button
- [x] QR code overlay with accessibility (Escape to close, focus management)
- [x] Copy link with clipboard/share API fallback
- [x] Collapsible voice panel with localStorage persistence
- [x] Floating mic button (FAB) on mobile
- [x] Slide-first layout on mobile
- [x] Session skeleton loader with shimmer
- [x] Optimistic answer submission with error recovery
- [x] Rich mic error panel with browser-specific guidance
- [x] Text fallback input (200 char limit)
- [x] Skip link to main content
- [x] Screen reader announcements for question/voice state
- [x] Haptic feedback on recording
- [x] Answer feedback animations (select-pop, correct-pulse)

---

## Phase 1: Foundation & Stability (Critical)

> **Goal**: Prevent crashes, improve performance, fix accessibility violations
> **Effort**: 3-4 days | **Impact**: High

### 1.1 Error Boundaries
**Priority**: P0 - CRITICAL
**Files to create**: `src/components/ErrorBoundary.tsx`
**Files to modify**: `src/App.tsx`

**Problem**: Any render error crashes the entire app. No recovery path.

**Implementation**:
```tsx
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    // TODO: Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-rose-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-slate-400 text-sm">
              The app encountered an error. Try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Wrap routes in App.tsx**:
```tsx
<ErrorBoundary>
  <Routes>
    <Route path="/" element={<Home />} />
    {/* ... */}
  </Routes>
</ErrorBoundary>
```

**Acceptance criteria**:
- [ ] Render errors show friendly fallback UI instead of white screen
- [ ] Refresh button reloads page
- [ ] Error details logged to console (and optionally to tracking service)

---

### 1.2 Code Splitting with React.lazy
**Priority**: P0 - CRITICAL
**Files to modify**: `src/App.tsx`

**Problem**: All routes load upfront. Firebase SDK alone is ~200KB. Initial load is slow.

**Implementation**:
```tsx
// src/App.tsx
import React, { Suspense, lazy } from "react";
import { SessionSkeleton } from "./components/SessionSkeleton";

// Lazy load heavy pages
const CreateDemoSession = lazy(() => import("./pages/CreateDemoSession"));
const PresenterSession = lazy(() => import("./pages/PresenterSession"));
const JoinSession = lazy(() => import("./pages/JoinSession"));
const AdminDeckEditor = lazy(() => import("./pages/AdminDeckEditor"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <SessionSkeleton />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create-demo" element={<CreateDemoSession />} />
            <Route path="/presenter/:sessionId" element={<PresenterSession />} />
            <Route path="/join/:joinCode" element={<JoinSession />} />
            <Route path="/admin" element={<AdminDeckEditor />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  );
}
```

**Acceptance criteria**:
- [ ] Initial bundle reduced by 40%+ (measure with `vite build --report`)
- [ ] Page-specific code loads on navigation
- [ ] Skeleton shows during lazy load
- [ ] No flash of unstyled content

---

### 1.3 State Management Refactor (JoinSession)
**Priority**: P1 - HIGH
**Files to create**: `src/contexts/VoiceStateContext.tsx`
**Files to modify**: `src/pages/JoinSession.tsx`

**Problem**: JoinSession has 30+ useState calls. Every state change re-renders the entire 1200-line component.

**Implementation**:

```tsx
// src/contexts/VoiceStateContext.tsx
import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { VoiceConnectionStatus, CharacterId } from "../types/voiceGateway";
import { MicStatus } from "../services/VoicePatientService";

interface VoiceState {
  connectionStatus: VoiceConnectionStatus;
  micStatus: MicStatus;
  micLevel: number;
  transcribing: boolean;
  targetCharacter: CharacterId;
  voiceError: string | null;
  preferTextInput: boolean;
  isVoiceExpanded: boolean;
  activeSpeakerId: string | null;
}

type VoiceAction =
  | { type: "SET_CONNECTION_STATUS"; payload: VoiceConnectionStatus }
  | { type: "SET_MIC_STATUS"; payload: MicStatus }
  | { type: "SET_MIC_LEVEL"; payload: number }
  | { type: "SET_TRANSCRIBING"; payload: boolean }
  | { type: "SET_TARGET_CHARACTER"; payload: CharacterId }
  | { type: "SET_VOICE_ERROR"; payload: string | null }
  | { type: "SET_PREFER_TEXT_INPUT"; payload: boolean }
  | { type: "SET_VOICE_EXPANDED"; payload: boolean }
  | { type: "SET_ACTIVE_SPEAKER"; payload: string | null };

const initialState: VoiceState = {
  connectionStatus: { state: "disconnected", lastChangedAt: Date.now() },
  micStatus: "unknown",
  micLevel: 0,
  transcribing: false,
  targetCharacter: "patient",
  voiceError: null,
  preferTextInput: localStorage.getItem("cq_prefer_text_input") === "true",
  isVoiceExpanded: localStorage.getItem("cq_voice_panel_expanded") !== "false",
  activeSpeakerId: null,
};

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.payload };
    case "SET_MIC_STATUS":
      return { ...state, micStatus: action.payload };
    case "SET_MIC_LEVEL":
      return { ...state, micLevel: action.payload };
    case "SET_TRANSCRIBING":
      return { ...state, transcribing: action.payload };
    case "SET_TARGET_CHARACTER":
      return { ...state, targetCharacter: action.payload };
    case "SET_VOICE_ERROR":
      return { ...state, voiceError: action.payload };
    case "SET_PREFER_TEXT_INPUT":
      localStorage.setItem("cq_prefer_text_input", String(action.payload));
      return { ...state, preferTextInput: action.payload };
    case "SET_VOICE_EXPANDED":
      localStorage.setItem("cq_voice_panel_expanded", String(action.payload));
      return { ...state, isVoiceExpanded: action.payload };
    case "SET_ACTIVE_SPEAKER":
      return { ...state, activeSpeakerId: action.payload };
    default:
      return state;
  }
}

const VoiceStateContext = createContext<{
  state: VoiceState;
  dispatch: React.Dispatch<VoiceAction>;
} | null>(null);

export function VoiceStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(voiceReducer, initialState);
  return (
    <VoiceStateContext.Provider value={{ state, dispatch }}>
      {children}
    </VoiceStateContext.Provider>
  );
}

export function useVoiceContext() {
  const context = useContext(VoiceStateContext);
  if (!context) {
    throw new Error("useVoiceContext must be used within VoiceStateProvider");
  }
  return context;
}
```

**Acceptance criteria**:
- [ ] Voice-related state extracted to context
- [ ] JoinSession reduced to <20 useState calls
- [ ] Voice panel updates don't re-render question section
- [ ] All existing functionality preserved

---

### 1.4 Focus Management (Accessibility)
**Priority**: P1 - HIGH
**Files to modify**: `src/components/QRCodeOverlay.tsx`, `src/components/SessionSummary.tsx`

**Problem**: Modals lack focus traps. Tab key escapes modal. Focus not restored on close.

**QRCodeOverlay fix** (already has partial implementation, needs focus trap):
```tsx
// Add focus trap logic
React.useEffect(() => {
  const panel = panelRef.current;
  if (!panel) return;

  const focusableElements = panel.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  panel.addEventListener("keydown", handleTab);
  return () => panel.removeEventListener("keydown", handleTab);
}, []);
```

**SessionSummary** needs similar treatment plus focus restoration.

**Acceptance criteria**:
- [ ] Tab cycles within modal only
- [ ] Shift+Tab works in reverse
- [ ] Escape closes modal
- [ ] Focus returns to trigger element on close
- [ ] Test with VoiceOver/NVDA

---

### 1.5 Session Not Found - Add Retry
**Priority**: P1 - HIGH
**Files to modify**: `src/pages/JoinSession.tsx` (lines 865-879)

**Problem**: Dead-end UX. User must manually navigate back and re-enter code.

**Implementation**:
```tsx
if (!session || !sessionId) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-50 space-y-4 p-6">
      <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-slate-700 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" x2="12" y1="8" y2="12"/>
          <line x1="12" x2="12.01" y1="16" y2="16"/>
        </svg>
      </div>
      <h2 className="text-xl font-bold">Session Not Found</h2>
      <p className="text-slate-400 text-center max-w-xs">
        We couldn't find a session with code{" "}
        <span className="font-mono text-sky-400 bg-sky-950/30 px-2 py-1 rounded mx-1">
          {joinCode?.toUpperCase()}
        </span>
      </p>
      <p className="text-slate-500 text-sm text-center max-w-xs">
        The session may have ended, or the code might be incorrect.
      </p>
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => {
            setLoading(true);
            setSession(null);
            setSessionId(null);
            // Re-trigger the findSession effect
            setTimeout(() => setLoading(false), 100);
          }}
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          Try Again
        </button>
        <Link
          to="/"
          className="px-6 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm font-medium transition-colors"
        >
          Enter New Code
        </Link>
      </div>
    </div>
  );
}
```

**Acceptance criteria**:
- [ ] "Try Again" button re-fetches session
- [ ] "Enter New Code" navigates to home
- [ ] Loading state shown during retry
- [ ] Error message explains possible causes

---

## Phase 2: UX Polish (High Impact)

> **Goal**: Fix friction points, improve feedback, enhance mobile experience
> **Effort**: 4-5 days | **Impact**: High

### 2.1 Scroll Behavior Fixes
**Priority**: P1 - HIGH
**Files to modify**: `src/pages/JoinSession.tsx`

**Problems**:
1. Sticky header covers content when scrolling up
2. No scroll-to-question when question changes
3. Voice panel position on mobile requires scrolling

**Implementation**:

```tsx
// 1. Add scroll-margin to content sections
<section className="scroll-mt-20 animate-slide-up"> {/* Question section */}

// 2. Scroll to question on change
useEffect(() => {
  if (currentQuestion) {
    const questionSection = document.getElementById("question-section");
    questionSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}, [session?.currentQuestionId]);

// 3. Add id to question section
<section id="question-section" className="scroll-mt-20 animate-slide-up">
```

**Acceptance criteria**:
- [ ] Scrolling up doesn't hide content under header
- [ ] New question automatically scrolls into view
- [ ] Smooth scroll animation (respects prefers-reduced-motion)

---

### 2.2 Toast Notification System
**Priority**: P2 - MEDIUM
**Files to create**: `src/components/Toast.tsx`, `src/contexts/ToastContext.tsx`
**Files to modify**: `src/pages/JoinSession.tsx`

**Problem**: Toasts appear inline, cause layout shift, inconsistent styling.

**Implementation**:
```tsx
// src/contexts/ToastContext.tsx
interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  duration?: number;
}

// src/components/Toast.tsx - Fixed position toast container
export function ToastContainer() {
  const { toasts } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`
            pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium
            animate-slide-up backdrop-blur-sm
            ${toast.type === "success" ? "bg-emerald-900/90 text-emerald-100 border border-emerald-700" : ""}
            ${toast.type === "error" ? "bg-rose-900/90 text-rose-100 border border-rose-700" : ""}
            ${toast.type === "warning" ? "bg-amber-900/90 text-amber-100 border border-amber-700" : ""}
            ${toast.type === "info" ? "bg-slate-900/90 text-slate-100 border border-slate-700" : ""}
          `}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
```

**Acceptance criteria**:
- [ ] Toasts appear in fixed position (no layout shift)
- [ ] Auto-dismiss after 3s (configurable)
- [ ] Color-coded by type
- [ ] Accessible (role="status", aria-live)
- [ ] Stack multiple toasts vertically

---

### 2.3 Autofocus on Forms
**Priority**: P2 - MEDIUM
**Files to modify**: `src/App.tsx` (Home), `src/components/TextQuestionInput.tsx`

**Problem**: Users must click input before typing. Extra friction.

**Implementation**:
```tsx
// Home component - autofocus join code input
<input
  id="join-code"
  type="text"
  autoFocus
  value={joinCode}
  // ...
/>

// TextQuestionInput - focus when shown
const inputRef = useRef<HTMLTextAreaElement>(null);
useEffect(() => {
  if (!disabled) {
    inputRef.current?.focus();
  }
}, [disabled]);
```

**Acceptance criteria**:
- [ ] Join code input focused on page load
- [ ] Text question input focused when panel expands
- [ ] No autofocus on mobile if keyboard would obscure content

---

### 2.4 Keyboard Accessibility for Scoreboards
**Priority**: P2 - MEDIUM
**Files to modify**: `src/components/TeamScoreboard.tsx`, `src/components/IndividualScoreboard.tsx`

**Problem**: `pointer-events-none` blocks all interaction. Screen reader users can't access.

**Implementation**:
```tsx
// Remove pointer-events-none, add proper semantics
<div
  className="w-[270px] max-w-xs bg-slate-950/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-4"
  role="region"
  aria-label="Team scores"
>
  <h2 className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-3">
    Teams
  </h2>
  <ul className="space-y-2" role="list">
    {teams.map((team, idx) => (
      <li key={team.teamId} className="flex items-center gap-3">
        {/* ... */}
      </li>
    ))}
  </ul>
</div>
```

**Acceptance criteria**:
- [ ] Scoreboards accessible via keyboard/screen reader
- [ ] Proper heading hierarchy
- [ ] List semantics for rankings

---

### 2.5 Character Limit Warning
**Priority**: P3 - LOW
**Files to modify**: `src/components/TextQuestionInput.tsx`

**Problem**: Character counter exists but no visual warning when approaching limit.

**Implementation**:
```tsx
const charCount = value.length;
const isNearLimit = charCount >= 180;
const isAtLimit = charCount >= 200;

<div className={`text-[11px] ${isAtLimit ? "text-rose-400" : isNearLimit ? "text-amber-400" : "text-slate-500"}`}>
  {charCount}/200
  {isNearLimit && !isAtLimit && " (almost full)"}
  {isAtLimit && " (limit reached)"}
</div>
```

**Acceptance criteria**:
- [ ] Counter turns amber at 180 chars
- [ ] Counter turns red at 200 chars
- [ ] Helper text indicates status

---

## Phase 3: Competitive Features (Engagement)

> **Goal**: Add features that competitors have, improve engagement
> **Effort**: 5-7 days | **Impact**: Medium-High

### 3.1 Question Timer
**Priority**: P1 - HIGH
**Files to create**: `src/components/CountdownTimer.tsx`
**Files to modify**: `src/pages/PresenterSession.tsx`, `src/pages/JoinSession.tsx`, `src/types.ts`

**Problem**: No time pressure. Competitors all have countdown timers.

**Implementation**:
```tsx
// src/components/CountdownTimer.tsx
interface CountdownTimerProps {
  endTime: number; // Unix timestamp
  onComplete?: () => void;
  showWarning?: boolean; // Pulse when <10s
}

export function CountdownTimer({ endTime, onComplete, showWarning = true }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));
      setRemaining(diff);
      if (diff === 0) {
        onComplete?.();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, onComplete]);

  const isWarning = showWarning && remaining <= 10 && remaining > 0;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div
      className={`
        font-mono text-2xl font-bold tabular-nums
        ${isWarning ? "text-rose-400 animate-pulse" : "text-slate-100"}
      `}
      aria-live="polite"
      aria-label={`${remaining} seconds remaining`}
    >
      {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}
```

**Session data schema addition**:
```tsx
interface SessionData {
  // ... existing fields
  questionTimeLimit?: number; // seconds (e.g., 30)
  questionStartedAt?: number; // Unix timestamp
}
```

**Presenter controls**:
```tsx
// Add timer controls to PresenterSession
<div className="flex items-center gap-2">
  <button onClick={() => setTimeLimit(30)}>30s</button>
  <button onClick={() => setTimeLimit(60)}>60s</button>
  <button onClick={() => setTimeLimit(null)}>No limit</button>
  <button onClick={() => extendTime(10)}>+10s</button>
</div>
```

**Acceptance criteria**:
- [ ] Presenter can set time limit per question
- [ ] Timer visible on both presenter and participant screens
- [ ] Visual warning at 10 seconds
- [ ] Optional: Audio beep at warning
- [ ] Extend time button adds 10s

---

### 3.2 Sound Effects
**Priority**: P2 - MEDIUM
**Files to create**: `src/services/SoundEffects.ts`, `src/contexts/SoundContext.tsx`
**Assets needed**: `public/sounds/` directory with audio files

**Problem**: App is silent. No audio feedback for actions. Competitors use sound extensively.

**Implementation**:
```tsx
// src/services/SoundEffects.ts
class SoundEffectsService {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled = true;

  constructor() {
    this.enabled = localStorage.getItem("cq_sounds_enabled") !== "false";
  }

  preload() {
    const soundFiles = {
      success: "/sounds/success.mp3",
      streak: "/sounds/streak.mp3",
      correct: "/sounds/correct.mp3",
      incorrect: "/sounds/incorrect.mp3",
      countdown: "/sounds/countdown.mp3",
      rankUp: "/sounds/rank-up.mp3",
    };

    Object.entries(soundFiles).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.preload = "auto";
      this.sounds.set(key, audio);
    });
  }

  play(sound: keyof typeof soundFiles) {
    if (!this.enabled) return;
    const audio = this.sounds.get(sound);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {}); // Ignore autoplay errors
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem("cq_sounds_enabled", String(enabled));
  }
}

export const soundEffects = new SoundEffectsService();
```

**Usage in JoinSession**:
```tsx
// On correct answer
if (session.showResults && selectedChoice === currentQuestion.correctIndex) {
  soundEffects.play("correct");
}

// On streak milestone
if (newStreak === 3) soundEffects.play("streak");
```

**Acceptance criteria**:
- [ ] Success sound on answer submission
- [ ] Correct/incorrect sounds on reveal
- [ ] Streak milestone sound
- [ ] Sound toggle in settings
- [ ] Respects browser autoplay policy
- [ ] Audio files <50KB each (use Web Audio API if needed)

---

### 3.3 Visible Streak Counter
**Priority**: P2 - MEDIUM
**Files to create**: `src/components/StreakCounter.tsx`
**Files to modify**: `src/pages/JoinSession.tsx`

**Problem**: Streak is calculated but hidden. Users don't see their progress.

**Implementation**:
```tsx
// src/components/StreakCounter.tsx
interface StreakCounterProps {
  streak: number;
  multiplier: number;
}

export function StreakCounter({ streak, multiplier }: StreakCounterProps) {
  if (streak < 2) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
      <span className="text-amber-400 text-lg">🔥</span>
      <span className="text-amber-100 text-sm font-semibold">
        {streak} streak
      </span>
      <span className="text-amber-400/80 text-xs font-mono">
        {multiplier}x
      </span>
    </div>
  );
}
```

**Acceptance criteria**:
- [ ] Streak badge appears at 2+ correct
- [ ] Shows current multiplier
- [ ] Animates on increment
- [ ] Resets with animation on break

---

### 3.4 Participation Indicator
**Priority**: P2 - MEDIUM
**Files to modify**: `src/pages/JoinSession.tsx`, `src/components/ResponsesChart.tsx`

**Problem**: Students don't know how many others answered. No social proof.

**Implementation**:
```tsx
// Show "X of Y answered" badge
<div className="flex items-center gap-2 text-sm text-slate-400">
  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
  <span>
    {responseCount} of {participantCount} answered
  </span>
</div>
```

**Acceptance criteria**:
- [ ] Real-time response count visible
- [ ] Shows as percentage and absolute
- [ ] Updates live as responses come in

---

### 3.5 First-Run Tutorial
**Priority**: P3 - LOW
**Files to create**: `src/components/OnboardingTutorial.tsx`
**Files to modify**: `src/pages/JoinSession.tsx`

**Problem**: Voice guide is hidden. First-time users don't know how to use voice.

**Implementation**:
```tsx
// Check if first time
const hasSeenTutorial = localStorage.getItem("cq_tutorial_seen") === "true";

// Show tutorial modal on first join with voice enabled
{!hasSeenTutorial && voice.enabled && (
  <OnboardingTutorial
    onComplete={() => {
      localStorage.setItem("cq_tutorial_seen", "true");
    }}
  />
)}
```

**Acceptance criteria**:
- [ ] Shows on first session join (if voice enabled)
- [ ] 3-4 step walkthrough of voice controls
- [ ] Skip button available
- [ ] Remembers completion in localStorage

---

## Phase 4: Advanced Features (Nice-to-Have)

> **Goal**: Parity with market leaders, delight features
> **Effort**: 7-10 days | **Impact**: Medium

### 4.1 Leaderboard Animations
**Files to modify**: `src/components/TeamScoreboard.tsx`, `src/components/IndividualScoreboard.tsx`

- Animate rank changes (slide up/down)
- Point pop animation (+100 floating up)
- First place glow effect
- Use `framer-motion` or CSS transitions

### 4.2 Achievement System
**Files to create**: `src/types/achievements.ts`, `src/components/AchievementPopup.tsx`

- Define achievement types (First Correct, Perfect Score, 5-Streak, etc.)
- Track in participant doc
- Show popup on unlock
- Badge display in summary

### 4.3 Shareable Results
**Files to create**: `src/components/ShareableResultCard.tsx`

- Screenshot-optimized result card
- Social share buttons (Twitter, LinkedIn)
- Download as PNG
- Include name, score, rank, accuracy

### 4.4 Accessibility Panel
**Files to create**: `src/components/AccessibilitySettings.tsx`, `src/contexts/AccessibilityContext.tsx`

- High contrast mode toggle
- Font size slider (100%, 125%, 150%)
- Reduced motion toggle
- Sound toggle
- Persist preferences in localStorage

### 4.5 Offline Support
**Files to create**: `public/service-worker.ts`, `public/manifest.json`

- PWA manifest for installability
- Service worker for offline capability
- Queue answers when offline, sync when online
- Enable Firebase offline persistence

---

## Technical Debt

### Performance
- [ ] Add `React.memo` to list item components
- [ ] Memoize `questionsMap` in JoinSession
- [ ] Replace shimmer `backgroundPosition` with `translateX`
- [ ] Conditional blur filters on low-end devices

### Consistency
- [ ] Standardize disabled opacity (use 60% everywhere)
- [ ] Standardize button scale transforms
- [ ] Create shared button component library
- [ ] Unify toast styling across app

### Cleanup
- [ ] Fix VoicePatientService visibility listener leak
- [ ] Remove unused imports
- [ ] Add proper TypeScript strict mode compliance

---

## Testing Checklist

### Accessibility
- [ ] Lighthouse accessibility score >90
- [ ] VoiceOver (iOS) full flow test
- [ ] Keyboard-only navigation test
- [ ] Color contrast audit (axe DevTools)

### Performance
- [ ] Bundle size <500KB initial
- [ ] Lighthouse performance score >80
- [ ] Test on 3G throttling
- [ ] Test on low-end Android device

### Cross-Browser
- [ ] Chrome (desktop + mobile)
- [ ] Safari (desktop + iOS)
- [ ] Firefox
- [ ] Edge

### Responsive
- [ ] 320px viewport (iPhone SE)
- [ ] 375px viewport (iPhone 12)
- [ ] 768px viewport (iPad)
- [ ] 1920px viewport (desktop)

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Lighthouse Accessibility | ~75 | >90 | Lighthouse audit |
| Lighthouse Performance | ~65 | >80 | Lighthouse audit |
| Initial Bundle Size | ~400KB | <300KB | `vite build --report` |
| Time to Interactive | ~3s | <2s | Lighthouse |
| Error Rate | Unknown | <1% | Error boundary logging |
| Mobile Voice Usage | Unknown | >70% | Analytics event |

---

## Implementation Order Summary

| Phase | Item | Priority | Effort | Impact |
|-------|------|----------|--------|--------|
| 1 | Error Boundaries | P0 | 2h | Critical |
| 1 | Code Splitting | P0 | 2h | Critical |
| 1 | State Refactor | P1 | 4h | High |
| 1 | Focus Management | P1 | 3h | High |
| 1 | Session Not Found Retry | P1 | 1h | High |
| 2 | Scroll Behavior | P1 | 2h | High |
| 2 | Toast System | P2 | 3h | Medium |
| 2 | Autofocus | P2 | 1h | Medium |
| 2 | Scoreboard Accessibility | P2 | 2h | Medium |
| 2 | Character Limit Warning | P3 | 1h | Low |
| 3 | Question Timer | P1 | 4h | High |
| 3 | Sound Effects | P2 | 4h | Medium |
| 3 | Streak Counter | P2 | 2h | Medium |
| 3 | Participation Indicator | P2 | 2h | Medium |
| 3 | First-Run Tutorial | P3 | 4h | Low |
| 4 | Leaderboard Animations | P3 | 6h | Low |
| 4 | Achievement System | P3 | 8h | Low |
| 4 | Shareable Results | P3 | 4h | Low |
| 4 | Accessibility Panel | P3 | 4h | Low |
| 4 | Offline Support | P3 | 8h | Low |

**Total estimated effort**: ~65 hours (8-10 days)

---

*Updated: December 2024*
*Based on world-class UX audit comparing against Kahoot, Quizlet Live, Mentimeter, Socrative*
