# CardioQuest Live

Pediatric cardiology teaching platform with AI patient simulation.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind
- **Backend**: Node.js voice-gateway (WebSocket), Firebase (Firestore, Auth)
- **AI**: OpenAI GPT-4 for patient/NPC responses, TTS for character voices

## Commands
```bash
npm run dev:tunnel:clean   # Recommended: Cloudflare tunnel (iPhone testing)
npm run dev:stack:local    # Local with Firebase emulators
npm run test:gateway       # Voice gateway tests (327+ tests)
npm run build              # TypeScript + Vite build
npm run lint               # ESLint check
npm run typecheck          # TypeScript check (frontend + gateway)

# Run scenario without WebSocket
cd voice-gateway && npm run scenario teen_svt_complex_v1
```

## Directory Structure
```
src/
├── pages/           # JoinSession (participant), PresenterSession (presenter)
├── components/      # presenter/, participant/, ui/
├── contexts/        # SimulationContext, UIStateContext, DebriefContext
├── hooks/           # useVoiceState, useTeamChat, useTeamLead
├── services/        # VoiceGatewayClient (WebSocket)
└── styles/          # constants.ts (Tailwind compositions)

voice-gateway/src/
├── index.ts                    # WebSocket server entry
├── orders.ts                   # Order system with TTS, timers, interventions
├── validators.ts               # Zod schemas (all 12 scenario IDs)
├── voiceConfig.ts              # Unified character voice mapping
├── stateLock.ts                # Async mutex for state synchronization
├── extendedStateValidators.ts  # Zod schemas for SVT/myocarditis extended state
├── persistence.ts              # Firestore state persistence + hydration
├── ttsClient.ts                # OpenAI TTS (alloy, echo, fable, onyx, nova, shimmer)
├── debriefAnalyzer.ts          # Complex scenario scoring + AI debrief
└── sim/
    ├── scenarioEngine.ts       # State machine
    ├── costController.ts       # Budget tracking with soft/hard limits
    └── scenarios/              # teen_svt_complex, peds_myocarditis_silent_crash
```

## Key Concepts

### Presenter Modes
Two mutually exclusive modes:
- **slides**: Presentation with questions, scores, gamification
- **sim**: Patient simulation with vitals, voice, interventions

### Orders System
| Order Type | Timing | Character |
|------------|--------|-----------|
| vitals | instant | nurse |
| ekg | 90-120s | tech |
| labs | instant | nurse |
| imaging/cxr | 180-240s | imaging |
| cardiac_exam | instant | nurse |
| lung_exam | instant | nurse |
| general_exam | instant | nurse |
| iv_access | 45-75s | nurse |

Features: TTS acknowledgment, duplicate detection, order persistence via `hydrate()`.

### Voice Gateway
- WebSocket: `/ws/voice` on port 8081
- Characters: patient, parent, nurse, tech, consultant, imaging
- TTS voices (OpenAI): alloy, echo, fable, onyx, nova, shimmer
- Non-patient utterances cancel patient response via `response.cancel`
- Heartbeat 30s, auto-reconnect with exponential backoff

### State Visibility
| Role | Sees |
|------|------|
| Presenter | Full state (vitals, rhythm, orders, interventions, extended) |
| Participant | Only ordered data (exam after request, EKG after order) |

Both roles see interventions (IV, O2, defib pads, monitor, NG, foley, ETT).

### Complex Scenarios
Two scenarios with deterministic scoring and AI debrief:
- `teen_svt_complex_v1`: PALS SVT algorithm (vagal → adenosine → cardioversion)
- `peds_myocarditis_silent_crash_v1`: Fulminant myocarditis with shock staging

**Scoring**: Base 50 + Checklist (10 pts × 5) + Bonuses - Penalties
**Pass**: 4/5 checklist items
**Grades**: A (90+), B (80-89), C (70-79), D (60-69), F (<60)

### Gamification
- **Formula**: `100 × streak_bonus × time_bonus` (max 195 pts/question)
- **Time bonus**: ≤5s = 1.3×, ≤10s = 1.15×, >10s = 1.0×
- **Streak bonus**: 2 = 1.1×, 3 = 1.2×, 4+ = 1.5×
- Teams auto-assigned, inactive participants marked "away"

### State Management

#### React Contexts
State extracted into `src/contexts/`: SimulationContext, UIStateContext, DebriefContext.

#### Extended State Validation
Complex scenarios (SVT, myocarditis) use validated extended state:
- `extendedStateValidators.ts`: Zod schemas for SVT/myocarditis phases, treatments
- Validation on persist (before Firestore write) and hydrate (after Firestore read)
- Warnings logged for consistency issues (out-of-order timestamps, etc.)

#### State Synchronization
- `stateLock.ts`: Async mutex prevents race conditions during state updates
- SVT phase ticks and treatments are serialized per session
- Multi-session operations run in parallel (different lock keys)

#### Budget Control
- `costController.ts`: Tracks OpenAI API costs per session
- Soft limit: Triggers `throttled` flag (presenter can continue)
- Hard limit: Triggers `fallback` flag (session switches to fallback mode)
- `resetSoftLimit()`: Allows presenter to continue past soft limit

#### Realtime Reconnection
- Automatic reconnection with exponential backoff (3 attempts: 2s, 4s, 8s)
- `fallback` flag set during disconnect, cleared on successful reconnect
- Clients notified via broadcast on recovery

## File Reference

| File | Purpose |
|------|---------|
| [JoinSession.tsx](src/pages/JoinSession.tsx) | Participant view |
| [PresenterSession.tsx](src/pages/PresenterSession.tsx) | Presenter view |
| [VoiceGatewayClient.ts](src/services/VoiceGatewayClient.ts) | WebSocket client |
| [index.ts](voice-gateway/src/index.ts) | Gateway server, phase transitions |
| [orders.ts](voice-gateway/src/orders.ts) | Order handling, TTS, interventions |
| [validators.ts](voice-gateway/src/validators.ts) | Zod schemas for all scenarios |
| [scenarioEngine.ts](voice-gateway/src/sim/scenarioEngine.ts) | State machine |
| [debriefAnalyzer.ts](voice-gateway/src/debriefAnalyzer.ts) | Complex scenario scoring |

## Environment
```bash
# Frontend (.env.local)
VITE_FIREBASE_*
VITE_VOICE_GATEWAY_URL

# Voice Gateway (voice-gateway/.env)
OPENAI_API_KEY
PORT=8081
```

## Testing
```bash
npm run test:gateway       # 327+ gateway tests
npm run build              # TypeScript + Vite build
npm run lint               # ESLint check
npm run typecheck          # TypeScript check (frontend + gateway)
firebase emulators:exec    # Firestore rules tests
```

### Test Coverage
| Area | Tests | Coverage |
|------|-------|----------|
| Gateway core | 200+ | ~60% |
| SVT scenario | 100+ | Phase transitions, scoring, triggers |
| Myocarditis | 50+ | Shock staging, interventions |
| State validation | 50+ | Extended state schemas, hydration |
| Race conditions | 12 | Concurrent operations, state locking |
| Budget control | 8 | Soft/hard limits, reset logic |

### CI Pipeline
GitHub Actions runs on push/PR:
- TypeScript check (frontend + gateway)
- Build verification
- Gateway tests with coverage
- Firestore rules tests
- Bundle size report
