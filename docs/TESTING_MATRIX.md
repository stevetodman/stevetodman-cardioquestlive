# Testing Matrix

Use this to choose the smallest reliable test set for your change. Prefer the smallest set that still covers the surface you touched; run the full suite before release.

## Change types → commands

- **Presenter/participant UI (pages/components)**
  - `npm test -- --runInBand src/pages/__tests__/JoinSession.test.tsx src/pages/__tests__/PresenterSessionSummary.test.tsx`
  - `npm run build` (catches TypeScript/asset issues)
- **Voice gateway (transport/orchestration/domain)**
  - `npm run test:gateway`
  - Optionally sanity-check: `npm run sim:harness` (ScenarioEngine/ToolGate) and `GW_URL=ws://localhost:8081/ws/voice npm run ws:harness` against a running gateway.
- **E2E Playwright (mocked sessions, no Firestore)**
  - Start dev server: `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --clearScreen false`
  - Run: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_USE_CHROMIUM=true npx playwright test`
  - Suite uses mock hooks (`?mockSession`, `mockVoice`, `mockNotFound`) and hash router query params.
- **Firestore rules**
  - `npm run test:rules`
  - If emulator ports clash: `FIRESTORE_PORT=62088 FIRESTORE_WS_PORT=62188 FIREBASE_HUB_PORT=62402 FIREBASE_LOGGING_PORT=62502 npm run test:rules:ports`
- **Deck/content-only edits**
  - `npm test -- --runInBand src/pages/__tests__/JoinSession.test.tsx` (smoke presenter/student flow)
  - `npm run build`
- **Release/infra changes**
  - Run everything above: gateway tests, page tests, rules tests, plus `npm run build`.

## CI expectation

GitHub Actions (on push/PR) should run: `npm run test:gateway`, page tests, Firestore rules tests, and `npm run build`. Keep the matrix aligned with CI to avoid surprises.
