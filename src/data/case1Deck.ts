
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

// Gemini-style shell sized to the 16:9 presenter viewport.
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
          <span>Case 1 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
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

export const case1Deck: Slide[] = [
  // SLIDE 1 – Presentation
  {
    id: "case1_summary",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #1 · Presentation</span>
          </div>

          <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
            <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/80 to-slate-950/90">
              <h1 class="cq-h1 text-3xl md:text-4xl">Ten-year-old girl with radial anomalies and a cardiac murmur</h1>
              <p class="cq-p">Connect the radial findings to the characteristic fixed split S2 and flow murmur.</p>
              <div class="space-y-4 mt-2">
                <div class="flex items-start gap-3">
                  <div class="cq-emo" aria-hidden="true">👧</div>
                  <div>
                    <div class="font-semibold text-lg">Subject</div>
                    <div class="cq-mute">Ten-year-old girl presents for well-child check.</div>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="cq-emo" aria-hidden="true">✋</div>
                  <div>
                    <div class="font-semibold text-lg">Physical Exam</div>
                    <div class="cq-mute">Missing thumbs on both hands.</div>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="cq-emo" aria-hidden="true">❤️</div>
                  <div>
                    <div class="font-semibold text-lg">Cardiovascular</div>
                    <ul class="cq-list">
                      <li>Widely split fixed S2.</li>
                      <li>2/6 systolic ejection murmur at ULSB.</li>
                      <li>1/6 short mid-diastolic murmur at LLSB.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
              <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(236,72,153,0.25),transparent_35%)]"></div>
              <div class="relative h-full w-full flex items-center justify-center">
                <img src="/images/genetic/img-003.png" alt="Clinical Photograph: Hand Anomalies" class="max-h-[320px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // SLIDE 2 – Family history
  {
    id: "case1_fhx",
    index: 1,
    type: "content",
    html: geminiSlide({
      slideNumber: 2,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full justify-center">
          <div class="text-center space-y-3">
            <div class="cq-emo mx-auto text-3xl">👨‍👩‍👧</div>
            <h2 class="cq-h1 text-4xl">Relevant Family History</h2>
            <p class="cq-p max-w-2xl mx-auto">Different members of the family have presented with a constellation of:</p>
          </div>
          ${renderInteractiveTiles({
            heading: "Family History",
            helperText: "Click a clue to reveal an image",
            tiles: [
              {
                id: "heart",
                title: "Heart murmurs",
                description: "Multiple relatives with structural heart disease or murmurs.",
                imageUrl: "/images/genetic/img-019.png",
              },
              {
                id: "limb",
                title: "Radial anomalies",
                description: "Radial ray abnormalities of the upper limbs in family members.",
                imageUrl: "/images/genetic/img-004.png",
              },
              {
                id: "conduction",
                title: "Conduction defects",
                description: "Documented conduction disease (heart block, bradycardia).",
                imageUrl: "/images/genetic/img-005.png",
              },
            ],
            role: "presenter",
          })}
          <p class="cq-mute text-center">Heart + hand pattern → think Holt–Oram.</p>
        </div>
      `,
    }),
  },

  // SLIDE 3 – Images
  {
    id: "case1_images",
    index: 2,
    type: "content",
    html: geminiSlide({
      slideNumber: 3,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case 1 · Images</span>
          </div>

          <div class="grid md:grid-cols-2 gap-4 h-full">
            <div class="cq-card cq-hoverable flex flex-col gap-2">
              <div class="cq-cardLabel"><span>Hand Anomalies</span><span class="cq-chip">Radial ray</span></div>
              <div class="flex-1 flex items-center justify-center">
                <img src="/images/genetic/img-003.png" alt="Hand anomalies" class="max-h-[360px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
              </div>
            </div>
            <div class="cq-card cq-hoverable flex flex-col gap-2">
              <div class="cq-cardLabel"><span>Exam Clue</span><span class="cq-chip">Boards</span></div>
              <div class="flex-1 flex items-center justify-center">
                <img src="/images/genetic/img-020.png" alt="Exam table" class="max-h-[360px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // SLIDE 4 – Poll (genetic syndrome)
  {
    id: "case1_question2",
    index: 3,
    type: "question",
    questionId: "q_case1_syndrome",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Genetic Syndrome</div>
            <h2 class="cq-h2">Which of the following is the most likely genetic syndrome?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Pattern</span><span class="cq-chip">Heart + Hand</span></div>
              <ul class="cq-list">
                <li>Preaxial radial ray abnormalities.</li>
                <li>Secundum ASD with fixed split S2.</li>
                <li>Autosomal dominant; conduction disease in family.</li>
              </ul>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>
              VACTERL association
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>
              Holt–Oram syndrome
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>
              Pulmonary atresia with multiple aortopulmonary collaterals
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>
              Kabuki syndrome
            </div>
            <div class="cq-option" data-state="idle">
              <span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>
              Marfan syndrome
            </div>
          </div>
        </div>
      `,
    }),
  },

  // SLIDE 5 – Diagnosis reveal
  {
    id: "case1_answer",
    index: 4,
    type: "content",
    html: geminiSlide({
      slideNumber: 5,
      totalSlides: 5,
      body: `
        <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950">
            <div class="cq-chip mb-2">Final Diagnosis</div>
            <h2 class="cq-h1 text-3xl md:text-4xl">Holt–Oram (“Heart–Hand”) Syndrome</h2>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Genetics</span><span class="cq-chip">TBX5</span></div>
                <div class="text-lg font-semibold">Autosomal Dominant</div>
                <p class="cq-mute">TBX5 transcription factor; limb + cardiac development.</p>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Pattern</span><span class="cq-chip">Heart + Hand</span></div>
                <ul class="cq-list">
                  <li>Preaxial radial ray abnormalities (thumbs/radius).</li>
                  <li>Secundum ASD with fixed split S2.</li>
                  <li>Conduction disease can progress (sinus node, AV block).</li>
                </ul>
              </div>
            </div>
            <div class="cq-card cq-hoverable mt-3">
              <div class="cq-cardLabel"><span>Boards Memory</span></div>
              <p class="cq-p" style="margin:0;">When you see heart + hand together, the safest single answer is Holt–Oram.</p>
            </div>
          </div>

          <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
            <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(236,72,153,0.25),transparent_35%)]"></div>
            <div class="relative h-full w-full flex items-center justify-center">
              <img src="/images/genetic/img-004.png" alt="Holt-Oram Syndrome" class="max-h-[360px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
            </div>
          </div>
        </div>
      `,
    }),
  },
];
