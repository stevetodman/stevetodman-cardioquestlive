import { renderHook, act } from "@testing-library/react";
import { useVitalsChange } from "../useVitalsChange";

// Mock timers for testing timeout behavior
jest.useFakeTimers();

describe("useVitalsChange", () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it("returns empty set on initial render", () => {
    const { result } = renderHook(() =>
      useVitalsChange({ hr: 80, spo2: 98 })
    );
    expect(result.current.size).toBe(0);
  });

  it("does not highlight small HR changes", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { hr: 80 } } }
    );

    // Change HR by 5 (below threshold of 10)
    rerender({ vitals: { hr: 85 } });
    expect(result.current.has("hr")).toBe(false);
  });

  it("highlights significant HR increase", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { hr: 80 } } }
    );

    // Change HR by 15 (above threshold of 10)
    rerender({ vitals: { hr: 95 } });
    expect(result.current.has("hr")).toBe(true);
  });

  it("highlights significant HR decrease", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { hr: 100 } } }
    );

    // Change HR by -12 (above threshold)
    rerender({ vitals: { hr: 88 } });
    expect(result.current.has("hr")).toBe(true);
  });

  it("highlights SpO2 drop", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { spo2: 98 } } }
    );

    // Drop SpO2 by 4 (above threshold of 3)
    rerender({ vitals: { spo2: 94 } });
    expect(result.current.has("spo2")).toBe(true);
  });

  it("highlights SpO2 recovery", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { spo2: 88 } } }
    );

    // Increase SpO2 by 5 (above threshold)
    rerender({ vitals: { spo2: 93 } });
    expect(result.current.has("spo2")).toBe(true);
  });

  it("highlights BP changes", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { bp: "120/80" } } }
    );

    rerender({ vitals: { bp: "90/60" } });
    expect(result.current.has("bp")).toBe(true);
  });

  it("highlights RR changes above threshold", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { rr: 16 } } }
    );

    // Change RR by 5 (above threshold of 4)
    rerender({ vitals: { rr: 21 } });
    expect(result.current.has("rr")).toBe(true);
  });

  it("clears highlights after duration", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals, 2000),
      { initialProps: { vitals: { hr: 80 } } }
    );

    rerender({ vitals: { hr: 95 } });
    expect(result.current.has("hr")).toBe(true);

    // Fast-forward past the duration
    act(() => {
      jest.advanceTimersByTime(2100);
    });

    expect(result.current.has("hr")).toBe(false);
  });

  it("can highlight multiple vitals simultaneously", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { hr: 80, spo2: 98, rr: 16 } } }
    );

    // Change multiple vitals at once
    rerender({ vitals: { hr: 95, spo2: 92, rr: 22 } });

    expect(result.current.has("hr")).toBe(true);
    expect(result.current.has("spo2")).toBe(true);
    expect(result.current.has("rr")).toBe(true);
  });

  it("handles undefined values gracefully", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { hr: undefined } } }
    );

    // Going from undefined to defined should not highlight
    rerender({ vitals: { hr: 80 } });
    expect(result.current.has("hr")).toBe(false);
  });

  it("does not highlight when value becomes undefined", () => {
    const { result, rerender } = renderHook(
      ({ vitals }) => useVitalsChange(vitals),
      { initialProps: { vitals: { hr: 80 } } }
    );

    // Going from defined to undefined should not highlight
    rerender({ vitals: { hr: undefined } });
    expect(result.current.has("hr")).toBe(false);
  });
});
