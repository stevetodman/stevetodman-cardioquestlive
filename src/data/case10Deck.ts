/* eslint-disable prettier/prettier */

import type { Slide } from "../types";
import { slideWrapper } from "../utils/slideWrapper";

const buildDots = (slideNumber: number, totalSlides: number) =>
  Array.from({ length: totalSlides })
    .map(
      (_, i) =>
        `<span class="cq-dot" data-active="${i === slideNumber - 1 ? "true" : "false"}"></span>`
    )
    .join("");

const geminiSlide = (opts: { slideNumber: number; totalSlides: number; body: string }) =>
  slideWrapper(`
    <div class="cq-shell relative">
      <div class="cq-appbar">
        <div class="cq-brand">
          <div class="cq-logo" aria-hidden="true"><span class="text-base">💙</span></div>
          <div>
            <div class="cq-brandTitle">Genetic Syndromes</div>
            <div class="cq-brandSub">Interactive Case Series</div>
          </div>
        </div>
        <div class="cq-meta">
          <span>Case 10 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
          <div class="cq-dots" aria-hidden="true">${buildDots(opts.slideNumber, opts.totalSlides)}</div>
        </div>
      </div>

      <div class="cq-body">
        ${opts.body}
      </div>

      <div class="cq-nav" aria-hidden="true">
        <div class="cq-btn">← Previous</div>
        <div class="cq-navHint"><span>←</span><span>→</span><span>Space</span></div>
        <div class="cq-btn cq-btnPrimary">Next →</div>
      </div>
    </div>
  `);

export const case10Deck: Slide[] = [
  // Presentation
  {
    id: "case10_presentation",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 4,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #10 · Presentation</span>
            <span>Slide 1 / 4</span>
          </div>

          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950/90 space-y-4">
            <h1 class="cq-h1 text-3xl md:text-4xl">12-year-old with long QT and family history of syncope/drowning</h1>
            <div class="space-y-3">
              <ul class="cq-list">
                <li>QTc ~0.72 on ECG.</li>
                <li>Family history of syncope/drowning.</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Phenotype/notes
  {
    id: "case10_notes",
    index: 1,
    type: "content",
    html: geminiSlide({
      slideNumber: 2,
      totalSlides: 4,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Key Clues</span>
            <span>Slide 2 / 4</span>
          </div>
          <div class="cq-card cq-hoverable space-y-2">
            <div class="cq-cardLabel"><span>Long QT pattern</span></div>
            <ul class="cq-list">
              <li>Prolonged QTc (~0.72).</li>
              <li>Family history of syncope/drowning.</li>
            </ul>
          </div>
        </div>
      `,
    }),
  },

  // Poll (diagnosis)
  {
    id: "case10_poll",
    index: 2,
    type: "question",
    questionId: "q_case10_diagnosis",
    html: geminiSlide({
      slideNumber: 3,
      totalSlides: 4,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Diagnosis</div>
            <h2 class="cq-h2">Which diagnosis fits best?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Pattern</span></div>
              <p class="cq-mute">Long QT in a 12-year-old with family history of syncope/drowning.</p>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Hypertrophic cardiomyopathy</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Anomalous left coronary artery from the pulmonary artery</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Brugada syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Wolff-Parkinson-White</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Jervell and Lange-Nielsen syndrome</div>
          </div>
        </div>
      `,
    }),
  },

  // Diagnosis
  {
    id: "case10_diagnosis",
    index: 3,
    type: "content",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 4,
      body: `
        <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950">
            <div class="cq-chip mb-2">Final Diagnosis</div>
            <h2 class="cq-h1 text-3xl md:text-4xl">Jervell and Lange-Nielsen syndrome</h2>
            <div class="cq-card cq-hoverable mt-3">
              <div class="cq-cardLabel"><span>Pattern</span></div>
              <ul class="cq-list">
                <li>Congenital long QT with family history of syncope/drowning.</li>
              </ul>
            </div>
          </div>

          <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
            <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(236,72,153,0.25),transparent_35%)]"></div>
            <div class="relative h-full w-full flex items-center justify-center">
              <div class="cq-mute text-center px-4">
                Long QT + syncope/drowning in family → Jervell and Lange-Nielsen.
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },
];
