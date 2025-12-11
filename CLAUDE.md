# CardioQuest Live

Pediatric cardiology teaching platform with AI patient simulation.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind
- **Backend**: Node.js voice-gateway (WebSocket), Firebase (Firestore, Auth)
- **AI**: OpenAI GPT-4 for patient/NPC responses

## Directory Structure
```
src/
├── pages/                 # JoinSession (participant), PresenterSession (presenter)
├── components/
│   ├── presenter/         # PresenterSimControls, GamificationControls, PresenterSlidesOverlays
│   ├── participant/       # QuickActionsBar, CharacterSelector
│   └── ui/                # CardPanel, SectionLabel, VitalsGrid (reusable)
├── hooks/                 # useVoiceState, useTeamChat, useTeamLead, etc.
├── services/              # VoiceGatewayClient (WebSocket), voiceCommands
├── types/                 # voiceGateway, simulationState, voiceCommands
└── styles/                # constants.ts (Tailwind compositions)

voice-gateway/
├── src/
│   ├── index.ts           # WebSocket server entry
│   ├── sim/
│   │   ├── scenarioEngine.ts    # Scenario state machine
│   │   ├── scenarios/           # teen_svt_complex, peds_myocarditis_silent_crash
│   │   └── triggers/types.ts    # Shared trigger types
│   └── orders.ts          # Order system with realistic timers
│   └── debriefAnalyzer.ts     # Complex scenario debrief (SVT/myocarditis)
└── __tests__/             # 200+ Jest tests
```

## Commands
```bash
npm run dev:tunnel:clean   # Recommended: Cloudflare tunnel (iPhone testing)
npm run dev:stack:local    # Local with Firebase emulators
npm run test:gateway       # Voice gateway tests (200 tests)
npm run build              # TypeScript + Vite build

# Run scenario without WebSocket
cd voice-gateway && npm run scenario teen_svt_complex_v1
cd voice-gateway && npm run scenario peds_myocarditis_silent_crash_v1
```

## Key Concepts

### Presenter Modes
Two mutually exclusive modes (`presenterMode.ts`):
- **slides**: Presentation with questions, scores, gamification
- **sim**: Patient simulation with vitals, voice, interventions

### Scenarios
12 pediatric cases. Complex scenarios:
- `teen_svt_complex_v1`: PALS SVT algorithm (vagal → adenosine → cardioversion)
- `peds_myocarditis_silent_crash_v1`: Fulminant myocarditis with shock staging

### Complex Scenario Scoring & Debrief
When `analyze_transcript` is called for SVT or myocarditis scenarios:
- Gateway detects complex scenario via `scenarioId` and `extendedState`
- Runs deterministic scoring (checklist 4/5 to pass, bonuses, penalties)
- Generates AI summary via `analyzeComplexScenario` in `debriefAnalyzer.ts`
- Broadcasts `complex_debrief_result` with grade (A-F), timeline, feedback
- Presenter sees `ComplexDebriefPanel` modal with full debrief

**Scoring Formula**:
- Base: 50 pts + Checklist (10 pts each, max 50) + Bonuses - Penalties
- Pass: 4/5 checklist items required
- Grades: A (90+), B (80-89), C (70-79), D (60-69), F (<60 or failed checklist)

**SVT Checklist**: ECG ordered, vagal attempted, adenosine ±10%, monitor on, patient reassured
**Myocarditis Checklist**: Cardiac markers, fluids ≤40mL/kg, PICU timely, safe intubation, cardiology consult

### Orders System
- **Order types**: vitals, ekg, labs, imaging, cardiac_exam, lung_exam, general_exam, iv_access
- **Timing**: EKG 90-120s delay, CXR 180-240s delay, exams instant
- **Tech acknowledgment**: NPC confirms order receipt
- **Duplicate detection**: "Still working on current EKG"
- **Viewers**: EkgViewer (Muse-like), CxrViewer (PACS-like)
- **Interventions**: IV orders update `state.interventions`, rendered on patient figure

