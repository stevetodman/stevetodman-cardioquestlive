# CardioQuest Live Architecture

This guide is a quick map for developers joining the project. It highlights where core pieces live and how data flows.

## Core components

- **Presenter**: `src/pages/PresenterSession.tsx`
  - Renders the current session slide (Gemini-styled HTML) in an aspect-ratio container.
  - Poll overlay lives inside the slide; controls are in the top bar. Nav uses arrows/Space.
  - Slide HTML is trusted (`dangerouslySetInnerHTML`) and comes from session data.

- **Admin**: `src/pages/AdminDeckEditor.tsx`
  - Edits `slide.html` strings (templates, snippets, paste-to-image, live preview).
  - Saves decks to Firestore (`configs/deck`) via `deckService`.

- **Decks**: `src/data/case1Deck.ts`–`case11Deck.ts`, `src/data/ductalDeck.ts`
  - Gemini-styled slides + questions. Sessions pull from these to seed data.

- **Gamification**:
  - Participants tracked in `sessions/{sessionId}/participants/{userId}` with team, points, streak, correctness counts, `inactive` status.
  - Presenter overlays (team + individual scoreboards) subscribe to participants.
  - Scoring is session-only and first-answer-only per question.
  - **Scoring formula** (`src/utils/scoringUtils.ts`): `100 × streak_bonus × time_bonus`
    - Time bonus: ≤5s = 1.3×, ≤10s = 1.15×, >10s = 1.0×
    - Streak bonus: 2 correct = 1.1×, 3 = 1.2×, 4+ = 1.5× (max)
  - **Empty teams hidden**: `useTeamScores` filters teams with 0 members.
  - **Inactive tracking**: Participants marked inactive on tab close/hide; shown as "(away)" in leaderboards.
  - **Random names**: Anonymous users assigned medical-themed names (`src/utils/names.ts`).
  - **Session wrap-up**: `SessionWrapUp` component shows answer recap, top team/player, accuracy.

- **Shared helpers**:
  - `src/utils/interactiveTiles.ts`: presenter-only interactive clue tiles; participant tiles remain static.
  - `src/utils/geminiHeader.ts`: compact header for Gemini slides.
  - `src/styles/cq-theme.css`: shared slide styling (cards, tiles, nav, images).

- **Session creation**: `src/pages/CreateDemoSession.tsx`
  - Uses `createInitialSessionData` (from `ductalDeck.ts`) and adds `createdBy` to create a Firestore session.

## Data model (Firestore)

- `sessions/{sessionId}`: session metadata
  - Fields: `createdBy`, `joinCode`, `slides`, `questions`, `currentSlideIndex`, `currentQuestionId`, `showResults`, `createdAt`, `title`.
  - Security: only creator or admin can update/delete; shape validated in `firestore.rules`.
- `sessions/{sessionId}/responses/{responseId}`: poll responses
  - `responseId = "{uid}_{questionId}"` to enforce one response per user/question.
  - Fields: `userId`, `questionId`, `choiceIndex`, `createdAt`, `sessionId`.
  - Security: user can create/update their own deterministic doc; reads require auth.
- `sessions/{sessionId}/participants/{userId}`: participant state for gamification
  - Fields: `userId`, `sessionId`, `teamId`, `teamName`, `points`, `streak`, `correctCount`, `incorrectCount`, `createdAt`, `role?` (`"member"` | `"lead"`), `displayName?`, `inactive?` (true when tab hidden/closed).
  - Security: any authenticated user can read; only the user can write their own doc with validated shape.
- `sessions/{sessionId}/teamMessages/{messageId}`: team chat messages
  - Fields: `userId`, `teamId`, `text`, `createdAt`, `senderName?`.
  - Security: only users on the same team can read/write (enforced via `isSameTeam()` helper in rules).
  - 500-character limit enforced in rules.
- `configs/{...}`: deck/config documents
  - Admin-only writes; reads require auth.

## Data flow

1. Deck is authored in `src/data/*Deck.ts`.
2. Admin can edit deck via `/#/admin` and save to `configs/deck`.
3. Session is created (`CreateDemoSession`) from the deck: writes `sessions/{sessionId}` with slides/questions and state fields.
4. Presenter (`/#/presenter/:sessionId`) reads the session and renders slides; polls are opened/shown via top-bar controls.
5. Participants submit responses; responses are stored under `sessions/{sessionId}/responses/{uid_questionId}` and streamed to presenter/participants.
6. Scoring: on first submission per user/question, participant doc is updated (points/streak/correct/incorrect). Team scores derive from participant points.
7. Presenter overlays subscribe to participants to show team standings and top individuals.

## Notes

- Slides are raw HTML strings; no sanitizer is applied in presenter. Keep content trusted.
- Interactive clue tiles are a presenter affordance; participant view is static unless explicitly built otherwise.
- Firestore security rules mirror the above model (`firestore.rules`).

## Voice gateway (overview)

- **Transport**: `voice-gateway/src/transport.ts` boots the WebSocket server at `/ws/voice`.
- **Orchestration**: `voice-gateway/src/index.ts` wires message handling, scenarios, orders, telemetry, and safety; `orchestrator.ts` coordinates message flow.
- **Domain modules**:
  - Safety/rate limits: `autoReplyGuard.ts`, `speechHelpers.ts`.
  - Orders/telemetry: `orders.ts`, `telemetry.ts`, `assetUtils.ts`.
  - State/persistence: `sim/scenarioEngine.ts`, `persistence.ts`, `messageTypes.ts`, `validators.ts`.
  - OpenAI integrations: `sttClient.ts`, `ttsClient.ts`, `debriefAnalyzer.ts`, `openaiClient.ts`.
  - **Order parsing**: `orderParser.ts` - Parses free-text orders from learner speech, returns nurse clarification prompts.
  - **Physiology engine**: `sim/physiologyEngine.ts` - Deterministic rules for complex scenarios (fluid overload, inotrope response, intubation collapse).
