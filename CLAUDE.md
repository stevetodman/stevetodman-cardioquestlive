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
10 pediatric cardiology cases with age-appropriate vitals, medications, and exam findings:
- Teen: syncope, SVT, HCM, arrhythmogenic syncope, chest pain
- Pediatric: myocarditis, kawasaki
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
npm run dev:tunnel             # Via Cloudflare tunnel

# Voice Gateway
cd voice-gateway
npm install && npm run build && npm start

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
- 28 rhythm generation tests for age-dependent thresholds
- Playwright E2E with mock sessions
- Jest unit tests for gateway logic

## Recent Changes
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

## Mobile (iPhone) Participant Experience
- Safe area insets for notch/home indicator
- Hold-to-speak with pointer capture for reliable touch
- Compact header with expandable vitals panel
- Floating mic button with visual state feedback
- Collapsible voice panel to maximize content area
