#!/usr/bin/env ts-node
import { getFirestore } from "../src/firebaseAdmin";

async function main() {
  const simId = process.argv[2];
  const limit = parseInt(process.argv[3] || "50", 10);
  if (!simId) {
    console.error("Usage: replaySimEvents <simId> [limit]");
    process.exit(1);
  }
  const db = getFirestore();
  if (!db) {
    console.error("Firestore not initialized. Set credentials/env before running.");
    process.exit(1);
  }
  const snap = await db
    .collection("sessions")
    .doc(simId)
    .collection("events")
    .orderBy("ts", "desc")
    .limit(limit)
    .get();
  const events = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .reverse();
  events.forEach((evt) => {
    console.log(`[${evt.ts?.toDate ? evt.ts.toDate().toISOString() : "no-ts"}] ${evt.type}`, evt.payload || {});
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
