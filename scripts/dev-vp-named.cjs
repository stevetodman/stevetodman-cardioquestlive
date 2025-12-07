#!/usr/bin/env node
/**
 * Named tunnel runner for virtual patient dev.
 * Assumes you've created a Cloudflare named tunnel and have a stable hostname.
 *
 * Env:
 * - CF_TUNNEL_NAME (optional, default: cardioquest)
 * - CF_TUNNEL_HOST (optional, e.g., cardioquest.trycloudflare.com)
 * - VITE_VOICE_GATEWAY_URL (optional; if absent and CF_TUNNEL_HOST is set, we build wss://<host>/ws/voice)
 */
const { spawn } = require("child_process");

const tunnelName = process.env.CF_TUNNEL_NAME || "cardioquest";
const tunnelHost = process.env.CF_TUNNEL_HOST;
const gatewayUrl =
  process.env.VITE_VOICE_GATEWAY_URL ||
  (tunnelHost ? `wss://${tunnelHost}/ws/voice` : null);

if (!gatewayUrl) {
  console.error(
    "[dev-vp-named] Set CF_TUNNEL_HOST (e.g., cardioquest.trycloudflare.com) or VITE_VOICE_GATEWAY_URL"
  );
  process.exit(1);
}

let gatewayProc = null;
let tunnelProc = null;
let viteProc = null;

function log(msg) {
  console.log(`[dev-vp-named] ${msg}`);
}

function shutdown(code = 0) {
  if (viteProc) viteProc.kill("SIGINT");
  if (tunnelProc) tunnelProc.kill("SIGINT");
  if (gatewayProc) gatewayProc.kill("SIGINT");
  process.exit(code);
}

process.on("SIGINT", () => {
  log("Received SIGINT, shutting down...");
  shutdown(0);
});

log("Starting voice-gateway (npm start in voice-gateway/)...");
gatewayProc = spawn("npm", ["start"], {
  cwd: "voice-gateway",
  stdio: "inherit",
});

log(`Starting named Cloudflare tunnel '${tunnelName}'...`);
tunnelProc = spawn("cloudflared", ["tunnel", "run", tunnelName], {
  stdio: "inherit",
});

tunnelProc.on("exit", (code) => {
  log(`cloudflared exited with code ${code}`);
  shutdown(code ?? 0);
});

log(`Starting Vite dev server with VITE_VOICE_GATEWAY_URL=${gatewayUrl} ...`);
viteProc = spawn("npm", ["run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_VOICE_GATEWAY_URL: gatewayUrl,
  },
});

viteProc.on("exit", (code) => {
  log(`Vite exited with code ${code}`);
  shutdown(code ?? 0);
});
