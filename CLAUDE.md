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
└── __tests__/             # 172+ Jest tests
```

## Commands
```bash
npm run dev:tunnel:clean   # Recommended: Cloudflare tunnel (iPhone testing)
npm run dev:stack:local    # Local with Firebase emulators
npm run test:gateway       # Voice gateway tests (172 tests)
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

### Orders System
- EKG: 90-120s delay, tech acknowledgment
- CXR: 180-240s delay
- Duplicate detection: "Still working on current EKG"
- Viewers: EkgViewer (Muse-like), CxrViewer (PACS-like)

### Voice Gateway
- WebSocket at `/ws/voice`
- Heartbeat ping 30s, reconnect with exponential backoff
- Characters: patient, parent, nurse, tech, consultant

### State Visibility
- **Presenter**: Full state (vitals, rhythm, all orders)
- **Participant**: Only ordered data (exam, EKG after request)

## File Quick Reference

| File | Purpose |
|------|---------|
| `src/pages/JoinSession.tsx` | Participant view |
| `src/pages/PresenterSession.tsx` | Presenter view |
| `src/services/VoiceGatewayClient.ts` | WebSocket client |
| `voice-gateway/src/index.ts` | WebSocket server |
| `voice-gateway/src/sim/scenarioEngine.ts` | Scenario state machine |
| `voice-gateway/src/orders.ts` | Order timers, duplicate detection |

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
- `npm run test:gateway` - 172+ gateway tests
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
