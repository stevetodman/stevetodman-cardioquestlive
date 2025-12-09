# CardioQuest Live: UI/UX Improvement Plan (Delta)

> **Note:** This plan builds on the existing simplified voice UX (Sprint 2) which already shipped:
> - Unified VoiceStatusBadge with 4 states (ready/active/waiting/unavailable)
> - Auto take/release floor via hold-to-speak (2s auto-release, 60s idle safety)
> - Advanced options collapsed by default; patient is default target
> - Contextual actions (exam/telemetry/EKG) only shown when actionable
> - Improved error copy with aria-live hints

---

## Sprint 1: Join Flow & Code Input

### 1.1 Smart Code Input
**File:** `src/App.tsx` (Home component, lines 10-67)

**Current state:** Basic `<input>` with `maxLength={4}`, manual uppercase via value transform.

**Changes:**
- [x] Auto-uppercase on input (already done via `toUpperCase()` on submit)
- [x] Add inline validation feedback: green border + checkmark when 4 chars entered
- [x] Shake animation on invalid/not-found submission
- [x] "Join last session" button using `localStorage.getItem('cq_last_join_code')`
- [x] Save successful join code to localStorage on session found

**Acceptance criteria:**
- Typing "abcd" shows green border after 4th char
- Submitting invalid code triggers 300ms shake animation
- If `cq_last_join_code` exists, show "Rejoin [CODE]" button below input
- Clicking rejoin navigates to `/join/{code}`

### 1.2 QR Code Join (Presenter)
**New file:** `src/components/QRCodeOverlay.tsx`
**Modified:** `src/pages/CreateDemoSession.tsx`, `src/pages/PresenterSession.tsx`

**Dependency:** none added (uses `src/utils/simpleQr` to render inline SVG QR)

**Changes:**
- [x] Add QR code display on CreateDemoSession showing full join URL
- [x] Add "Show QR" toggle button to PresenterSession header
- [x] QR overlay: centered modal with large QR, join code text, close button
- [x] QR encodes: `https://cardioquestlive.com/#/join/{CODE}` (hash URL)

**Acceptance criteria:**
- QR code renders at 256x256px minimum
- Scanning with phone camera opens join page
- Toggle button shows/hides overlay without page refresh
- Works with current hash router (no hosting changes needed)

### 1.3 Copy Session Link
**File:** `src/pages/CreateDemoSession.tsx`, `src/pages/PresenterSession.tsx`

**Changes:**
- [x] Add "Copy Link" button next to join code display
- [x] Use `navigator.clipboard.writeText()` with fallback
- [x] Show "Copied!" toast for 1.5s on success

**Acceptance criteria:**
- Button copies full URL to clipboard
- Works on iOS Safari (uses `navigator.share()` as fallback if available)
- Visual feedback confirms action

---

## Sprint 2: Mobile Voice Layout

### 2.1 Collapsible Voice Panel
**File:** `src/pages/JoinSession.tsx` (voice section, lines 672-1018)

**Current state:** Voice section is ~350 lines, always expanded on mobile, pushes slide off-screen.

**Changes:**
- [x] Wrap voice section in collapsible container
- [x] Collapsed state: single row with status badge + "Hold to speak" button
- [x] Tap anywhere on collapsed bar to expand
- [x] Persist expanded/collapsed preference in localStorage
- [x] Default: collapsed on mobile (<640px), expanded on desktop

**Component structure:**
```tsx
// src/components/CollapsibleVoicePanel.tsx
interface Props {
  isExpanded: boolean;
  onToggle: () => void;
  statusBadge: React.ReactNode;
  children: React.ReactNode; // full controls when expanded
}
```

**Acceptance criteria:**
- On 375px viewport, collapsed panel is ~64px tall
- Expanding shows full controls with 300ms slide animation
- Collapsing preserves scroll position
- HoldToSpeakButton works in both states

### 2.2 Floating Mic Button (Mobile)
**New file:** `src/components/FloatingMicButton.tsx`
**Modified:** `src/pages/JoinSession.tsx`

**Changes:**
- [x] On mobile (<640px), show floating mic button (56px circle) in bottom-right
- [x] Position: `bottom: calc(16px + env(safe-area-inset-bottom))`, `right: 16px`
- [x] Button states mirror HoldToSpeakButton (idle/requesting/recording/disabled)
- [x] Hold behavior identical to existing HoldToSpeakButton
- [x] Hide inline HoldToSpeakButton when FAB is visible

**Acceptance criteria:**
- FAB is always visible above fold on mobile
- Does not overlap answer buttons or slide content
- Recording state shows emerald pulse ring
- Works with iOS safe area insets

### 2.3 Slide-First Layout (Mobile)
**File:** `src/pages/JoinSession.tsx`

**Current state:** Layout is `flex-col` with voice section before question.

