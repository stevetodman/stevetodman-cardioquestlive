# Runbook: Voice Gateway & Web

Who to page: gateway owner / on-call dev.

## Health / Checks
- Healthcheck: `GET /health` on the gateway host (returns 200 JSON `{ ok: true }`).
- CI: GitHub Actions runs gateway tests, page tests, and Firestore rules on push/PR.
- Watch for budget hard-limit events and repeated fallbacks in logs.

## SLO targets (revise per environment)
- Web app availability: 99.9% (hash-routed SPA served via Hosting/CDN).
- Join/submit latency: < 2s P95 (presenter/participant Firestore writes).
- Voice gateway availability: 99% (WebSocket `/ws/voice` up, budget not hard-limited).
- Error budget burn: page if > 2% of requests return 5xx over 30m.

## Alerts & where to look
- **Gateway down / `/health` fails:** restart process; check logs in your process manager (pm2/systemd) and recent deploy changes.
- **Budget hard-limit:** reduce traffic or raise limits intentionally; restart after adjusting budgets.
- **Repeated fallback/LLM errors:** inspect gateway logs for OpenAI responses/timeouts; verify API key and rate limits.
- **Firestore/Hosting issues:** check Firebase status; confirm service account/environment keys.

## Observability (recommended)
- Logs: capture gateway stdout/stderr (pm2/systemd) and surface in your log aggregator; tag by commit and environment.
- Metrics: track WebSocket connection counts, request/response error rates, latency, and budget events. Export to your monitoring stack with dashboards for:
  - Web uptime + Hosting cache hit ratio.
  - Firestore read/write error rate.
  - Gateway `/health`, 5xx, fallback counts, and budget events.
- Traces: optional but recommended around gateway request handling and Firestore writes for presenter/participant flows.

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
