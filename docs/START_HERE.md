# Start Here — CardioQuest Live

Use this page as the on-ramp to the project. It links the right docs by role and sketches the system quickly before you dive in.

## System at a glance

- React/Vite SPA backed by Firebase (Firestore/Auth) with optional local emulators.
- Optional voice gateway (WebSocket) for the virtual patient; routes to OpenAI for TTS/STT.
- Data flow (happy path):
  - Presenter UI seeds a session → Firestore stores `sessions`, `slides`, `questions`.
  - Learners join via code, read slides/questions, write responses to Firestore.
  - Presenter overlays stream participants/responses for scores and polls.
  - Voice gateway (if enabled) streams `sim_state`/TTS over `/ws/voice`; UI shows vitals/status.

## Pick your path

- **Build/ship engineers:** start with `README.md` (overview + setup), then `docs/ARCHITECTURE.md` for app layout. Deploy/run guidance in `DEPLOY.md`.
- **Deck/content editors:** jump to `docs/ADMIN_SLIDE_EDITING.md`.
- **Ops/on-call:** read `RUNBOOK.md` (health, rollback, alerts) and `DEPLOY.md` (checklist/env). Virtual patient status in `docs/virtual-patient-status.md`.
- **Voice gateway owners:** see `docs/voice-sim-state-and-harnesses.md` (sim/harness), `docs/virtual-patient-status.md` (current posture).
- **AI Studio/Gemini:** use `docs/GOOGLE_AI_STUDIO.md`.

## Quickstart (local dev)

```bash
npm install
npm run dev:stack:local   # emulators + voice gateway + web on 127.0.0.1:5173
# Then create a session at http://127.0.0.1:5173/#/create-demo and join with the code shown.
# Allow microphone for 127.0.0.1 in your browser for voice; tap "Re-check mic" if blocked.
```

Key routes: Presenter `/#/create-demo` → `/#/presenter/:sessionId`; Student `/#/join/CODE`; Admin `/#/admin`.

## What to read next

- Architecture/data model: `docs/ARCHITECTURE.md`
- Slide editing UX: `docs/ADMIN_SLIDE_EDITING.md`
- Deployment/ops: `DEPLOY.md`, `RUNBOOK.md`
- Voice/virtual patient: `docs/virtual-patient-status.md`, `docs/voice-sim-state-and-harnesses.md`
- Testing matrix: `docs/TESTING_MATRIX.md`
