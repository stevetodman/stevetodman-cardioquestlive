# Voice Gateway & Simulation

Real-time pediatric cardiology simulation with AI-powered patient/NPC interactions.

## Architecture

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

## Characters

| Character | Role | TTS Voice |
|-----------|------|-----------|
| Patient | Primary interviewee, age-appropriate responses | alloy |
| Parent | Birth/family history, scenario-specific concerns | nova |
| Nurse | Order executor, confirms doses (mg/kg), reports changes | echo |
| Tech | EKG/monitor tech, rhythm descriptions | fable |
| Consultant | Brief recommendations, next steps | onyx |
| Imaging | CXR/echo summaries | shimmer |

Characters can interject during scenarios (e.g., nurse: "Doctor, sats are dropping").

## State Visibility

**Presenters** see full state: vitals, telemetry, rhythm, all orders, interventions, extended state

**Participants** see only ordered data:
- Vitals: After ordering vitals or enabling telemetry
- Rhythm/EKG: After ordering EKG or enabling telemetry
- Exam findings: After performing physical exam

Both roles see interventions (IV, oxygen, defib pads, monitor, NG tube, foley, ETT).

## Scenarios

| ID | Age | Weight | Description |
|----|-----|--------|-------------|
| `syncope` | 15yo | 55kg | Exertional syncope |
| `exertional_chest_pain` | 16yo | 62kg | Chest pain with exertion |
| `palpitations_svt` | 14yo | 50kg | Recurrent SVT episodes |
| `myocarditis` | 11yo | 38kg | Post-viral myocarditis |
| `exertional_syncope_hcm` | 17yo | 70kg | HCM with family hx sudden death |
| `ductal_shock` | 1mo | 3.5kg | Ductal-dependent lesion |
| `cyanotic_spell` | 2yo | 12kg | Tet spell, cyanotic CHD |
| `kawasaki` | 4yo | 16kg | Kawasaki disease |
| `coarctation_shock` | 2mo | 4.5kg | Coarctation with shock |
| `arrhythmogenic_syncope` | 15yo | 58kg | ARVC/CPVT with VT |
| `teen_svt_complex_v1` | 14yo | 50kg | Complex SVT with PALS algorithm |
| `peds_myocarditis_silent_crash_v1` | 10yo | 32kg | Fulminant myocarditis |

## Age-Based HR Thresholds (PALS)

| Age Group | NSR Range | Tachycardia | Bradycardia | SVT |
|-----------|-----------|-------------|-------------|-----|
| Neonate (<1mo) | 100-180 | >180 | <100 | >220 |
| Infant (1-12mo) | 100-160 | >160 | <100 | >220 |
| Toddler (1-3yr) | 90-150 | >150 | <90 | >220 |
| Preschool (3-6yr) | 80-120 | >120 | <80 | >220 |
| School-age (6-12yr) | 70-110 | >110 | <70 | >220 |
| Adolescent (>12yr) | 60-100 | >100 | <60 | >220 |

## Weight-Based Medication Dosing (PALS)

| Medication | Dose | Max | Notes |
|------------|------|-----|-------|
| Adenosine | 0.1 mg/kg rapid push | 6mg (1st), 12mg (2nd) | Flush with 5 mL NS |
| Amiodarone | 5 mg/kg over 20 min | 300mg | VF/pVT refractory |
| Epinephrine | 0.01 mg/kg (10 mcg/kg) | — | 1:10,000 IV |
| Atropine | 0.02 mg/kg | 0.5mg child, 1mg teen | Min 0.1mg |
| Cardioversion | 0.5-1 J/kg | 2 J/kg | Synchronized |
| Defibrillation | 2-4 J/kg | — | Asynchronous |

Nurse confirms exact dose with mg/kg calculation before administration.

## Complex Scenario Scoring

Both complex scenarios use deterministic scoring with AI-powered debrief.

**Formula**: Base 50 + Checklist (10 pts × 5) + Bonuses - Penalties
**Pass**: 4/5 checklist items required
**Grades**: A (90+), B (80-89), C (70-79), D (60-69), F (<60 or failed)

### SVT Checklist
1. Ordered 12-lead ECG
2. Attempted vagal maneuvers before adenosine
3. Adenosine dosed correctly (0.1 mg/kg ±10%)
4. Patient on monitor during treatment
5. Reassured patient/parent

### Myocarditis Checklist
1. Recognized cardiac etiology (troponin/BNP/ECG)
2. Avoided fluid overload (≤40 mL/kg)
3. Called PICU within 10 min of decompensation
4. Safe intubation (ketamine + pressor ready)
5. Consulted cardiology

## Running Locally

```bash
# Voice gateway
cd voice-gateway && npm install && npm run build && npm start

# Run scenario without WebSocket
npm run scenario teen_svt_complex_v1
npm run scenario peds_myocarditis_silent_crash_v1

# Tests
npm run test:gateway
```

## Authentication

**Production** (default): Voice WebSocket requires valid Firebase ID token in `join` message.
- On invalid/expired token: server sends `{ type: "error", message: "unauthorized_token" }` and closes
- Client refreshes token once and retries; on failure shows "Sign back in to use voice"

**Development**: Set `ALLOW_INSECURE_VOICE_WS=true` in `voice-gateway/.env`:
- Tokens not verified; any `join` succeeds
- UI shows "⚠️ Insecure voice WS (dev only)" warning

## Interventions

Interventions follow unified flow:
```
Order placed → orders.ts processes → updateIntervention()
    → state.interventions updated → broadcastSimState()
    → VoiceGatewayClient receives sim_state
    → PatientStatusOutline renders indicators
```

**Supported**: iv, oxygen, defibPads, monitor, ngTube, foley, ett

## Event Logging

**Sim State Persistence** (`persistence.ts`):
- `persistSimState()`: Writes to Firestore with change detection
- `loadSimState()`: Restores state for session recovery
- `logSimEvent()`: Appends to events subcollection

**Voice Event Logger** (`voiceEventLogger.ts`):
- Client-side logging for errors, fallbacks, recoveries
- Spike detection: alerts on >5 errors in 1-minute window
- Posts to `VITE_VOICE_LOG_SINK_URL` or console.warn fallback
