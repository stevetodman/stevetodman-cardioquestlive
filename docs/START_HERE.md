# Start Here — CardioQuest Live

Use this page as the on-ramp to the project. It links the right docs by role and sketches the system quickly before you dive in.

## System at a glance

- React/Vite SPA backed by Firebase (Firestore/Auth) with optional local emulators.
- Voice gateway (WebSocket) for AI patient simulation; routes to OpenAI for TTS/STT.
- **Presenter has two mutually exclusive modes:**
  - **Slides**: Full-screen presentation with questions, gamification, scoreboards
  - **Sim**: AI patient simulation with vitals, voice controls, interventions
- Data flow (happy path):
  - Presenter UI seeds a session → Firestore stores `sessions`, `slides`, `questions`.
  - Learners join via code, read slides/questions, write responses to Firestore.
  - Presenter overlays stream participants/responses for scores and polls.
  - Voice gateway streams `sim_state`/TTS over `/ws/voice`; UI shows vitals/status.

## Pick your path

| Role | Start with |
|------|------------|
| **Build/ship engineers** | `README.md` → `docs/ARCHITECTURE.md` |
| **Deck/content editors** | `docs/ADMIN_SLIDE_EDITING.md` |
| **Voice gateway owners** | `docs/voice-sim-state-and-harnesses.md` |
| **AI Studio/Gemini** | `docs/GOOGLE_AI_STUDIO.md` |
| **Testing** | `docs/TESTING_MATRIX.md` |

## Quickstart (local dev)

```bash
npm install
npm run dev:stack:local   # emulators + voice gateway + web on 127.0.0.1:5173

# Or with Cloudflare tunnel (recommended for iPhone testing):
npm run dev:tunnel:clean  # auto-cleans ports, starts tunnel
```

Create a session at `http://127.0.0.1:5173/#/create-demo` and join with the code shown.

Key routes: Presenter `/#/create-demo` → `/#/presenter/:sessionId`; Student `/#/join/CODE`; Admin `/#/admin`.

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/ARCHITECTURE.md` | App layout and data model |
| `docs/ADMIN_SLIDE_EDITING.md` | Slide editing UX |
| `docs/voice-sim-state-and-harnesses.md` | Voice gateway, scenarios, PALS guidelines |
| `docs/TESTING_MATRIX.md` | Test commands by change type |
| `docs/GOOGLE_AI_STUDIO.md` | AI Studio integration |
