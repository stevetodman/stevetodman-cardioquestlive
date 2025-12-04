import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
  const originalEnv = process.env.VITE_ADMIN_ACCESS_CODE;
  const originalPrompt = window.prompt;
  const originalConfirm = window.confirm;
  const originalFileReader = (global as any).FileReader;

  beforeEach(() => {
    process.env.VITE_ADMIN_ACCESS_CODE = "TEST_CODE";
    jest.clearAllMocks();
    window.prompt = originalPrompt;
    window.confirm = originalConfirm;
    (global as any).FileReader = originalFileReader;
  });

  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env.VITE_ADMIN_ACCESS_CODE;
    } else {
      process.env.VITE_ADMIN_ACCESS_CODE = originalEnv;
    }
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

    const user = userEvent.setup();
    render(<AdminDeckEditor />);

    await user.type(screen.getByPlaceholderText(/access code/i), "TEST_CODE");
    await user.click(screen.getByRole("button", { name: /unlock editor/i }));

    await waitFor(() => {
      expect(screen.getByText(/deck admin/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/slide 1/i)).toBeInTheDocument();
  });

  test("shows disabled state when admin code is not defined", async () => {
    delete process.env.VITE_ADMIN_ACCESS_CODE;
    render(<AdminDeckEditor />);
    expect(screen.getByText(/admin locked/i)).toBeInTheDocument();
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
    await userEvent.type(screen.getByPlaceholderText(/access code/i), "TEST_CODE");
    await userEvent.click(screen.getByRole("button", { name: /unlock editor/i }));
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
    await userEvent.type(screen.getByPlaceholderText(/access code/i), "TEST_CODE");
    await userEvent.click(screen.getByRole("button", { name: /unlock editor/i }));

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

  test("pastes image data URLs with optional alt and prevents default", async () => {
    (fetchDeck as jest.Mock).mockResolvedValue({
      slides: [{ id: "s1", index: 0, type: "content", html: "" }],
      questions: [],
    });

    const mockReadAsDataURL = jest.fn(function (this: any) {
      this.result = "data:image/png;base64,TEST";
      setTimeout(() => this.onload && this.onload(), 0);
    });
    (global as any).FileReader = jest.fn(() => ({
      onload: null,
      onerror: null,
      readAsDataURL: mockReadAsDataURL,
      result: "",
    }));
    window.prompt = jest.fn().mockReturnValue("Alt Text");

    render(<AdminDeckEditor />);
    await userEvent.type(screen.getByPlaceholderText(/access code/i), "TEST_CODE");
    await userEvent.click(screen.getByRole("button", { name: /unlock editor/i }));
    await waitFor(() => expect(screen.getByText(/deck admin/i)).toBeInTheDocument());

    const textarea = screen.getByLabelText(/slide html/i) as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(0, 0);

    const preventDefault = jest.fn();
    const file = new File(["data"], "test.png", { type: "image/png" });
    const imageItem = { kind: "file", type: "image/png", getAsFile: () => file };
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.assign(pasteEvent, {
      clipboardData: { items: [imageItem] },
      preventDefault,
    });

    fireEvent(textarea, pasteEvent);

    await waitFor(() => expect(preventDefault).toHaveBeenCalled());
    await waitFor(() => expect(textarea.value).toMatch(/<img/));
    expect(textarea.value).toMatch(/Alt Text/);
  });

  test("paste does nothing special when no image is present", async () => {
    (fetchDeck as jest.Mock).mockResolvedValue({
      slides: [{ id: "s1", index: 0, type: "content", html: "" }],
      questions: [],
    });

    render(<AdminDeckEditor />);
    await userEvent.type(screen.getByPlaceholderText(/access code/i), "TEST_CODE");
    await userEvent.click(screen.getByRole("button", { name: /unlock editor/i }));
    await waitFor(() => expect(screen.getByText(/deck admin/i)).toBeInTheDocument());

    const textarea = screen.getByLabelText(/slide html/i) as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    const preventDefault = jest.fn();
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.assign(pasteEvent, {
      clipboardData: { items: [] },
      preventDefault,
    });
    textarea.dispatchEvent(pasteEvent);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(textarea.value).toBe("");
  });

  test("applies template to empty slide", async () => {
    (fetchDeck as jest.Mock).mockResolvedValue({
      slides: [{ id: "s1", index: 0, type: "content", html: "" }],
      questions: [],
    });

    render(<AdminDeckEditor />);
    await userEvent.type(screen.getByPlaceholderText(/access code/i), "TEST_CODE");
    await userEvent.click(screen.getByRole("button", { name: /unlock editor/i }));
    await waitFor(() => expect(screen.getByText(/deck admin/i)).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText(/template/i), "phenotype");
    const textarea = screen.getByLabelText(/slide html/i) as HTMLTextAreaElement;
    expect(textarea.value).toMatch(/Phenotype/);
    expect(textarea.value).toMatch(/cq-tiles/);
  });

  test("inserts snippet at caret", async () => {
    (fetchDeck as jest.Mock).mockResolvedValue({
      slides: [{ id: "s1", index: 0, type: "content", html: "Start" }],
      questions: [],
    });

    render(<AdminDeckEditor />);
    await userEvent.type(screen.getByPlaceholderText(/access code/i), "TEST_CODE");
    await userEvent.click(screen.getByRole("button", { name: /unlock editor/i }));
    await waitFor(() => expect(screen.getByText(/deck admin/i)).toBeInTheDocument());

    const textarea = screen.getByLabelText(/slide html/i) as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await userEvent.click(screen.getByRole("button", { name: /\+ heading/i }));
    expect(textarea.value).toMatch(/<h1>Slide Title<\/h1>/);
  });
});
