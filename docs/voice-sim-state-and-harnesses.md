## Voice Sim State & Harnesses

Real-time simulation state management and testing harnesses for the voice gateway.

### Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│   Presenter     │────▶│   Voice Gateway   │◀────│   Participant    │
│ (Full State)    │     │   (WebSocket)     │     │ (Filtered State) │
└─────────────────┘     └───────────────────┘     └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   ScenarioEngine    │
                    │   - State machine   │
                    │   - Age-based HR    │
                    │   - Dynamic rhythm  │
                    └─────────────────────┘
```

### What's Implemented

**Core Engine** (`voice-gateway/src/sim/scenarioEngine.ts`):
- ScenarioEngine with stage-based state machine
- PALS-accurate age-dependent HR thresholds (neonate → adolescent)
- Dynamic rhythm generation (`getDynamicRhythm()`)
- Vitals drift over time
- ToolGate for intent validation and rate limits

**State Broadcasting** (`voice-gateway/src/index.ts`):
- `sim_state` WebSocket message with full simulation data
- **Presenter view**: All vitals, orders, telemetry, exam findings, interventions
- **Participant view**: Only ordered data (vitals, EKG, exam audio after request)
- Telemetry waveform generation
- Auscultation audio clips (scenario-specific)
- Interventions tracking (IV, oxygen, defib pads, monitor, NG tube, foley)

**Frontend**:
- Presenter: Stage/vitals chips, freeze/unfreeze, force reply, skip stage, live captions
- Participant: Status banner, PTT (disabled in fallback), exam audio playback

**Characters** (`voice-gateway/src/patientPersona.ts`):
- Patient, Parent, Nurse, Tech, Consultant—each with sim-context-aware prompts
- Real-time vitals/scenario injection into character responses

### Running Harnesses

```bash
cd voice-gateway

# Build first
npm run build

# Unit tests (28 rhythm generation tests)
npm test

# Exercise ScenarioEngine + ToolGate
npm run sim:harness

# WS flow test (gateway must be running)
GW_URL=ws://localhost:8081/ws/voice npm run ws:harness
```

### Authentication

**Production mode** (default): The voice WebSocket requires a valid Firebase ID token in the `join` message.
- Client sends `{ type: "join", authToken: "<Firebase ID token>", ... }`
- Gateway verifies token via `firebase-admin` and checks `uid` matches `userId`
- On invalid/expired token: server sends `{ type: "error", message: "unauthorized_token" }` and closes connection
- Client receives `unauthorized_token`, refreshes token once, and retries
- If retry fails, client sets status to `error/unauthorized` and shows "Sign back in to use voice"

**Development mode**: Set `ALLOW_INSECURE_VOICE_WS=true` in voice-gateway `.env`:
```bash
# voice-gateway/.env
ALLOW_INSECURE_VOICE_WS=true
```
- Tokens are not verified; any `join` succeeds
- UI shows "⚠️ Insecure voice WS (dev only)" warning
- Useful for local dev with emulators or tunnels

**Environment variables**:
- `VITE_VOICE_GATEWAY_URL` (frontend): WebSocket URL override for tunnels, e.g. `wss://my-tunnel.trycloudflare.com/ws/voice`
- `ALLOW_INSECURE_VOICE_WS` (gateway): Set to `true` for insecure local dev

### Manual Testing

1. Start gateway: `cd voice-gateway && npm start`
2. Start frontend: `npm run dev` (root)
3. Open presenter + participant views
4. Verify:
   - Presenter sees full vitals/rhythm/orders/interventions
   - Participant only sees data after ordering it (exam, EKG, etc.)
   - Exam audio plays on participant device (AirPods)
   - Stage transitions update rhythm appropriately
   - IV and other interventions appear on patient figure after order completes
   - In dev mode with `ALLOW_INSECURE_VOICE_WS=true`, see insecure warning banner

### Interventions Flow

Interventions (IV, oxygen, defib pads, etc.) follow a unified flow:

```
Order placed → orders.ts processes → updateIntervention() called
    → state.interventions updated → broadcastSimState()
    → VoiceGatewayClient receives sim_state with interventions
    → PatientStatusOutline renders intervention indicators
```

**Supported interventions**:
- `iv`: IV access with location, gauge, fluid type
- `oxygen`: O2 delivery (nasal cannula, mask, etc.) with flow rate
- `defibPads`: Defibrillation pads placement
- `monitor`: Cardiac monitor leads
- `ngTube`: Nasogastric tube
- `foley`: Urinary catheter

All interventions are shared between presenter and participant views.

### Age-Based HR Thresholds (PALS)

| Age Group | NSR Range | Tachy Threshold | Brady Threshold | SVT |
|-----------|-----------|-----------------|-----------------|-----|
| Neonate (<1mo) | 100-180 | 180 | 100 | >220 |
| Infant (1-12mo) | 100-160 | 160 | 100 | >220 |
| Toddler (1-3y) | 90-150 | 150 | 90 | >220 |
| Preschool (3-5y) | 80-140 | 140 | 80 | >220 |
| School (5-12y) | 70-120 | 120 | 70 | >220 |
| Adolescent (>12y) | 60-100 | 100 | 60 | >220 |

### Event Logging & Persistence

**Sim State Persistence** (`voice-gateway/src/persistence.ts`):
- `persistSimState()`: Writes sim state to Firestore `sessions/{simId}` with change detection
- `loadSimState()`: Restores state for session recovery
- `logSimEvent()`: Appends events to `sessions/{simId}/events` subcollection
- Zod schema validation prevents corrupt state from breaking replay

**Event Log Architecture** (`voice-gateway/src/sim/eventLog.ts`):
```
┌─────────────────────────────────────────────────────────┐
│              CompositeEventLog (prod)                   │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  InMemoryEventLog   │  │    FirestoreEventLog     │  │
│  │  (debug/getRecent)  │  │  (replay/persistence)    │  │
│  └─────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```
- `InMemoryEventLog`: Bounded buffer (5000 events) for dev debugging
- `FirestoreEventLog`: Fire-and-forget writes to Firestore for production replay
- `CompositeEventLog`: Combines both; used in prod when `FIREBASE_SERVICE_ACCOUNT` is set
- `createEventLog()`: Factory that selects appropriate logger based on environment

**Voice Event Logger** (`src/services/voiceEventLogger.ts`):
- Client-side logging for voice_error, voice_fallback, voice_recovered events
- Spike detection: alerts when >5 errors in 1-minute window
- Redacted sink: POSTs to `VITE_VOICE_LOG_SINK_URL` in production (or console.warn fallback)
- In-memory buffer (50 events) with subscriber pattern for UI debugging

### Remaining Work

**High Priority**:
- Live OPENAI_API_KEY smoke testing
- Set `VITE_VOICE_LOG_SINK_URL` in production (see README for Slack/PagerDuty examples)

**Medium Priority**:
- Budget guardrail live testing (soft/hard thresholds)

**Low Priority**:
- Jest Firestore emulator integration
- Accessibility audit for new UI components (fallback banners, debug panel)

**Before Public Launch**:
- Harden Firestore rules: lock `participants/{userId}` so clients can only write `displayName`/`inactive` (not `points`/`teamId`/`streak`); validate `responses` have valid `choiceIndex` and matching `sessionId`
- Refactor god components: decompose `PresenterSession.tsx` and `JoinSession.tsx` into feature modules (voice/, orders/, scoring/, chat/)
