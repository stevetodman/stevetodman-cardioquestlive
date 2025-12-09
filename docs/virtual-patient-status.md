# CardioQuest Live — Virtual Patient Status (Checkpoint)

## What’s working now (voice/AI)

- Multi-role NPCs (patient/parent/nurse/tech/consultant) with per-role replies; auto-reply with safety/rate limits.
- Orders: vitals/ekg/labs/imaging with history and strip URLs; imaging/EKG assets fall back to summary if missing.
- Telemetry: live waveform, rhythm history, alarms with debounce; presenter vitals monitor.
- Treatments: basic effects with decay and cooldown to prevent rapid re-dosing; scenario transitions for SVT/ductal/cyanotic cases.
- Persistence: telemetry/EKG histories and timing hydrated on reconnect.
- Debrief: AI summary/strengths/opportunities/teaching points from transcript.

### Current posture
- Runs locally with OpenAI keys; voice gateway publishes `sim_state` over `/ws/voice` and the presenter UI renders vitals/status banners.
- State lives in-process; telemetry/EKG histories hydrate on reconnect while the process is alive. Firestore persistence for sim_state/events is not wired yet.
- TTS/STT require valid OpenAI credentials; otherwise text-only fallback replies are used.

## How to run (short)

Voice gateway:
```bash
cd voice-gateway
npm install
npm run build
npm start   # ws://localhost:8081/ws/voice
```
Env (set in voice-gateway/.env): `OPENAI_API_KEY`, optional `OPENAI_TTS_VOICE_*`, `OPENAI_MODEL`, `PORT` (default 8081), `ALLOW_INSECURE_VOICE_WS=false` (set true only for local/tunnels without Firebase auth).

App:
```bash
npm install
npm run dev   # http://localhost:3000
```
If using a custom gateway URL: set `VITE_VOICE_GATEWAY_URL`.

## Participant voice UX (current)

- Single hold-to-speak control auto-takes and releases the floor (auto-release 2s after you stop holding; 60s idle safety).
- Unified status badge (ready / active / waiting / unavailable) with aria-live hints and recovery steps (blocked mic, connecting, fallback, locked).
- Advanced options (target role) hidden by default; defaults to asking the patient.
- Contextual actions only show when actionable (exam/telemetry/EKG) to avoid disabled clutter.
- Mobile-first layout: collapsible voice panel with floating mic button on phones; desktop keeps inline hold-to-speak.

## Tests
- Gateway/unit: `npm run test:gateway`
- UI pages: `npm test -- --runInBand src/pages/__tests__/JoinSession.test.tsx src/pages/__tests__/PresenterSessionSummary.test.tsx`
- Rules: `npm run test:rules` (or `FIRESTORE_PORT=62088 FIRESTORE_WS_PORT=62188 FIREBASE_HUB_PORT=62402 FIREBASE_LOGGING_PORT=62502 npm run test:rules:ports` if defaults are blocked)

## Known gaps
- Placeholder avatar/EKG assets; replace with final art/strips.
- Treatment/alarms are simplified (no weight-based dosing/stacking realism).
- Budget/alarm badges are presenter-only; participant voice badge now unified but budget state is not yet announced to screen readers.
- Limited E2E tests for presenter/participant flows; consider adding before major UI changes.
- Persistence to Firestore for sim_state/events is still pending; gateway restarts drop state.
- No production SLOs/alerting yet; add dashboards for fallback/budget/5xx and WS error rates.
