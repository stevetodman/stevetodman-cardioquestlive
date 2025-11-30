import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminDeckEditor from "../AdminDeckEditor";

// Mock deck service so tests avoid touching Firestore/network.
jest.mock("../../utils/deckService", () => ({
  __esModule: true,
  fetchDeck: jest.fn(),
  persistDeck: jest.fn(),
}));

// Mock default deck file to keep fixtures lightweight.
jest.mock("../../data/ductalDeck", () => ({
  __esModule: true,
  defaultDeck: {
    slides: [
      {
        id: "slide0",
        index: 1,
        type: "content",
        html: "<div>Slide 0</div>",
      },
      {
        id: "slide1",
        index: 0,
        type: "question",
        html: "<div>Slide 1</div>",
        questionId: "question1",
      },
    ],
    questions: [
      {
        id: "question1",
        stem: "Question 1",
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        explanation: "",
      },
    ],
  },
}));

describe("AdminDeckEditor", () => {
  const { fetchDeck, persistDeck } = require("../../utils/deckService");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("displays loading state and renders deck after fetch", async () => {
    (fetchDeck as jest.Mock).mockResolvedValue({
      slides: [
        {
          id: "slideA",
          index: 0,
          type: "content",
          html: "<div>Slide A</div>",
        },
      ],
      questions: [],
    });

    render(<AdminDeckEditor />);
    expect(screen.getByText(/loading deck/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/deck admin/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/slide 1/i)).toBeInTheDocument();
  });

  test("skips passcode prompt when admin code is not defined", async () => {
    (fetchDeck as jest.Mock).mockResolvedValue({
      slides: [
        {
          id: "slideA",
          index: 0,
          type: "content",
          html: "<div>Slide A</div>",
        },
      ],
      questions: [],
    });

    render(<AdminDeckEditor />);
    await waitFor(() => {
      expect(screen.getByText(/deck admin/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/admin access/i)).not.toBeInTheDocument();
  });

  test("calls fetchDeck on mount and lists slides ordered by index", async () => {
    (fetchDeck as jest.Mock).mockResolvedValue({
      slides: [
        { id: "slideB", index: 2, type: "content", html: "<div>Slide B</div>" },
        { id: "slideC", index: 0, type: "question", html: "<div>Slide C</div>" },
        { id: "slideA", index: 1, type: "content", html: "<div>Slide A</div>" },
      ],
      questions: [
        {
          id: "q1",
          stem: "Stem",
          options: ["A", "B", "C", "D"],
          correctIndex: 1,
          explanation: "",
        },
      ],
    });

    render(<AdminDeckEditor />);
    expect(fetchDeck).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/deck admin/i)).toBeInTheDocument();
    });

    const slideButtons = screen.getAllByRole("button", { name: /slide/i });
    expect(slideButtons[0].textContent).toMatch(/slide 1/i);
    expect(slideButtons[1].textContent).toMatch(/slide 2/i);
    expect(slideButtons[2].textContent).toMatch(/slide 3/i);
  });

  test("normalizes slide indices and calls persistDeck on save", async () => {
    const deck = {
      slides: [
        { id: "s0", index: 5, type: "content", html: "<div>S0</div>" },
        { id: "s1", index: 2, type: "content", html: "<div>S1</div>" },
      ],
      questions: [],
    };
    (fetchDeck as jest.Mock).mockResolvedValue(deck);

    render(<AdminDeckEditor />);
    await waitFor(() => {
      expect(screen.getByText(/deck admin/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /save deck/i }));

    await waitFor(() => {
      expect(persistDeck).toHaveBeenCalled();
    });
    const savedDeck = (persistDeck as jest.Mock).mock.calls[0][0];
    expect(savedDeck.slides[0].index).toBe(0);
    expect(savedDeck.slides[1].index).toBe(1);
  });
});
