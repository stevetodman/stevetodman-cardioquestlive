
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
          <div class="cq-logo" aria-hidden="true"><span class="text-base">💙</span></div>
          <div>
            <div class="cq-brandTitle">Genetic Syndromes</div>
            <div class="cq-brandSub">Interactive Case Series</div>
          </div>
        </div>
        <div class="cq-meta">
          <span>Case 8 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
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

export const case8Deck: Slide[] = [
  // Presentation
  {
    id: "case8_presentation",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #8 · Presentation</span>
          </div>

          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950/90 space-y-4">
            <h1 class="cq-h1 text-3xl md:text-4xl">6-year-old short boy with click and SEM at LUSB</h1>
            <div class="space-y-3">
              <ul class="cq-list">
                <li>Early systolic click at upper sternal border.</li>
                <li>3/6 SEM at LUSB.</li>
                <li>Short stature noted on well-child visit.</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Phenotype
  {
    id: "case8_phenotype",
    index: 1,
    type: "content",
    html: geminiSlide({
      slideNumber: 2,
      totalSlides: 5,
      body: renderInteractiveTiles({
        heading: "Phenotype",
        helperText: "Click a clue to reveal an image",
        tiles: [
          {
            id: "growth",
            title: "Short stature",
            description: "Height below peers; may have webbed neck or hypertelorism (Noonan pattern).",
            imageUrl: "/images/genetic/img-016.png",
          },
          {
            id: "cardiac",
            title: "Pulmonic stenosis",
            description: "Early systolic click + LUSB SEM suggests PS; HCM also seen in Noonan.",
            imageUrl: "/images/genetic/img-014.png",
          },
          {
            id: "genetics",
            title: "RASopathy",
            description: "PTPN11 (~50%) or SOS1 (~13%) common in Noonan.",
            imageUrl: "/images/genetic/img-015.png",
          },
        ],
        role: "presenter",
      }),
    }),
  },

  // Features
  {
    id: "case8_features",
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
            <div class="cq-cardLabel"><span>Noonan highlights</span></div>
            <ul class="cq-list">
              <li>Pulmonary stenosis (20-50%); hypertrophic cardiomyopathy (20-30%); axis abnormalities on EKG (~90%).</li>
              <li>Short stature; possible webbed neck, wide-set eyes, low-set/posteriorly rotated ears.</li>
            </ul>
          </div>
        </div>
      `,
    }),
  },

  // Cardiac poll
  {
    id: "case8_cardiac_poll",
    index: 3,
    type: "question",
    questionId: "q_case8_defect",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Cardiac Defect</div>
            <h2 class="cq-h2">Which cardiac defect is most likely?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Clue</span></div>
              <p class="cq-mute">Early systolic click + LUSB SEM → pulmonary stenosis in a RASopathy.</p>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Aortic stenosis</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>VSD</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>ASD</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Pulmonary stenosis</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>PDA</div>
          </div>
        </div>
      `,
    }),
  },

  // Syndrome poll
  {
    id: "case8_syndrome_poll",
    index: 4,
    type: "question",
    questionId: "q_case8_syndrome",
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
              <p class="cq-mute">Short stature + pulmonary stenosis + possible webbed neck/hypertelorism → think Noonan.</p>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>LEOPARD syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Noonan syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Klippel-Feil syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Lesch-Nyhan syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Menkes disease</div>
          </div>
        </div>
      `,
    }),
  },
];
