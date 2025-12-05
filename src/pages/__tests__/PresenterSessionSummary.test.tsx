import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PresenterSession from "../PresenterSession";

const mockOnSnapshot = jest.fn();
const mockCollection = jest.fn((...args) => ({ path: args.join("/") }));
const mockDoc = jest.fn((...args) => ({ path: args.join("/") }));
const mockUpdateDoc = jest.fn();
const mockQuery = jest.fn((ref) => ref);
const mockWhere = jest.fn();

jest.mock("../../utils/firestore", () => ({
  __esModule: true,
  doc: (...args: any[]) => mockDoc(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  db: {},
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
}));

jest.mock("../../hooks/useTeamScores", () => ({
  useTeamScores: () => [{ teamId: "a", teamName: "Team A", points: 100 }],
}));

jest.mock("../../hooks/useIndividualScores", () => ({
  useIndividualScores: () => [{ userId: "u1", teamId: "a", teamName: "Team A", points: 80 }],
}));

jest.mock("../../services/voiceCommands", () => ({
  sendVoiceCommand: jest.fn(),
}));

describe("PresenterSession summary toggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const sessionData = {
      id: "session1",
      title: "Test Session",
      joinCode: "ABCD",
      currentSlideIndex: 0,
      currentQuestionId: null,
      showResults: false,
      slides: [
        { id: "s1", index: 0, type: "content", html: "<div>Slide</div>" },
      ],
      questions: [
        { id: "q1", stem: "Q", options: ["A", "B"], correctIndex: 0 },
      ],
      createdAt: new Date().toISOString(),
    };

    // onSnapshot mock: first for session doc, then responses/participants listeners
    mockOnSnapshot.mockImplementation((ref: any, cb: any) => {
      const path = ref?.path ?? "";
      if (typeof path === "string" && path.includes("sessions/session1") && !path.includes("responses") && !path.includes("participants")) {
        cb({ exists: () => true, data: () => sessionData, id: "session1" });
      } else if (typeof path === "string" && path.includes("responses")) {
        cb({ docs: [{ data: () => ({ questionId: "q1", choiceIndex: 0 }) }] });
      } else if (typeof path === "string" && path.includes("participants")) {
        cb({
          docs: [
            { data: () => ({ correctCount: 1, incorrectCount: 1, points: 100, teamId: "a", teamName: "Team A" }) },
          ],
        });
      }
      return () => {};
    });
  });

  test("shows session summary when toggled", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/presenter/session1"]}>
        <Routes>
          <Route path="/presenter/:sessionId" element={<PresenterSession />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Test Session/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Session summary/i }));
    expect(screen.getByText(/Results & Standings/i)).toBeInTheDocument();
  });
});
