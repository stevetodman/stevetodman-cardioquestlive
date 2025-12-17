import React from "react";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import {
  SimulationProvider,
  useSimulation,
  useSimulationOptional,
} from "../SimulationContext";

describe("SimulationContext", () => {
  describe("SimulationProvider", () => {
    it("provides default state values", () => {
      const TestComponent = () => {
        const { simState, patientState, gatewayStatus, isConnected } = useSimulation();
        return (
          <div>
            <span data-testid="simState">{simState === null ? "null" : "exists"}</span>
            <span data-testid="patientState">{patientState}</span>
            <span data-testid="gatewayState">{gatewayStatus.state}</span>
            <span data-testid="isConnected">{isConnected ? "yes" : "no"}</span>
          </div>
        );
      };

      render(
        <SimulationProvider>
          <TestComponent />
        </SimulationProvider>
      );

      expect(screen.getByTestId("simState")).toHaveTextContent("null");
      expect(screen.getByTestId("patientState")).toHaveTextContent("idle");
      expect(screen.getByTestId("gatewayState")).toHaveTextContent("disconnected");
      expect(screen.getByTestId("isConnected")).toHaveTextContent("no");
    });

    it("allows updating simulation state", () => {
      const TestComponent = () => {
        const { simState, setSimState } = useSimulation();
        return (
          <div>
            <span data-testid="stageId">{simState?.stageId ?? "none"}</span>
            <button
              onClick={() =>
                setSimState({
                  stageId: "stage_1",
                  vitals: { hr: 100 },
                  fallback: false,
                })
              }
            >
              Set State
            </button>
          </div>
        );
      };

      render(
        <SimulationProvider>
          <TestComponent />
        </SimulationProvider>
      );

      expect(screen.getByTestId("stageId")).toHaveTextContent("none");

      act(() => {
        screen.getByText("Set State").click();
      });

      expect(screen.getByTestId("stageId")).toHaveTextContent("stage_1");
    });

    it("computes isComplexScenario correctly", () => {
      const TestComponent = () => {
        const { selectedScenario, setSelectedScenario, isComplexScenario } = useSimulation();
        return (
          <div>
            <span data-testid="scenario">{selectedScenario}</span>
            <span data-testid="isComplex">{isComplexScenario ? "yes" : "no"}</span>
            <button onClick={() => setSelectedScenario("syncope")}>Set Syncope</button>
          </div>
        );
      };

      render(
        <SimulationProvider>
          <TestComponent />
        </SimulationProvider>
      );

      // Default is teen_svt_complex_v1 which is complex
      expect(screen.getByTestId("isComplex")).toHaveTextContent("yes");

      act(() => {
        screen.getByText("Set Syncope").click();
      });

      // Syncope is not complex
      expect(screen.getByTestId("isComplex")).toHaveTextContent("no");
    });

    it("manages transcript log", () => {
      const TestComponent = () => {
        const { transcriptLog, setTranscriptLog } = useSimulation();
        return (
          <div>
            <span data-testid="count">{transcriptLog.length}</span>
            <button
              onClick={() =>
                setTranscriptLog((prev) => [
                  ...prev,
                  { id: "1", timestamp: Date.now(), text: "Hello", character: "patient" },
                ])
              }
            >
              Add Turn
            </button>
          </div>
        );
      };

      render(
        <SimulationProvider>
          <TestComponent />
        </SimulationProvider>
      );

      expect(screen.getByTestId("count")).toHaveTextContent("0");

      act(() => {
        screen.getByText("Add Turn").click();
      });

      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });
  });

  describe("useSimulation", () => {
    it("throws error when used outside provider", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useSimulation());
      }).toThrow("useSimulation must be used within a SimulationProvider");

      consoleError.mockRestore();
    });
  });

  describe("useSimulationOptional", () => {
    it("returns null when used outside provider", () => {
      const { result } = renderHook(() => useSimulationOptional());
      expect(result.current).toBeNull();
    });

    it("returns context when used inside provider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SimulationProvider>{children}</SimulationProvider>
      );

      const { result } = renderHook(() => useSimulationOptional(), { wrapper });
      expect(result.current).not.toBeNull();
      expect(result.current?.patientState).toBe("idle");
    });
  });
});
