#!/usr/bin/env node
/**
 * Quick dev runner for virtual patient with a Cloudflare quick tunnel.
 * Starts gateway, then cloudflared to 3000 (frontend) which proxies /ws/voice to 8081,
 * parses the tunnel URL, and starts Vite with VITE_VOICE_GATEWAY_URL set.
 */
const { spawn } = require("child_process");

let gatewayProc = null;
let tunnelProc = null;
let viteProc = null;

function log(msg) {
  console.log(`[dev-vp-quick] ${msg}`);
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

log("Starting cloudflared quick tunnel to http://localhost:3000 (frontend + proxied /ws/voice)...");
tunnelProc = spawn("cloudflared", ["tunnel", "--url", "http://localhost:3000"], {
  stdio: ["ignore", "pipe", "pipe"],
});

let tunnelUrl = null;

tunnelProc.stdout.on("data", (chunk) => handleTunnelOutput(chunk));
tunnelProc.stderr.on("data", (chunk) => handleTunnelOutput(chunk));

function handleTunnelOutput(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);
  const match = text.match(/https:\/\/[^\s]+trycloudflare\.com/);
  if (match && !tunnelUrl) {
    tunnelUrl = match[0];
    log(`Detected tunnel URL: ${tunnelUrl}`);
    log(`OPEN THIS URL in browser/phone: ${tunnelUrl}`);
    log("Starting Vite dev server with VITE_VOICE_GATEWAY_URL set to tunnel URL...");
    viteProc = spawn(
      "npm",
      ["run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          VITE_VOICE_GATEWAY_URL: `${tunnelUrl}/ws/voice`,
        },
      }
    );
    viteProc.on("exit", (code) => {
      log(`Vite exited with code ${code}`);
      shutdown(code ?? 0);
    });
  }
}

tunnelProc.on("exit", (code) => {
  log(`cloudflared exited with code ${code}`);
  shutdown(code ?? 0);
});
