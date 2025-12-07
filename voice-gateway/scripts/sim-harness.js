// Lightweight local harness to exercise ScenarioEngine + ToolGate without WS/OpenAI.
// Run after a build: `npm run sim:harness`

/* eslint-disable no-console */
const { ScenarioEngine } = require("../dist/sim/scenarioEngine");
const { ToolGate } = require("../dist/sim/toolGate");

const simId = process.env.SIM_ID || "sim_harness";
const scenarioId = "syncope";

function run() {
  const engine = new ScenarioEngine(simId, scenarioId);
  const gate = new ToolGate();

  console.log("initial", engine.getState());

  const advance = { type: "intent_advanceStage", stageId: "stage_2_worse" };
  console.log("gate advance", gate.validate(simId, engine.getStageDef(engine.getState().stageId), advance));
  console.log("apply advance", engine.applyIntent(advance));

  const vitals = { type: "intent_updateVitals", delta: { hr: 8 } };
  console.log("gate vitals", gate.validate(simId, engine.getStageDef(engine.getState().stageId), vitals));
  console.log("apply vitals", engine.applyIntent(vitals));

  console.log("final", engine.getState());
}

run();
