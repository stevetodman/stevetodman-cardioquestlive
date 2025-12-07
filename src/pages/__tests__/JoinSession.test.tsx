import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import JoinSession from "../JoinSession";
import { ParticipantDoc } from "../../../types";

const mockOnAuthStateChanged = jest.fn();
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
}));

jest.mock("../../components/SlidePreview", () => ({
  SlidePreview: ({ html }: { html: string }) => <div data-testid="slide-preview">{html}</div>,
}));

jest.mock("../../services/VoiceGatewayClient", () => ({
  voiceGatewayClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    startSpeaking: jest.fn(),
    stopSpeaking: jest.fn(),
    sendVoiceCommand: jest.fn(),
    onPatientState: () => () => {},
    onPatientTranscriptDelta: () => () => {},
    onParticipantState: () => () => {},
    onSimState: () => () => {},
    onStatus: () => () => {},
  },
}));

const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();
const mockSetDoc = jest.fn();
const mockDoc = jest.fn((...args) => ({ path: args.join("/") }));
const mockCollection = jest.fn();
const mockGetDoc = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockRunTransaction = jest.fn((_db, fn) =>
  fn({
    get: async () => ({ exists: () => false, data: () => null }),
    set: () => {},
    update: () => {},
  })
);

jest.mock("../../utils/firestore", () => ({
  __esModule: true,
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  limit: (...args: any[]) => mockLimit(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  query: (...args: any[]) => mockQuery(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  runTransaction: (...args: any[]) => mockRunTransaction(...args),
  where: (...args: any[]) => mockWhere(...args),
  db: {},
}));

jest.mock("../../firebase", () => ({
  __esModule: true,
  isConfigured: true,
  auth: { currentUser: { uid: "user-123" } },
  ensureSignedIn: jest.fn().mockResolvedValue(undefined),
}));

function renderJoin(joinCode = "ABCD") {
  return render(
    <MemoryRouter initialEntries={[`/join/${joinCode}`]}>
      <Routes>
        <Route path="/join/:joinCode" element={<JoinSession />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("JoinSession", () => {
  const baseSession = {
    id: "session1",
    joinCode: "ABCD",
    currentSlideIndex: 0,
    currentQuestionId: "q1",
    showResults: false,
    slides: [
      { id: "slide1", index: 0, type: "question", html: "<div>Q Slide</div>", questionId: "q1" },
    ],
    questions: [
      {
        id: "q1",
        stem: "What is the defect?",
        options: ["A", "B", "C"],
        correctIndex: 1,
        explanation: "",
        difficulty: "medium",
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      cb({ uid: "user-123" });
      return jest.fn();
    });
    mockGetDoc.mockImplementation(async (ref: any) => {
      if (ref.path.includes("/participants/")) {
        return { exists: () => false, data: () => null };
      }
      if (ref.path.includes("/responses/")) {
        return { exists: () => false, data: () => null };
      }
      return { exists: () => false, data: () => null };
    });

    mockGetDocs.mockImplementation(async (arg: any) => {
      if (typeof arg === "object" && arg?.path?.includes("participants")) {
        return {
          empty: true,
          docs: [],
          forEach: (fn: any) => [],
        };
      }
      return {
        empty: false,
        docs: [{ id: "session1", data: () => baseSession }],
      };
    });

    mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
      cb({ exists: () => true, id: "session1", data: () => baseSession });
      return () => {};
    });
  });

  test("renders question and options when session loads", async () => {
    renderJoin();

    await waitFor(() => expect(screen.getByText(/What is the defect/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /A/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /B/ })).toBeInTheDocument();
  });

  test("submits a single response with deterministic doc id", async () => {
    const user = userEvent.setup();
    renderJoin();

    await waitFor(() => screen.getByText(/What is the defect/i));
    await user.click(screen.getByRole("button", { name: /A/ }));

    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
    const responseCall = mockSetDoc.mock.calls.find(([ref]) =>
      ref?.path?.includes("responses")
    );
    expect(responseCall).toBeDefined();
    const [docRef, payload] = responseCall as any;
    expect(docRef.path).toMatch(/sessions\/session1\/responses\/user-123_q1/);
    expect(payload.choiceIndex).toBe(0);
    expect(payload.userId).toBe("user-123");
    expect(payload.questionId).toBe("q1");
  });

  test("creates participant doc with defaults and assigns least-loaded team", async () => {
    mockGetDocs.mockImplementation(async (arg: any) => {
      if (typeof arg === "object" && arg?.path?.includes("participants")) {
        return {
          empty: true,
          docs: [
            { data: () => ({ teamId: "team_ductus" }) },
            { data: () => ({ teamId: "team_cyanosis" }) },
            { data: () => ({ teamId: "team_cyanosis" }) },
          ],
          forEach: (fn: any) => {
            [
              { teamId: "team_ductus" },
              { teamId: "team_cyanosis" },
              { teamId: "team_cyanosis" },
            ].forEach((d) => fn({ data: () => d }));
          },
        };
      }
      return {
        empty: false,
        docs: [{ id: "session1", data: () => baseSession }],
      };
    });

    renderJoin();
    await waitFor(() =>
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringMatching(/participants\/user-123$/) }),
        expect.objectContaining({
          points: 0,
          streak: 0,
          correctCount: 0,
          incorrectCount: 0,
          teamId: "team_ductus",
        })
      )
    );
  });

  test("awards points and streak on first correct answer only", async () => {
    const user = userEvent.setup();
    const participantState: ParticipantDoc = {
      userId: "user-123",
      sessionId: "session1",
      teamId: "team_ductus",
      teamName: "Team Ductus",
      points: 200,
      streak: 2,
      correctCount: 1,
      incorrectCount: 0,
      createdAt: "iso",
    };

    mockGetDoc.mockImplementation(async (ref: any) => {
      if (ref.path.includes("/participants/")) {
        return { exists: () => true, data: () => participantState };
      }
      if (ref.path.includes("/responses/")) {
        return { exists: () => false, data: () => null };
      }
      return { exists: () => false, data: () => null };
    });

    const updateSpy = jest.fn();
    mockRunTransaction.mockImplementationOnce(async (_db, fn) =>
      fn({
        get: async () => ({ exists: () => true, data: () => participantState }),
        set: jest.fn(),
        update: updateSpy,
      })
    );

    renderJoin();
    await waitFor(() => screen.getByText(/What is the defect/i));
    await user.click(screen.getByRole("button", { name: /B/ })); // correct choiceIndex 1

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringMatching(/participants\/user-123$/) }),
        expect.objectContaining({
          points: 343, // 200 + round(100 * 1.3 * 1.1)
          streak: 3,
          correctCount: 2,
          incorrectCount: 0,
        })
      )
    );

    // second submission should not trigger another transaction
    mockGetDoc.mockImplementation(async (ref: any) => {
      if (ref.path.includes("/participants/")) {
        return { exists: () => true, data: () => participantState };
      }
      if (ref.path.includes("/responses/")) {
        return { exists: () => true, data: () => ({ choiceIndex: 1 }) };
      }
      return { exists: () => false, data: () => null };
    });

    await user.click(screen.getByRole("button", { name: /A/ })); // incorrect, but second attempt
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });

  test("incorrect answer resets streak and increments incorrectCount", async () => {
    const user = userEvent.setup();
    const participantState: ParticipantDoc = {
      userId: "user-123",
      sessionId: "session1",
      teamId: "team_ductus",
      teamName: "Team Ductus",
      points: 500,
      streak: 3,
      correctCount: 3,
      incorrectCount: 0,
      createdAt: "iso",
    };

    mockGetDoc.mockImplementation(async (ref: any) => {
      if (ref.path.includes("/participants/")) {
        return { exists: () => true, data: () => participantState };
      }
      if (ref.path.includes("/responses/")) {
        return { exists: () => false, data: () => null };
      }
      return { exists: () => false, data: () => null };
    });

    const updateSpy = jest.fn();
    mockRunTransaction.mockImplementationOnce(async (_db, fn) =>
      fn({
        get: async () => ({ exists: () => true, data: () => participantState }),
        set: jest.fn(),
        update: updateSpy,
      })
    );

    renderJoin();
    await waitFor(() => screen.getByText(/What is the defect/i));
    await user.click(screen.getByRole("button", { name: /A/ })); // incorrect

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringMatching(/participants\/user-123$/) }),
        expect.objectContaining({
          points: 500,
          streak: 0,
          correctCount: 3,
          incorrectCount: 1,
        })
      )
    );
  });
});
