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
          <div class="cq-logo" aria-hidden="true"><span class="text-base">💙</span></div>
          <div>
            <div class="cq-brandTitle">Genetic Syndromes</div>
            <div class="cq-brandSub">Interactive Case Series</div>
          </div>
        </div>
        <div class="cq-meta">
          <span>Case 7 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
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

export const case7Deck: Slide[] = [
  // Presentation
  {
    id: "case7_presentation",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #7 · Presentation</span>
          </div>

          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950/90 space-y-4">
            <h1 class="cq-h1 text-3xl md:text-4xl">Female infant with single umbilical artery and murmur</h1>
            <div class="space-y-3">
              <ul class="cq-list">
                <li>Profound psychomotor delay, hypotonia, seizures.</li>
                <li>Low birth weight, microcephaly, micrognathia.</li>
                <li>Closed fists with overlapping fingers; microphthalmia; short sternum.</li>
                <li>3/6 holosystolic murmur at LLSB.</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Phenotype
  {
    id: "case7_phenotype",
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
            id: "hands",
            title: "Overlapping fingers",
            description: "Closed fists with overlapping fingers; single umbilical artery.",
            imageUrl: "/images/genetic/img-054.png",
          },
          {
            id: "growth",
            title: "IUGR + microcephaly",
            description: "Low birth weight, microcephaly, short sternum, micrognathia.",
            imageUrl: "/images/genetic/img-033.png",
          },
          {
            id: "neuro",
            title: "Seizures + delay",
            description: "Profound psychomotor delay, hypotonia, seizures.",
            imageUrl: "/images/genetic/img-059.png",
          },
        ],
        role: "presenter",
      }),
    }),
  },

  // Cardiac likelihood
  {
    id: "case7_chd_poll",
    index: 2,
    type: "question",
    questionId: "q_case7_chd_rate",
    html: geminiSlide({
      slideNumber: 3,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · CHD Likelihood</div>
            <h2 class="cq-h2">What is the likelihood of congenital heart disease?</h2>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Under 5%</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>10%</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>20%</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>50%</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Over 90%</div>
          </div>
        </div>
      `,
    }),
  },

  // Syndrome poll
  {
    id: "case7_syndrome_poll",
    index: 3,
    type: "question",
    questionId: "q_case7_syndrome",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Genetic Condition</div>
            <h2 class="cq-h2">What is the most likely genetic condition?</h2>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Trisomy 18</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Trisomy 13</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Wolf-Hirschhorn syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Rett syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Prader-Willi</div>
          </div>
        </div>
      `,
    }),
  },

  // Diagnosis
  {
    id: "case7_diagnosis",
    index: 4,
    type: "content",
    html: geminiSlide({
      slideNumber: 5,
      totalSlides: 5,
      body: `
        <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950">
            <div class="cq-chip mb-2">Final Diagnosis</div>
            <h2 class="cq-h1 text-3xl md:text-4xl">Trisomy 18 (Edwards Syndrome)</h2>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>CHD</span></div>
                <ul class="cq-list">
                  <li>>90% have CHD: VSD, ASD, PDA, TOF, coarctation common.</li>
                </ul>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Other malformations</span></div>
                <ul class="cq-list">
                  <li>Pulmonary hypoplasia.</li>
                  <li>GI/GU anomalies; thymic/thyroid/adrenal hypoplasia.</li>
                </ul>
              </div>
            </div>
            <div class="cq-card cq-hoverable mt-3">
              <div class="cq-cardLabel"><span>Key clue</span></div>
              <p class="cq-p" style="margin:0;">Clenched fists with overlapping fingers + growth restriction + micrognathia.</p>
            </div>
          </div>

          <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
            <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(236,72,153,0.25),transparent_35%)]"></div>
            <div class="relative h-full w-full flex items-center justify-center">
              <div class="cq-mute text-center px-4">
                Trisomy 18: overlapping fingers, single umbilical artery, high CHD rate.
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },
];
