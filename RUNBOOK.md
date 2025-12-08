# Runbook: Voice Gateway & Web

Who to page: gateway owner / on-call dev.

## Health / Checks
- Healthcheck: `GET /health` on the gateway host (returns 200 JSON `{ ok: true }`).
- CI: GitHub Actions runs gateway tests, page tests, and Firestore rules on push/PR.
- Watch for budget hard-limit events and repeated fallbacks in logs.

## Common Actions
- Restart gateway: use your process manager (e.g., `pm2 restart gateway` or redeploy).
- Validate after restart: hit `/health`; run `npm run test:gateway` in a canary env if needed.
- Blocked deploy: fix failing CI tests (gateway/pages/rules) then redeploy.

## Rollback
- Revert to last known-good git commit; redeploy gateway and web bundle.
- Verify `/health` and a canary session.

## Incident Notes
- If OpenAI/STT/TTS down: gateway falls back to text; presenters see degraded notices.
- If budget hard limit trips: gateway switches to fallback; reduce usage or raise limits intentionally and redeploy.
- Firestore emulator/rules issues: run `npm run test:rules` (or `test:rules:ports` if ports clash) before changes to rules.
