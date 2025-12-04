/* eslint-disable prettier/prettier */

import type { Slide } from "../types";
import { slideWrapper } from "../utils/slideWrapper";
import { geminiHeader } from "../utils/geminiHeader";
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
          <span>Case 3 · Slide ${opts.slideNumber} / ${opts.totalSlides}</span>
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

export const case3Deck: Slide[] = [
  // Presentation
  {
    id: "case3_presentation",
    index: 0,
    type: "content",
    html: geminiSlide({
      slideNumber: 1,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full">
          <div class="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
            <span class="cq-chip">Case #3 · Presentation</span>
          </div>

          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950/90 space-y-4">
            <h1 class="cq-h1 text-3xl md:text-4xl">7-year-old girl with systolic murmur and growth restriction</h1>
            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <div class="cq-emo" aria-hidden="true">🩺</div>
                <div>
                  <div class="font-semibold text-lg">Exam</div>
                  <div class="cq-mute">Systolic murmur at axilla/back; growth restriction; mild developmental delay.</div>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="cq-emo" aria-hidden="true">🦴</div>
                <div>
                  <div class="font-semibold text-lg">Imaging</div>
                  <div class="cq-mute">Butterfly vertebral arch defects on spine films.</div>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="cq-emo" aria-hidden="true">🧪</div>
                <div>
                  <div class="font-semibold text-lg">Labs/Other</div>
                  <div class="cq-mute">Hypercholesterolemia; cholestasis suspected.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Phenotype / facies / liver
  {
    id: "case3_phenotype",
    index: 1,
    type: "content",
    html: geminiSlide({
      slideNumber: 2,
      totalSlides: 5,
      body: `
        <div class="flex flex-col gap-4 h-full justify-center">
          <div class="max-w-4xl mx-auto w-full space-y-1">
            <div class="cq-emo mx-auto text-3xl">👧</div>
            ${geminiHeader({
              subtitle: "Genetic Syndromes · Interactive Case Series",
              title: "Facies + Hepatic Clues",
              meta: "Case 3 · Slide 2/5",
              variant: "dense",
            })}
            <p class="cq-p max-w-3xl mx-auto text-center text-sm md:text-base">Link the vertebral findings, facies, and cholestasis to the right syndrome.</p>
          </div>
          ${renderInteractiveTiles({
            heading: "Phenotype",
            helperText: "Click a clue to reveal an image",
            tiles: [
              {
                id: "face",
                title: "Characteristic facies",
                description: "Broad forehead, deep-set widely spaced eyes, long straight nose, micrognathia.",
                imageUrl: "/images/genetic/img-023.png",
              },
              {
                id: "hepatic",
                title: "Cholestasis",
                description: "Bile duct paucity on biopsy; neonatal jaundice/cholestasis common.",
                imageUrl: "/images/genetic/img-025.png",
              },
              {
                id: "spine",
                title: "Butterfly vertebrae",
                description: "Vertebral arch defects on imaging.",
                imageUrl: "/images/genetic/img-022.png",
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
    id: "case3_images",
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
              <div class="cq-cardLabel"><span>Butterfly vertebrae</span></div>
              <div class="flex-1 flex items-center justify-center">
                <img src="/images/genetic/img-022.png" alt="Butterfly vertebrae x-ray" class="max-h-[360px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
              </div>
            </div>
            <div class="cq-card cq-hoverable flex flex-col gap-2">
              <div class="cq-cardLabel"><span>Clinical features</span></div>
              <div class="flex-1 flex items-center justify-center">
                <img src="/images/genetic/img-024.png" alt="Alagille clinical features" class="max-h-[360px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  },

  // Poll (syndrome)
  {
    id: "case3_poll",
    index: 3,
    type: "question",
    questionId: "q_case3_syndrome",
    html: geminiSlide({
      slideNumber: 4,
      totalSlides: 5,
      body: `
        <div class="cq-twoCol">
          <div class="space-y-4">
            <div class="cq-chip">Poll · Genetic Syndrome</div>
            <h2 class="cq-h2">Which syndrome best fits?</h2>
            <div class="cq-card">
              <div class="cq-cardLabel"><span>Pattern</span></div>
              <ul class="cq-list">
                <li>Butterfly vertebrae + cholestasis.</li>
                <li>Peripheral pulmonary stenosis/branch PA stenosis.</li>
                <li>Characteristic facies.</li>
              </ul>
            </div>
          </div>
          <div class="cq-tiles">
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">A.</span>Noonan’s syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">B.</span>Cri-du-chat</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">C.</span>Angelman syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">D.</span>Alagille syndrome</div>
            <div class="cq-option" data-state="idle"><span style="font-weight:900; margin-right:8px; color:rgba(148,163,184,0.9);">E.</span>Apert syndrome</div>
          </div>
        </div>
      `,
    }),
  },

  // Diagnosis
  {
    id: "case3_diagnosis",
    index: 4,
    type: "content",
    html: geminiSlide({
      slideNumber: 5,
      totalSlides: 5,
      body: `
        <div class="grid md:grid-cols-[1.05fr_0.95fr] gap-4 h-full">
          <div class="cq-card cq-hoverable h-full bg-gradient-to-b from-slate-900/85 to-slate-950">
            <div class="cq-chip mb-2">Final Diagnosis</div>
            <h2 class="cq-h1 text-3xl md:text-4xl">Alagille Syndrome</h2>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Genetics</span></div>
                <div class="text-lg font-semibold">JAG1 (AD)</div>
                <p class="cq-mute">Autosomal dominant, Notch signaling.</p>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Hepatic</span></div>
                <p class="cq-p" style="margin:0;">Bile duct paucity → cholestasis, neonatal jaundice.</p>
              </div>
            </div>
            <div class="grid md:grid-cols-2 gap-3 mt-3">
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Cardiac</span></div>
                <ul class="cq-list">
                  <li>Peripheral/branch pulmonary artery stenosis.</li>
                  <li>Other right-sided outflow lesions possible.</li>
                </ul>
              </div>
              <div class="cq-card cq-hoverable">
                <div class="cq-cardLabel"><span>Spine/Face</span></div>
                <ul class="cq-list">
                  <li>Butterfly vertebrae.</li>
                  <li>Characteristic facies: broad forehead, deep-set eyes, long straight nose, micrognathia.</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="cq-card cq-hoverable h-full relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90">
            <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(236,72,153,0.25),transparent_35%)]"></div>
            <div class="relative h-full w-full flex items-center justify-center">
              <img src="/images/genetic/img-024.png" alt="Alagille features" class="max-h-[360px] w-auto rounded-xl border border-slate-700/70 shadow-2xl" />
            </div>
          </div>
        </div>
      `,
    }),
  },
];
