import React from "react";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import {
  DebriefProvider,
  useDebrief,
  useDebriefOptional,
} from "../DebriefContext";

describe("DebriefContext", () => {
  describe("DebriefProvider", () => {
    it("provides default state values", () => {
      const TestComponent = () => {
        const { isAnalyzing, debriefResult, timelineFilter } = useDebrief();
        return (
          <div>
            <span data-testid="isAnalyzing">{isAnalyzing ? "yes" : "no"}</span>
            <span data-testid="debriefResult">{debriefResult ? "exists" : "null"}</span>
            <span data-testid="timelineFilter">{timelineFilter}</span>
          </div>
        );
      };

      render(
        <DebriefProvider>
          <TestComponent />
        </DebriefProvider>
      );

      expect(screen.getByTestId("isAnalyzing")).toHaveTextContent("no");
      expect(screen.getByTestId("debriefResult")).toHaveTextContent("null");
      expect(screen.getByTestId("timelineFilter")).toHaveTextContent("all");
    });

    it("addTimelineExtra adds entries", () => {
      const TestComponent = () => {
        const { timelineExtras, addTimelineExtra } = useDebrief();
        return (
          <div>
            <span data-testid="count">{timelineExtras.length}</span>
            <ul data-testid="list">
              {timelineExtras.map((e) => (
                <li key={e.id}>{e.label}: {e.detail}</li>
              ))}
            </ul>
            <button onClick={() => addTimelineExtra("Test", "Test detail")}>Add</button>
          </div>
        );
      };

      render(
        <DebriefProvider>
          <TestComponent />
        </DebriefProvider>
      );

      expect(screen.getByTestId("count")).toHaveTextContent("0");

      act(() => {
        screen.getByText("Add").click();
      });

      expect(screen.getByTestId("count")).toHaveTextContent("1");
      expect(screen.getByTestId("list")).toHaveTextContent("Test: Test detail");

      act(() => {
        screen.getByText("Add").click();
      });

      expect(screen.getByTestId("count")).toHaveTextContent("2");
    });

    it("clearDebrief resets analysis state", () => {
      const TestComponent = () => {
        const { isAnalyzing, setIsAnalyzing, debriefResult, setDebriefResult, clearDebrief } = useDebrief();
        return (
          <div>
            <span data-testid="isAnalyzing">{isAnalyzing ? "yes" : "no"}</span>
            <span data-testid="debriefResult">{debriefResult ? "exists" : "null"}</span>
            <button
              onClick={() => {
                setIsAnalyzing(true);
                setDebriefResult({
                  turns: [],
                  summary: "Test summary",
                });
              }}
            >
              Set Result
            </button>
            <button onClick={clearDebrief}>Clear</button>
          </div>
        );
      };

      render(
        <DebriefProvider>
          <TestComponent />
        </DebriefProvider>
      );

      act(() => {
        screen.getByText("Set Result").click();
      });

      expect(screen.getByTestId("isAnalyzing")).toHaveTextContent("yes");
      expect(screen.getByTestId("debriefResult")).toHaveTextContent("exists");

      act(() => {
        screen.getByText("Clear").click();
      });

      expect(screen.getByTestId("isAnalyzing")).toHaveTextContent("no");
      expect(screen.getByTestId("debriefResult")).toHaveTextContent("null");
    });

    it("manages export status", () => {
      const TestComponent = () => {
        const { exportStatus, setExportStatus } = useDebrief();
        return (
          <div>
            <span data-testid="status">{exportStatus}</span>
            <button onClick={() => setExportStatus("exporting")}>Start Export</button>
            <button onClick={() => setExportStatus("exported")}>Complete</button>
            <button onClick={() => setExportStatus("error")}>Error</button>
          </div>
        );
      };

      render(
        <DebriefProvider>
          <TestComponent />
        </DebriefProvider>
      );

      expect(screen.getByTestId("status")).toHaveTextContent("idle");

      act(() => {
        screen.getByText("Start Export").click();
      });

      expect(screen.getByTestId("status")).toHaveTextContent("exporting");

      act(() => {
        screen.getByText("Complete").click();
      });

      expect(screen.getByTestId("status")).toHaveTextContent("exported");

      act(() => {
        screen.getByText("Error").click();
      });

      expect(screen.getByTestId("status")).toHaveTextContent("error");
    });

    it("manages complex debrief result", () => {
      const TestComponent = () => {
        const { complexDebriefResult, setComplexDebriefResult } = useDebrief();
        return (
          <div>
            <span data-testid="grade">{complexDebriefResult?.grade ?? "none"}</span>
            <button
              onClick={() =>
                setComplexDebriefResult({
                  scenarioId: "teen_svt_complex_v1",
                  passed: true,
                  grade: "A",
                  totalPoints: 95,
                  basePoints: 50,
                  checklistPoints: 40,
                  bonusPoints: 10,
                  penaltyPoints: -5,
                  checklistResults: [],
                  bonusResults: [],
                  penaltyResults: [],
                  timeline: [],
                  elapsedMs: 300000,
                })
              }
            >
              Set Grade
            </button>
          </div>
        );
      };

      render(
        <DebriefProvider>
          <TestComponent />
        </DebriefProvider>
      );

      expect(screen.getByTestId("grade")).toHaveTextContent("none");

      act(() => {
        screen.getByText("Set Grade").click();
      });

      expect(screen.getByTestId("grade")).toHaveTextContent("A");
    });
  });

  describe("useDebrief", () => {
    it("throws error when used outside provider", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useDebrief());
      }).toThrow("useDebrief must be used within a DebriefProvider");

      consoleError.mockRestore();
    });
  });

  describe("useDebriefOptional", () => {
    it("returns null when used outside provider", () => {
      const { result } = renderHook(() => useDebriefOptional());
      expect(result.current).toBeNull();
    });

    it("returns context when used inside provider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <DebriefProvider>{children}</DebriefProvider>
      );

      const { result } = renderHook(() => useDebriefOptional(), { wrapper });
      expect(result.current).not.toBeNull();
      expect(result.current?.isAnalyzing).toBe(false);
    });
  });
});