**Changes:**
- [x] On mobile, reorder: header → slide/question → collapsible voice panel
- [x] Use CSS `order` or conditional rendering based on viewport
- [x] Ensure question is always visible without scrolling when voice collapsed

**Acceptance criteria:**
- On 667px viewport (iPhone SE), question card is fully visible with voice collapsed
- Answer buttons are tappable without scrolling
- Voice panel expands below question area

---

## Sprint 3: Loading & Performance

### 3.1 Skeleton Loading (Session Join)
**New file:** `src/components/SessionSkeleton.tsx`
**Modified:** `src/pages/JoinSession.tsx` (lines 428-434)

**Current state:** Shows "Connecting to session..." text with `animate-pulse`.

**Changes:**
- [x] Replace text with skeleton UI matching final layout:
  - Header bar skeleton (logo + code badge + status)
  - Voice panel skeleton (status badge shape + button shape)
  - Question card skeleton (stem lines + 4 option rectangles)
- [x] Use shimmer animation (not just pulse)

**Skeleton structure:**
```tsx
// src/components/SessionSkeleton.tsx
export function SessionSkeleton() {
  return (
    <div className="animate-shimmer">
      <div className="h-14 bg-slate-800 rounded" /> {/* header */}
      <div className="mt-4 h-24 bg-slate-900 rounded-xl" /> {/* voice */}
      <div className="mt-4 space-y-3">
        <div className="h-6 bg-slate-800 rounded w-3/4" /> {/* stem */}
        <div className="h-14 bg-slate-900 rounded-xl" /> {/* option */}
        <div className="h-14 bg-slate-900 rounded-xl" />
        <div className="h-14 bg-slate-900 rounded-xl" />
        <div className="h-14 bg-slate-900 rounded-xl" />
      </div>
    </div>
  );
}
```

**Acceptance criteria:**
- Skeleton appears within 50ms of page load
- Layout matches actual content dimensions (no layout shift)
- Shimmer animation runs at 60fps

### 3.2 Optimistic Answer Submission
**File:** `src/pages/JoinSession.tsx` (handleChoice, lines 552-618)

**Current state:** Sets `submitting=true`, waits for Firestore, then updates UI.

**Changes:**
- [x] Immediately set `selectedChoice` on click (before Firestore)
- [x] Show "Answer Recorded" badge immediately
- [x] On Firestore error, reset `selectedChoice` and show error toast
- [x] Add error state: `const [submitError, setSubmitError] = useState<string | null>(null)`

**Acceptance criteria:**
- Visual feedback appears <50ms after tap
- Error state reverts selection and shows actionable message
- Score calculation still happens after Firestore confirms

---

## Sprint 4: Error Recovery

### 4.1 Rich Mic Error Panel
**File:** `src/components/ParticipantVoiceStatusBanner.tsx`

**Current state:** Shows error text with "Re-check mic" or "Retry voice" buttons.

**Changes:**
- [x] Expand blocked mic state to include step-by-step instructions
- [x] Add browser-specific hints (Chrome vs Safari vs Firefox)
- [x] Add "Use text instead" option that shows text input field
- [x] Persist text fallback preference in localStorage

**Design:**
```
┌─────────────────────────────────────────────────┐
│ Microphone Access Needed                        │
│                                                 │
│ Your browser blocked mic access. To fix:       │
│                                                 │
│ 1. Tap the lock icon in your address bar       │
│ 2. Select "Allow" for microphone               │
│ 3. Tap "Try Again" below                       │
│                                                 │
│ [Try Again]  [Type Questions Instead]          │
└─────────────────────────────────────────────────┘
```

**Acceptance criteria:**
- Instructions are browser-aware (detect via userAgent)
- "Type Questions Instead" shows inline text input
- Text input sends to gateway via existing `sendVoiceCommand`

### 4.2 Text Fallback Input
**New file:** `src/components/TextQuestionInput.tsx`
**Modified:** `src/pages/JoinSession.tsx`

**Changes:**
- [x] Create text input component for voice fallback
- [x] Show when: fallback mode active OR user chose text mode
- [x] Submit sends typed question to Firestore voiceCommands (order payload) and shows confirmation
- [x] Clear input on submit, show "Sent" confirmation

**Acceptance criteria:**
- Input has 200 char limit with counter
- Submit on Enter or button click
- Disabled while waiting for AI response
- Works when voice gateway is in fallback mode

---

## Sprint 5: Accessibility Audit

### 5.1 Focus Management
**Files:** All modal/overlay components

**Checklist:**
- [ ] `SessionSummary` modal: trap focus, return focus on close
- [ ] QR overlay: trap focus, close on Escape
- [ ] Collapsible voice panel: focus first interactive element on expand
- [ ] Add skip link to main content in header