### Voice Gateway
- WebSocket at `/ws/voice`
- Heartbeat ping 30s, reconnect with exponential backoff
- Characters: patient, parent, nurse, tech, consultant

### State Visibility
- **Presenter**: Full state (vitals, rhythm, all orders, interventions)
- **Participant**: Only ordered data (exam, EKG after request)
- **Exam gating**: Exam findings only visible after corresponding exam order completes
- **Interventions**: Shared between presenter and participant (IV, O2, defib pads, monitor, NG, foley, ETT)

### Gamification & Scoring
- **Scoring formula**: `100 × streak_bonus × time_bonus`
  - Time bonus: ≤5s = 1.3×, ≤10s = 1.15×, >10s = 1.0×
  - Streak bonus: 2 correct = 1.1×, 3 = 1.2×, 4+ = 1.5×
  - Max per question: 195 points
- **Team scores**: Sum of all team member points
- **Individual scores**: Per-participant with streak tracking
- **Empty teams**: Hidden from UI until they have members
- **Inactive status**: Participants marked "away" when tab hidden/closed
- **Random names**: Anonymous users get medical-themed names (e.g., "Swift Atrium")

### Session Wrap-Up
- `SessionWrapUp` component shows at end of slides deck
- Answer recap with correct options and rationale
- Score snapshot: top team, top player, overall accuracy
- Toggle via "Session summary" button in presenter view

## File Quick Reference

| File | Purpose |
|------|---------|
| `src/pages/JoinSession.tsx` | Participant view |
| `src/pages/PresenterSession.tsx` | Presenter view |
| `src/services/VoiceGatewayClient.ts` | WebSocket client |
| `src/utils/scoringUtils.ts` | Scoring formula (streak, time bonus) |
| `src/utils/names.ts` | Random name generator for anonymous users |
| `src/components/SessionWrapUp.tsx` | End-of-session answer recap + scores |
| `src/hooks/useTeamScores.ts` | Team scores (filters empty teams) |
| `src/hooks/useIndividualScores.ts` | Individual leaderboard with inactive status |
| `voice-gateway/src/index.ts` | WebSocket server |
| `voice-gateway/src/sim/scenarioEngine.ts` | Scenario state machine |
| `voice-gateway/src/orders.ts` | Order timers, duplicate detection, interventions |
| `voice-gateway/src/validators.ts` | Zod schemas for sim_state, interventions |
| `voice-gateway/src/messageTypes.ts` | OrderType, ClientToServerMessage types |
| `voice-gateway/src/debriefAnalyzer.ts` | Complex scenario debrief (SVT/myocarditis scoring + AI) |
| `src/components/ComplexDebriefPanel.tsx` | Modal showing grade, checklist, timeline, feedback |
| `src/components/PatientStatusOutline.tsx` | Patient figure with intervention indicators (IV, O2, ETT, etc.) |

## Component Patterns

### Reusable UI (`src/components/ui/`)
```tsx
import { CardPanel, SectionLabel, VitalsGrid } from "../components/ui";

<CardPanel title="Orders" variant="dark" padding="md">
  {content}
</CardPanel>

<SectionLabel>Exam Findings</SectionLabel>

<VitalsGrid hr={120} bp="90/60" spo2={94} rr={28} />
```

### Style Constants (`src/styles/constants.ts`)
```tsx
import { LABEL_XS, CARD, BTN_PRIMARY, BADGE_SUCCESS } from "../styles/constants";
```

## Testing
- `npm run test:gateway` - 200+ gateway tests
- `npm run build` - TypeScript check
- `firebase emulators:exec` - Firestore rules tests

## Environment
```bash
# Frontend (.env.local)
VITE_FIREBASE_*
VITE_VOICE_GATEWAY_URL

# Voice Gateway (voice-gateway/.env)
OPENAI_API_KEY
PORT=8081
```
