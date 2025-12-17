
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
          <span>Case 9 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
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

export const case9Deck: Slide[] = [
  // Presentation
  {
    id: "case9_presentation",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #9 · Presentation</span>
          </div>

          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950/90 space-y-4">
            <h1 class="cq-h1 text-3xl md:text-4xl">15-day-old boy with failure to thrive</h1>
            <div class="space-y-3">
              <ul class="cq-list">
                <li>Poor weight gain.</li>
                <li>Grade II/VI holosystolic murmur heard best at LLSB.</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Phenotype/features
  {
    id: "case9_phenotype",
    index: 1,
    type: "content",
    html: geminiSlide({
      slideNumber: 2,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-6 h-full justify-center">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Phenotype</span>
          </div>

          <div class="cq-card cq-hoverable space-y-2">
            <div class="cq-cardLabel"><span>Cardiac + growth</span></div>
            <ul class="cq-list">
              <li>Holosystolic murmur LLSB (VSD).</li>
              <li>Failure to thrive at 15 days old.</li>
            </ul>
          </div>
        </div>
      `,
    }),
  },

  // Cardiac poll
  {
    id: "case9_cardiac_poll",
    index: 2,
    type: "question",
    questionId: "q_case9_defect",
    html: geminiSlide({
      slideNumber: 3,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Cardiac Defect</div>
            <h2 class="cq-h2">What is the most likely congenital heart disease?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Clue</span></div>
              <p class="cq-mute">Holosystolic murmur at LLSB in a neonate with FTT → consider VSD.</p>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>VSD</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>ASD</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Pulmonary stenosis</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Aortic stenosis</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Tetralogy of Fallot</div>
          </div>
        </div>
      `,
    }),
  },

  // Syndrome poll
  {
    id: "case9_syndrome_poll",
    index: 3,
    type: "question",
    questionId: "q_case9_syndrome",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Genetic Syndrome</div>
            <h2 class="cq-h2">Which genetic syndrome?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Clue</span></div>
              <p class="cq-mute">Neonate with FTT + VSD; consider chromosomal syndromes with cardiac lesions.</p>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Trisomy 13</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Trisomy 21</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Trisomy 18</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Klinefelter syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Turner syndrome</div>
          </div>
        </div>
      `,
    }),
  },

  // Diagnosis
  {
    id: "case9_diagnosis",
    index: 4,
    type: "content",
    html: geminiSlide({
      slideNumber: 5,
      totalSlides: 5,
      body: `
        <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950">
            <div class="cq-chip mb-2">Diagnosis</div>
            <h2 class="cq-h1 text-3xl md:text-4xl">Likely VSD in chromosomal syndrome</h2>
            <div class="cq-card cq-hoverable mt-3">
              <div class="cq-cardLabel"><span>Key clues</span></div>
              <ul class="cq-list">
                <li>Holosystolic murmur LLSB → VSD.</li>
                <li>Failure to thrive in a neonate → consider chromosomal syndromes (Trisomies 13, 18, 21).</li>
              </ul>
            </div>
          </div>

          <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
            <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(236,72,153,0.25),transparent_35%)]"></div>
            <div class="relative h-full w-full flex items-center justify-center">
              <div class="cq-mute text-center px-4">
                Neonatal VSD + FTT → high suspicion for chromosomal anomaly.
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },
];
