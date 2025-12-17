import React from "react";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import {
  UIStateProvider,
  useUIState,
  useUIStateOptional,
} from "../UIStateContext";

describe("UIStateContext", () => {
  describe("UIStateProvider", () => {
    it("provides default state values", () => {
      const TestComponent = () => {
        const { showTeamScores, showEkg, loading } = useUIState();
        return (
          <div>
            <span data-testid="showTeamScores">{showTeamScores ? "yes" : "no"}</span>
            <span data-testid="showEkg">{showEkg ? "yes" : "no"}</span>
            <span data-testid="loading">{loading ? "yes" : "no"}</span>
          </div>
        );
      };

      render(
        <UIStateProvider>
          <TestComponent />
        </UIStateProvider>
      );

      expect(screen.getByTestId("showTeamScores")).toHaveTextContent("yes");
      expect(screen.getByTestId("showEkg")).toHaveTextContent("no");
      expect(screen.getByTestId("loading")).toHaveTextContent("yes");
    });

    it("toggle functions work correctly", () => {
      const TestComponent = () => {
        const { showEkg, toggleEkg, showQr, toggleQr } = useUIState();
        return (
          <div>
            <span data-testid="showEkg">{showEkg ? "yes" : "no"}</span>
            <span data-testid="showQr">{showQr ? "yes" : "no"}</span>
            <button onClick={toggleEkg}>Toggle EKG</button>
            <button onClick={toggleQr}>Toggle QR</button>
          </div>
        );
      };

      render(
        <UIStateProvider>
          <TestComponent />
        </UIStateProvider>
      );

      expect(screen.getByTestId("showEkg")).toHaveTextContent("no");
      expect(screen.getByTestId("showQr")).toHaveTextContent("no");

      act(() => {
        screen.getByText("Toggle EKG").click();
      });

      expect(screen.getByTestId("showEkg")).toHaveTextContent("yes");

      act(() => {
        screen.getByText("Toggle QR").click();
      });

      expect(screen.getByTestId("showQr")).toHaveTextContent("yes");

      // Toggle again
      act(() => {
        screen.getByText("Toggle EKG").click();
      });

      expect(screen.getByTestId("showEkg")).toHaveTextContent("no");
    });

    it("manages viewer state", () => {
      const TestComponent = () => {
        const { viewingEkgOrder, setViewingEkgOrder } = useUIState();
        return (
          <div>
            <span data-testid="viewing">{viewingEkgOrder ? viewingEkgOrder.summary : "none"}</span>
            <button
              onClick={() =>
                setViewingEkgOrder({
                  imageUrl: "http://example.com/ekg.png",
                  summary: "Normal sinus rhythm",
                  timestamp: Date.now(),
                })
              }
            >
              View EKG
            </button>
            <button onClick={() => setViewingEkgOrder(null)}>Close</button>
          </div>
        );
      };

      render(
        <UIStateProvider>
          <TestComponent />
        </UIStateProvider>
      );

      expect(screen.getByTestId("viewing")).toHaveTextContent("none");

      act(() => {
        screen.getByText("View EKG").click();
      });

      expect(screen.getByTestId("viewing")).toHaveTextContent("Normal sinus rhythm");

      act(() => {
        screen.getByText("Close").click();
      });

      expect(screen.getByTestId("viewing")).toHaveTextContent("none");
    });

    it("manages copy toast", () => {
      const TestComponent = () => {
        const { copyToast, setCopyToast } = useUIState();
        return (
          <div>
            <span data-testid="toast">{copyToast ?? "none"}</span>
            <button onClick={() => setCopyToast("Copied!")}>Show Toast</button>
          </div>
        );
      };

      render(
        <UIStateProvider>
          <TestComponent />
        </UIStateProvider>
      );

      expect(screen.getByTestId("toast")).toHaveTextContent("none");

      act(() => {
        screen.getByText("Show Toast").click();
      });

      expect(screen.getByTestId("toast")).toHaveTextContent("Copied!");
    });
  });

  describe("useUIState", () => {
    it("throws error when used outside provider", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useUIState());
      }).toThrow("useUIState must be used within a UIStateProvider");

      consoleError.mockRestore();
    });
  });

  describe("useUIStateOptional", () => {
    it("returns null when used outside provider", () => {
      const { result } = renderHook(() => useUIStateOptional());
      expect(result.current).toBeNull();
    });

    it("returns context when used inside provider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <UIStateProvider>{children}</UIStateProvider>
      );

      const { result } = renderHook(() => useUIStateOptional(), { wrapper });
      expect(result.current).not.toBeNull();
      expect(result.current?.loading).toBe(true);
    });
  });
});
