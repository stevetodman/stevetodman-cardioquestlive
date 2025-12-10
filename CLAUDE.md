# CardioQuest Live - Claude Context

## Project Overview
Real-time pediatric cardiology teaching platform with autonomous AI patient simulation. Students interact via iPhones (Cloudflare tunnel), presenters monitor and guide scenarios.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js voice-gateway (WebSocket), Firebase (Firestore, Auth)
- **AI**: OpenAI GPT-4 for patient/NPC responses
- **Infrastructure**: Cloudflare tunnel for HTTPS/WSS

## Key Directories
```
src/                    # React frontend
  pages/               # Main views (JoinSession, PresenterSession)
  components/          # Reusable UI components
  services/            # VoiceGatewayClient, Firebase services
  hooks/               # Custom React hooks
  types/               # TypeScript types

voice-gateway/         # Node.js WebSocket server
  src/
    sim/               # Scenario engine, types
    data/              # Auscultation clips, order templates
    __tests__/         # Jest tests

docs/                  # Documentation
public/               # Static assets (audio files, images)
```

## Core Concepts

### Scenarios
12 pediatric cardiology cases with age-appropriate vitals, medications, and exam findings:
- Teen: syncope, SVT, HCM, arrhythmogenic syncope, chest pain, **Complex SVT (PALS algorithm)**
- Pediatric: myocarditis, kawasaki, **"The Silent Crash" (complex fulminant myocarditis)**
- Infant: ductal shock, coarctation, cyanotic spell

### Weight-Based Dosing
All medications use PALS-accurate mg/kg dosing. Patient demographics (age, weight) are in each scenario.

### Age-Dependent HR Thresholds
- SVT: >220 bpm (all ages)
- Bradycardia/tachycardia: age-specific per PALS

### State Visibility
- **Presenters**: Full state (vitals, rhythm, all orders)
- **Participants**: Only see data they've ordered (vitals, EKG, exam)

### Characters
- Patient, Parent, Nurse, Tech, Consultant, Imaging
- Each has scenario-aware prompts and can interject in real-time

## Commands
```bash
# Development
npm run dev                    # Frontend (localhost:3000)
npm run dev:stack:local        # Full stack with emulators
npm run dev:tunnel:clean       # Via Cloudflare tunnel (recommended - auto-cleans ports)
npm run dev:tunnel             # Via Cloudflare tunnel (raw, no cleanup)

# Voice Gateway
cd voice-gateway
npm install && npm run build && npm start

# Quick-run a scenario (no WebSocket/OpenAI required)
cd voice-gateway && npm run build && npm run scenario teen_svt_complex_v1
cd voice-gateway && npm run build && npm run scenario peds_myocarditis_silent_crash_v1
cd voice-gateway && npm run scenario --help  # List all scenarios

# Testing
npm test                       # Unit tests
npm run test:gateway           # Gateway tests
npm run test:e2e              # Playwright E2E
```

## Environment Variables
```
# Frontend (.env.local)
VITE_FIREBASE_*               # Firebase config
VITE_VOICE_GATEWAY_URL        # WebSocket URL

# Voice Gateway (voice-gateway/.env)
OPENAI_API_KEY                # Required for AI
PORT                          # Default 8081
```

## Key Files to Know
- `voice-gateway/src/index.ts` - Main WebSocket handler
- `voice-gateway/src/sim/scenarioEngine.ts` - Scenario state machine
- `src/pages/JoinSession.tsx` - Participant view
- `src/pages/PresenterSession.tsx` - Presenter view
- `src/services/VoiceGatewayClient.ts` - WebSocket client

## Testing
- 165+ gateway tests (rhythm generation, myocarditis scenario, SVT scenario, order parsing)
- Playwright E2E with mock sessions
- Jest unit tests for gateway logic

## Presenter View Modes
Two mutually exclusive view modes (`src/types/presenterMode.ts`):
- **Slides mode**: Full-screen presentation with slides, questions, scores, gamification
- **Sim mode**: Patient simulation with voice controls, vitals, telemetry, interventions

Toggle via the mode switch in presenter header. Mode persists in localStorage.

