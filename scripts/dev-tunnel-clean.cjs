#!/usr/bin/env node
/**
 * Clean startup script for tunnel-based development.
 *
 * This script:
 * 1. Kills any stale processes on ports 3000 and 8081
 * 2. Verifies cloudflared is installed
 * 3. Starts all services with proper cleanup on exit
 *
 * Usage: npm run dev:tunnel:clean
 */
const { spawn, execSync } = require("child_process");

const PORTS = [3000, 8081];

function log(msg) {
  console.log(`\x1b[36m[dev-tunnel]\x1b[0m ${msg}`);
}

function logError(msg) {
  console.error(`\x1b[31m[dev-tunnel]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
  console.log(`\x1b[32m[dev-tunnel]\x1b[0m ${msg}`);
}

// Kill processes on specified ports
function killPortProcesses() {
  for (const port of PORTS) {
    try {
      const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
      if (pids) {
        log(`Killing stale processes on port ${port}: ${pids.replace(/\n/g, ", ")}`);
        execSync(`kill -9 ${pids.replace(/\n/g, " ")}`, { stdio: "ignore" });
      }
    } catch {
      // No processes on this port - that's fine
    }
  }
}

// Check if cloudflared is installed
function checkCloudflared() {
  try {
    execSync("which cloudflared", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Check if voice-gateway is built
function checkGatewayBuilt() {
  const fs = require("fs");
  return fs.existsSync("voice-gateway/dist/index.js");
}

// Main startup
async function main() {
  console.log("");
  log("=== CardioQuest Live - Tunnel Dev Mode ===");
  console.log("");

  // Pre-flight checks
  log("Running pre-flight checks...");

  if (!checkCloudflared()) {
    logError("cloudflared not found. Install with: brew install cloudflared");
    process.exit(1);
  }
  logSuccess("✓ cloudflared installed");

  if (!checkGatewayBuilt()) {
    log("Building voice-gateway...");
    try {
      execSync("cd voice-gateway && npm run build", { stdio: "inherit" });
      logSuccess("✓ voice-gateway built");
    } catch (e) {
      logError("Failed to build voice-gateway");
      process.exit(1);
    }
  } else {
    logSuccess("✓ voice-gateway already built");
  }

  // Kill stale processes
  log("Cleaning up stale processes...");
  killPortProcesses();
  logSuccess("✓ Ports 3000 and 8081 cleared");

  // Brief pause to ensure ports are released
  await new Promise(r => setTimeout(r, 500));

  console.log("");
  log("Starting services...");
  console.log("");

  // Start all services using concurrently (via npm script)
  const mainProc = spawn("npm", ["run", "dev:tunnel"], {
    stdio: "inherit",
    env: process.env,
  });

  mainProc.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  // Handle cleanup on exit
  const cleanup = () => {
    log("Shutting down...");
    mainProc.kill("SIGINT");
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((err) => {
  logError(err.message);
  process.exit(1);
});
