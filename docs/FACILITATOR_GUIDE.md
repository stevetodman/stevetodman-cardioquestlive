# CardioQuest Live - Facilitator Guide

Complete guide for facilitators running pediatric cardiology simulation scenarios. This document covers all 11 scenarios with clinical details, teaching objectives, expected progressions, and intervention strategies.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Presenter Controls](#presenter-controls)
3. [Scenario Overview](#scenario-overview)
4. [Teen Scenarios](#teen-scenarios)
5. [Pediatric Scenarios](#pediatric-scenarios)
6. [Infant Scenarios](#infant-scenarios)
7. [Complex Scenarios](#complex-scenarios)
8. [Code Blue Management](#code-blue-management)
9. [PALS Reference](#pals-reference)

---

## Quick Start

1. **Launch Session**: Navigate to `/#/create-demo` and create a new session
2. **Select Scenario**: Choose from 10 pre-built scenarios or load custom content
3. **Enable Voice**: Click "Enable Voice" in presenter controls
4. **Share Join Code**: Display QR code or give students the 4-digit code
5. **Monitor & Guide**: Use presenter controls to trigger events and advance stages

---

## Presenter Controls

### Quick Commands (Grouped by Category)

**AI Control**
- Enable/Disable Voice - Toggle AI patient responses
- Pause AI - Temporarily stop auto-replies
- Debrief - Generate AI summary of the encounter

**Clinical**
- Vitals Check - Display current vitals
- Physical Exam - Perform examination
- Telemetry On/Off - Toggle continuous monitoring

**Orders**
- EKG - 12-lead electrocardiogram
- Labs - Blood work panel
- Imaging - CXR, Echo

**Treatments**
- Intervene - Open medication/treatment panel
- Code Blue - Initiate resuscitation protocol

### Presenter Events

Trigger physiological changes:
- `hypoxia` - Drop SpO2
- `tachycardia` - Increase HR
- `hypotension` - Drop BP
- `fever` - Elevate temperature
- `stabilize` - Return to baseline
- `improve` - Gradual improvement
- `deteriorate` - Clinical worsening
- `rhythm_change` - VTach, SVT, AFib
- `code_blue` - Cardiac arrest

---

## Scenario Overview

| ID | Age | Weight | Diagnosis | Urgency |
|----|-----|--------|-----------|---------|
| `syncope` | 15yo | 55kg | Exertional syncope | Medium |
| `exertional_chest_pain` | 16yo | 62kg | Chest pain | Medium |
| `palpitations_svt` | 14yo | 50kg | SVT episodes | High |
| `myocarditis` | 11yo | 38kg | Post-viral myocarditis | High |
| `exertional_syncope_hcm` | 17yo | 70kg | HCM | High |
| `arrhythmogenic_syncope` | 15yo | 58kg | ARVC/CPVT | Critical |
| `kawasaki` | 4yo | 16kg | Kawasaki disease | Medium |
| `cyanotic_spell` | 2yo | 12kg | Tet spell | High |
| `ductal_shock` | 1mo | 3.5kg | Ductal-dependent lesion | Critical |
| `coarctation_shock` | 2mo | 4.5kg | Coarctation with shock | Critical |
| `teen_svt_complex_v1` | 14yo | 50kg | Complex SVT (PALS algorithm) | High |
| `peds_myocarditis_silent_crash_v1` | 9yo | 28kg | Fulminant myocarditis | Critical |

---

## Teen Scenarios

### 1. Syncope (`syncope`)

**Patient**: 15-year-old male, 55kg

**Presentation**: Lightheaded with exertion, near-syncope episodes

**Teaching Objectives**:
- Orthostatic vital signs technique
- Differentiate vasovagal vs cardiac syncope
- Red flags for sudden cardiac death risk

**Stage Progression**:

| Stage | HR | BP | SpO2 | Trigger |
|-------|----|----|------|---------|
| Baseline | 92 | 112/68 | 99% | Initial |
| Worse | 120 | 94/52 | 98% | Asking about exertion OR 3 min elapsed |
| Syncopal Event | 130 | 88/48 | 97% | Stand test + 30s |

**Physical Exam Findings**:
- *Baseline*: Well-appearing, oriented. Regular rhythm, no loud murmurs. Clear lungs. Warm, good pulses.
- *Decomp*: Dizzy and pale on standing. Tachycardic, mildly cool, delayed cap refill. Near-syncope.

**EKG Patterns**:
- *Baseline*: Sinus 90s, normal intervals
- *Decomp*: Sinus tachy 120s, borderline QTc

**Key Teaching Points**:
1. Always perform orthostatic vitals
2. Ask about family history of sudden death
3. Look for pre-excitation on EKG
4. Consider echo if murmur or abnormal EKG

---

### 2. Exertional Chest Pain (`exertional_chest_pain`)

**Patient**: 16-year-old male, 62kg

**Presentation**: Chest pain and palpitations with exertion

**Teaching Objectives**:
- Evaluate exertional chest pain in adolescents
- Distinguish musculoskeletal from cardiac causes
- When to order stress testing

**Stage Progression**:

| Stage | HR | BP | SpO2 | Trigger |
|-------|----|----|------|---------|
| Baseline | 88 | 110/70 | 99% | Initial |
| Exertion | 125 | 104/64 | 99% | 2 min elapsed |
| Recovery | 96 | 110/70 | 99% | 3 min after exertion |

**Physical Exam Findings**:
- *Baseline*: Well-appearing, mild discomfort. Possible soft SEM at LSB. Clear lungs. Warm extremities.
- *Exertion*: Uncomfortable. Tachycardic, no rub, no JVD. Anxious but oriented.

**EKG Patterns**:
- *Baseline*: Sinus 80-90s, nonspecific ST/T changes
- *Exertion*: Sinus tachy 110-120s, nonspecific changes

**Key Teaching Points**:
1. Reproducible with palpation = likely MSK
2. Exertional with syncope = high concern
3. Check for HCM features on exam
4. EKG before clearing for sports

---

### 3. Palpitations/SVT (`palpitations_svt`)

**Patient**: 14-year-old female, 50kg

**Presentation**: Recurrent episodes of rapid heartbeat

**Teaching Objectives**:
- Recognize SVT on monitor/EKG
- Vagal maneuvers technique
- Adenosine administration and monitoring

**Stage Progression**:

| Stage | HR | BP | SpO2 | Trigger |
|-------|----|----|------|---------|
| Baseline | 90 | 112/70 | 99% | Initial |
| Episode | 170 | 108/64 | 98% | 90s elapsed |
| Post-Episode | 102 | 112/70 | 99% | 2 min after episode |

**Physical Exam Findings**:
- *Baseline*: Comfortable between episodes. Regular rhythm, no murmurs.
- *Episode*: Anxious. Rapid regular pulse, slightly diaphoretic. Alert.

**EKG Patterns**:
- *Baseline*: Sinus 90s at rest
- *Episode*: Narrow regular tachycardia ~180 bpm

**CRITICAL: SVT Management**
1. **Vagal maneuvers first** (if stable):
   - Ice to face (diving reflex)
   - Valsalva (blow into syringe)
   - Modified Valsalva with leg raise

2. **Adenosine** (if vagal fails):
   - 0.1 mg/kg rapid IV push (max 6mg first dose)
   - Follow with 5mL NS flush
   - Second dose: 0.2 mg/kg (max 12mg)
   - **Have defibrillator ready**

3. **Cardioversion** (if unstable):
   - 0.5-1 J/kg synchronized
   - Sedate if possible

**Key Teaching Points**:
1. SVT = regular, narrow, >220 bpm
2. P waves absent or retrograde
3. Abrupt onset/offset
4. Document rhythm before/during/after conversion

---

### 4. Exertional Syncope - HCM (`exertional_syncope_hcm`)

**Patient**: 17-year-old male, 70kg

**Presentation**: Near-syncope during intense basketball practice. Family history of sudden cardiac death in uncle at age 32.

**Teaching Objectives**:
- Recognize HCM clinical features
- Understand dynamic LVOT obstruction
- Risk stratification for sudden death
- Sports restriction counseling

**Stage Progression**:

| Stage | HR | BP | SpO2 | Trigger |
|-------|----|----|------|---------|
| Baseline | 92 | 110/68 | 99% | Initial |
| Exertion | 130 | 104/62 | 99% | 90s elapsed |
| Presyncope | 140 | 88/50 | 99% | 90s after exertion |

**Physical Exam Findings**:
- *Baseline*: Well-appearing athlete. **Harsh SEM at LLSB that increases with Valsalva/standing**. Strong pulses.
- *Presyncope*: Lightheaded. Murmur more pronounced standing. Slightly delayed cap refill. Dizzy when upright.

**EKG Patterns**:
- *Baseline*: Sinus 90s, **LVH voltage with deep Q waves in V5-V6**
- *Exertion*: Sinus 110s, LVH with repolarization changes

**CRITICAL: HCM Features**
- Dynamic murmur (louder with Valsalva, standing, exercise)
- Brisk carotid upstroke with bisferiens pulse
- S4 gallop possible
- Family history of sudden death

**Key Teaching Points**:
1. **Murmur maneuvers**:
   - Increases with: Valsalva, standing, dehydration
   - Decreases with: squatting, handgrip, leg raise
2. EKG shows LVH + deep septal Qs
3. Echo essential for diagnosis
4. **No competitive sports** until cardiology evaluation
5. First-degree relatives need screening

---

### 5. Arrhythmogenic Syncope (`arrhythmogenic_syncope`)

**Patient**: 15-year-old male, 58kg

**Presentation**: Collapsed during soccer match, brief loss of consciousness

**Teaching Objectives**:
- Recognize high-risk syncope features
- Identify ventricular arrhythmias
- ARVC/CPVT differential
- Emergency VT management

**Stage Progression**:

| Stage | HR | BP | SpO2 | Trigger |
|-------|----|----|------|---------|
| Baseline | 96 | 110/68 | 99% | Initial |
| Irritable | 112 | 104/64 | 99% | 2 min elapsed |
| VTach Risk | 140 | 92/58 | 98% | 2 min after irritable |

**Physical Exam Findings**:
- *Baseline*: Anxious teen. Occasional irregular beats, no murmur. Warm, strong pulses.
- *Irritable*: More anxious, lightheaded. Frequent irregular beats.

**EKG Patterns**:
- *Baseline*: Sinus with occasional PVCs
- *Irritable*: Sinus with runs of VT possible
- *Episode*: Nonsustained VT

**CRITICAL: VT Recognition & Management**

Wide complex tachycardia features:
- QRS >120ms
- AV dissociation
- Fusion/capture beats
- Northwest axis

**Stable VT**:
- Amiodarone 5 mg/kg over 20 min (max 300mg)
- OR Procainamide 15 mg/kg over 30 min
- Cardiology consult ASAP

**Unstable VT / Pulseless VT**:
- Defibrillation 2 J/kg → 4 J/kg
- CPR immediately
- Epinephrine 0.01 mg/kg q3-5min
- Amiodarone 5 mg/kg bolus

**Key Teaching Points**:
1. Exercise-induced syncope = high risk
2. PVCs that increase with exercise = concerning
3. ARVC: RV abnormalities, epsilon waves
4. CPVT: Bidirectional VT with exercise
5. ICD often indicated

---

## Pediatric Scenarios

### 6. Myocarditis (`myocarditis`)

**Patient**: 11-year-old male, 38kg

**Presentation**: Recent viral illness (1 week ago), now with chest discomfort, fatigue, and low-grade fever

**Teaching Objectives**:
- Recognize myocarditis presentation
- Understand progression to cardiogenic shock
- Inotrope and mechanical support indications

**Stage Progression**:

| Stage | HR | BP | SpO2 | Temp | Trigger |
|-------|----|----|------|------|---------|
| Baseline | 118 | 98/60 | 97% | 38.1°C | Initial |
| Decompensation | 135 | 86/54 | 95% | — | 3 min elapsed |
| Support | 112 | 96/60 | 96% | — | 4 min after decomp |

**Physical Exam Findings**:
- *Baseline*: Tired, low energy. Tachycardic, possible **S3 gallop or rub**. **Mild crackles at bases**. Cool extremities, delayed cap refill.
- *Decomp*: Ill-appearing, tachypneic. Gallop rhythm. **Bibasilar crackles**. Weak pulses, lethargic.

**EKG Patterns**:
- *Baseline*: Sinus tachy 120s, **low voltage, diffuse ST/T changes**
- *Decomp*: Sinus tachy 130s, low voltage with ST depressions

**CRITICAL: Myocarditis Management**

**Do NOT give**:
- NSAIDs (worsen inflammation)
- High-dose fluids (already volume overloaded)

**Management**:
1. Oxygen for hypoxia
2. Diuresis for congestion (furosemide 1 mg/kg)
3. Inotropes if shock (milrinone, dobutamine)
4. ICU/ECMO capability if severe
5. Restrict activity

**Key Teaching Points**:
1. Recent viral prodrome is classic
2. Low voltage + ST changes = inflammatory
3. Can progress rapidly to fulminant
4. Echo shows depressed function
5. Troponin/BNP elevated

---

### 7. Kawasaki Disease (`kawasaki`)

**Patient**: 4-year-old male, 16kg

**Presentation**: 5 days of fever, bilateral conjunctival injection, strawberry tongue, cervical lymphadenopathy, extremity swelling

**Teaching Objectives**:
- Kawasaki diagnostic criteria
- Coronary artery aneurysm risk
- IVIG and aspirin timing
- Incomplete Kawasaki recognition

**Stage Progression**:

| Stage | HR | BP | SpO2 | Temp | Trigger |
|-------|----|----|------|------|---------|
| Fever | 130 | 96/60 | 98% | 39.2°C | Initial |
| Incomplete | 122 | 98/62 | 98% | 38.4°C | 3 min elapsed |

**Physical Exam Findings**:
- *Fever*: Febrile, irritable. Tachycardic, no murmur. Clear lungs. **Swollen hands/feet**. Irritable but alert.
- *Incomplete*: Less febrile, still irritable.

**CRITICAL: Kawasaki Criteria (5 of 6)**

1. **Fever ≥5 days** (required)
2. Bilateral bulbar conjunctival injection (non-purulent)
3. Oral mucous membrane changes (strawberry tongue, red lips)
4. Peripheral extremity changes (edema, erythema, desquamation)
5. Polymorphous rash
6. Cervical lymphadenopathy (≥1.5 cm, usually unilateral)

**Treatment Window**:
- IVIG **within 10 days** of fever onset
- Dose: 2 g/kg over 10-12 hours
- Aspirin: High dose initially, then low dose for 6-8 weeks

**Key Teaching Points**:
1. Echo at diagnosis AND 6-8 weeks
2. Coronary aneurysms in 25% untreated
3. Incomplete Kawasaki: <4 criteria but echo changes or lab support
4. Labs: elevated ESR/CRP, thrombocytosis, sterile pyuria

---

### 8. Cyanotic Spell - Tetralogy of Fallot (`cyanotic_spell`)

**Patient**: 2-year-old male, 12kg, known Tetralogy of Fallot awaiting repair

**Presentation**: Crying episode followed by deepening cyanosis and irritability. Parent notes he often squats when playing.

**Teaching Objectives**:
- Recognize hypercyanotic (Tet) spell
- Understand RVOT spasm mechanism
- Knee-chest position technique
- Pharmacologic management

**Stage Progression**:

| Stage | HR | BP | SpO2 | Trigger |
|-------|----|----|------|---------|
| Baseline | 110 | 92/58 | 93% | Initial |
| Spell | 150 | 88/54 | **78%** | 2 min elapsed |
| Recovery | 120 | 90/56 | 88% | 2 min after spell |

**Physical Exam Findings**:
- *Baseline*: Quiet toddler, mildly cyanotic lips. **Soft systolic murmur at LUSB**. Slight **digital clubbing**.
- *Spell*: Irritable, **squatting posture**, deeply cyanotic. Tachycardic, **murmur becomes LOUDER** (less obstruction = more right-to-left shunt = less murmur; this is counterintuitive). Delayed cap refill.

**EKG Patterns**:
- *Baseline*: Sinus 100s, RVH pattern, right axis deviation
- *Spell*: Sinus 150s, RV strain pattern

**CRITICAL: Tet Spell Management**

**Immediate Actions** (in order):
1. **Knee-chest position** - increases SVR, decreases shunt
2. **100% oxygen**
3. **Calm the child** - crying worsens spell

**If persists**:
4. **Morphine** 0.1 mg/kg IM/IV - reduces agitation, decreases preload
5. **Phenylephrine** 5-20 mcg/kg IV bolus - increases SVR
6. **Fluid bolus** 10-20 mL/kg - increases preload

**If still cyanotic**:
7. **Propranolol** 0.1 mg/kg IV slow push - relaxes RVOT
8. **Sodium bicarbonate** if acidotic
9. **Emergent surgery** if refractory

**Key Teaching Points**:
1. Squatting increases SVR (natural treatment)
2. Murmur DECREASES during spell (less flow across RVOT)
3. Avoid high FiO2 in chronic cyanosis - won't help much
4. Beta-blockers relax RVOT spasm
5. Urgent surgical consult

---

## Infant Scenarios

### 9. Ductal Shock (`ductal_shock`)

**Patient**: 1-month-old male, 3.5kg

**Presentation**: Previously healthy infant now ill-appearing with poor feeding, mottled skin, weak pulses

**Teaching Objectives**:
- Recognize ductal-dependent lesion presentation
- Prostaglandin E1 emergency use
- Differentiate from sepsis
- Avoid excessive oxygen

**Stage Progression**:

| Stage | HR | BP | SpO2 | Trigger |
|-------|----|----|------|---------|
| Shock | 188 | 62/38 | **86%** | Initial |
| Improving | 170 | 72/44 | 90% | 2 min elapsed |
| Stabilized | 150 | 78/48 | 94% | 3 min after improving |

**Physical Exam Findings**:
- *Shock*: Ill, irritable infant. Tachycardic, possible **gallop**. Mild retractions, coarse breath sounds. **Cool extremities, weak pulses, hepatomegaly**.
- *Stabilized*: Improved color. Still tachycardic but better perfusion.

**EKG Patterns**:
- *Baseline*: Sinus tachy 180s, possible RV strain
- *Decomp*: Sinus tachy 190s, low amplitude complexes

**CRITICAL: Ductal-Dependent Lesion Management**

**Start PGE1 IMMEDIATELY if suspected**:
- 0.05-0.1 mcg/kg/min IV infusion
- Prepare for intubation (PGE1 causes apnea in ~10%)

**Key Signs of Ductal-Dependent Lesion**:
- Age 1-4 weeks (as ductus closes)
- Shock with no clear infectious source
- Lower extremity pulses weaker than upper (coarctation)
- Cyanosis not improving with oxygen

**Supportive Care**:
- Minimal oxygen (target SpO2 75-85% is acceptable)
- IV access, glucose check
- Blood cultures + antibiotics until sepsis ruled out
- Urgent cardiology/ECHO

**Key Teaching Points**:
1. PGE1 saves lives - don't delay
2. Monitor for apnea after starting PGE1
3. Excess oxygen can close the ductus
4. May look like sepsis - treat for both initially
5. Definitive treatment is surgical

---

### 10. Coarctation with Shock (`coarctation_shock`)

**Patient**: 2-month-old male, 4.5kg

**Presentation**: Poor feeding, irritability, tachypnea. On exam: **differential pulses** (strong upper, weak lower extremities)

**Teaching Objectives**:
- Four-extremity blood pressure technique
- Upper/lower extremity gradient interpretation
- Coarctation vs ductal-dependent lesion
- PGE1 indications

**Stage Progression**:

| Stage | HR | BP | SpO2 | RR | Trigger |
|-------|----|----|------|-----|---------|
| Shock | 182 | 78/40 | 88% | 48 | Initial |
| After Bolus | 168 | 84/48 | 90% | 42 | 3 min elapsed |

**Physical Exam Findings**:
- *Shock*: Ill infant, cool legs. Tachycardic. **WEAK FEMORAL PULSES** vs strong brachial. Tachypneic. **Delayed cap refill in lower extremities**.
- *After fluids*: Slightly improved. **Femoral pulses still weaker than upper extremity**.

**EKG Patterns**:
- *Baseline*: Sinus tachy 180s, possible RV strain
- *After fluids*: Sinus tachy 170s, low amplitude

**CRITICAL: Coarctation Assessment**

**Four-Extremity BP**:
- Upper extremity BP should be similar left/right
- Lower extremity should be HIGHER than upper (normally)
- **Gradient >20 mmHg = significant coarctation**

**Classic Signs**:
- Femoral pulse delay or absence
- Upper body hypertension
- Lower body hypoperfusion
- Systolic murmur (may be subtle)

**Management**:
1. PGE1 if ductal-dependent (usually <3 months)
2. Fluid resuscitation (careful - may worsen LV failure)
3. Avoid excessive oxygen
4. Inotropes if needed (milrinone preferred)
5. Surgical repair

**Key Teaching Points**:
1. **Always check femoral pulses** in sick infants
2. Critical coarctation presents in first weeks of life
3. May initially present as "sepsis"
4. PGE1 reopens ductus to perfuse lower body
5. Surgical repair is definitive

---

## Complex Scenarios

These advanced scenarios feature deterministic physiology engines, phase-based progression, scoring systems, and NPC character triggers for high-fidelity simulation.

### 11. Complex SVT - Teen (`teen_svt_complex_v1`)

**Patient**: Alex Chen, 14-year-old female, 50kg

**Presentation**: Recurrent episodes of rapid heartbeat. Current episode with HR 220, anxiety, mild chest discomfort. Family history of WPW in mother.

**Teaching Objectives**:
- Master PALS SVT algorithm
- Vagal maneuver technique selection
- Correct adenosine dosing (0.1 mg/kg first, 0.2 mg/kg second)
- Recognition of when to cardiovert
- Sedation before cardioversion

**Runtime**: ~15-20 minutes

**Phase Progression** (6 phases):

| Phase | Duration | HR | BP | SpO2 | Key Mechanics |
|-------|----------|----|----|------|---------------|
| `presentation` | 2 min | 90 | 115/72 | 99% | History taking, baseline ECG |
| `svt_onset` | 3 min | 220 | 105/68 | 98% | SVT starts, patient stable |
| `treatment_window` | 5 min | 220-240 | 100/65 | 97% | Vagal/adenosine opportunity |
| `cardioversion_decision` | 3 min | 240 | 90/55 | 95% | Adenosine failed, cardioversion needed |
| `decompensating` | 5 min | 250 | 75/45 | 92% | Unstable - urgent cardioversion |
| `converted` | 3 min | 95 | 112/70 | 99% | Resolution, monitoring |

**Physical Exam Findings**:
- *Baseline*: Well-appearing teen. Regular rhythm at 90 bpm. Normal S1/S2, no murmur. Clear lungs. Warm, strong pulses.
- *SVT Episode*: Anxious, rapid regular pulse ~220 bpm. JVP visible. Slightly diaphoretic. Alert and oriented.
- *Decompensating*: Ill-appearing, drowsy. Rapid weak pulse ~250 bpm. Delayed cap refill. Altered mental status.

**EKG Patterns**:
- *Baseline*: Normal sinus rhythm 90s, normal intervals, no pre-excitation
- *SVT Episode*: Narrow complex tachycardia 220 bpm, regular, P waves not visible (AVNRT pattern)
- *Decompensating*: Persistent SVT 240+ bpm with ST depression

**CRITICAL: PALS SVT Algorithm**

**Step 1 - Vagal Maneuvers** (if hemodynamically stable):
- **Ice to face**: Bag of ice on forehead/eyes for 15-20 sec (diving reflex)
- **Modified Valsalva**: Blow into 10mL syringe then leg raise 45° for 15 sec
- **Standard Valsalva**: Bear down/blow out against resistance

**Step 2 - Adenosine** (if vagal fails):
| Dose | mg/kg | Max | Technique |
|------|-------|-----|-----------|
| First | 0.1 mg/kg | 6mg | Rapid IV push + 5mL flush |
| Second | 0.2 mg/kg | 12mg | Same technique, repeat if needed |

**Step 3 - Synchronized Cardioversion** (if unstable OR adenosine fails):
- 0.5-1 J/kg synchronized (may increase to 2 J/kg)
- **Sedate first if possible** (midazolam 0.1 mg/kg, ketamine, or propofol)

**Scoring System**:

*Checklist (need 4/5 to pass):*
| Item | Criteria |
|------|----------|
| ECG ordered | 12-lead obtained |
| Vagal attempted | Tried before adenosine (stable patient) |
| Adenosine dose correct | First dose 0.1 mg/kg ±20% |
| Continuous monitoring | Monitor on before treatment |
| Patient reassured | Communication with patient/parent |

*Bonuses*:
- Early ECG (<60 sec): +10 pts
- Vagal conversion: +20 pts
- First-dose adenosine conversion: +15 pts
- Cardiology consult: +10 pts
- Proper flush technique: +5 pts

*Penalties*:
- Adenosine underdose (<0.05 mg/kg): -10 pts
- Adenosine overdose (>0.25 mg/kg): -15 pts
- Skipped vagal in stable patient: -5 pts
- Delayed treatment (>5 min): -15 pts
- Unsedated cardioversion: -20 pts
- Patient decompensated: -15 pts

**Character Triggers**:

*Nurse (safety-critical):*
- "Heart rate is 220. Want me to get a 12-lead?"
- "Vagal didn't work. Adenosine is drawn up - 5mg ready."
- "BP is dropping - she's at 90 systolic now."
- "Do you want sedation before we cardiovert?"

*Parent:*
- "What's happening? Her heart is racing so fast!"
- "My mother had WPW - could Alex have that too?"

*Patient:*
- "My heart is racing again! I'm scared..."
- "That medicine felt weird - like my heart stopped for a second"
- "It stopped! That feels so much better."

**Key Teaching Points**:
1. SVT >220 bpm in pediatrics = PALS pathway
2. Vagal maneuvers first in stable patients
3. Adenosine: weight-based dosing, rapid push with flush
4. Document rhythm before/during/after conversion attempt
5. Family history of WPW → EP study referral
6. Sedate before cardioversion when possible

---

### 12. The Silent Crash - Myocarditis (`peds_myocarditis_silent_crash_v1`)

**Patient**: Marcus Johnson, 9-year-old male, 28kg

**Presentation**: Post-viral illness (2 weeks ago), now with progressive fatigue, exercise intolerance, and subtle signs of cardiogenic shock.

**Teaching Objectives**:
- Recognize subtle myocarditis presentation
- Understand cardiogenic shock progression
- Avoid fluid overload in pump failure
- Inotrope selection and timing
- Intubation risks in cardiogenic shock

**Runtime**: ~25-30 minutes

**Phase Progression** (6 phases):

| Phase | Duration | HR | BP | SpO2 | Shock Stage | Key Event |
|-------|----------|----|----|------|-------------|-----------|
| `presentation` | 5 min | 128 | 94/62 | 96% | 1 | Initial assessment |
| `compensated_shock` | 5 min | 135 | 88/58 | 94% | 2 | Declining perfusion |
| `decompensated_shock` | 5 min | 145 | 80/52 | 92% | 3 | Frank shock |
| `crisis` | 5 min | 155+ | 70/45 | 88% | 4 | Arrest imminent |
| `resuscitation` | 10 min | varies | varies | varies | 5 | Active resuscitation |
| `stabilized` | 5 min | 110 | 95/60 | 96% | 2 | Inotrope response |

**Critical Physiology Rules**:

| Rule | Trigger | Effect |
|------|---------|--------|
| Fluid overload | >20 mL/kg fluid | Worsens SpO2, crackles, gallop |
| Dobutamine response | Dobutamine started | HR -10, BP +15, cap refill improves |
| Milrinone response | Milrinone started | Gradual improvement over 15 min |
| Epinephrine bridge | Epi push + milrinone | Stabilizes for milrinone onset |
| Intubation collapse | Intubation without inotropes | Severe hypotension, possible arrest |
| Amiodarone effect | For VT/SVT | Rate control, rhythm stabilization |

**Scoring System**:

*Checklist (need 4/5 to pass):*
| Item | Criteria |
|------|----------|
| Cardiology consult | Called within first 10 minutes |
| Echo ordered | Bedside echo requested |
| Avoided fluid overload | Total fluids <20 mL/kg |
| Started inotropes | Before intubation attempt |
| Avoided NSAIDs | No ibuprofen/ketorolac ordered |

**Key Teaching Points**:
1. Post-viral fatigue + tachycardia = think myocarditis
2. Fluid restriction - these patients are volume overloaded
3. Inotropes BEFORE intubation in cardiogenic shock
4. Echo early - function tells the story
5. NSAIDs contraindicated (worsen myocardial inflammation)

---

## Code Blue Management

### Activating Code Blue Mode

The presenter interface includes an automated **Code Blue Panel** that activates when critical rhythms are detected:
- Ventricular Fibrillation (VFib)
- Pulseless Ventricular Tachycardia (VTach)
- Asystole
- Pulseless Electrical Activity (PEA)

### Code Blue Panel Features

1. **Automatic Detection**: Panel appears when rhythm summary indicates arrest
2. **Duration Timer**: Tracks time since code started
3. **Pulse Check Countdown**: 2-minute PALS timer
4. **CPR Metronome**: Audio/visual guide at 110 BPM (PALS: 100-120/min)
5. **Shockable vs Non-Shockable**: Pathway guidance

### PALS Algorithm Quick Reference

**Shockable Rhythms (VFib/pVT)**:
1. CPR 2 minutes
2. Shock 2 J/kg
3. CPR 2 minutes
4. Shock 4 J/kg
5. CPR + Epinephrine 0.01 mg/kg
6. Shock 4 J/kg
7. CPR + Amiodarone 5 mg/kg
8. Repeat: CPR → Shock → Epi q3-5min → Amiodarone (can repeat x2)

**Non-Shockable Rhythms (Asystole/PEA)**:
1. CPR 2 minutes
2. Epinephrine 0.01 mg/kg
3. CPR 2 minutes
4. Epinephrine q3-5min
5. Consider reversible causes (H's and T's)

### H's and T's Mnemonic

| H's | T's |
|-----|-----|
| Hypovolemia | Tension pneumothorax |
| Hypoxia | Tamponade (cardiac) |
| Hydrogen ion (acidosis) | Toxins |
| Hypo/Hyperkalemia | Thrombosis (pulmonary) |
| Hypothermia | Thrombosis (coronary) |
| Hypoglycemia | Trauma |

---

## PALS Reference

### Age-Dependent Heart Rate Thresholds

| Age Group | Normal Range | Tachycardia | Bradycardia | SVT |
|-----------|--------------|-------------|-------------|-----|
| Neonate (<1mo) | 100-180 | >180 | <100 | >220 |
| Infant (1-12mo) | 100-160 | >160 | <100 | >220 |
| Toddler (1-3yr) | 90-150 | >150 | <90 | >220 |
| Preschool (3-6yr) | 80-120 | >120 | <80 | >220 |
| School-age (6-12yr) | 70-110 | >110 | <70 | >220 |
| Adolescent (>12yr) | 60-100 | >100 | <60 | >220 |

### Weight-Based Medication Dosing

| Medication | Dose | Max | Route | Notes |
|------------|------|-----|-------|-------|
| Adenosine (1st) | 0.1 mg/kg | 6mg | Rapid IV push | Flush with 5mL NS |
| Adenosine (2nd) | 0.2 mg/kg | 12mg | Rapid IV push | Flush with 5mL NS |
| Epinephrine | 0.01 mg/kg | — | IV/IO | 1:10,000 (0.1 mL/kg) |
| Epinephrine (IM) | 0.01 mg/kg | 0.5mg | IM | 1:1,000 (0.01 mL/kg) |
| Amiodarone | 5 mg/kg | 300mg | IV over 20min | VF/pVT refractory |
| Atropine | 0.02 mg/kg | 0.5mg child, 1mg teen | IV | Min dose 0.1mg |
| Lidocaine | 1 mg/kg | 100mg | IV bolus | VF/pVT alternative |
| Calcium chloride | 20 mg/kg | 2g | Slow IV push | Hypocalcemia/hyperK |
| Sodium bicarbonate | 1 mEq/kg | — | Slow IV push | Documented acidosis |
| Magnesium | 25-50 mg/kg | 2g | IV over 15min | Torsades |
| Procainamide | 15 mg/kg | 1g | IV over 30min | Wide complex tachy |

### Electrical Therapy

| Intervention | Energy | Notes |
|--------------|--------|-------|
| Cardioversion (sync) | 0.5-1 J/kg | May increase to 2 J/kg |
| Defibrillation | 2 J/kg | Increase to 4 J/kg |

### CPR Quality Indicators

- **Rate**: 100-120 compressions/min
- **Depth**: At least 1/3 AP diameter (4cm infant, 5cm child)
- **Recoil**: Allow full chest recoil
- **Interruptions**: Minimize (<10 sec)
- **Ventilation**: Avoid excessive ventilation

---

## Troubleshooting

### Common Facilitator Questions

**Q: Student can't hear the AI patient**
- A: Check that voice is enabled in presenter controls. Ensure student's phone volume is up.

**Q: Vitals aren't changing**
- A: The scenario may be in auto-progression. Use presenter events to trigger changes, or wait for automatic stage transitions.

**Q: How do I reset a scenario?**
- A: Create a new session from `/#/create-demo`. Each session is independent.

**Q: Can I customize scenarios?**
- A: Currently, scenarios are defined in `scenarioEngine.ts`. Custom decks can be created in the admin editor for slide content.

**Q: The Code Blue panel isn't appearing**
- A: The panel auto-detects critical rhythms. Use the "Code Blue" event trigger from presenter controls to initiate an arrest.

---

## Version History

- **v1.2.0** (Dec 2024): Added Complex SVT scenario (`teen_svt_complex_v1`)
  - 6-phase PALS SVT algorithm teaching
  - Deterministic physiology with vagal, adenosine, cardioversion paths
  - Scoring system with checklist, bonuses, penalties
  - NPC triggers (nurse, parent, patient)
- **v1.1.0** (Dec 2024): Added "The Silent Crash" myocarditis scenario
  - Complex physiology engine for cardiogenic shock
  - Phase-based progression with shock staging
- **v1.0.0** (Dec 2024): Initial facilitator guide with all 10 scenarios
  - Includes Code Blue panel, CPR metronome, dynamic rhythm waveforms
