# Start Here

## Quick Start
```bash
npm install
npm run dev:tunnel:clean   # Cloudflare tunnel (recommended for iPhone)
# OR
npm run dev:stack:local    # Local with Firebase emulators
```

Create session: `http://127.0.0.1:5173/#/create-demo`

## System Overview

| Component | Purpose |
|-----------|---------|
| React SPA | Presenter + participant views |
| Firebase | Firestore (data), Auth (anonymous) |
| Voice Gateway | WebSocket for AI patient simulation |

**Presenter has two modes:**
- **Slides**: Questions, scores, gamification
- **Sim**: AI patient with vitals, voice, interventions

## Documentation

| Doc | For |
|-----|-----|
| `CLAUDE.md` | LLM context (structure, patterns) |
| `README.md` | Full feature documentation |
| `docs/ARCHITECTURE.md` | Data model, app layout |
| `docs/FACILITATOR_GUIDE.md` | Scenario clinical details |
| `docs/virtual-patient-status.md` | Voice gateway status |
| `docs/TESTING_MATRIX.md` | Test commands |

## Routes

| Route | Purpose |
|-------|---------|
| `/#/create-demo` | Create session |
| `/#/presenter/:sessionId` | Presenter view |
| `/#/join/CODE` | Participant view |
| `/#/admin` | Deck editing |