- **Tests**: `npm run test:gateway` runs gateway/unit behavior; page tests cover basic presenter flows; rules tests via `npm run test:rules` (or `test:rules:ports` with env overrides if ports are blocked).

## Interventions system

Physical interventions applied to the patient are tracked in `state.interventions` and rendered on the patient figure.

### Supported interventions
| Intervention | Schema | Example |
|-------------|--------|---------|
| IV access | `{ location, gauge?, fluidsRunning?, fluidType? }` | `{ location: "right_ac", gauge: 22 }` |
| Oxygen | `{ type, flowRateLpm? }` | `{ type: "nasal_cannula", flowRateLpm: 2 }` |
| Defib pads | `{ placed: boolean }` | `{ placed: true }` |
| Monitor | `{ leads: boolean }` | `{ leads: true }` |
| NG tube | `{ placed: boolean }` | `{ placed: true }` |
| Foley | `{ placed: boolean }` | `{ placed: true }` |

### Data flow
1. **Order placed**: Learner requests "IV access" via voice command or order
2. **Gateway processes**: `orders.ts` schedules order, updates `state.interventions` via `updateIntervention()`
3. **State broadcast**: `broadcastSimState()` includes validated `interventions` field
4. **Client receives**: `VoiceGatewayClient.ts` passes `interventions` to sim state listeners
5. **UI renders**: `PatientStatusOutline` component shows intervention indicators on patient figure

### Order types
```typescript
type OrderType = "vitals" | "ekg" | "labs" | "imaging"
               | "cardiac_exam" | "lung_exam" | "general_exam" | "iv_access";
```

### Exam visibility gating
Exam findings (general, cardio, lungs, perfusion, neuro) are only shown after the learner orders the corresponding exam:
- `cardiac_exam` → reveals `exam.cardio` + heart audio
- `lung_exam` → reveals `exam.lungs` + lung audio
- `general_exam` → reveals `exam.general`, `exam.perfusion`, `exam.neuro`

Both presenter and participant views gate exam data behind completed orders.

## Complex scenarios architecture

The `peds_myocarditis_silent_crash` scenario introduces a new architecture pattern for high-fidelity simulations:

### Scenario directory structure
```
voice-gateway/src/sim/scenarios/peds_myocarditis_silent_crash/
  index.ts           # Main exports
  definition.ts      # ScenarioDef with phases, vitals, exam
  results.ts         # Lab/imaging results (troponin, BNP, ECG, echo)
  triggers.ts        # Deterministic NPC lines (nurse/parent/patient)
  scoring.ts         # Pass/fail checklist + point system
```

### Key components
- **Physiology engine** (`physiologyEngine.ts`): Deterministic rules that modify vitals/state based on interventions
- **Order parser** (`orderParser.ts`): Free-text order recognition with nurse clarification prompts
- **Scoring system** (`scoring.ts`): 5-item checklist (need 4/5 to pass) + bonus/penalty points
- **Debrief analyzer** (`debriefAnalyzer.ts`): Enhanced with timeline, scoring breakdown, scenario-specific feedback

### State model
Complex scenarios use `MyocarditisExtendedState` to track:
- Current phase and shock stage (1-5)
- Fluid totals, inotropes, airway status
- Ordered diagnostics, consults called
- Timeline events, bonuses/penalties earned

## Simulation visualization components

### RhythmWaveform (`src/components/RhythmWaveform.tsx`)
Real-time animated ECG waveform using Canvas API:
- **Rhythm detection**: Parses rhythm summary to identify type (sinus, SVT, VTach, VFib, AFib, asystole, PEA, heart_block)
- **Dynamic patterns**: Generates rhythm-specific waveform shapes
- **HR-based timing**: Adjusts wave speed based on current heart rate
- **Color coding**: Emerald (normal), amber (concerning), red (critical)
- **Flash animation**: Visual highlight on rhythm changes

### CodeBluePanel (`src/components/CodeBluePanel.tsx`)
Resuscitation management interface:
- **Auto-detection**: Activates on VFib, VTach, Asystole, or PEA rhythms
- **Timers**: Code duration and 2-minute pulse check countdown
- **PALS checklist**: Interactive protocol steps
- **Pathway guidance**: Shockable vs non-shockable algorithms
- **CPR metronome integration**: Embedded compact metronome

### CPRMetronome (`src/components/CPRMetronome.tsx`)
Audio-visual CPR timing assistance:
- **Web Audio API**: Generates beep sounds at target rate
- **Target rate**: 110 BPM (PALS standard: 100-120/min)
- **Visual pulse**: Animated beat indicator
- **Tap-to-track**: Manual compression rate feedback
- **Volume control**: Adjustable audio level
- **Compact mode**: `CPRMetronomeMini` for embedding

### VitalsMonitor (`src/components/VitalsMonitor.tsx`)
Enhanced with rhythm visualization:
- **Animated waveform**: Integrates RhythmWaveform component
- **Event-driven highlighting**: Amber glow on significant vitals changes
- **Telemetry toggle**: Switch between animated and static waveform
