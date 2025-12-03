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
          <span>Case 5 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
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

export const case5Deck: Slide[] = [
  // Presentation
  {
    id: "case5_presentation",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #5 · Presentation</span>
            <span>Slide 1 / 5</span>
          </div>

          <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
            <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950/90 space-y-4">
              <h1 class="cq-h1 text-3xl md:text-4xl">18-year-old male with skeletal findings and click/murmur</h1>
              <div class="space-y-3">
                <ul class="cq-list">
                  <li>Pectus carinatum; history of pneumothorax.</li>
                  <li>Flat feet; reduced elbow extension; medial displacement of medial malleolus.</li>
                  <li>Mid-systolic click with 3/6 apical systolic murmur.</li>
                  <li>Ectopia lentis (lens subluxation) history.</li>
                </ul>
              </div>
            </div>

            <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
              <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(16,185,129,0.25),transparent_35%)]"></div>
              <div class="relative h-full w-full flex items-center justify-center">
                <img src="/images/genetic/img-011.png" alt="Valve click EKG" class="max-h-[320px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Phenotype
  {
    id: "case5_phenotype",
    index: 1,
    type: "content",
    html: geminiSlide({
      slideNumber: 2,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-6 h-full justify-center">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Phenotype</span>
            <span>Case 5 · Slide 2 / 5</span>
          </div>

          <div class="cq-tiles grid md:grid-cols-3 gap-4 max-w-5xl mx-auto w-full">
            <div class="cq-tile cq-hoverable">
              <div class="cq-cardLabel"><span>Skeletal</span></div>
              <div class="text-lg font-semibold">Pectus + long bones</div>
              <p class="cq-mute">Pectus carinatum, flat feet, reduced elbow extension, long limbs.</p>
            </div>
            <div class="cq-tile cq-hoverable">
              <div class="cq-cardLabel"><span>Ocular</span></div>
              <div class="text-lg font-semibold">Ectopia lentis</div>
              <p class="cq-mute">Lens subluxation history.</p>
            </div>
            <div class="cq-tile cq-hoverable">
              <div class="cq-cardLabel"><span>Cardiac</span></div>
              <div class="text-lg font-semibold">Click + murmur</div>
              <p class="cq-mute">Mid-systolic click with apical systolic murmur (think MVP).</p>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Images/notes
  {
    id: "case5_images",
    index: 2,
    type: "content",
    html: geminiSlide({
      slideNumber: 3,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Features</span>
            <span>Slide 3 / 5</span>
          </div>
          <div class="cq-card cq-hoverable space-y-2">
            <div class="cq-cardLabel"><span>Key associations</span></div>
            <ul class="cq-list">
              <li>Tall, slender habitus with joint laxity.</li>
              <li>Chest wall deformity (pectus carinatum/excavatum).</li>
              <li>Lens subluxation (upward/outward in Marfan).</li>
              <li>Cardiac: mitral valve prolapse with regurgitation common.</li>
            </ul>
          </div>
        </div>
      `,
    }),
  },

  // Poll
  {
    id: "case5_poll",
    index: 3,
    type: "question",
    questionId: "q_case5_defect",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Cardiac Finding</div>
            <h2 class="cq-h2">What is the most likely congenital heart defect?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Clue</span></div>
              <p class="cq-mute">Mid-systolic click + apical systolic murmur suggests MVP with regurgitation.</p>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Aortic stenosis</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Pulmonary stenosis</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Coarctation of the aorta</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Pericarditis</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Mitral valve prolapse with regurgitation</div>
          </div>
        </div>
      `,
    }),
  },

  // Diagnosis poll?
  {
    id: "case5_syndrome_poll",
    index: 4,
    type: "question",
    questionId: "q_case5_syndrome",
    html: geminiSlide({
      slideNumber: 5,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Diagnosis</div>
            <h2 class="cq-h2">Which diagnosis best fits?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Pattern</span></div>
              <ul class="cq-list">
                <li>Tall habitus, pectus carinatum, joint laxity.</li>
                <li>Lens subluxation.</li>
                <li>MVP with regurgitation (click + murmur).</li>
              </ul>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Marfan syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Treacher Collins</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Sturge-Weber</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Smith-Lemli-Opitz</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Neurofibromatosis</div>
          </div>
        </div>
      `,
    }),
  },
];
