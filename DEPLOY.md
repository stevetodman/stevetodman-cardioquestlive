# Deploy & Ops Checklist

Lightweight guidance for running the presenter/student app and the voice gateway in prod-like environments.

## Prereqs
- Node 18+ (align with local dev).
- Firebase project with Firestore rules deployed.
- OPENAI_API_KEY available for gateway LLM/TTS/STT paths.
- Env injection via your secret manager (not committed).

## Build/Test
- `npm run test:gateway`
- `npm test -- --runInBand src/pages/__tests__/JoinSession.test.tsx src/pages/__tests__/PresenterSessionSummary.test.tsx`
- `npm run test:rules` (or `npm run test:rules:ports` if emulator ports clash)
- `npm run build`
- See `docs/TESTING_MATRIX.md` for change-type coverage.

## Gateway runtime env (recommended defaults)
- `PORT=8081`
- `ALLOW_INSECURE_VOICE_WS=false` (must be false in prod)
- `SCENARIO_HEARTBEAT_MS=1000`
- `COMMAND_COOLDOWN_MS=3000`
- `MAX_WS_PAYLOAD_BYTES=262144` (256 KB guardrail)
- `SOFT_BUDGET_USD=3.5`, `HARD_BUDGET_USD=4.5`
- `OPENAI_REALTIME_MODEL=gpt-4o-mini-realtime-preview`
- `OPENAI_API_KEY` (required for realtime path)

## Healthcheck (gateway)
- Expose a simple HTTP 200 endpoint via your process manager or load balancer to detect liveness.
- Alarms: alert on process down, repeated `budget.hard_limit`, and excessive 5xx from the gateway.
- CI (GitHub Actions): runs gateway tests, page tests, and Firestore rules on push/PR.
- Health endpoint: `GET /health` responds `{ ok: true }`.

## Deploy outline
1) Set env vars in your platform (see above).
2) Install deps: `npm ci`
3) Run tests (see Build/Test).
4) Build web: `npm run build`
5) Start gateway behind TLS-terminating proxy on `/ws/voice` (respect PORT).
6) Verify healthcheck and a canary session.

## Firestore data hygiene
- Rules are covered by `test/firestore.rules.test.ts`; run in CI.
- Decide export/retention for session/transcript collections; automate `gcloud firestore export` on a schedule if data must be retained.
