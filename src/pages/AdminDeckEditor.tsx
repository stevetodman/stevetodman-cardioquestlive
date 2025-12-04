import React, { useEffect, useMemo, useState } from "react";
import type { DeckData, Question, Slide } from "../types";
import { defaultDeck } from "../data/ductalDeck";
import { fetchDeck, persistDeck } from "../utils/deckService";
import { SlidePreview } from "../components/SlidePreview";

type TemplateKey = "none" | "phenotype" | "poll" | "image" | "teaching";

function getAdminCode(): string {
  // Vite injects env vars onto process.env via define() in vite.config.ts
  return (process.env.VITE_ADMIN_ACCESS_CODE ?? "").trim();
}

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [templateChoice, setTemplateChoice] = useState<TemplateKey>("none");
  const adminCode = useMemo(getAdminCode, []);
  const hasAdminCode = adminCode.length > 0;

  useEffect(() => {
    if (!hasAdminCode || !accessGranted) return;
    loadDeck();
  }, [hasAdminCode, accessGranted]);

  async function loadDeck() {
    setLoading(true);
    try {
      const data = await fetchDeck();
      setDeck(data);
      setSelectedSlideId(data.slides[0]?.id ?? null);
      setSelectedQuestionId(data.questions[0]?.id ?? null);
      setStatus(null);
    } catch (error) {
      console.error("Failed to load deck", error);
      setStatus("Failed to load deck from Firestore. Using default deck.");
    } finally {
      setLoading(false);
    }
  }

  const slidesSorted = useMemo(
    () => [...deck.slides].sort((a, b) => a.index - b.index),
    [deck.slides]
  );

  const selectedSlide = slidesSorted.find((slide) => slide.id === selectedSlideId) ?? null;
  const selectedQuestion = deck.questions.find((q) => q.id === selectedQuestionId) ?? null;
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
    setStatus(null);
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

      return {
        ...prev,
        slides: sorted.map((slide, idx) => ({ ...slide, index: idx })),
      };
    });
    setStatus(null);
  }

  function addSlide(type: Slide["type"]) {
    const newSlide = createEmptySlide(type, deck.slides.length);
    setDeck((prev) => ({
      ...prev,
      slides: [...prev.slides, newSlide],
    }));
    setSelectedSlideId(newSlide.id);
    setStatus(null);
  }

  function removeSlide(id: string) {
    setDeck((prev) => {
      const filtered = prev.slides.filter((slide) => slide.id !== id);
      const reindexed = filtered.map((slide, idx) => ({
        ...slide,
        index: idx,
      }));
      return { ...prev, slides: reindexed };
    });
    setSelectedSlideId((prevId) => (prevId === id ? null : prevId));
    setStatus(null);
  }

  function addQuestion() {
    const newQuestion = createEmptyQuestion();
    setDeck((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
    setSelectedQuestionId(newQuestion.id);
    setStatus(null);
  }

  function updateQuestion(id: string, updater: (question: Question) => Question) {
    setDeck((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === id ? updater(question) : question
      ),
    }));
    setStatus(null);
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

  const templates: Record<TemplateKey, string> = {
    none: "",
    phenotype: `
<div class="flex flex-col gap-4 h-full justify-center">
  <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
    <span class="cq-chip">Phenotype</span>
    <span class="text-[11px] text-slate-500">Click a clue to reveal an image</span>
  </div>
  <div class="cq-tiles grid md:grid-cols-3 gap-4 max-w-5xl mx-auto w-full">
    <div class="cq-tile cq-hoverable">
      <div class="cq-cardLabel"><span>Clue 1</span></div>
      <div class="text-lg font-semibold">Phenotype clue</div>
      <p class="cq-mute">Short description of the first phenotype clue.</p>
    </div>
    <div class="cq-tile cq-hoverable">
      <div class="cq-cardLabel"><span>Clue 2</span></div>
      <div class="text-lg font-semibold">Phenotype clue</div>
      <p class="cq-mute">Short description of the second phenotype clue.</p>
    </div>
    <div class="cq-tile cq-hoverable">
      <div class="cq-cardLabel"><span>Clue 3</span></div>
      <div class="text-lg font-semibold">Phenotype clue</div>
      <p class="cq-mute">Short description of the third phenotype clue.</p>
    </div>
  </div>
</div>`.trim(),
    poll: `
<div class="cq-twoCol">
  <div class="space-y-4">
    <div class="cq-chip">Poll · Diagnosis</div>
    <h2 class="cq-h2">What is the most likely diagnosis?</h2>
    <div class="cq-card">
      <div class="cq-cardLabel"><span>Clue</span></div>
      <p class="cq-mute">Add a brief clue or context for this question.</p>
    </div>
  </div>
  <div class="cq-tiles">
    <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Option A</div>
    <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Option B</div>
    <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Option C</div>
    <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Option D</div>
    <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Option E</div>
  </div>
</div>`.trim(),
    image: `
<div class="flex flex-col gap-4 h-full justify-center">
  <div class="text-center space-y-2">
    <h2 class="cq-h1 text-3xl md:text-4xl">Image Title</h2>
    <p class="cq-p max-w-3xl mx-auto">Brief description or context for this image.</p>
  </div>
  <img class="cq-slide-image" src="" alt="" />
  <p class="cq-mute text-center">Add a short caption for this image, including key teaching points.</p>
</div>`.trim(),
    teaching: `
<div class="flex flex-col gap-4 h-full justify-center">
  <div class="text-center space-y-2">
    <h2 class="cq-h1 text-3xl md:text-4xl">Teaching Points</h2>
    <p class="cq-p max-w-3xl mx-auto">Summarize the highest-yield pearls for this case.</p>
  </div>
  <div class="cq-card cq-hoverable space-y-2">
    <div class="cq-cardLabel"><span>Key pearl</span></div>
    <ul class="cq-list">
      <li>High-yield teaching point #1</li>
      <li>High-yield teaching point #2</li>
      <li>High-yield teaching point #3</li>
    </ul>
  </div>
</div>`.trim(),
  };

  const applyTemplate = (key: TemplateKey) => {
    if (!selectedSlide || key === "none") return;
    const templateHtml = templates[key];
    if (!templateHtml) return;
    const current = selectedSlide.html ?? "";
    const isEmpty = current.trim().length === 0;
    if (!isEmpty) {
      const ok = window.confirm("Replace existing HTML with the selected template?");
      if (!ok) {
        setTemplateChoice("none");
        return;
      }
    }
    updateSlide(selectedSlide.id, "html", templateHtml);
    setTemplateChoice("none");
  };


  const validationMessages = useMemo(() => {
    const messages: string[] = [];
    const questionIds = new Set(deck.questions.map((q) => q.id));

    slidesSorted.forEach((slide, idx) => {
      const humanIndex = idx + 1;

      if (!slide.html?.trim()) {
        messages.push(`Slide ${humanIndex} has empty HTML content.`);
      }

      if (slide.type === "question") {
        if (!slide.questionId) {
          messages.push(
            `Slide ${humanIndex} is a question slide but has no linked question.`
          );
        } else if (!questionIds.has(slide.questionId)) {
          messages.push(
            `Slide ${humanIndex} links to missing question id "${slide.questionId}".`
          );
        }
      }
    });

    deck.questions.forEach((q) => {
      if (!q.stem?.trim()) {
        messages.push(`Question "${q.id}" is missing a stem.`);
      }
      if (!q.options || q.options.length < 2) {
        messages.push(`Question "${q.id}" should have at least 2 options.`);
      }
    });

    return messages;
  }, [slidesSorted, deck.questions]);

  if (!hasAdminCode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto bg-slate-900 border border-rose-800 rounded-xl p-6 space-y-3 text-center">
          <h2 className="text-xl font-semibold text-white">Admin Locked</h2>
          <p className="text-slate-300 text-sm">
            Set <code className="text-rose-300">VITE_ADMIN_ACCESS_CODE</code> to enable the deck editor.
          </p>
        </div>
      </div>
    );
  }

  if (!accessGranted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white text-center">Admin Access</h2>
          <p className="text-slate-400 text-sm text-center">
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
              if (codeInput.trim() === adminCode) {
                setAccessGranted(true);
                setStatus(null);
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
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Loading deck...</div>
      </div>
    );
  }

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleHtmlPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!selectedSlide) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (!imageItem) return; // allow normal paste for non-images

    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

    // Capture selection state before any async work to avoid stale references.
    const { selectionStart, selectionEnd, value } = e.currentTarget;
    const sizeMB = file.size / (1024 * 1024);
    const MAX_PASTE_IMAGE_MB = 2;
    if (sizeMB > MAX_PASTE_IMAGE_MB) {
      const ok = window.confirm(
        `This image is about ${sizeMB.toFixed(1)} MB. Large images can bloat slide size and slow loading. Insert anyway?`
      );
      if (!ok) return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const altInput = window.prompt("Optional alt text for this image (for accessibility):", "");
      const escapedAlt = altInput && altInput.trim().length > 0 ? altInput.trim().replace(/"/g, "&quot;") : "";
      const imgTag = `\n<img class="cq-slide-image" src="${dataUrl}" alt="${escapedAlt}" />\n`;
      const nextValue = value.slice(0, selectionStart) + imgTag + value.slice(selectionEnd);
      updateSlide(selectedSlide.id, "html", nextValue);
    } catch (err) {
      console.error("Failed to paste image", err);
      setStatus("Failed to insert image from clipboard.");
    }
  };

  const insertSnippet = (snippet: string) => {
    if (!selectedSlide) return;
    const textarea = document.getElementById("slide-html-editor") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const { selectionStart, selectionEnd, value } = textarea;
    const nextValue = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
    updateSlide(selectedSlide.id, "html", nextValue);
  };

  const snippetButtons = [
    { label: "+ Heading", snippet: "\n<h1>Slide Title</h1>\n" },
    { label: "+ Subheading", snippet: "\n<h2>Section Heading</h2>\n" },
    {
      label: "+ Clue box",
      snippet: `\n<div class="cq-card cq-hoverable space-y-2">\n  <div class="cq-cardLabel"><span>Clue Title</span></div>\n  <p class="cq-mute">Short description of this clue.</p>\n</div>\n`,
    },
    {
      label: "+ Teaching pearl",
      snippet: `\n<div class="cq-card cq-hoverable space-y-2">\n  <div class="cq-cardLabel"><span>Teaching Pearl</span></div>\n  <ul class="cq-list">\n    <li>High-yield point #1</li>\n    <li>High-yield point #2</li>\n  </ul>\n</div>\n`,
    },
  ];

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
              onClick={() => {
                setDeck(defaultDeck);
                setSelectedSlideId(defaultDeck.slides[0]?.id ?? null);
                setSelectedQuestionId(defaultDeck.questions[0]?.id ?? null);
                setStatus("Reset to default deck (local). Remember to save.");
              }}
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

        {validationMessages.length > 0 && (
          <div className="rounded-lg border border-amber-600/60 bg-amber-900/20 px-4 py-3 text-xs text-amber-100 space-y-1">
            <div className="font-semibold text-amber-300 text-sm">
              Deck issues
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {validationMessages.slice(0, 4).map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
            {validationMessages.length > 4 && (
              <div className="text-[11px] text-amber-300/80">
                + {validationMessages.length - 4} more…
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="lg:w-72 lg:flex-shrink-0 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Slides</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => addSlide("content")}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5"
                >
                  + Content
                </button>
                <button
                  onClick={() => addSlide("question")}
                  className="rounded-lg bg-slate-800 hover-bg-slate-700 text-xs px-3 py-1.5"
                >
                  + Question
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
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
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>
                      Slide {slide.index + 1} • {slide.type}
                    </span>
                    {slide.type === "question" && (
                      <span className="px-1.5 py-0.5 rounded-full bg-sky-900/60 text-sky-300">
                        Q
                      </span>
                    )}
                  </div>
                  <div className="text-xs line-clamp-2 text-slate-100">
                    {slide.html.replace(/<[^>]+>/g, "").slice(0, 100) ||
                      "Untitled slide"}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="flex-1 flex flex-col gap-6 lg:flex-row">
            <section className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Preview</h2>
                {selectedSlide && (
                  <span className="text-[11px] text-slate-500">
                    Viewing {selectedSlide.index + 1} of {slidesSorted.length}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                {selectedSlide ? (
                  <SlidePreview html={selectedSlide.html} />
                ) : (
                  <div className="text-sm text-slate-500 text-center py-12">
                    Select a slide to preview.
                  </div>
                )}
              </div>
            </section>

            <section className="flex-1 space-y-4">
              <h2 className="text-lg font-semibold">Slide Editor</h2>
              {selectedSlide ? (
                <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs uppercase text-slate-500">
                        Type
                      </label>
                      <select
                        value={selectedSlide.type}
                        onChange={(event) =>
                          updateSlide(
                            selectedSlide.id,
                            "type",
                            event.target.value as Slide["type"]
                          )
                        }
                        className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
                      >
                        <option value="content">Content</option>
                        <option value="question">Question</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                      <label className="text-xs uppercase text-slate-500">
                        Question ID
                      </label>
                      <select
                        value={selectedSlide.questionId ?? ""}
                        onChange={(event) =>
                          updateSlide(
                            selectedSlide.id,
                            "questionId",
                            event.target.value || undefined
                          )
                        }
                        disabled={selectedSlide.type !== "question"}
                        className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm disabled:opacity-50"
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

                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => moveSlide(selectedSlide.id, -1)}
                      className="rounded-lg border border-slate-700 px-3 py-1"
                    >
                      ↑ Move Up
                    </button>
                    <button
                      onClick={() => moveSlide(selectedSlide.id, 1)}
                      className="rounded-lg border border-slate-700 px-3 py-1"
                    >
                      ↓ Move Down
                    </button>
                    <button
                      onClick={() => removeSlide(selectedSlide.id)}
                      className="rounded-lg border border-rose-700 px-3 py-1 text-rose-300"
                    >
                      Delete Slide
                    </button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs uppercase text-slate-500">
                        Slide HTML
                      </label>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="text-slate-500">Template:</label>
                        <select
                          value={templateChoice}
                          onChange={(event) => applyTemplate(event.target.value as TemplateKey)}
                          className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-[11px]"
                        >
                          <option value="none">Choose…</option>
                          <option value="phenotype">Phenotype / Clue Grid</option>
                          <option value="poll">Poll (MCQ)</option>
                          <option value="image">Image + Caption</option>
                          <option value="teaching">Teaching Pearl / Summary</option>
                        </select>
                        <div className="flex flex-wrap items-center gap-2">
                          {snippetButtons.map((btn) => (
                            <button
                              key={btn.label}
                              type="button"
                              onClick={() => insertSnippet(btn.snippet)}
                              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] hover:bg-slate-800"
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Tip: copy an image, click in this editor, and press <span className="font-semibold">Cmd/Ctrl + V</span> to insert an <code className="text-rose-200">&lt;img&gt;</code> tag with a data URL.
                      </p>
                      <textarea
                        value={selectedSlide.html}
                        id="slide-html-editor"
                        onPaste={handleHtmlPaste}
                        onChange={(event) =>
                          updateSlide(
                            selectedSlide.id,
                            "html",
                            event.target.value
                          )
                        }
                        rows={16}
                        className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-mono leading-relaxed min-h-[320px]"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Live Preview</span>
                        <span className="text-[11px] text-slate-500">Presenter styling</span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-black/20 p-3">
                        <div className="aspect-video w-full overflow-auto rounded-lg bg-slate-950/80 border border-slate-800">
                          <div
                            className="h-full w-full"
                            dangerouslySetInnerHTML={{ __html: selectedSlide.html }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {linkedQuestion && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-1">
                      <p className="text-[11px] text-slate-400">Linked Question</p>
                      <p className="text-sm text-slate-100">{linkedQuestion.stem}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">
                  Select a slide from the list to edit its content.
                </p>
              )}
            </section>
          </div>
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
                  <label className="text-xs uppercase text-slate-500">
                    Question ID
                  </label>
                  <input
                    value={selectedQuestion.id}
                    onChange={(event) =>
                      updateQuestion(selectedQuestion.id, (q) => ({
                        ...q,
                        id: event.target.value,
                      }))
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
              <p className="text-slate-400 text-sm">
                Select a question to edit its details.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
