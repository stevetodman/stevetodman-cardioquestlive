/* Generate a temporary firebase emulator config with env overrides. */
const fs = require("fs");
const path = require("path");

const firestorePort = process.env.FIRESTORE_PORT || 62088;
const firestoreWsPort = process.env.FIRESTORE_WS_PORT || 62188;
const hubPort = process.env.FIREBASE_HUB_PORT || 62402;
const loggingPort = process.env.FIREBASE_LOGGING_PORT || 62502;

const config = {
  hosting: {
    public: "dist",
    ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
    rewrites: [{ source: "**", destination: "/index.html" }],
  },
  functions: { source: "functions" },
  firestore: { rules: "firestore.rules" },
  emulators: {
    firestore: { host: "127.0.0.1", port: Number(firestorePort), websocketPort: Number(firestoreWsPort) },
    hub: { host: "127.0.0.1", port: Number(hubPort) },
    logging: { host: "127.0.0.1", port: Number(loggingPort) },
    auth: { port: 9099 },
    functions: { port: 5001 },
    hosting: { port: 5000 },
    ui: { enabled: true },
    singleProjectMode: true,
  },
};

const target = path.join(process.cwd(), ".firebase.emu.generated.json");
fs.writeFileSync(target, JSON.stringify(config, null, 2));
console.log(`[emu] wrote ${target} (firestore:${firestorePort}, ws:${firestoreWsPort}, hub:${hubPort}, logging:${loggingPort})`);