## Recent Changes
- **Presenter mode simplification** (Dec 2024):
  - Reduced from 3 modes to 2 mutually exclusive modes: "slides" and "sim"
  - Slides mode hides all simulation UI (vitals status bar, voice controls)
  - Sim mode hides slide presentation controls
- Autonomous simulation mode
- PALS-accurate medications and HR thresholds
- Dynamic rhythm generation
- Separated state visibility (presenter vs participant)
- Scenario-specific auscultation clips for AirPods listening
- **Mobile UX improvements** (Dec 2024):
  - FloatingMicButton: 68x68px touch target, pulse animation, haptic feedback
  - CompactVitalsChip: Header vitals (HR/SpO2) with abnormal highlighting
  - Auscultation audio: Loading states, play/pause icons, buffering indicator
  - Voice panel: Reorganized sections (status → speak → actions → options)
- **Event-driven vitals highlighting** (Dec 2024):
  - useVitalsChange hook detects significant changes (HR ±10, SpO2 ±3%, RR ±4)
  - Amber glow animation on VitalsMonitor and CompactVitalsChip
  - No direction arrows (clinically appropriate for resident training)
- **UI polish** (Dec 2024):
  - Quick commands grouped by category (AI Control, Clinical, Orders, Treatments)
  - Custom focus-visible states for keyboard accessibility
  - Spring animation on collapsible panels
- **Resuscitation simulation** (Dec 2024):
  - RhythmWaveform: Canvas-based animated ECG with rhythm-type detection
  - CodeBluePanel: Auto-detects VFib/VTach/Asystole/PEA, PALS timers, checklist
  - CPRMetronome: Web Audio API beep at 110 BPM, tap-to-track feedback
  - VitalsMonitor integration with animated waveforms
- **Facilitator documentation** (Dec 2024):
  - FACILITATOR_GUIDE.md: Complete scenario guide with clinical details
  - All 10 scenarios documented with stages, vitals, exam findings, teaching points
- **"The Silent Crash" complex myocarditis scenario** (Dec 2024):
  - High-fidelity 30-min simulation: `peds_myocarditis_silent_crash_v1`
  - Phase-based progression with 6 phases, shock staging (1-5)
  - Deterministic physiology engine (fluid overload, inotrope response, intubation collapse)
  - Free-text order parsing with nurse clarification prompts
  - Pass/fail scoring (4/5 checklist items) + bonus/penalty points
  - Enhanced debrief with timeline, scoring breakdown, teaching points
  - 36 new tests for physiology, orders, results, scoring, triggers
- **Complex SVT scenario** (Dec 2024):
  - PALS SVT algorithm teaching: `teen_svt_complex_v1`
  - 6 phases: presentation → svt_onset → treatment_window → cardioversion_decision → decompensating → converted
  - Vagal maneuver parsing (ice to face, modified Valsalva, bearing down)
  - Adenosine dose validation (0.1 mg/kg first, 0.2 mg/kg second)
  - Cardioversion with sedation tracking
  - NPC triggers: nurse safety prompts, parent history (WPW), patient responses
  - 73 new tests for SVT physiology, scoring, triggers

## Team Mode Features

### Team Chat
Private messaging within teams - teammates can coordinate without other teams seeing.
- **Firestore**: `sessions/{sessionId}/teamMessages/{messageId}` subcollection
- **Security**: Only team members can read/write their team's messages (enforced via `isSameTeam()` rule)
- **Components**: `useTeamChat` hook, `TeamChat` component
- **Features**: Collapsible UI, unread badge, message grouping, 500 char limit

### Team Lead Role
One member per team can claim the "lead" role for special privileges.
- **Data**: `ParticipantDoc.role` field (`"member"` | `"lead"`)
- **Components**: `useTeamLead` hook, `TeamRoleBadge` component
- **Features**: Claim/resign buttons, star icon indicator, race condition protection

## Mobile (iPhone) Participant Experience
- Safe area insets for notch/home indicator
- Hold-to-speak with pointer capture for reliable touch
- Compact header with expandable vitals panel
- Floating mic button with visual state feedback
- Collapsible voice panel to maximize content area
