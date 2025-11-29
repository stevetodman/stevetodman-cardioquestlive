import React, { useEffect, useMemo, useState } from "react";
import type { DeckData, Question, Slide } from "../types";
import { defaultDeck } from "../data/ductalDeck";
import { fetchDeck, persistDeck } from "../utils/deckService";

const ADMIN_CODE = import.meta.env.VITE_ADMIN_ACCESS_CODE?.trim();

type SlideField = keyof Omit<Slide, "id">;

function createEmptySlide(type: Slide["type"], index: number): Slide {
  return {
    id: `slide_${Date.now()}`,
    index,
    type,
    html: `<div class="w-full h-full bg-slate-900 text-slate-50 p-6">
  <h2 class="text-2xl font-semibold mb-4">${type === "content" ? "New Content" : "New Question"}</h2>
  <p>Edit this slide in the admin editor.</p>
</div>`,
    questionId: type === "question" ? "" : undefined,
  };
}

function createEmptyQuestion(): Question {
  return {
    id: `question_${Date.now()}`,
    stem: "Edit this question stem",
    options: ["Option 1", "Option 2", "Option 3", "Option 4"],
    correctIndex: 0,
    explanation: "",
  };
}

export default function AdminDeckEditor() {
  const [deck, setDeck] = useState<DeckData>(defaultDeck);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [accessGranted, setAccessGranted] = useState(!ADMIN_CODE);
  const [codeInput, setCodeInput] = useState("");

  useEffect(() => {
    loadDeck();
  }, []);

  async function loadDeck() {
    setLoading(true);
    try {
      const data = await fetchDeck();
      setDeck(data);
      setSelectedSlideId(data.slides[0]?.id ?? null);
      setSelectedQuestionId(data.questions[0]?.id ?? null);
    } catch (error) {
      console.error("Failed to load deck", error);
    } finally {
      setLoading(false);
    }
  }

  const slidesSorted = useMemo(() => {
    return [...deck.slides].sort((a, b) => a.index - b.index);
  }, [deck.slides]);

  const selectedSlide = slidesSorted.find((slide) => slide.id === selectedSlideId) ?? null;
  const selectedQuestion =
    deck.questions.find((q) => q.id === selectedQuestionId) ?? null;

  const linkedQuestion = selectedSlide?.questionId
    ? deck.questions.find((q) => q.id === selectedSlide.questionId)
    : null;

  function updateSlide(id: string, field: SlideField, value: any) {
    setDeck((prev) => ({
      ...prev,
      slides: prev.slides.map((slide) =>
        slide.id === id ? { ...slide, [field]: value } : slide
      ),
    }));
  }

  function moveSlide(id: string, delta: number) {
    setDeck((prev) => {
      const sorted = [...prev.slides].sort((a, b) => a.index - b.index);
      const currentIndex = sorted.findIndex((s) => s.id === id);
      const targetIndex = currentIndex + delta;
      if (targetIndex < 0 || targetIndex >= sorted.length) return prev;
      [sorted[currentIndex], sorted[targetIndex]] = [
        { ...sorted[targetIndex], index: currentIndex },
        { ...sorted[currentIndex], index: targetIndex },
      ];
      return { ...prev, slides: sorted.map((slide, idx) => ({ ...slide, index: idx })) };
    });
  }

  function addSlide(type: Slide["type"]) {
    setDeck((prev) => {
      const newSlide = createEmptySlide(type, prev.slides.length);
      return { ...prev, slides: [...prev.slides, newSlide] };
    });
    setStatus(null);
  }

  function removeSlide(id: string) {
    setDeck((prev) => ({
      ...prev,
      slides: prev.slides
        .filter((slide) => slide.id !== id)
        .map((slide, idx) => ({ ...slide, index: idx })),
    }));
    setSelectedSlideId((prevId) => (prevId === id ? null : prevId));
  }

  function addQuestion() {
    const newQuestion = createEmptyQuestion();
    setDeck((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
    setSelectedQuestionId(newQuestion.id);
  }

  function updateQuestion(id: string, updater: (question: Question) => Question) {
    setDeck((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === id ? updater(question) : question
      ),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const normalizedDeck: DeckData = {
        ...deck,
        slides: slidesSorted.map((slide, index) => ({ ...slide, index })),
      };
      await persistDeck(normalizedDeck);
      setDeck(normalizedDeck);
      setStatus("Deck saved successfully.");
    } catch (error) {
      console.error(error);
      setStatus("Failed to save deck. Check console for details.");
    } finally {
      setSaving(false);
    }
  }

  const deckPasscodeSection = !accessGranted ? (
    <div className="max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-semibold text-white text-center">Admin Access</h2>
      <p className="text-slate-400 text-sm">
        Enter the admin access code to modify the CardioQuest Live deck.
      </p>
      <input
        type="password"
        value={codeInput}
        onChange={(event) => setCodeInput(event.target.value)}
        placeholder="Access code"
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none"
      />
      <button
        onClick={() => {
          if (codeInput.trim() === ADMIN_CODE) {
            setAccessGranted(true);
          } else {
            setStatus("Incorrect access code");
          }
        }}
        className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 transition-colors"
      >
        Unlock Editor
      </button>
      {status && <p className="text-sm text-rose-400 text-center">{status}</p>}
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Loading deck...</div>
      </div>
    );
  }

  if (!accessGranted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
        {deckPasscodeSection}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Deck Admin</h1>
            <p className="text-sm text-slate-400">
              Edit slides and questions, then save to update new sessions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadDeck}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
              disabled={loading}
            >
              Reload Deck
            </button>
            <button
              onClick={() => setDeck(defaultDeck)}
              className="rounded-lg border border-rose-700/70 px-4 py-2 text-sm text-rose-300 hover:bg-rose-900/30"
            >
              Reset to Default
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Deck"}
            </button>
          </div>
        </header>

        {status && (
          <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
            {status}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Slides</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => addSlide("content")}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 text-sm px-3 py-1.5"
                >
                  + Content
                </button>
                <button
                  onClick={() => addSlide("question")}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 text-sm px-3 py-1.5"
                >
                  + Question
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
              {slidesSorted.map((slide) => (
                <button
                  key={slide.id}
                  onClick={() => setSelectedSlideId(slide.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    slide.id === selectedSlideId
                      ? "border-sky-500 bg-slate-800"
                      : "border-slate-700 bg-slate-900 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="text-xs text-slate-400">
                    Slide {slide.index + 1} • {slide.type}
                  </div>
                  <div className="text-sm line-clamp-1 text-slate-100">
                    {slide.html.replace(/<[^>]+>/g, "").slice(0, 80) || "Untitled slide"}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Slide Editor</h2>
            {selectedSlide ? (
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
                <div className="flex gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs uppercase text-slate-500">Type</label>
                    <select
                      value={selectedSlide.type}
                      onChange={(event) =>
                        updateSlide(selectedSlide.id, "type", event.target.value as Slide["type"])
                      }
                      className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                    >
                      <option value="content">Content</option>
                      <option value="question">Question</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs uppercase text-slate-500">Question ID</label>
                    <select
                      value={selectedSlide.questionId ?? ""}
                      onChange={(event) =>
                        updateSlide(selectedSlide.id, "questionId", event.target.value || undefined)
                      }
                      disabled={selectedSlide.type !== "question"}
                      className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 disabled:opacity-50"
                    >
                      <option value="">Select question</option>
                      {deck.questions.map((question) => (
                        <option key={question.id} value={question.id}>
                          {question.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => moveSlide(selectedSlide.id, -1)}
                    className="rounded-lg border border-slate-700 px-3 py-1 text-xs"
                  >
                    ↑ Move Up
                  </button>
                  <button
                    onClick={() => moveSlide(selectedSlide.id, 1)}
                    className="rounded-lg border border-slate-700 px-3 py-1 text-xs"
                  >
                    ↓ Move Down
                  </button>
                  <button
                    onClick={() => removeSlide(selectedSlide.id)}
                    className="rounded-lg border border-rose-700 px-3 py-1 text-xs text-rose-300"
                  >
                    Delete Slide
                  </button>
                </div>
                <label className="text-xs uppercase text-slate-500">
                  Slide HTML
                  <textarea
                    value={selectedSlide.html}
                    onChange={(event) => updateSlide(selectedSlide.id, "html", event.target.value)}
                    rows={10}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono"
                  />
                </label>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Preview</h3>
                  <div
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                    dangerouslySetInnerHTML={{ __html: selectedSlide.html }}
                  />
                </div>
                {linkedQuestion && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="text-xs text-slate-400 mb-1">Linked Question</p>
                    <p className="text-sm text-slate-100">{linkedQuestion.stem}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">Select a slide to edit.</p>
            )}
          </section>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Questions</h2>
            <button
              onClick={addQuestion}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 text-sm px-3 py-1.5"
            >
              + Add Question
            </button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
              {deck.questions.map((question) => (
                <button
                  key={question.id}
                  onClick={() => setSelectedQuestionId(question.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    question.id === selectedQuestionId
                      ? "border-sky-500 bg-slate-800"
                      : "border-slate-700 bg-slate-900 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="text-xs text-slate-400">{question.id}</div>
                  <div className="text-sm line-clamp-1 text-slate-100">
                    {question.stem.slice(0, 80)}
                  </div>
                </button>
              ))}
            </div>
            {selectedQuestion ? (
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase text-slate-500">Question ID</label>
                  <input
                    value={selectedQuestion.id}
                    onChange={(event) =>
                      updateQuestion(selectedQuestion.id, (q) => ({ ...q, id: event.target.value }))
                    }
                    className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
                  />
                </div>
                <label className="text-xs uppercase text-slate-500">
                  Question Stem
                  <textarea
                    value={selectedQuestion.stem}
                    onChange={(event) =>
                      updateQuestion(selectedQuestion.id, (q) => ({
                        ...q,
                        stem: event.target.value,
                      }))
                    }
                    rows={4}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  />
                </label>
                <div className="space-y-2">
                  <p className="text-xs uppercase text-slate-500">Options</p>
                  {selectedQuestion.options.map((option, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOption"
                        checked={selectedQuestion.correctIndex === idx}
                        onChange={() =>
                          updateQuestion(selectedQuestion.id, (q) => ({
                            ...q,
                            correctIndex: idx,
                          }))
                        }
                      />
                      <input
                        value={option}
                        onChange={(event) =>
                          updateQuestion(selectedQuestion.id, (q) => {
                            const options = [...q.options];
                            options[idx] = event.target.value;
                            return { ...q, options };
                          })
                        }
                        className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <label className="text-xs uppercase text-slate-500">
                  Explanation
                  <textarea
                    value={selectedQuestion.explanation ?? ""}
                    onChange={(event) =>
                      updateQuestion(selectedQuestion.id, (q) => ({
                        ...q,
                        explanation: event.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">Select a question to edit.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
