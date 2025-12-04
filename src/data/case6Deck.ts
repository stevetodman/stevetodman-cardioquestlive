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
          <span>Case 6 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
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

export const case6Deck: Slide[] = [
  // Presentation
  {
    id: "case6_presentation",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #6 · Presentation</span>
          </div>

          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950/90 space-y-4">
            <h1 class="cq-h1 text-3xl md:text-4xl">4-month-old dysmorphic boy with holosystolic murmur</h1>
            <div class="space-y-3">
              <ul class="cq-list">
                <li>Undernourished, tachycardic, tachypneic.</li>
                <li>3/6 holosystolic murmur at LLSB with mid-diastolic rumble.</li>
                <li>Hepatomegaly; EKG shows AV canal pattern.</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Phenotype
  {
    id: "case6_phenotype",
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
            id: "cardiac",
            title: "AV canal pattern",
            description: "Holosystolic murmur LLSB with mid-diastolic rumble; EKG shows AV canal.",
            imageUrl: "/images/genetic/img-009.png",
          },
          {
            id: "facies",
            title: "Dysmorphic features",
            description: "Classic Down syndrome facies; hypotonia; growth delay.",
            imageUrl: "/images/genetic/img-017.png",
          },
          {
            id: "gi",
            title: "Associated conditions",
            description: "GI anomalies (duodenal atresia, Hirschsprung), endocrine (hypothyroid), leukemia risk.",
            imageUrl: "/images/genetic/img-018.png",
          },
        ],
        role: "presenter",
      }),
    }),
  },

  // Features/notes
  {
    id: "case6_features",
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
            <div class="cq-cardLabel"><span>Down syndrome highlights</span></div>
            <ul class="cq-list">
              <li>40-50% have congenital heart disease: AV canal (~43%), VSD (~32%).</li>
              <li>Physical: upslanting palpebral fissures, flat nasal bridge, small ears with overfolded helix.</li>
              <li>Neonatal hypotonia; growth delay; moderate-to-severe intellectual disability.</li>
              <li>Associated: Brushfield spots, refractive errors, sleep apnea, atlantoaxial instability.</li>
              <li>GI: duodenal atresia, Hirschsprung; Endocrine: hypothyroid; Hematologic: leukemia risk.</li>
            </ul>
          </div>
        </div>
      `,
    }),
  },

  // Poll
  {
    id: "case6_poll",
    index: 3,
    type: "question",
    questionId: "q_case6_syndrome",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Diagnosis</div>
            <h2 class="cq-h2">Which syndrome best explains these findings?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Pattern</span></div>
              <ul class="cq-list">
                <li>AV canal murmur + AV canal EKG pattern.</li>
                <li>Dysmorphic features consistent with Down syndrome.</li>
                <li>Hepatomegaly, hypotonia, growth delay.</li>
              </ul>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>McCune-Albright</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Treacher Collins</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Sturge-Weber</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Trisomy 21</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Neurofibromatosis</div>
          </div>
        </div>
      `,
    }),
  },

  // Diagnosis (content)
  {
    id: "case6_diagnosis",
    index: 4,
    type: "content",
    html: geminiSlide({
      slideNumber: 5,
      totalSlides: 5,
      body: `
        <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950">
            <div class="cq-chip mb-2">Final Diagnosis</div>
            <h2 class="cq-h1 text-3xl md:text-4xl">Trisomy 21 (Down Syndrome)</h2>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Cardiac</span></div>
                <ul class="cq-list">
                  <li>AV canal (~43%), VSD (~32%) common.</li>
                </ul>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Physical</span></div>
                <p class="cq-p" style="margin:0;">Upslanting palpebral fissures, flat nasal bridge, small ears with overfolded helix; hypotonia.</p>
              </div>
            </div>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Associated</span></div>
                <ul class="cq-list">
                  <li>GI: duodenal atresia, Hirschsprung.</li>
                  <li>Endocrine: hypothyroid.</li>
                  <li>Heme: leukemia risk.</li>
                </ul>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Other</span></div>
                <ul class="cq-list">
                  <li>Brushfield spots, refractive errors.</li>
                  <li>Sleep apnea; atlantoaxial instability.</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
            <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(236,72,153,0.25),transparent_35%)]"></div>
            <div class="relative h-full w-full flex items-center justify-center">
              <div class="cq-mute text-center px-4">
                Remember: AV canal + Down facies + hypotonia → think Trisomy 21.
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },
];
