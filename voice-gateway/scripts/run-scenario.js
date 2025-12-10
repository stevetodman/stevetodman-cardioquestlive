#!/usr/bin/env node
/**
 * Quick-run script for testing scenarios locally without WebSocket/OpenAI.
 *
 * Usage:
 *   npm run scenario <scenario_id>
 *   npm run scenario teen_svt_complex_v1
 *   npm run scenario peds_myocarditis_silent_crash_v1
 *   npm run scenario syncope
 *
 * Available scenarios:
 *   - syncope                           (Teen syncope)
 *   - exertional_chest_pain             (Teen chest pain)
 *   - palpitations_svt                  (Basic SVT)
 *   - teen_svt_complex_v1               (Complex SVT - PALS algorithm)
 *   - exertional_syncope_hcm            (HCM)
 *   - arrhythmogenic_syncope            (ARVC/CPVT)
 *   - myocarditis                       (Basic myocarditis)
 *   - peds_myocarditis_silent_crash_v1  (Complex myocarditis)
 *   - kawasaki                          (Kawasaki disease)
 *   - cyanotic_spell                    (Tet spell)
 *   - ductal_shock                      (Ductal-dependent)
 *   - coarctation_shock                 (Coarctation)
 */

/* eslint-disable no-console */
const { ScenarioEngine } = require("../dist/sim/scenarioEngine");
const { ToolGate } = require("../dist/sim/toolGate");

const AVAILABLE_SCENARIOS = [
  "syncope",
  "exertional_chest_pain",
  "palpitations_svt",
  "teen_svt_complex_v1",
  "exertional_syncope_hcm",
  "arrhythmogenic_syncope",
  "myocarditis",
  "peds_myocarditis_silent_crash_v1",
  "kawasaki",
  "cyanotic_spell",
  "ductal_shock",
  "coarctation_shock",
];

function printUsage() {
  console.log("\nUsage: npm run scenario <scenario_id>\n");
  console.log("Available scenarios:");
  AVAILABLE_SCENARIOS.forEach((s) => console.log(`  - ${s}`));
  console.log("\nExamples:");
  console.log("  npm run scenario teen_svt_complex_v1");
  console.log("  npm run scenario peds_myocarditis_silent_crash_v1\n");
}

function run() {
  const scenarioId = process.argv[2];

  if (!scenarioId || scenarioId === "--help" || scenarioId === "-h") {
    printUsage();
    process.exit(0);
  }

  if (!AVAILABLE_SCENARIOS.includes(scenarioId)) {
    console.error(`\nError: Unknown scenario '${scenarioId}'`);
    printUsage();
    process.exit(1);
  }

  const simId = `sim_${Date.now()}`;
  console.log(`\n=== Running scenario: ${scenarioId} ===\n`);

  try {
    const engine = new ScenarioEngine(simId, scenarioId);
    const gate = new ToolGate();

    const state = engine.getState();
    console.log("Initial State:");
    console.log("  Stage:", state.stageId);
    console.log("  Vitals:", JSON.stringify(state.vitals, null, 2));

    if (state.extendedState) {
      console.log("  Phase:", state.extendedState.phase);
      if (state.extendedState.currentScore !== undefined) {
        console.log("  Current Score:", state.extendedState.currentScore);
      }
    }

    console.log("\nScenario Definition:");
    const def = engine.getScenarioDef();
    console.log("  ID:", def.id);
    console.log("  Version:", def.version);
    console.log("  Demographics:", JSON.stringify(def.demographics));
    console.log("  Stages:", def.stages.map((s) => s.id).join(", "));

    // Show available stage transitions
    const stageDef = engine.getStageDef(state.stageId);
    if (stageDef) {
      console.log("\nCurrent Stage:", stageDef.id);
      console.log("  Vitals:", JSON.stringify(stageDef.vitals));
      if (stageDef.duration) {
        console.log("  Duration:", stageDef.duration, "seconds");
      }
    }

    // Example intent validation
    const testIntent = { type: "intent_updateVitals", delta: { hr: 10 } };
    const validation = gate.validate(simId, stageDef, testIntent);
    console.log("\nTest intent validation (HR +10):", validation.allowed ? "ALLOWED" : "BLOCKED");

    console.log("\n=== Scenario loaded successfully ===\n");
    console.log("Run interactively with:");
    console.log(`  npm run sim:harness  (then modify SIM_ID/scenarioId in script)`);
    console.log("");

  } catch (err) {
    console.error("\nError loading scenario:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
