# Contributing Guidelines

## Architecture boundaries
- **Transport vs orchestration vs domain:** Keep WebSocket/HTTP wiring in transport modules, orchestration logic in a thin coordinator, and domain logic (orders, telemetry, scenario engine, persistence, safety) in focused modules. Avoid putting new logic into entrypoints like `voice-gateway/src/index.ts` or page roots.
- **Cross-cutting concerns:** Reuse the shared safety/rate-limit middleware (e.g., auto-reply guard), asset checks, and zod validation for persisted/hydrated state. Do not duplicate ad-hoc checks.
- **Pure vs side effects:** Keep pure helpers separate from side-effecting code (network, file, db, AI calls). Inject side-effecting dependencies for testability.

## Tests and quality gates
- Run `npm run test:gateway` for gateway/unit behavior.
- Run page tests: `npm test -- --runInBand src/pages/__tests__/JoinSession.test.tsx src/pages/__tests__/PresenterSessionSummary.test.tsx`.
- Run rules tests when ports are available: `npm run test:rules`.
- If ports are blocked, use env overrides: `FIRESTORE_PORT=62088 FIRESTORE_WS_PORT=62188 FIREBASE_HUB_PORT=62402 FIREBASE_LOGGING_PORT=62502 npm run test:rules:ports` (adjust ports as needed).
- Add a small behavior test when introducing a new flow (routing, alarms, orders, budgets, safety).

## Code style
- Prefer small, single-responsibility modules over large files.
- Use explicit types and schema validation on external input (e.g., zod) instead of `any`.
- Keep presentational components dumb; fetch/side-effects live in hooks/containers.
- Reuse existing helpers/modules rather than adding duplicate logic.
