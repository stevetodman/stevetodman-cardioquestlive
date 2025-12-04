/* eslint-disable prettier/prettier */

import type { Slide } from "../types";
import { slideWrapper } from "../utils/slideWrapper";
import { renderInteractiveTiles } from "../utils/interactiveTiles";

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
          <div class="cq-logo" aria-hidden="true">
            <span class="text-base">💙</span>
          </div>
          <div>
            <div class="cq-brandTitle">Genetic Syndromes</div>
            <div class="cq-brandSub">Interactive Case Series</div>
          </div>
        </div>
        <div class="cq-meta">
          <span>Case 2 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
          <div class="cq-dots" aria-hidden="true">${buildDots(opts.slideNumber, opts.totalSlides)}</div>
        </div>
      </div>

      <div class="cq-body">
        ${opts.body}
      </div>

      <div class="cq-nav" aria-hidden="true">
        <div class="cq-btn">←</div>
        <div class="cq-navHint">Space = Next</div>
        <div class="cq-btn cq-btnPrimary">→</div>
      </div>
    </div>
  `);

export const case2Deck: Slide[] = [
  // Presentation
  {
    id: "case2_presentation",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #2 · Presentation</span>
          </div>

          <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
            <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950/90 space-y-4">
              <h1 class="cq-h1 text-3xl md:text-4xl">1-year-old boy with URI symptoms and developmental delay</h1>
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <div class="cq-emo" aria-hidden="true">🧒</div>
                  <div>
                    <div class="font-semibold text-lg">Subject</div>
                    <div class="cq-mute">Mild developmental delay; 2-day history of URI symptoms.</div>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="cq-emo" aria-hidden="true">🩺</div>
                  <div>
                    <div class="font-semibold text-lg">Physical Exam</div>
                    <div class="cq-mute">Harsh 5/6 systolic ejection murmur at URSB; BP 107/60 mmHg.</div>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="cq-emo" aria-hidden="true">🧪</div>
                  <div>
                    <div class="font-semibold text-lg">Labs</div>
                    <div class="cq-mute">Serum calcium 12 mg/dL (hypercalcemia).</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
              <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(16,185,129,0.25),transparent_35%)]"></div>
              <div class="relative h-full w-full flex items-center justify-center">
                <img src="/images/genetic/img-020.png" alt="Williams syndrome facial features" class="max-h-[320px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Family/phenotype
  {
    id: "case2_family",
    index: 1,
    type: "content",
    html: geminiSlide({
      slideNumber: 2,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full justify-center">
          <div class="text-center space-y-3">
            <div class="cq-emo mx-auto text-3xl">👨‍👩‍👦</div>
            <h2 class="cq-h1 text-3xl md:text-4xl">Facial / Clinical Pattern</h2>
            <p class="cq-p max-w-3xl mx-auto">Characteristic features to link the exam findings with the underlying syndrome.</p>
          </div>
          ${renderInteractiveTiles({
            heading: "Phenotype",
            helperText: "Click a clue to reveal an image",
            tiles: [
              {
                id: "face",
                title: "Elfin facies",
                description: "Stellate iris, bulbous nasal tip, flat bridge, long philtrum, wide mouth.",
                imageUrl: "/images/genetic/img-020.png",
              },
              {
                id: "build",
                title: "Prominent cheeks",
                description: "Mild micrognathia, triangular facies, full cheeks.",
                imageUrl: "/images/genetic/img-021.png",
              },
              {
                id: "behavior",
                title: "Hypercalcemia + behavior",
                description: "Overfriendly affect, ADHD/anxiety tendencies; elevated calcium.",
                imageUrl: "/images/genetic/img-017.png",
              },
            ],
            role: "presenter",
          })}
        </div>
      `,
    }),
  },

  // Images
  {
    id: "case2_images",
    index: 2,
    type: "content",
    html: geminiSlide({
      slideNumber: 3,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Images</span>
          </div>
          <div class="grid md:grid-cols-2 gap-4 h-full">
            <div class="cq-card cq-hoverable flex flex-col gap-2">
              <div class="cq-cardLabel"><span>Elfin facies</span><span class="cq-chip">Williams</span></div>
              <div class="flex-1 grid grid-cols-1 gap-2">
                <img src="/images/genetic/img-020.png" alt="Facial features labeled" class="w-full rounded-xl border border-slate-700/70 shadow-2xl" />
                <img src="/images/genetic/img-021.png" alt="Williams syndrome child" class="w-full rounded-xl border border-slate-700/70 shadow-2xl" />
              </div>
            </div>
            <div class="cq-card cq-hoverable flex flex-col gap-2">
              <div class="cq-cardLabel"><span>Cardiac imaging</span><span class="cq-chip">Flow</span></div>
              <div class="flex-1 grid grid-cols-1 gap-2">
                <img src="/images/genetic/img-014.png" alt="Supravalvar aortic stenosis angiogram" class="w-full rounded-xl border border-slate-700/70 shadow-2xl" />
                <img src="/images/genetic/img-011.png" alt="Supravalvar AS EKG pattern" class="w-full rounded-xl border border-slate-700/70 shadow-2xl" />
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Poll (genetic syndrome)
  {
    id: "case2_cardiac_poll",
    index: 3,
    type: "question",
    questionId: "q_case2_defect",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 6,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Cardiac Diagnosis</div>
            <h2 class="cq-h2">What is the most likely cardiac diagnosis?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Murmur</span></div>
              <p class="cq-mute">Harsh 5/6 systolic ejection murmur at the URSB.</p>
            </div>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Exam/Labs</span></div>
              <ul class="cq-list">
                <li>Hypercalcemia (Ca 12 mg/dL).</li>
                <li>Normal BP 107/60 mmHg.</li>
                <li>Facial features suggestive of Williams.</li>
              </ul>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>
              ASD
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>
              VSD
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>
              PDA
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>
              Pulmonary stenosis
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>
              Aortic stenosis
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Poll (genetic syndrome)
  {
    id: "case2_poll",
    index: 4,
    type: "question",
    questionId: "q_case2_syndrome",
    html: geminiSlide({
      slideNumber: 5,
      totalSlides: 6,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Genetic Syndrome</div>
            <h2 class="cq-h2">Which of the following is the most likely genetic syndrome?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Cardiac clue</span><span class="cq-chip">Flow</span></div>
              <p class="cq-mute">Harsh 5/6 URSB SEM with hypercalcemia → think supravalvar aortic stenosis pattern.</p>
            </div>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Facial pattern</span></div>
              <p class="cq-mute">Elfin facies: stellate iris, full cheeks, wide mouth, bulbous nasal tip.</p>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>
              Williams syndrome
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>
              Kabuki syndrome
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>
              Alagille syndrome
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>
              Wolf-Hirschhorn syndrome
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>
              Trisomy 21
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Diagnosis reveal
  {
    id: "case2_diagnosis",
    index: 6,
    type: "content",
    html: geminiSlide({
      slideNumber: 6,
      totalSlides: 6,
      body: `
        <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950">
            <div class="cq-chip mb-2">Final Diagnosis</div>
            <h2 class="cq-h1 text-3xl md:text-4xl">Williams Syndrome</h2>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Genetics</span></div>
                <div class="text-lg font-semibold">7q11.23 microdeletion</div>
                <p class="cq-mute">Elastin (ELN) gene disruption; autosomal dominant.</p>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Behavior</span></div>
                <p class="cq-p" style="margin:0;">Overfriendly “cocktail party” persona; anxiety/ADHD tendencies.</p>
              </div>
            </div>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Cardiac</span><span class="cq-chip">Flow</span></div>
                <ul class="cq-list">
                  <li>Supravalvar aortic stenosis (classic).</li>
                  <li>Supravalvar pulmonary or peripheral branch PA stenosis.</li>
                  <li>Renal artery stenosis; systemic hypertension.</li>
                </ul>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Other</span></div>
                <ul class="cq-list">
                  <li>Hypercalcemia (especially in infancy).</li>
                  <li>Elfin facies: stellate iris, full cheeks, wide mouth, long philtrum.</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
            <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(236,72,153,0.25),transparent_35%)]"></div>
            <div class="relative h-full w-full flex items-center justify-center">
              <img src="/images/genetic/img-014.png" alt="Supravalvar aortic stenosis imaging" class="max-h-[360px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
            </div>
          </div>
        </div>
      `,
    }),
  },
];
