/**
 * Contexts index - Export all React contexts for state management.
 *
 * These contexts extract state from PresenterSession.tsx to:
 * - Reduce component complexity
 * - Enable state sharing across components
 * - Improve testability
 *
 * Usage:
 * ```tsx
 * import { SimulationProvider, useSimulation } from "../contexts";
 *
 * // Wrap your app
 * <SimulationProvider sessionId={sessionId}>
 *   <UIStateProvider>
 *     <DebriefProvider>
 *       <YourComponent />
 *     </DebriefProvider>
 *   </UIStateProvider>
 * </SimulationProvider>
 *
 * // Use in components
 * const { simState, setSimState } = useSimulation();
 * const { showEkg, toggleEkg } = useUIState();
 * const { debriefResult, isAnalyzing } = useDebrief();
 * ```
 */

export {
  SimulationProvider,
  useSimulation,
  useSimulationOptional,
  type SimulationContextValue,
  type SimState,
  type SimOrder,
  type SimOrderType,
  type BudgetState,
  type ExtendedState,
  type TranscriptLogTurn,
  type ActiveCharacterState,
  type TreatmentHistoryEntry,
  type TelemetryHistoryEntry,
  type EkgHistoryEntry,
  type VitalsHistoryEntry,
} from "./SimulationContext";

export {
  UIStateProvider,
  useUIState,
  useUIStateOptional,
  type UIStateContextValue,
  type EkgOrderView,
  type CxrOrderView,
} from "./UIStateContext";

export {
  DebriefProvider,
  useDebrief,
  useDebriefOptional,
  type DebriefContextValue,
  type TimelineExtra,
} from "./DebriefContext";
