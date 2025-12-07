## Voice Sim State & Harnesses (vNext Notes)

This document captures the current deterministic voice sim shape, how to exercise it locally, and what remains to wire before production.

### What’s implemented
- `sim_state` WebSocket message (stageId, vitals, fallback) published by the voice-gateway.
- Frontend consumption:
  - Presenter: stage/vitals chip and fallback chip near voice controls.
  - Participant: status banner shows fallback; PTT disables when fallback is active.
- Deterministic core scaffolding in gateway:
  - `ScenarioEngine` (in-memory state) and `ToolGate` (validation/rate limits).
  - RealtimePatientClient scaffold (not exercised here without network).
- Harnesses:
  - `npm run sim:harness` (voice-gateway) — exercises ScenarioEngine + ToolGate.
  - `npm run ws:harness` (voice-gateway) — connects to a running gateway and prints `sim_state`/patient events.

### How to run harnesses
From `voice-gateway/`:
```bash
# Build first
npm run build

# Exercise ScenarioEngine + ToolGate
npm run sim:harness

# Exercise WS flow (gateway must be running)
GW_URL=ws://localhost:8081/ws/voice npm run ws:harness
# Optional env overrides: SIM_ID, USER_ID, ROLE
```

### Manual UI check (dev)
1) Start the gateway (`npm start` in voice-gateway) and the app (`npm run dev` in root).
2) Open presenter + participant in the browser.
3) Verify:
   - Stage/vitals/fallback chips render (presenter).
   - Participant banner shows fallback when triggered; PTT is disabled in fallback.
   - Stage label is visible in participant view.

### What’s missing / next wiring
- Firestore persistence: sim_state + events are still in-memory; add firebase-admin writes for `sessions/{simId}` and `sessions/{simId}/events`.
- Realtime/OpenAI path needs live testing (network/API key).
- Budget guardrail: plug CostController into Realtime usage and flip to fallback on threshold.
- Jest rules tests: run with Firestore emulator to remove skipped warnings.

### Production-minded checklist
- Persist sim_state/events to Firestore (debounced) for replay/debug.
- Confirm WS harness + UI show sim_state against a running gateway (with and without fallback).
- Realtime smoke test with OPENAI_API_KEY: doctor_audio → tool intent → sim_state update; fallback on disconnect/budget.
- Observability: track tool intent approvals/rejections, stage changes, fallback events.
