#!/usr/bin/env node
/**
 * Lightweight WS load smoke. Assumes gateway allows insecure joins (dev) or uses a permissive token.
 * Env:
 *   GATEWAY_URL=wss://.../ws/voice (default ws://localhost:8081/ws/voice)
 *   CLIENTS=20 (number of simulated clients)
 *   MESSAGES=5 (pings per client)
 */
const WebSocket = require("ws");

const url = process.env.GATEWAY_URL || "ws://localhost:8081/ws/voice";
const clients = Number(process.env.CLIENTS || 20);
const messages = Number(process.env.MESSAGES || 5);

let connected = 0;
let completed = 0;

for (let i = 0; i < clients; i++) {
  const ws = new WebSocket(url);
  ws.on("open", () => {
    connected++;
    const sessionId = `load-sim`;
    const userId = `user-${i}`;
    ws.send(
      JSON.stringify({
        type: "join",
        sessionId,
        userId,
        role: "participant",
        authToken: "dev-unsafe",
      })
    );
    let sent = 0;
    const interval = setInterval(() => {
      if (sent >= messages) {
        clearInterval(interval);
        ws.close();
        return;
      }
      ws.send(JSON.stringify({ type: "ping", sessionId }));
      sent++;
    }, 100);
  });
  ws.on("close", () => {
    completed++;
    if (completed === clients) {
      console.log(`Done. Connected: ${connected}, completed: ${completed}, messages/client: ${messages}`);
      process.exit(0);
    }
  });
  ws.on("error", (err) => {
    console.error("WS error", err.message);
  });
}
