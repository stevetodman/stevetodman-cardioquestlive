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
          <span>Case 4 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
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

export const case4Deck: Slide[] = [
  // Presentation
  {
    id: "case4_presentation",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #4 · Presentation</span>
          </div>

          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950/90 space-y-4">
            <h1 class="cq-h1 text-3xl md:text-4xl">3-year-old with seizures and hypopigmented macules</h1>
            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <div class="cq-emo" aria-hidden="true">🧠</div>
                <div>
                  <div class="font-semibold text-lg">Neuro</div>
                  <div class="cq-mute">Seizures; developmental delay.</div>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="cq-emo" aria-hidden="true">🧴</div>
                <div>
                  <div class="font-semibold text-lg">Skin</div>
                  <div class="cq-mute">Hypopigmented macules (“ash leaf”).</div>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="cq-emo" aria-hidden="true">❤️</div>
                <div>
                  <div class="font-semibold text-lg">Cardiac</div>
                  <div class="cq-mute">Prenatal echo showed cardiac tumors; concern for rhabdomyomas.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Phenotype
  {
    id: "case4_phenotype",
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

          <div class="cq-tiles grid md:grid-cols-3 gap-4 max-w-5xl mx-auto w-full">
            <div class="cq-tile cq-hoverable">
              <div class="cq-cardLabel"><span>Skin</span></div>
              <div class="text-lg font-semibold">Ash-leaf macules</div>
              <p class="cq-mute">Hypopigmented macules; may also see shagreen patch, facial angiofibromas, periungual fibromas.</p>
            </div>
            <div class="cq-tile cq-hoverable">
              <div class="cq-cardLabel"><span>Heart</span></div>
              <div class="text-lg font-semibold">Rhabdomyomas</div>
              <p class="cq-mute">Cardiac tumors often detected prenatally; tend to regress over time.</p>
            </div>
            <div class="cq-tile cq-hoverable">
              <div class="cq-cardLabel"><span>CNS</span></div>
              <div class="text-lg font-semibold">Seizures</div>
              <p class="cq-mute">Cortical dysplasias; subependymal nodules/giant cell astrocytomas; seizures in ~80%.</p>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Images/info cards
  {
    id: "case4_images",
    index: 2,
    type: "content",
    html: geminiSlide({
      slideNumber: 3,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Key Features</span>
          </div>
          <div class="cq-card cq-hoverable space-y-2">
            <div class="cq-cardLabel"><span>Multisystem clues</span></div>
            <ul class="cq-list">
              <li>Autosomal dominant; TSC1 (~26%) or TSC2 (~70%).</li>
              <li>Dermatologic: ash-leaf, shagreen patch, facial angiofibromas, periungual fibromas.</li>
              <li>Cardiac: rhabdomyomas regress spontaneously.</li>
              <li>CNS: cortical dysplasias, subependymal nodules/giant cell astrocytomas.</li>
              <li>Ophthalmic: retinal hamartomas (~30–50%).</li>
            </ul>
          </div>
        </div>
      `,
    }),
  },

  // Poll
  {
    id: "case4_poll",
    index: 3,
    type: "question",
    questionId: "q_case4_syndrome",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Genetic Diagnosis</div>
            <h2 class="cq-h2">Which syndrome is most likely?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Pattern</span></div>
              <ul class="cq-list">
                <li>Seizures + hypopigmented macules.</li>
                <li>Cardiac rhabdomyomas (prenatal).</li>
                <li>AD inheritance; hamartomas in multiple organs.</li>
              </ul>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Waardenburg syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Treacher Collins</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Sturge-Weber</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Smith-Lemli-Opitz</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Tuberous sclerosis</div>
          </div>
        </div>
      `,
    }),
  },

  // Diagnosis
  {
    id: "case4_diagnosis",
    index: 4,
    type: "content",
    html: geminiSlide({
      slideNumber: 5,
      totalSlides: 5,
      body: `
        <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950">
            <div class="cq-chip mb-2">Final Diagnosis</div>
            <h2 class="cq-h1 text-3xl md:text-4xl">Tuberous Sclerosis</h2>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Genetics</span></div>
                <div class="text-lg font-semibold">AD · TSC1/TSC2</div>
                <p class="cq-mute">TSC2 (~70%); TSC1 (~26%).</p>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Heart</span></div>
                <p class="cq-p" style="margin:0;">Rhabdomyomas often regress spontaneously.</p>
              </div>
            </div>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Skin</span></div>
                <ul class="cq-list">
                  <li>Ash-leaf macules.</li>
                  <li>Shagreen patch; facial angiofibromas; periungual fibromas.</li>
                </ul>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>CNS/Ocular</span></div>
                <ul class="cq-list">
                  <li>Seizures (~80%); cortical dysplasias; subependymal nodules/SEGA.</li>
                  <li>Retinal hamartomas (~30–50%).</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
            <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(236,72,153,0.25),transparent_35%)]"></div>
            <div class="relative h-full w-full grid md:grid-cols-2 gap-3 p-3">
              <div class="cq-card bg-slate-900/80 border border-slate-700/70 cursor-pointer hover:border-indigo-300/80 hover:shadow-indigo-500/30 transition">
                <div class="cq-cardLabel"><span>Skin clues</span><span class="cq-chip">ash-leaf / shagreen / angiofibromas</span></div>
                <div class="cq-mute text-sm">
                  Ash-leaf hypopigmented macules; rough “shagreen” patch; facial angiofibromas along the malar area; periungual fibromas. Hover to highlight; imagine revealing each lesion in a gallery.
                </div>
              </div>
              <div class="cq-card bg-slate-900/80 border border-slate-700/70 cursor-pointer hover:border-indigo-300/80 hover:shadow-indigo-500/30 transition">
                <div class="cq-cardLabel"><span>Cardiac</span><span class="cq-chip">Rhabdomyomas</span></div>
                <div class="cq-mute text-sm">
                  Intracardiac rhabdomyomas often detected prenatally; they tend to regress. Pair this with the skin/CNS findings to lock in tuberous sclerosis. Hover for focus.
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },
];
