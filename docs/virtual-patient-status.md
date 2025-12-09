# CardioQuest Live — Virtual Patient System

## Overview

Real-time autonomous pediatric cardiology simulation with AI-powered patient/family/staff interactions. Students connect via phones (Cloudflare tunnel), interact with the AI patient, and the presenter monitors/guides the scenario.

## Core Features

### Autonomous Simulation
- Students interact via their phones through permanent Cloudflare tunnel
- AI auto-replies without presenter intervention
- Presenter monitors and can trigger events when needed

### Multi-Role NPCs
| Character | Role | Capabilities |
|-----------|------|--------------|
| **Patient** | Primary interviewee | Age-appropriate responses, symptom description |
| **Parent** | History provider | Birth/family history, scenario-specific concerns |
| **Nurse** | Order executor | Confirms doses (mg/kg), reports clinical changes |
| **Tech** | EKG/monitor tech | Rhythm descriptions, strip interpretation |
| **Consultant** | Guidance | Brief recommendations, next steps |
| **Imaging** | Results | CXR/echo summaries |

Characters can interject during real-time scenarios (e.g., nurse: "Doctor, sats are dropping").

### Clinical Monitoring
- **Telemetry**: Live waveform, rhythm history, alarms with debounce
- **Vitals**: Age-appropriate thresholds, continuous monitoring when enabled
- **EKG**: Dynamic rhythm generation based on current state
- **Orders**: Vitals/EKG/labs/imaging with realistic delays and results

### Weight-Based Medication Dosing (PALS-Accurate)

| Medication | Dose | Max | Notes |
|------------|------|-----|-------|
| Adenosine | 0.1 mg/kg rapid push | 6mg (1st), 12mg (2nd) | Flush with 5 mL NS |
| Amiodarone | 5 mg/kg over 20 min | 300mg | VF/pVT refractory |
| Epinephrine | 0.01 mg/kg (10 mcg/kg) | — | 1:10,000 IV, 1:1,000 IM |
| Atropine | 0.02 mg/kg | 0.5mg child, 1mg teen | Min 0.1mg |
| Lidocaine | 1 mg/kg bolus | 100mg | VF/pVT alt to amiodarone |
| Calcium chloride | 20 mg/kg slow push | 2g | Hypocalcemia/hyperK |
| Sodium bicarbonate | 1 mEq/kg slow push | — | Documented acidosis |
| Magnesium | 25-50 mg/kg over 15 min | 2g | Torsades |
| Procainamide | 15 mg/kg over 30 min | 1g | Wide-complex tachycardia |
| Cardioversion | 0.5-1 J/kg | 2 J/kg | Synchronized |
| Defibrillation | 2-4 J/kg | — | Asynchronous |

Nurse confirms exact dose with mg/kg calculation before administration.

### Age-Dependent Heart Rate Thresholds (PALS Guidelines)

| Age Group | NSR Range | Tachycardia | Bradycardia | SVT |
|-----------|-----------|-------------|-------------|-----|
| Neonate (<1mo) | 100-180 | >180 | <100 | >220 |
| Infant (1-12mo) | 100-160 | >160 | <100 | >220 |
| Toddler (1-3yr) | 90-150 | >150 | <90 | >220 |
| Preschool (3-6yr) | 80-120 | >120 | <80 | >220 |
| School-age (6-12yr) | 70-110 | >110 | <70 | >220 |
| Adolescent (>12yr) | 60-100 | >100 | <60 | >220 |

### Dynamic Rhythm Generation
Rhythm strip updates automatically based on:
- Current heart rate and vitals
- Scenario type (SVT, VT, myocarditis, etc.)
- Stage (baseline, episode, decompensation)
- Treatment effects (adenosine conversion, cardioversion)

Examples:
- SVT: "SVT 230 bpm, narrow complex, regular, P waves absent"
- VT: "Monomorphic VT 180 bpm, wide complex, AV dissociation"
- Normal: "Normal sinus rhythm 85 bpm, LVH voltage, deep Q waves V5-V6"

### Presenter Events
Presenter can trigger scenario events:
- `hypoxia`, `tachycardia`, `hypotension`, `fever`
- `stabilize`, `improve`, `deteriorate`
- `rhythm_change` (vtach, svt, afib)
- `code_blue` (cardiac arrest)

## Scenarios

| ID | Age | Weight | Description |
|----|-----|--------|-------------|
| `syncope` | 15yo | 55kg | Exertional syncope, male |
| `exertional_chest_pain` | 16yo | 62kg | Chest pain with exertion, male |
| `palpitations_svt` | 14yo | 50kg | Recurrent SVT episodes, female |
| `myocarditis` | 11yo | 38kg | Post-viral myocarditis, male |
| `exertional_syncope_hcm` | 17yo | 70kg | HCM with family hx sudden death |
| `ductal_shock` | 1mo | 3.5kg | Ductal-dependent lesion, shock |
| `cyanotic_spell` | 2yo | 12kg | Tet spell, cyanotic CHD |
| `kawasaki` | 4yo | 16kg | Kawasaki disease, coronary risk |
| `coarctation_shock` | 2mo | 4.5kg | Coarctation with shock |
| `arrhythmogenic_syncope` | 15yo | 58kg | ARVC/CPVT with VT |

## Architecture

### State Visibility
- **Presenters**: See full state (vitals, telemetry, rhythm, all orders)
- **Participants**: See only what they've ordered/enabled:
  - Vitals: After ordering vitals or enabling telemetry
  - Rhythm/EKG: After ordering EKG or enabling telemetry
  - Exam findings: After performing physical exam

### Voice Gateway
```
ws://localhost:8081/ws/voice (local)
wss://voice.cardioquestlive.com/ws/voice (production)
```

Environment variables:
- `OPENAI_API_KEY` — Required for AI responses
- `OPENAI_MODEL` — Default: `gpt-4.1-mini`
- `PORT` — Default: `8081`

## Running Locally

```bash
# Voice gateway
cd voice-gateway
npm install && npm run build && npm start

# App (separate terminal)
npm install && npm run dev

# Full stack with tunnel
npm run dev:tunnel
```

## Testing

```bash
# All gateway tests
npm run test:gateway

# Rhythm generation tests
npm test -- voice-gateway/src/__tests__/rhythmGeneration.test.ts

# E2E (Playwright)
npm run test:e2e
```

## Known Limitations
- Persistence to Firestore for sim_state/events is in-memory only
- Gateway restart drops simulation state
- Some EKG/imaging assets are placeholders
