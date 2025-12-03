import { SessionData, Slide, Question, DeckData } from "../types";
import { slideWrapper } from "../utils/slideWrapper";
import { case1Deck } from "./case1Deck";
import { case2Deck } from "./case2Deck";

// Consistent layout for audience question slides
const questionSlide = (title: string, content: string) =>
  slideWrapper(`
    <div class="space-y-4">
      <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400">Audience Quiz</div>
      <h2 class="text-2xl font-semibold text-slate-50">${title}</h2>
      <div class="text-sm text-slate-200 leading-relaxed space-y-3">
        ${content}
      </div>
      <div class="inline-flex items-center gap-2 text-xs text-slate-400 border border-slate-800 bg-slate-950/50 rounded-lg px-3 py-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        Answer on your device; results update live.
      </div>
    </div>
  `);

const legacySlides: Slide[] = [
  {
    id: "intro_title",
    index: 0,
    type: "content",
    html: slideWrapper(`
      <div class="flex h-full w-full items-center justify-center">
        <div class="w-full max-w-5xl space-y-6 text-center px-4">
          <h1 class="text-4xl md:text-5xl font-black tracking-tight">Genetic Syndromes Involving the Heart</h1>
          <p class="text-lg md:text-xl text-slate-200">Case-based review of congenital heart disease associations</p>
          <p class="text-sm md:text-base text-slate-400">Based on material by Steven H. Todman, M.D. — Pediatric Cardiology, LSUHSC-Shreveport</p>
          <div class="mt-8 flex justify-center">
            <img src="/images/genetic/img-000.png" alt="Heart illustration" class="max-h-[240px] w-auto drop-shadow-2xl rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
          </div>
        </div>
      </div>
    `),
  },
  {
    id: "goals",
    index: 1,
    type: "content",
    html: slideWrapper(`
      <div class="flex h-full w-full items-center justify-center">
        <div class="w-full max-w-5xl space-y-6 px-4">
          <h2 class="text-3xl md:text-4xl font-bold">Goals & Objectives</h2>
          <ul class="list-disc list-outside pl-6 space-y-3 text-base md:text-lg text-slate-100">
            <li>Review common genetic syndromes linked to congenital heart disease.</li>
            <li>Discuss high-yield case images and clinical clues.</li>
            <li>Practice rapid pattern recognition for exam and bedside decision-making.</li>
          </ul>
          <div class="mt-6 flex justify-center">
            <img src="/images/genetic/img-003.png" alt="Exam weights for pediatric board content" class="max-h-[260px] w-auto rounded-xl border border-slate-700/70 bg-slate-900/60 p-4 shadow-2xl">
          </div>
        </div>
      </div>
    `),
  },
  {
    id: "case1_summary",
    index: 2,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 1</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>10-year-old girl seen for well-child check</li>
        <li>Missing thumbs on both hands</li>
        <li>Widely split fixed S2, 2/6 SEM at ULSB, 1/6 short mid-diastolic murmur at LLSB</li>
        <li>Family: heart murmurs, radial anomalies, cardiac conduction defects</li>
      </ul>
<div class="mt-4 flex justify-center"><img src="/images/genetic/img-004.png" alt="Holt-Oram hand anomalies" class="max-h-56 rounded-lg border border-slate-800" / style="max-height: 180px; width: 100%; object-fit: contain;"></div>
`),
  },
  {
    id: "case1_defect",
    index: 3,
    type: "question",
    questionId: "q_case1_defect",
    html: questionSlide(
      "Case 1 - Cardiac Defect",
      `
        <p class="text-sm text-slate-300">What is the most likely cardiac defect?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>ASD</li>
          <li>VSD</li>
          <li>PDA</li>
          <li>Tetralogy of Fallot</li>
          <li>Dextrocardia, TGA, and IAA</li>
        </ul>
      `
    ),
  },
  {
    id: "case1_syndrome",
    index: 4,
    type: "question",
    questionId: "q_case1_syndrome",
    html: questionSlide(
      "Case 1 - Genetic Syndrome",
      `
        <p class="text-sm text-slate-300">Which of the following is most likely?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>VACTERL</li>
          <li>Holt-Oram</li>
          <li>Pulmonary atresia with multiple collaterals</li>
          <li>Kabuki</li>
        </ul>
      `
    ),
  },
  {
    id: "case1_answer",
    index: 5,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Holt-Oram Syndrome</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>Autosomal dominant TBX5 mutation</li>
        <li>Preaxial radial ray abnormalities (thumb/forearm hypoplasia to phocomelia)</li>
        <li>ASD and cardiac conduction defects are common</li>
        <li>Family history of upper limb + septal/conduction disease is a key clue</li>
      </ul>
    `),
  },
  {
    id: "case2_summary",
    index: 6,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 2</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
        <ul class="md:col-span-2 list-disc list-inside space-y-2 text-sm">
          <li>1-year-old boy with mild developmental delay and URI symptoms</li>
          <li>Harsh 5/6 SEM at URSB, BP 107/60 mmHg</li>
          <li>Serum calcium 12 mg/dL</li>
        </ul>
        <div class="flex flex-col gap-2 items-center">
          <img src="/images/genetic/img-020.png" alt="Williams facial features" class="rounded-lg border border-slate-800" style="max-height: 180px; width: 100%; object-fit: contain;" />
          <img src="/images/genetic/img-014.png" alt="Supravalvar aortic stenosis angiogram" class="rounded-lg border border-slate-800" style="max-height: 180px; width: 100%; object-fit: contain;" />
        </div>
      </div>
    `),
  },
  {
    id: "case2_defect",
    index: 7,
    type: "question",
    questionId: "q_case2_defect",
    html: questionSlide(
      "Case 2 - Cardiac Diagnosis",
      `
        <p class="text-sm text-slate-300">What is the most likely cardiac diagnosis?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>ASD</li>
          <li>VSD</li>
          <li>PDA</li>
          <li>Pulmonary stenosis</li>
          <li>Aortic stenosis</li>
          <li>Innocent murmur</li>
        </ul>
      `
    ),
  },
  {
    id: "case2_syndrome",
    index: 8,
    type: "question",
    questionId: "q_case2_syndrome",
    html: questionSlide(
      "Case 2 - Syndrome",
      `
        <p class="text-sm text-slate-300">Your diagnosis?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Williams syndrome</li>
          <li>Kabuki syndrome</li>
          <li>Alagille syndrome</li>
          <li>Wolf-Hirschhorn syndrome</li>
          <li>Trisomy 21</li>
        </ul>
      `
    ),
  },
  {
    id: "case2_williams",
    index: 9,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Williams Syndrome</h2>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
        <div class="lg:col-span-2 space-y-3">
          <ul class="list-disc list-inside space-y-2">
            <li>Elastin (ELN) gene disruption on chromosome 7</li>
            <li>Stellate iris, wide mouth, long philtrum, flat nasal bridge</li>
            <li>Overfriendly behavior, hyperacusis, variable intellectual disability</li>
            <li>Hypercalcemia can be present</li>
          </ul>
          <ul class="list-disc list-inside space-y-2">
            <li>Supravalvar aortic stenosis (classic)</li>
            <li>Supravalvar or branch pulmonary stenosis</li>
            <li>Peripheral PA stenosis; renal artery stenosis; systemic hypertension</li>
          </ul>
        </div>
        <div class="space-y-3">
          <img src="/images/genetic/img-020.png" alt="Williams syndrome facial features" class="w-full rounded-lg border border-slate-800" style="max-height: 180px; width: 100%; object-fit: contain;" />
          <img src="/images/genetic/img-014.png" alt="Supravalvar aortic stenosis angiogram" class="w-full rounded-lg border border-slate-800" style="max-height: 180px; width: 100%; object-fit: contain;" />
          <img src="/images/genetic/img-021.png" alt="Williams syndrome child" class="w-full rounded-lg border border-slate-800" style="max-height: 180px; width: 100%; object-fit: contain;" />
        </div>
      </div>
    `),
  },
  {
    id: "case3_summary",
    index: 10,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 3</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        <ul class="list-disc list-inside space-y-2 text-sm">
          <li>7-year-old girl with systolic murmur at axilla/back</li>
          <li>Hypercholesterolemia; butterfly vertebral arch defects</li>
          <li>Mild mental retardation; growth restriction</li>
          <li>Facies: broad forehead, deep-set widely spaced eyes, long straight nose, micrognathia</li>
          <li>Posterior embryotoxin on eye exam; liver biopsy: bile duct paucity with cholestasis</li>
        </ul>
        <div class="flex flex-col gap-2 items-center">
          <img src="/images/genetic/img-024.png" alt="Butterfly vertebrae motif" class="rounded-lg border border-slate-800" style="max-height: 180px; width: 100%; object-fit: contain;" />
          <img src="/images/genetic/img-027.png" alt="Posterior embryotoxin" class="rounded-lg border border-slate-800" style="max-height: 180px; width: 100%; object-fit: contain;" />
        </div>
      </div>
    `),
  },
  {
    id: "case3_syndrome",
    index: 11,
    type: "question",
    questionId: "q_case3_syndrome",
    html: questionSlide(
      "Case 3 - Genetic Syndrome",
      `
        <p class="text-sm text-slate-300">Which syndrome best fits?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Noonan's syndrome</li>
          <li>Cri-du-chat</li>
          <li>Angelman syndrome</li>
          <li>Alagille syndrome</li>
          <li>Apert syndrome</li>
        </ul>
      `
    ),
  },
  {
    id: "case3_answer",
    index: 12,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Alagille Syndrome</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>Autosomal dominant JAG1 mutation (~90%)</li>
        <li>Neonatal jaundice; cholestasis with bile duct paucity</li>
        <li>Peripheral pulmonary stenosis or branch PA stenosis; characteristic facies and butterfly vertebrae</li>
        <li>Growth restriction, mild developmental delay, and hypercholesterolemia may be present</li>
      </ul>
      <div class="mt-4 flex justify-center">
        <img src="/images/genetic/img-025.png" alt="Clinical features" class="rounded-lg border border-slate-800" style="max-height: 180px; width: 100%; object-fit: contain;" />
      </div>
    `),
  },
  {
    id: "case4_summary",
    index: 13,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 4</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>3-year-old with seizures, hypopigmented macules, developmental delay</li>
        <li>Prenatal echocardiogram showed cardiac tumors</li>
        <li>Concern for cardiac rhabdomyomas</li>
      </ul>
    `),
  },
  {
    id: "case4_masses",
    index: 14,
    type: "question",
    questionId: "q_case4_mass_course",
    html: questionSlide(
      "Case 4 - Cardiac Masses",
      `
        <p class="text-sm text-slate-300">What is the usual course of these tumors?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Progress in size</li>
          <li>Regress in size</li>
          <li>Result in obstruction of cardiac output</li>
          <li>Require surgical excision</li>
        </ul>
      `
    ),
  },
  {
    id: "case4_syndrome",
    index: 15,
    type: "question",
    questionId: "q_case4_syndrome",
    html: questionSlide(
      "Case 4 - Genetic Diagnosis",
      `
        <p class="text-sm text-slate-300">Which syndrome is most likely?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Waardenburg syndrome</li>
          <li>Treacher Collins</li>
          <li>Sturge-Weber</li>
          <li>Smith-Lemli-Opitz</li>
          <li>Tuberous sclerosis</li>
        </ul>
      `
    ),
  },
  {
    id: "case4_answer",
    index: 16,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Tuberous Sclerosis</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>Autosomal dominant; TSC2 (~70%) and TSC1 (~26%) mutations</li>
        <li>Cardiac rhabdomyomas often regress spontaneously</li>
        <li>Dermatologic clues: ash-leaf hypopigmented macules, shagreen patch, forehead fibrous plaque, facial angiofibromas, periungual fibromas</li>
        <li>CNS: cortical dysplasias, subependymal nodules or giant cell astrocytomas; seizures in ~80%</li>
        <li>Retinal hamartomas in ~30-50%</li>
      </ul>
    `),
  },
  {
    id: "case5_summary",
    index: 17,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 5</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>18-year-old male with pectus carinatum and prior pneumothorax</li>
        <li>Flat feet; reduced elbow extension; medial displacement of medial malleolus</li>
        <li>Mid-systolic click with 3/6 apical systolic murmur</li>
        <li>History of lens subluxation (ectopia lentis)</li>
      </ul>
<div class="mt-4 flex justify-center"><img src="/images/genetic/img-011.png" alt="Marfan/valve click EKG" class="w-full max-w-3xl rounded-lg border border-slate-800" / style="max-height: 180px; width: 100%; object-fit: contain;"></div>
`),
  },
  {
    id: "case5_defect",
    index: 18,
    type: "question",
    questionId: "q_case5_defect",
    html: questionSlide(
      "Case 5 - Cardiac Finding",
      `
        <p class="text-sm text-slate-300">What is the most likely congenital heart defect?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Aortic stenosis</li>
          <li>Pulmonary stenosis</li>
          <li>Coarctation of the aorta</li>
          <li>Pericarditis</li>
          <li>Mitral valve prolapse with regurgitation</li>
        </ul>
      `
    ),
  },
  {
    id: "case5_syndrome",
    index: 19,
    type: "question",
    questionId: "q_case5_syndrome",
    html: questionSlide(
      "Case 5 - Diagnosis",
      `
        <p class="text-sm text-slate-300">Which diagnosis best fits?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Marfan syndrome</li>
          <li>Treacher Collins</li>
          <li>Sturge-Weber</li>
          <li>Smith-Lemli-Opitz</li>
          <li>Neurofibromatosis</li>
        </ul>
      `
    ),
  },
  {
    id: "case5_answer",
    index: 20,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Marfan Syndrome (vs Loeys-Dietz)</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>Classic features: tall habitus, pectus deformity, lens subluxation, joint laxity, pes planus</li>
        <li>Cardiac: mitral valve prolapse with regurgitation is common; aortic root disease risk</li>
        <li>Loeys-Dietz variant can present similarly but often with aggressive aortopathy</li>
      </ul>
    `),
  },
  {
    id: "case6_summary",
    index: 21,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 6</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>4-month-old dysmorphic boy at well-child check</li>
        <li>Undernourished, tachycardic, tachypneic</li>
        <li>3/6 holosystolic murmur at LLSB with mid-diastolic rumble</li>
        <li>Hepatomegaly; EKG shows AV canal pattern</li>
      </ul>
    `),
  },
  {
    id: "case6_syndrome",
    index: 22,
    type: "question",
    questionId: "q_case6_syndrome",
    html: questionSlide(
      "Case 6 - Diagnosis",
      `
        <p class="text-sm text-slate-300">Which syndrome best explains these findings?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>McCune-Albright</li>
          <li>Treacher Collins</li>
          <li>Sturge-Weber</li>
          <li>Trisomy 21</li>
          <li>Neurofibromatosis</li>
        </ul>
      `
    ),
  },
  {
    id: "case6_answer",
    index: 23,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Trisomy 21 (Down Syndrome)</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>40-50% have congenital heart disease: AV canal (~43%), VSD (~32%) common</li>
        <li>Physical: upslanting palpebral fissures, flat nasal bridge, small ears with overfolded helix</li>
        <li>Neonatal hypotonia; growth delay; moderate-to-severe intellectual disability</li>
        <li>Associated findings: Brushfield spots, refractive errors, sleep apnea, atlantoaxial instability</li>
        <li>GI: duodenal atresia, Hirschsprung; Endocrine: hypothyroid; Hematologic: leukemia risk</li>
      </ul>
    `),
  },
  {
    id: "case7_summary",
    index: 24,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 7</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>Female infant with single umbilical artery</li>
        <li>Profound psychomotor delay, hypotonia, seizures</li>
        <li>Low birth weight, microcephaly, micrognathia</li>
        <li>Closed fists with overlapping fingers; microphthalmia; short sternum</li>
        <li>3/6 holosystolic murmur at LLSB</li>
      </ul>
    `),
  },
  {
    id: "case7_chd",
    index: 25,
    type: "question",
    questionId: "q_case7_chd_rate",
    html: questionSlide(
      "Case 7 - CHD Likelihood",
      `
        <p class="text-sm text-slate-300">What is the likelihood of congenital heart disease?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Under 5%</li>
          <li>10%</li>
          <li>20%</li>
          <li>50%</li>
          <li>Over 90%</li>
        </ul>
      `
    ),
  },
  {
    id: "case7_syndrome",
    index: 26,
    type: "question",
    questionId: "q_case7_syndrome",
    html: questionSlide(
      "Case 7 - Genetic Condition",
      `
        <p class="text-sm text-slate-300">What is the most likely genetic condition?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Trisomy 18</li>
          <li>Trisomy 13</li>
          <li>Wolf-Hirschhorn syndrome</li>
          <li>Rett syndrome</li>
          <li>Prader-Willi</li>
        </ul>
      `
    ),
  },
  {
    id: "case7_answer",
    index: 27,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Trisomy 18 (Edwards Syndrome)</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>>90% have congenital heart disease; VSD, ASD, PDA, TOF, coarctation common</li>
        <li>Other malformations: pulmonary hypoplasia; GI and GU anomalies; thymic/thyroid/adrenal hypoplasia</li>
        <li>Classic hand finding: clenched fists with overlapping fingers; growth restriction and micrognathia</li>
      </ul>
    `),
  },
  {
    id: "case8_summary",
    index: 28,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 8</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>6-year-old short boy at well-child visit</li>
        <li>Early systolic click at upper sternal border; 3/6 SEM at LUSB</li>
      </ul>
    `),
  },
  {
    id: "case8_defect",
    index: 29,
    type: "question",
    questionId: "q_case8_defect",
    html: questionSlide(
      "Case 8 - Cardiac Defect",
      `
        <p class="text-sm text-slate-300">Which cardiac defect is most likely?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Aortic stenosis</li>
          <li>VSD</li>
          <li>ASD</li>
          <li>Pulmonary stenosis</li>
          <li>PDA</li>
        </ul>
      `
    ),
  },
  {
    id: "case8_syndrome",
    index: 30,
    type: "question",
    questionId: "q_case8_syndrome",
    html: questionSlide(
      "Case 8 - Diagnosis",
      `
        <p class="text-sm text-slate-300">Which diagnosis best fits?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>LEOPARD syndrome</li>
          <li>Noonan syndrome</li>
          <li>Klippel-Feil syndrome</li>
          <li>Lesch-Nyhan syndrome</li>
          <li>Menkes disease</li>
        </ul>
      `
    ),
  },
  {
    id: "case8_answer",
    index: 31,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Noonan Syndrome</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>Mutations in PTPN11 (~50%) or SOS1 (~13%)</li>
        <li>Cardiac: pulmonary stenosis (20-50%), hypertrophic cardiomyopathy (20-30%), axis abnormalities on EKG (~90%)</li>
        <li>Neonatal features: tall forehead, hypertelorism, downslanting palpebral fissures, posteriorly rotated ears</li>
        <li>Short stature is common</li>
      </ul>
    `),
  },
  {
    id: "case9_summary",
    index: 32,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 9</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>12-year-old short female at well-child visit</li>
        <li>Apical ejection click; 2/6 SEM at base radiating to carotids</li>
      </ul>
    `),
  },
  {
    id: "case9_defect",
    index: 33,
    type: "question",
    questionId: "q_case9_defect",
    html: questionSlide(
      "Case 9 - Cardiac Defect",
      `
        <p class="text-sm text-slate-300">Which cardiac defect is most likely?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Aortic stenosis</li>
          <li>VSD</li>
          <li>ASD</li>
          <li>Pulmonary stenosis</li>
          <li>PDA</li>
        </ul>
      `
    ),
  },
  {
    id: "case9_syndrome",
    index: 34,
    type: "question",
    questionId: "q_case9_syndrome",
    html: questionSlide(
      "Case 9 - Diagnosis",
      `
        <p class="text-sm text-slate-300">What is the most likely genetic defect?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Turner syndrome</li>
          <li>VATER</li>
          <li>Treacher-Collins</li>
          <li>Stickler syndrome</li>
          <li>Sotos syndrome</li>
        </ul>
      `
    ),
  },
  {
    id: "case9_answer",
    index: 35,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Turner Syndrome</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>45,X or mosaic forms; risk of gonadoblastoma</li>
        <li>Congenital heart defects (~30%): coarctation of the aorta, bicuspid aortic valve, aortic stenosis</li>
        <li>Aortic root dilation/aneurysm risk warrants surveillance</li>
      </ul>
    `),
  },
  {
    id: "case10_summary",
    index: 36,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 10</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>12-year-old boy with syncope</li>
        <li>Father drowned unexpectedly while swimming; paternal uncle with syncope; grandfather sudden death at 22</li>
        <li>Long QT noted on ECG (QTc ~0.72 via Bazett)</li>
      </ul>
      <div class="mt-4 flex justify-center">
        <img src="/images/genetic/img-005.png" alt="Long QT EKG" class="w-full max-w-3xl rounded-lg border border-slate-800" style="max-height: 180px; width: 100%; object-fit: contain;" />
      </div>
    `),
  },
  {
    id: "case10_diagnosis",
    index: 37,
    type: "question",
    questionId: "q_case10_diagnosis",
    html: questionSlide(
      "Case 10 - Diagnosis",
      `
        <p class="text-sm text-slate-300">Which diagnosis fits best?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Hypertrophic cardiomyopathy</li>
          <li>Anomalous left coronary artery from the pulmonary artery</li>
          <li>Brugada syndrome</li>
          <li>Wolff-Parkinson-White</li>
          <li>Jervell and Lange-Nielsen syndrome</li>
        </ul>
      `
    ),
  },
  {
    id: "case10_answer",
    index: 38,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Congenital Long QT Syndrome</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>Family history of syncope/drowning during swimming raises suspicion for LQTS</li>
        <li>Jervell and Lange-Nielsen: autosomal recessive, long QTc >500 ms plus congenital deafness</li>
        <li>Romano-Ward: autosomal dominant form without deafness</li>
        <li>Risk: torsades and sudden death during exertion or fright</li>
      </ul>
    `),
  },
  {
    id: "case11_summary",
    index: 39,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Case 11</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>Infant with large tongue, flabby muscles, and cardiomegaly</li>
        <li>EKG shows striking high-voltage pattern</li>
      </ul>
    `),
  },
  {
    id: "case11_diagnosis",
    index: 40,
    type: "question",
    questionId: "q_case11_diagnosis",
    html: questionSlide(
      "Case 11 - Diagnosis",
      `
        <p class="text-sm text-slate-300">Which diagnosis is most likely?</p>
        <ol class="list-decimal list-inside space-y-1" style="list-style-type: upper-alpha;">
          <li>Wolf-Hirschhorn</li>
          <li>Waardenburg</li>
          <li>Pompe disease</li>
          <li>Beckwith-Wiedemann</li>
          <li>Cri-du-chat</li>
        </ul>
      `
    ),
  },
  {
    id: "case11_answer",
    index: 41,
    type: "content",
    html: slideWrapper(`
      <h2 class="text-2xl font-semibold mb-3">Pompe Disease</h2>
      <ul class="list-disc list-inside space-y-2 text-sm">
        <li>Autosomal recessive glycogen storage disorder (acid alpha-glucosidase deficiency)</li>
        <li>Infantile form: hypotonia, cardiomegaly, hepatomegaly; characteristic EKG and echo findings</li>
        <li>Enzyme replacement therapy has improved outcomes</li>
      </ul>
    `),
  },
];

function reindexSlides(slides: Slide[]): Slide[] {
  return slides.map((slide, index) => ({ ...slide, index }));
}

const filteredLegacySlides = legacySlides.filter(
  (slide) => !slide.id.startsWith("case1_") && !slide.id.startsWith("case2_")
);
const introAndGoals = filteredLegacySlides.slice(0, 2);
const remainingLegacySlides = filteredLegacySlides.slice(2);
const mergedSlides = [...introAndGoals, ...case1Deck, ...case2Deck, ...remainingLegacySlides];

export const defaultSlides: Slide[] = reindexSlides(mergedSlides);

export const defaultQuestions: Question[] = [
  {
    id: "q_case1_defect",
    stem: "Case 1: 10-year-old girl with absent thumbs, widely split fixed S2, and family history of radial anomalies/conduction disease. What is the most likely cardiac defect?",
    options: [
      "ASD",
      "VSD",
      "PDA",
      "Tetralogy of Fallot",
      "Dextrocardia, TGA, and IAA",
    ],
    correctIndex: 0,
    explanation: "Holt-Oram is strongly linked to secundum ASD and conduction disease; the fixed split S2 points to ASD.",
  },
  {
    id: "q_case1_syndrome",
    stem: "Case 1: Which genetic syndrome best fits the radial ray anomalies and atrial septal defect?",
    options: [
      "VACTERL",
      "Holt-Oram",
      "Pulmonary atresia with multiple collaterals",
      "Kabuki",
    ],
    correctIndex: 1,
    explanation: "Upper limb preaxial defects plus ASD/conduction disease are classic for Holt-Oram (TBX5).",
  },
  {
    id: "q_case2_defect",
    stem: "Case 2: 1-year-old boy with hypercalcemia and a 5/6 URSB systolic murmur. What is the most likely cardiac diagnosis?",
    options: [
      "ASD",
      "VSD",
      "PDA",
      "Pulmonary stenosis",
      "Aortic stenosis",
      "Innocent murmur",
    ],
    correctIndex: 4,
    explanation: "Williams syndrome commonly causes supravalvar aortic stenosis producing a loud URSB murmur.",
  },
  {
    id: "q_case2_syndrome",
    stem: "Case 2: Which syndrome best explains the cardiac lesion and hypercalcemia?",
    options: [
      "Williams syndrome",
      "Kabuki syndrome",
      "Alagille syndrome",
      "Wolf-Hirschhorn syndrome",
      "Trisomy 21",
    ],
    correctIndex: 0,
    explanation: "Elastin gene deletion in Williams causes supravalvar AS with hypercalcemia and characteristic facies.",
  },
  {
    id: "q_case3_syndrome",
    stem: "Case 3: 7-year-old with butterfly vertebrae, bile duct paucity, and peripheral pulmonary stenosis. Which syndrome is most likely?",
    options: [
      "Noonan’s syndrome",
      "Cri-du-chat",
      "Angelman syndrome",
      "Alagille syndrome",
      "Apert syndrome",
    ],
    correctIndex: 3,
    explanation: "Alagille (JAG1) causes bile duct paucity, characteristic facies, butterfly vertebrae, and peripheral PA stenosis.",
  },
  {
    id: "q_case4_mass_course",
    stem: "Case 4: Cardiac rhabdomyomas detected prenatally. What is their usual course?",
    options: [
      "Progress in size",
      "Regress in size",
      "Result in obstruction of cardiac output",
      "Require surgical excision",
    ],
    correctIndex: 1,
    explanation: "Rhabdomyomas in tuberous sclerosis typically regress spontaneously over time.",
  },
  {
    id: "q_case4_syndrome",
    stem: "Case 4: Seizures, hypopigmented macules, developmental delay, and regressing cardiac rhabdomyomas suggest which syndrome?",
    options: [
      "Waardenburg syndrome",
      "Treacher Collins",
      "Sturge-Weber",
      "Smith-Lemli-Opitz",
      "Tuberous sclerosis",
    ],
    correctIndex: 4,
    explanation: "Cutaneous ash-leaf spots plus regressing rhabdomyomas point to tuberous sclerosis (TSC1/2).",
  },
  {
    id: "q_case5_defect",
    stem: "Case 5: 18-year-old with ectopia lentis, pectus carinatum, joint laxity, and apical click/murmur. Which defect is most likely?",
    options: [
      "Aortic stenosis",
      "Pulmonary stenosis",
      "Coarctation of the aorta",
      "Pericarditis",
      "Mitral valve prolapse with regurgitation",
    ],
    correctIndex: 4,
    explanation: "Marfan patients frequently have mitral valve prolapse with regurgitation producing click-plus-murmur.",
  },
  {
    id: "q_case5_syndrome",
    stem: "Case 5: Which diagnosis best explains the skeletal findings and valve prolapse?",
    options: [
      "Marfan syndrome",
      "Treacher Collins",
      "Sturge-Weber",
      "Smith-Lemli-Opitz",
      "Neurofibromatosis",
    ],
    correctIndex: 0,
    explanation: "Tall habitus, pectus carinatum, ectopia lentis, and MVP are hallmark Marfan features.",
  },
  {
    id: "q_case6_syndrome",
    stem: "Case 6: 4-month-old with AV canal murmur, hepatomegaly, dysmorphism, and global delay. Which syndrome is most likely?",
    options: [
      "McCune-Albright",
      "Treacher Collins",
      "Sturge-Weber",
      "Trisomy 21",
      "Neurofibromatosis",
    ],
    correctIndex: 3,
    explanation: "AV canal defects with hypotonia and classic facies point to Trisomy 21.",
  },
  {
    id: "q_case7_chd_rate",
    stem: "Case 7: For the described infant (Trisomy 18), what is the likelihood of congenital heart disease?",
    options: [
      "Under 5%",
      "10%",
      "20%",
      "50%",
      "Over 90%",
    ],
    correctIndex: 4,
    explanation: "Over 90% of infants with Trisomy 18 have structural heart disease.",
  },
  {
    id: "q_case7_syndrome",
    stem: "Case 7: Single umbilical artery, overlapping fingers, growth restriction, and holosystolic murmur suggest which condition?",
    options: [
      "Trisomy 18",
      "Trisomy 13",
      "Wolf-Hirschhorn syndrome",
      "Rett syndrome",
      "Prader-Willi",
    ],
    correctIndex: 0,
    explanation: "Overlapping fingers and severe growth restriction are classic for Trisomy 18 (Edwards).",
  },
  {
    id: "q_case8_defect",
    stem: "Case 8: Short boy with early systolic click and SEM at LUSB. Which defect is most likely?",
    options: [
      "Aortic stenosis",
      "VSD",
      "ASD",
      "Pulmonary stenosis",
      "PDA",
    ],
    correctIndex: 3,
    explanation: "Pulmonary valve stenosis with a click/SEM is common in Noonan syndrome.",
  },
  {
    id: "q_case8_syndrome",
    stem: "Case 8: Which diagnosis best fits the short stature and pulmonary stenosis?",
    options: [
      "LEOPARD syndrome",
      "Noonan syndrome",
      "Klippel-Feil syndrome",
      "Lesch-Nyhan syndrome",
      "Menkes disease",
    ],
    correctIndex: 1,
    explanation: "Noonan (PTPN11/SOS1) commonly presents with PS and short stature.",
  },
  {
    id: "q_case9_defect",
    stem: "Case 9: Short female with apical ejection click and SEM radiating to carotids. Which defect is most likely?",
    options: [
      "Aortic stenosis",
      "VSD",
      "ASD",
      "Pulmonary stenosis",
      "PDA",
    ],
    correctIndex: 0,
    explanation: "Turner syndrome often has bicuspid aortic valve/aortic stenosis producing an ejection click and carotid radiation.",
  },
  {
    id: "q_case9_syndrome",
    stem: "Case 9: Which genetic diagnosis best explains the stature and left-sided obstructive lesion?",
    options: [
      "Turner syndrome",
      "VATER",
      "Treacher-Collins",
      "Stickler syndrome",
      "Sotos syndrome",
    ],
    correctIndex: 0,
    explanation: "Short stature with aortic valve disease/coarctation is classic for Turner syndrome.",
  },
  {
    id: "q_case10_diagnosis",
    stem: "Case 10: 12-year-old with long QT (QTc ~0.72) and family history of syncope/drowning. Which diagnosis fits best?",
    options: [
      "Hypertrophic cardiomyopathy",
      "Anomalous left coronary artery from the pulmonary artery",
      "Brugada syndrome",
      "Wolff-Parkinson-White",
      "Jervell and Lange-Nielsen syndrome",
    ],
    correctIndex: 4,
    explanation: "Only Jervell and Lange-Nielsen accounts for congenital long QT among the options; drowning while swimming is a classic trigger.",
  },
  {
    id: "q_case11_diagnosis",
    stem: "Case 11: Infant with macroglossia, hypotonia, and cardiomegaly with high-voltage EKG. Most likely diagnosis?",
    options: [
      "Wolf-Hirschhorn",
      "Waardenburg",
      "Pompe disease",
      "Beckwith-Wiedemann",
      "Cri-du-chat",
    ],
    correctIndex: 2,
    explanation: "Pompe (acid alpha-glucosidase deficiency) causes cardiomegaly and profound hypotonia with characteristic EKG/echo changes.",
  },
];

export const defaultDeck: DeckData = {
  title: "Genetic Syndromes Involving the Heart",
  slides: defaultSlides,
  questions: defaultQuestions,
};

export function createInitialSessionData(deck: DeckData = defaultDeck): SessionData {
  const now = new Date().toISOString();
  const joinCode = Math.random().toString(36).substring(2, 6).toUpperCase();

  return {
    title: deck.title,
    joinCode,
    currentSlideIndex: 0,
    currentQuestionId: null,
    showResults: false,
    slides: deck.slides,
    questions: deck.questions,
    createdAt: now,
  };
}
