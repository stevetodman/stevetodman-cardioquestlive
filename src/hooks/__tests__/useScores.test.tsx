import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useTeamScores } from "../useTeamScores";
import { useIndividualScores } from "../useIndividualScores";

const mockOnSnapshot = jest.fn();

jest.mock("../../utils/firestore", () => ({
  __esModule: true,
  collection: (_db: any, ...args: any[]) => ({ path: args.join("/") }),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  db: {},
}));

describe("score hooks", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("useTeamScores groups points by team and sorts descending", async () => {
    mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
      cb({
        docs: [
          { data: () => ({ teamId: "a", teamName: "Team A", points: 100 }) },
          { data: () => ({ teamId: "b", teamName: "Team B", points: 200 }) },
          { data: () => ({ teamId: "a", teamName: "Team A", points: 75 }) },
        ],
      });
      return () => {};
    });

    function Wrapper() {
      const teams = useTeamScores("session1");
      return (
        <div>
          {teams.map((t) => (
            <div key={t.teamId} data-testid={`team-${t.teamId}`}>
              {t.teamName}:{t.points}
            </div>
          ))}
        </div>
      );
    }

    render(<Wrapper />);

    await waitFor(() => {
      expect(screen.getByTestId("team-b").textContent).toContain("200");
      expect(screen.getByTestId("team-a").textContent).toContain("175");
    });
  });

  test("useIndividualScores returns top N players sorted by points", async () => {
    mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
      cb({
        docs: [
          { data: () => ({ userId: "u1", teamId: "a", teamName: "A", points: 50 }) },
          { data: () => ({ userId: "u2", teamId: "b", teamName: "B", points: 150 }) },
          { data: () => ({ userId: "u3", teamId: "a", teamName: "A", points: 120 }) },
          { data: () => ({ userId: "u4", teamId: "c", teamName: "C", points: 10 }) },
        ],
      });
      return () => {};
    });

    function Wrapper() {
      const players = useIndividualScores("session1", 3);
      return (
        <div>
          {players.map((p, idx) => (
            <div key={p.userId} data-testid={`player-${idx}`}>
              {p.userId}:{p.points}
            </div>
          ))}
        </div>
      );
    }

    render(<Wrapper />);

    await waitFor(() => {
      expect(screen.getByTestId("player-0").textContent).toContain("u2:150");
      expect(screen.getByTestId("player-1").textContent).toContain("u3:120");
      expect(screen.getByTestId("player-2").textContent).toContain("u1:50");
    });
  });
});
