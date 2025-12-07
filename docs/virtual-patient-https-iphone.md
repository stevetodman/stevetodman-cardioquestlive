# Virtual Patient — HTTPS/WSS Dev Setup for iPhone Mic (ngrok)

Safari on iPhone requires a secure origin to allow `getUserMedia`. Use ngrok to expose both the Vite dev server over **HTTPS** and the voice gateway over **WSS**.

Prereqs: ngrok installed with authtoken configured; repo already set up; `voice-gateway/.env` contains your OpenAI keys. Never commit tokens or env files.

## One-time ngrok config (single endpoint with routes)

Create or edit `~/.config/ngrok/ngrok.yml` (ngrok v3 format) with a single tunnel that routes `/ws/voice` to the voice gateway and everything else to Vite:

```yaml
version: "3"
tunnels:
  cardioquest:
    proto: http
    addr: 3000
    schemes: [https]
    routes:
      - match: /ws/voice
        proto: http
        addr: 8081
```

This uses your default ngrok free domain (e.g., `https://tympanitic-nu-yeomanly.ngrok-free.dev`) as the single HTTPS endpoint. Frontend is served from `/`, and `wss://<domain>/ws/voice` forwards to `http://localhost:8081/ws/voice`.

## Terminal 1 — start voice gateway

```bash
cd ~/cardioquestlive/voice-gateway
npm start
# -> Voice gateway listening on :8081 (path: /ws/voice)
```

## Terminal 2 — start ngrok (single endpoint)

```bash
ngrok start cardioquest
```

Example output (your domain will differ):

```
Forwarding  https://tympanitic-nu-yeomanly.ngrok-free.dev -> http://localhost:3000
```

Gateway + frontend share this single URL:
- Frontend: `https://tympanitic-nu-yeomanly.ngrok-free.dev`
- Gateway WSS: `wss://tympanitic-nu-yeomanly.ngrok-free.dev/ws/voice`

## Terminal 3 — start Vite pointing to WSS gateway

```bash
cd ~/cardioquestlive
VITE_VOICE_GATEWAY_URL=wss://tympanitic-nu-yeomanly.ngrok-free.dev/ws/voice npm run dev -- --host 0.0.0.0 --port 3000
```

Use the ngrok URL in Safari; the local/lan URLs Vite prints are just backend targets for ngrok.

## Using it

On Mac (presenter):
1. Open `https://tympanitic-nu-yeomanly.ngrok-free.dev`.
2. Start session, **Enable voice** → expect `VOICE Enabled · READY`.

On iPhone (participant):
1. Open `https://tympanitic-nu-yeomanly.ngrok-free.dev` in Safari.
2. Join by code, accept mic prompt on first hold.
3. Speak, release → gateway logs show `Doctor audio received …` and `STT transcript …`; presenter question box fills; Auto Force Reply drives patient answer.

Notes:
- Dev-only HTTPS/WSS via ngrok; do not expose secrets.
- `OPENAI_API_KEY` stays in `voice-gateway/.env` (not exposed through ngrok).
- Default gateway URL (if you omit `VITE_VOICE_GATEWAY_URL`) is `wss://score-bent-trailer-think.trycloudflare.com/ws/voice`; override with `VITE_VOICE_GATEWAY_URL` or `globalThis.__VITE_VOICE_GATEWAY_URL` as needed.

## Quickstart (Cloudflare tunnel + local dev)

For a one-command local setup with the Cloudflare tunnel and voice gateway:

```bash
npm run dev:vp
```

This starts:
- voice-gateway on `http://localhost:8081`
- Cloudflare tunnel to the gateway (`cloudflared tunnel --url http://localhost:8081`)
- Vite dev server (default http://localhost:3000 and LAN URL)

Use the Cloudflare tunnel URL you see in the terminal as the WSS endpoint (default already set), and the Vite URL for browser/mobile. Ctrl+C stops all three.

If you prefer an auto-detected quick-tunnel URL (no manual env), use:
```bash
npm run dev:vp:quick
```
This will:
- start gateway
- start a Cloudflare quick tunnel to the Vite dev server (http://localhost:3000)
- start Vite with `VITE_VOICE_GATEWAY_URL` set to `wss://<that-url>/ws/voice`
- `/ws/voice` is proxied by Vite to `http://localhost:8081` so the single tunnel serves both frontend and gateway
- prints `OPEN THIS URL...` with the tunnel URL; open it on Mac/iPhone for HTTPS/WSS

For a stable named tunnel (no random URL), create a named tunnel in Cloudflare once, set `CF_TUNNEL_HOST` (e.g., `cardioquest.trycloudflare.com`), then run:
```bash
CF_TUNNEL_HOST=cardioquest.trycloudflare.com npm run dev:vp:named
```
This assumes you’ve already done `cloudflared tunnel login` and `cloudflared tunnel create <name>` (default name used: `cardioquest` unless overridden with `CF_TUNNEL_NAME`).

### Best free “one-and-done” setup (stable URL)
1. One time:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create cardioquest
   ```
2. (Optional) Save your host so you don’t retype it (e.g., in `~/.bashrc` or `~/.zshrc`):
   ```bash
   export CF_TUNNEL_HOST=cardioquest.trycloudflare.com
   export CF_TUNNEL_NAME=cardioquest
   ```
3. Daily run:
   ```bash
   npm run dev:vp:named
   ```
This starts gateway, the named tunnel, and Vite with a fixed WSS URL `wss://$CF_TUNNEL_HOST/ws/voice`, so the same HTTPS URL works every session (no random URL copy/paste).
