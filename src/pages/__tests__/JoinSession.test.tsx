import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import JoinSession from "../JoinSession";

const mockOnAuthStateChanged = jest.fn();
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
}));

jest.mock("../../components/SlidePreview", () => ({
  SlidePreview: ({ html }: { html: string }) => <div data-testid="slide-preview">{html}</div>,
}));

const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();
const mockSetDoc = jest.fn();
const mockDoc = jest.fn((...args) => ({ path: args.join("/") }));
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();

jest.mock("../../utils/firestore", () => ({
  __esModule: true,
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  limit: (...args: any[]) => mockLimit(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  query: (...args: any[]) => mockQuery(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
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
      { id: "q1", stem: "What is the defect?", options: ["A", "B", "C"], correctIndex: 1, explanation: "" },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      cb({ uid: "user-123" });
      return jest.fn();
    });

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: "session1", data: () => baseSession }],
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
    const [docRef, payload] = mockSetDoc.mock.calls[0];
    expect(docRef.path).toMatch(/sessions\/session1\/responses\/user-123_q1/);
    expect(payload.choiceIndex).toBe(0);
    expect(payload.userId).toBe("user-123");
    expect(payload.questionId).toBe("q1");
  });
});
