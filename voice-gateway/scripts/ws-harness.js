#!/usr/bin/env node
// Quick WebSocket harness to exercise sim_state broadcasts without the full UI.
// Prereq: gateway running locally (npm start in voice-gateway) or use VITE_VOICE_GATEWAY_URL-like override via GW_URL env.

/* eslint-disable no-console */
const WebSocket = require("ws");

const sessionId = process.env.SIM_ID || "sim_harness";
const userId = process.env.USER_ID || "harness-user";
const role = process.env.ROLE || "presenter";
const url = process.env.GW_URL || "ws://localhost:8081/ws/voice";

console.log("[ws-harness] connecting", url);

const ws = new WebSocket(url);

ws.on("open", () => {
  console.log("[ws-harness] open");
  ws.send(JSON.stringify({ type: "join", sessionId, userId, role }));
});

ws.on("message", (data) => {
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch {
    return;
  }
  if (msg.type === "sim_state") {
    console.log("[sim_state]", msg);
  } else if (msg.type === "patient_state" || msg.type === "patient_transcript_delta") {
    console.log("[patient]", msg.type, msg.state || msg.text);
  } else if (msg.type === "error") {
    console.warn("[error]", msg.message);
  }
});

ws.on("close", () => console.log("[ws-harness] closed"));
ws.on("error", (err) => console.error("[ws-harness] error", err));
