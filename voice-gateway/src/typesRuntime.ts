import { ScenarioEngine } from "./sim/scenarioEngine";
import { ToolGate } from "./sim/toolGate";
import { CostController } from "./sim/costController";
import { RealtimePatientClient } from "./sim/realtimePatientClient";

export type Runtime = {
  realtime?: RealtimePatientClient;
  fallback: boolean;
  scenarioEngine: ScenarioEngine;
  toolGate: ToolGate;
  cost: CostController;
};
