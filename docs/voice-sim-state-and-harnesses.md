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

### Remaining Work

**High Priority**:
- Firestore persistence for sim_state replay/debug
- Live OPENAI_API_KEY smoke testing

**Medium Priority**:
- Budget guardrail live testing (soft/hard thresholds)
- Observability: intent approvals, stage changes, fallback events

**Low Priority**:
- Jest Firestore emulator integration