**Testing:**
- Tab through entire join flow with keyboard only
- Verify focus visible on all interactive elements
- Test with VoiceOver on iOS, TalkBack on Android

### 5.2 Screen Reader Announcements
**Files:** `src/components/VoiceStatusBadge.tsx`, `src/pages/JoinSession.tsx`

**Current state:** `aria-live="polite"` on status badge.

**Changes:**
- [ ] Announce question open/close: "Question now open for answers"
- [ ] Announce voice state changes: "Recording started", "Patient is responding"
- [ ] Announce correct answer reveal: "Correct answer is B"
- [ ] Add `role="status"` to toast messages

**Acceptance criteria:**
- VoiceOver announces all state changes without visual focus
- No duplicate announcements
- Announcements are concise (<50 chars)

### 5.3 Color Contrast Audit
**Tool:** axe DevTools, Lighthouse

**Checklist:**
- [ ] `text-slate-400` on `bg-slate-900`: verify 4.5:1 ratio
- [ ] `text-slate-500` labels: may need to lighten to `text-slate-400`
- [ ] `text-sky-400` on dark backgrounds: verify contrast
- [ ] Disabled button states: ensure distinguishable

**Acceptance criteria:**
- Lighthouse accessibility score >90
- No WCAG AA failures for text contrast
- All interactive elements have visible focus state

---

## Sprint 6: Polish & Delight

### 6.1 Haptic Feedback
**File:** `src/components/HoldToSpeakButton.tsx`, `src/pages/JoinSession.tsx`

**Changes:**
- [ ] Add haptic on recording start: `navigator.vibrate?.(30)`
- [ ] Add haptic on recording stop: `navigator.vibrate?.(50)`
- [ ] Respect `prefers-reduced-motion` media query
- [ ] No-op gracefully on iOS Safari (vibrate not supported)

**Acceptance criteria:**
- Android Chrome: vibrates on start/stop
- iOS Safari: no errors, silent no-op
- Reduced motion: haptics disabled

### 6.2 Answer Feedback Animation
**File:** `src/pages/JoinSession.tsx` (answer buttons, lines 1056-1087)

**Changes:**
- [ ] On correct answer reveal: brief green pulse on correct option
- [ ] On selection: subtle scale animation (0.98 → 1.0)
- [ ] Respect `prefers-reduced-motion`

**Acceptance criteria:**
- Animations complete in <300ms
- No layout shift during animation
- Static alternative for reduced motion users

---

## Technical Notes

### Breakpoints
- Mobile: <640px (Tailwind `sm:` breakpoint)
- Desktop: >=640px

### localStorage Keys
- `cq_live_user_id` (existing)
- `cq_last_join_code` (new)
- `cq_voice_panel_expanded` (new)
- `cq_prefer_text_input` (new)

### New Dependencies
- `qrcode.react` (8KB gzipped) - for QR generation

### No New Dependencies Needed For
- Collapsible panel (CSS + state)
- Floating mic button (existing HoldToSpeakButton logic)
- Skeletons (Tailwind classes)
- Haptics (native API)
- Focus trap (manual implementation or existing pattern)

---

## What This Plan Does NOT Include

These items from the original plan are **already implemented** or **not needed**:

| Item | Status |
|------|--------|
| Unified voice status badge | Already shipped (VoiceStatusBadge) |
| Auto take/release floor | Already shipped (hold-to-speak) |
| Hide advanced options | Already shipped (collapsed by default) |
| Contextual quick actions | Already shipped (only show when actionable) |
| Remove manual floor buttons | Already shipped |
| Improved error messages | Partially shipped; Sprint 4 extends |

These items are **deferred** pending further requirements:

| Item | Reason |
|------|--------|
| Clean URLs (/j/ABCD) | Requires hosting rewrite rules; hash router works |
| Global hold-to-speak (anywhere) | Risk of conflicting with scroll/buttons; needs UX research |
| Voice onboarding modal | May not be needed with simplified UX; test first |
| Bottom sheet with snap points | Complex; collapsible panel may suffice |
| Achievement animations | Nice-to-have after core UX is solid |
| Sound design | Requires audio assets and user preference system |

---

## Success Metrics

| Metric | How to Measure | Target |
|--------|----------------|--------|
| Time to join | Timer from home page to session loaded | <5s |
| Mobile voice usage | % of mobile users who use voice at least once | >70% |
| Mic error recovery | % of mic blocked users who successfully retry | >50% |
| Accessibility score | Lighthouse audit | >90 |

---

## Next Steps

1. [ ] Create tickets for Sprint 1 items
2. [ ] Install `qrcode.react` dependency
3. [ ] Implement smart code input (1.1) as first PR
4. [ ] Test on mobile devices (iOS Safari, Android Chrome)
5. [ ] Run accessibility audit to establish baseline

---

*Updated: December 2024*
*Based on codebase state after Sprint 2 voice UX simplification*
