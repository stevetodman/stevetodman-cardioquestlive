/**
 * Treatment handler for patient interventions and medications.
 * Extracted from index.ts for better maintainability.
 *
 * Handles:
 * - Supportive care (oxygen, fluids, positioning)
 * - SVT interventions (vagal, sedation)
 * - Cardiac medications (adenosine, amiodarone, epinephrine, etc.)
 * - Cardioversion/defibrillation
 * - Airway management
 */

import { SessionManager } from "./sessionManager";
import { ScenarioEngine } from "./sim/scenarioEngine";
import { hasSVTExtended, ToolIntent } from "./sim/types";
import { SVT_PHASES } from "./sim/scenarios/teen_svt_complex";
import { logSimEvent } from "./persistence";
import { createOrderHandler } from "./orders";
import { buildTelemetryWaveform } from "./telemetry";

export type TreatmentDependencies = {
  sessionManager: SessionManager;
  ensureRuntime: (sessionId: string) => {
    scenarioEngine: ScenarioEngine;
    cost: { getState?: () => any };
    fallback: boolean;
  };
  broadcastSimState: (sessionId: string, state: any) => void;
  handleOrder: ReturnType<typeof createOrderHandler>;
  lastTreatmentAt: Map<string, number>;
};

export function createTreatmentHandler(deps: TreatmentDependencies) {
  const { sessionManager, ensureRuntime, broadcastSimState, handleOrder, lastTreatmentAt } = deps;

  return function handleTreatment(
    sessionId: string,
    treatmentType?: string,
    payload?: Record<string, unknown>
  ) {
    const runtime = ensureRuntime(sessionId);
    const weightKg = runtime.scenarioEngine.getPatientWeight();
    const demographics = runtime.scenarioEngine.getDemographics();

    const key = `${sessionId}:${(treatmentType ?? "").toLowerCase()}`;
    const now = Date.now();
    const last = lastTreatmentAt.get(key) || 0;

    // Minimum interval between same treatments (prevents spam)
    const minIntervalMs = treatmentType === "cardioversion" || treatmentType === "defibrillation" ? 3000 : 8000;
    if (now - last < minIntervalMs) {
      sessionManager.broadcastToPresenters(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: "Treatment already given; wait a moment before re-dosing.",
        character: "nurse",
      });
      return;
    }
    lastTreatmentAt.set(key, now);

    const delta: any = {};
    let nurseResponse = "";
    let techResponse: string | undefined;
    let decayMs = 120000;
    let decayIntent: ToolIntent | null = null;

    // Extract dose/route from payload
    const doseOrdered = payload?.dose as number | undefined;
    const routeOrdered = payload?.route as string | undefined;
    const joules = payload?.joules as number | undefined;

    switch ((treatmentType ?? "").toLowerCase()) {
      // ===== SUPPORTIVE CARE =====
      case "oxygen":
      case "o2": {
        delta.spo2 = 3;
        delta.hr = -3;
        const flowRate = (payload?.flowRate as number) ?? 2;
        const o2Type = (payload?.o2Type as string) ?? "nasal_cannula";
        runtime.scenarioEngine.updateIntervention("oxygen", {
          type: o2Type as any,
          flowRateLpm: flowRate,
        });
        nurseResponse = `Oxygen on at ${flowRate} L/min via ${o2Type.replace(/_/g, " ")}. SpO2 should improve.`;
        techResponse = "Oxygenation improving on the monitor.";
        decayIntent = { type: "intent_updateVitals", delta: { spo2: -2, hr: 2 } as any };
        break;
      }
      case "fluids":
      case "bolus": {
        // Standard: 20 mL/kg NS bolus
        const volumeMl = doseOrdered ?? Math.round(20 * weightKg);
        delta.hr = -4;
        delta.sbpPerMin = 6;
        delta.dbpPerMin = 4;
        // Update IV intervention if not already set
        const currentIv = runtime.scenarioEngine.getState().interventions?.iv;
        if (!currentIv) {
          runtime.scenarioEngine.updateIntervention("iv", {
            location: "right_ac",
            gauge: 22,
            fluidsRunning: true,
            fluidType: "NS",
          });
        } else {
          runtime.scenarioEngine.updateIntervention("iv", {
            ...currentIv,
            fluidsRunning: true,
            fluidType: "NS",
          });
        }
        nurseResponse = `NS bolus ${volumeMl} mL IV running in. That's ${Math.round(volumeMl / weightKg)} mL/kg.`;
        techResponse = "Perfusion improving with fluids.";
        decayIntent = { type: "intent_updateVitals", delta: { hr: 2, sbpPerMin: -4, dbpPerMin: -3 } as any };
        break;
      }
      case "iv":
      case "iv_access": {
        // Use the delayed order system for IV placement
        const ivLocation = (payload?.location as string) ?? "right_ac";
        const ivGauge = (payload?.gauge as number) ?? 22;
        const ivOrderedBy = payload?.orderedBy
          ? { id: (payload.orderedBy as any).id ?? "unknown", name: (payload.orderedBy as any).name ?? "Unknown", role: (payload.orderedBy as any).role ?? "presenter" as const }
          : { id: "system", name: "System", role: "presenter" as const };

        const orderResult = handleOrder(sessionId, "iv_access", ivOrderedBy, { gauge: ivGauge, location: ivLocation });

        if (orderResult.success) {
          // Update SVT extended state to track that IV was ordered (completion updates ivAccess)
          const ivState = runtime.scenarioEngine.getState();
          if (hasSVTExtended(ivState)) {
            const ext = ivState.extended;
            runtime.scenarioEngine.updateExtended({
              ...ext,
              timelineEvents: [
                ...ext.timelineEvents,
                { ts: Date.now(), type: "intervention", description: `IV access ordered (${ivGauge}g ${ivLocation.replace(/_/g, " ")})` },
              ],
            });
          }
        }
        // Order handler broadcasts nurse ack, so skip here
        nurseResponse = "";
        break;
      }
      case "position":
      case "knee-chest": {
        delta.spo2 = 4;
        delta.hr = -5;
        nurseResponse = "Got them into knee-chest position. Sats improving.";
        techResponse = "Squatting/knee-chest reducing right-to-left shunt; sats coming up.";
        decayIntent = { type: "intent_updateVitals", delta: { spo2: -3, hr: 3 } as any };
        break;
      }

      // ===== SVT INTERVENTIONS =====
      case "vagal":
      case "vagal_maneuver": {
        // Vagal maneuvers for SVT: ~30% success rate on second attempt
        // Modified Valsalva, ice to face, or bearing down
        const currentState = runtime.scenarioEngine.getState();
        const currentHr = currentState.vitals.hr ?? 90;
        const method = (payload?.method as string) ?? "valsalva";
        const methodName = method === "ice_to_face" ? "ice to face" :
                           method === "modified_valsalva" ? "modified Valsalva" : "bearing down";

        if (currentHr > 180) {
          // SVT likely - vagal may work
          // Teaching progression: first attempt fails, second attempt has 30% success
          const previousAttempts = hasSVTExtended(currentState) ? currentState.extended.vagalAttempts : 0;
          const vagalSucceeds = previousAttempts >= 1 && Math.random() < 0.3;

          nurseResponse = `Trying ${methodName} now... watching the monitor...`;

          if (vagalSucceeds) {
            // Vagal converted the SVT!
            techResponse = "Wait... look at that! Rate's coming down... 180... 140... 100... We're back in sinus!";
            delta.hr = -(currentHr - 90); // Convert to sinus ~90 bpm
            decayIntent = null; // No rebound, stay converted

            if (hasSVTExtended(currentState)) {
              const ext = currentState.extended;
              runtime.scenarioEngine.updateExtended({
                ...ext,
                vagalAttempts: ext.vagalAttempts + 1,
                vagalAttemptTs: Date.now(),
                converted: true,
                conversionMethod: "vagal",
                conversionTs: Date.now(),
                currentRhythm: "sinus",
                checklistCompleted: ext.checklistCompleted.includes("vagal_attempted")
                  ? ext.checklistCompleted
                  : [...ext.checklistCompleted, "vagal_attempted"],
                timelineEvents: [
                  ...ext.timelineEvents,
                  { ts: Date.now(), type: "treatment", description: `Vagal maneuver (${methodName}) - CONVERTED to sinus rhythm` },
                ],
              });
            }
          } else {
            // Vagal failed
            techResponse = "Rate unchanged. Vagal didn't convert her.";
            // Small HR drop but no conversion
            delta.hr = -5;
            decayIntent = { type: "intent_updateVitals", delta: { hr: 5 } as any };
            decayMs = 30000;

            if (hasSVTExtended(currentState)) {
              const ext = currentState.extended;
              runtime.scenarioEngine.updateExtended({
                ...ext,
                vagalAttempts: ext.vagalAttempts + 1,
                vagalAttemptTs: Date.now(),
                checklistCompleted: ext.checklistCompleted.includes("vagal_attempted")
                  ? ext.checklistCompleted
                  : [...ext.checklistCompleted, "vagal_attempted"],
                timelineEvents: [
                  ...ext.timelineEvents,
                  { ts: Date.now(), type: "treatment", description: `Vagal maneuver (${methodName}) attempted - no conversion` },
                ],
              });
            }
          }
        } else {
          nurseResponse = `Heart rate is only ${currentHr}. Vagal maneuvers are for SVT rates over 180.`;
        }
        break;
      }
      case "sedation": {
        // Procedural sedation for cardioversion
        const agent = (payload?.agent as string) ?? "midazolam";
        const agentDoses: Record<string, { dose: number; unit: string; onset: string }> = {
          midazolam: { dose: 0.1, unit: "mg/kg", onset: "1-2 minutes" },
          ketamine: { dose: 1.0, unit: "mg/kg", onset: "30 seconds" },
          propofol: { dose: 1.0, unit: "mg/kg", onset: "30 seconds" },
        };
        const info = agentDoses[agent] ?? agentDoses.midazolam;
        const actualDose = Math.round(info.dose * weightKg * 10) / 10;
        nurseResponse = `${agent.charAt(0).toUpperCase() + agent.slice(1)} ${actualDose} ${info.unit === "mg/kg" ? "mg" : info.unit} IV given. ` +
                        `That's ${info.dose} ${info.unit}. Onset in about ${info.onset}.`;
        if (agent === "propofol") {
          delta.sbpPerMin = -10; // Propofol causes hypotension
          nurseResponse += " Watching the BP closely.";
        }

        // Update SVT extended state
        const sedState = runtime.scenarioEngine.getState();
        if (hasSVTExtended(sedState)) {
          const ext = sedState.extended;
          runtime.scenarioEngine.updateExtended({
            ...ext,
            sedationGiven: true,
            sedationAgent: agent,
            sedationTs: Date.now(),
            timelineEvents: [
              ...ext.timelineEvents,
              { ts: Date.now(), type: "treatment", description: `Sedation given (${agent} ${actualDose} mg)` },
            ],
          });
        }
        break;
      }

      // ===== CARDIAC MEDICATIONS =====
      case "adenosine": {
        // PALS: First dose 0.1 mg/kg IV rapid push (max 6mg), second dose 0.2 mg/kg (max 12mg)
        // Must be given rapid IV push followed immediately by NS flush
        const adenState = runtime.scenarioEngine.getState();
        const maxFirst = 6;
        const maxSecond = 12;
        let doseNumber: 1 | 2 = 1;
        let recommendedDose = doseOrdered ?? Math.min(0.1 * weightKg, maxFirst);

        // Check if this is second dose (for SVT scenarios)
        if (hasSVTExtended(adenState)) {
          const ext = adenState.extended;
          if (ext.adenosineDoses.length > 0) {
            doseNumber = 2;
            // Second dose is 0.2 mg/kg (max 12mg)
            recommendedDose = doseOrdered ?? Math.min(0.2 * weightKg, maxSecond);
          }
        }

        const actualDose = Math.round(recommendedDose * 100) / 100;
        const rapidPush = payload?.rapidPush !== false;
        const flushGiven = payload?.flush !== false;

        // For SVT scenarios, simulate conversion based on dose number
        // First dose: 60% success, Second dose: 90% cumulative
        // For teaching purposes, we'll make first dose fail and second succeed
        const isFirstDose = doseNumber === 1;
        if (isFirstDose) {
          delta.hr = -30; // Brief dip
          decayIntent = { type: "intent_updateVitals", delta: { hr: 25 } as any };
          decayMs = 15000;
          nurseResponse = `Adenosine ${actualDose} mg IV rapid push given. That's ${(actualDose / weightKg).toFixed(2)} mg/kg. Flushing with 5 mL NS.`;
          techResponse = "Brief pause... and it's back. Still in SVT. Want to try the higher dose?";
        } else {
          delta.hr = -125; // Full conversion from ~220 to ~95
          nurseResponse = `Adenosine ${actualDose} mg IV rapid push given. That's ${(actualDose / weightKg).toFixed(2)} mg/kg. Flushing with 5 mL NS.`;
          techResponse = "There it is! She's converting... sinus rhythm. Heart rate coming down nicely.";
        }

        // Update SVT extended state
        if (hasSVTExtended(adenState)) {
          const ext = adenState.extended;
          const newDose = {
            ts: Date.now(),
            doseMg: actualDose,
            doseMgKg: actualDose / weightKg,
            doseNumber,
            rapidPush,
            flushGiven,
          };
          const newChecklist = [...ext.checklistCompleted];
          // Check for correct dosing (within 20% of recommended)
          const expectedDose = doseNumber === 1 ? 0.1 * weightKg : 0.2 * weightKg;
          const doseTolerance = expectedDose * 0.2;
          if (Math.abs(actualDose - expectedDose) <= doseTolerance && !newChecklist.includes("adenosine_correct_dose")) {
            newChecklist.push("adenosine_correct_dose");
          }

          const converted = !isFirstDose; // Second dose converts
          runtime.scenarioEngine.updateExtended({
            ...ext,
            adenosineDoses: [...ext.adenosineDoses, newDose],
            totalAdenosineMg: ext.totalAdenosineMg + actualDose,
            converted,
            conversionMethod: converted ? (doseNumber === 1 ? "adenosine_first" : "adenosine_second") : undefined,
            conversionTs: converted ? Date.now() : undefined,
            currentRhythm: converted ? "sinus" : "svt",
            phase: converted ? "converted" : ext.phase,
            phaseEnteredAt: converted ? Date.now() : ext.phaseEnteredAt,
            checklistCompleted: newChecklist,
            bonusesEarned: rapidPush && flushGiven && !ext.bonusesEarned.includes("proper_flush")
              ? [...ext.bonusesEarned, "proper_flush"]
              : ext.bonusesEarned,
            timelineEvents: [
              ...ext.timelineEvents,
              { ts: Date.now(), type: "treatment", description: `Adenosine ${actualDose} mg (dose #${doseNumber})${converted ? " - CONVERTED" : ""}` },
            ],
          });

          // If converted, update vitals/rhythm to sinus
          if (converted) {
            const convertedPhase = SVT_PHASES.find((p) => p.id === "converted");
            if (convertedPhase) {
              runtime.scenarioEngine.hydrate({
                vitals: convertedPhase.vitalsTarget,
                exam: convertedPhase.examFindings,
                rhythmSummary: convertedPhase.rhythmSummary,
              });
            }
          }
        }
        break;
      }
      case "amiodarone": {
        // 5 mg/kg IV over 20-60 min (max 300mg for arrest)
        const recommendedDose = doseOrdered ?? Math.min(5 * weightKg, 300);
        const actualDose = Math.round(recommendedDose);
        delta.hr = -15;
        decayMs = 300000; // Long-acting
        nurseResponse = `Amiodarone ${actualDose} mg IV loading. That's ${(actualDose / weightKg).toFixed(1)} mg/kg. Running over 20 minutes.`;
        techResponse = "Rate control medication infusing. Should see gradual effect.";
        decayIntent = { type: "intent_updateVitals", delta: { hr: 5 } as any };
        break;
      }
      case "epinephrine":
      case "epi": {
        // Arrest: 0.01 mg/kg IV/IO (1:10,000) = 0.1 mL/kg
        // Anaphylaxis: 0.01 mg/kg IM (1:1,000)
        const route = routeOrdered ?? "iv";
        const recommendedDose = doseOrdered ?? 0.01 * weightKg;
        const actualDose = Math.round(recommendedDose * 1000) / 1000; // mg
        delta.hr = 20;
        delta.sbpPerMin = 10;
        decayMs = 180000;
        const concentration = route.toLowerCase() === "im" ? "1:1,000" : "1:10,000";
        nurseResponse = `Epinephrine ${actualDose} mg ${route.toUpperCase()} given (${concentration}). That's ${(actualDose / weightKg * 1000).toFixed(0)} mcg/kg.`;
        techResponse = "Heart rate increasing, perfusion improving.";
        decayIntent = { type: "intent_updateVitals", delta: { hr: -10, sbpPerMin: -5 } as any };
        break;
      }
      case "atropine": {
        // PALS: 0.02 mg/kg IV/IO (min 0.1mg to avoid paradoxical bradycardia, max 0.5mg child / 1mg adolescent)
        // May repeat once; total max 1mg child, 2mg adolescent
        const minDose = 0.1;
        const maxDose = demographics.ageYears >= 12 ? 1.0 : 0.5;
        const recommendedDose = doseOrdered ?? Math.max(minDose, Math.min(0.02 * weightKg, maxDose));
        const actualDose = Math.round(recommendedDose * 100) / 100;
        delta.hr = 20;
        decayMs = 180000;
        nurseResponse = `Atropine ${actualDose} mg IV push given. That's ${(actualDose / weightKg * 1000).toFixed(0)} mcg/kg (${(actualDose * 1000).toFixed(0)} mcg).`;
        techResponse = "Watching for rate increase...";
        decayIntent = { type: "intent_updateVitals", delta: { hr: -10 } as any };
        break;
      }
      case "morphine": {
        // 0.05-0.1 mg/kg IV (max 4mg)
        const recommendedDose = doseOrdered ?? Math.min(0.1 * weightKg, 4);
        const actualDose = Math.round(recommendedDose * 100) / 100;
        delta.hr = -5;
        decayMs = 240000;
        nurseResponse = `Morphine ${actualDose} mg IV given slowly. That's ${(actualDose / weightKg).toFixed(2)} mg/kg. Monitoring respiratory status.`;
        break;
      }
      case "prostaglandin":
      case "pge1":
      case "alprostadil": {
        // 0.05-0.1 mcg/kg/min infusion for ductal-dependent lesions
        const infusionRate = doseOrdered ?? 0.05;
        delta.spo2 = 5;
        delta.hr = -5;
        decayMs = 600000; // Continuous infusion
        nurseResponse = `PGE1 infusion started at ${infusionRate} mcg/kg/min. That's ${(infusionRate * weightKg).toFixed(2)} mcg/min total.`;
        techResponse = "Watching for duct reopening. Sats should improve.";
        break;
      }
      case "lidocaine": {
        // PALS: 1 mg/kg IV/IO bolus (max 100mg), then 20-50 mcg/kg/min infusion
        // Used for VF/pVT refractory to defibrillation
        const recommendedDose = doseOrdered ?? Math.min(1 * weightKg, 100);
        const actualDose = Math.round(recommendedDose);
        delta.hr = -5;
        decayMs = 600000;
        nurseResponse = `Lidocaine ${actualDose} mg IV bolus given. That's ${(actualDose / weightKg).toFixed(1)} mg/kg.`;
        techResponse = "Antiarrhythmic on board.";
        decayIntent = { type: "intent_updateVitals", delta: { hr: 3 } as any };
        break;
      }
      case "calcium":
      case "calcium_chloride":
      case "cacl": {
        // PALS: Calcium chloride 20 mg/kg IV slow push (max 2g) - only for hypocalcemia, hyperkalemia, Ca-blocker OD
        // CaCl2 10% = 100 mg/mL = 27.2 mg/mL elemental Ca
        const recommendedDose = doseOrdered ?? Math.min(20 * weightKg, 2000);
        const actualDose = Math.round(recommendedDose);
        const volumeMl = Math.round(actualDose / 100 * 10) / 10; // 10% solution
        delta.hr = 5;
        delta.sbpPerMin = 5;
        decayMs = 300000;
        nurseResponse = `Calcium chloride ${actualDose} mg (${volumeMl} mL of 10%) IV slow push over 30 seconds. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
        techResponse = "Monitoring for improved contractility.";
        break;
      }
      case "sodium_bicarbonate":
      case "bicarb":
      case "nahco3": {
        // PALS: 1 mEq/kg IV slow push - only for documented acidosis, hyperkalemia, TCA OD
        // 8.4% solution = 1 mEq/mL
        const recommendedDose = doseOrdered ?? weightKg; // 1 mEq/kg
        const actualDose = Math.round(recommendedDose);
        decayMs = 300000;
        nurseResponse = `Sodium bicarbonate ${actualDose} mEq (${actualDose} mL of 8.4%) IV slow push. That's ${(actualDose / weightKg).toFixed(1)} mEq/kg.`;
        techResponse = "Bicarb given. Check follow-up gas.";
        break;
      }
      case "magnesium":
      case "mag":
      case "mgso4": {
        // PALS: 25-50 mg/kg IV over 10-20 min (max 2g) - for torsades, hypomagnesemia
        const recommendedDose = doseOrdered ?? Math.min(50 * weightKg, 2000);
        const actualDose = Math.round(recommendedDose);
        delta.hr = -10;
        decayMs = 600000;
        nurseResponse = `Magnesium sulfate ${actualDose} mg IV over 15 minutes. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
        techResponse = "Magnesium infusing for rhythm stabilization.";
        break;
      }
      case "procainamide": {
        // PALS: 15 mg/kg IV over 30-60 min (max 17 mg/kg or 1g)
        // For SVT unresponsive to adenosine, wide-complex tachycardia
        const recommendedDose = doseOrdered ?? Math.min(15 * weightKg, 1000);
        const actualDose = Math.round(recommendedDose);
        delta.hr = -20;
        decayMs = 600000;
        nurseResponse = `Procainamide ${actualDose} mg IV infusing over 30 minutes. That's ${Math.round(actualDose / weightKg)} mg/kg. Monitoring BP and QRS.`;
        techResponse = "Watching QRS width and BP during infusion.";
        break;
      }

      // ===== CARDIOVERSION / DEFIBRILLATION =====
      case "cardioversion":
      case "sync_cardioversion": {
        // Synchronized cardioversion: 0.5-1 J/kg, may increase to 2 J/kg
        const joulesOrdered = joules ?? Math.round(0.5 * weightKg);
        const cvState = runtime.scenarioEngine.getState();
        runtime.scenarioEngine.updateIntervention("defibPads", { placed: true });

        // Check if patient was sedated for SVT
        let wasSedated = true;
        if (hasSVTExtended(cvState)) {
          wasSedated = cvState.extended.sedationGiven;
        }

        if (!wasSedated) {
          nurseResponse = `Synchronized cardioversion at ${joulesOrdered} J delivered. That's ${(joulesOrdered / weightKg).toFixed(1)} J/kg. She felt that! We should have sedated first.`;
          techResponse = "Shock delivered... she's crying but... rhythm converting!";
        } else {
          nurseResponse = `Synchronized cardioversion at ${joulesOrdered} J delivered. That's ${(joulesOrdered / weightKg).toFixed(1)} J/kg. Patient sedated.`;
          techResponse = "Shock delivered... watching rhythm... she's converting!";
        }

        delta.hr = -150; // Convert to sinus ~90

        // Update SVT extended state
        if (hasSVTExtended(cvState)) {
          const ext = cvState.extended;
          const cvAttempt = {
            ts: Date.now(),
            joules: joulesOrdered,
            joulesPerKg: joulesOrdered / weightKg,
            synchronized: true,
            sedated: wasSedated,
            sedationAgent: ext.sedationAgent,
          };

          runtime.scenarioEngine.updateExtended({
            ...ext,
            cardioversionAttempts: [...ext.cardioversionAttempts, cvAttempt],
            converted: true,
            conversionMethod: "cardioversion",
            conversionTs: Date.now(),
            currentRhythm: "sinus",
            phase: "converted",
            phaseEnteredAt: Date.now(),
            flags: {
              ...ext.flags,
              unsedatedCardioversion: !wasSedated,
            },
            penaltiesIncurred: !wasSedated && !ext.penaltiesIncurred.includes("unsedated_cardioversion")
              ? [...ext.penaltiesIncurred, "unsedated_cardioversion"]
              : ext.penaltiesIncurred,
            timelineEvents: [
              ...ext.timelineEvents,
              { ts: Date.now(), type: "treatment", description: `Synchronized cardioversion ${joulesOrdered} J${!wasSedated ? " (UNSEDATED!)" : ""} - CONVERTED` },
            ],
          });

          // Update to converted phase vitals
          const convertedPhase = SVT_PHASES.find((p) => p.id === "converted");
          if (convertedPhase) {
            runtime.scenarioEngine.hydrate({
              vitals: convertedPhase.vitalsTarget,
              exam: convertedPhase.examFindings,
              rhythmSummary: convertedPhase.rhythmSummary,
            });
          }
        }
        break;
      }
      case "defibrillation":
      case "defib": {
        // VF/pVT: 2 J/kg first, then 4 J/kg
        const joulesOrdered = joules ?? Math.round(2 * weightKg);
        delta.hr = 0; // Pulseless - either converts or stays in arrest
        runtime.scenarioEngine.updateIntervention("defibPads", { placed: true });
        nurseResponse = `Defibrillation at ${joulesOrdered} J delivered! That's ${(joulesOrdered / weightKg).toFixed(0)} J/kg. Resuming compressions.`;
        techResponse = "Shock delivered. Checking rhythm...";
        break;
      }
      case "defib_pads":
      case "pads": {
        runtime.scenarioEngine.updateIntervention("defibPads", { placed: true });
        nurseResponse = "Defibrillator pads placed - apex and right sternal border.";
        techResponse = "Pads on. Ready for rhythm analysis.";
        break;
      }
      case "monitor":
      case "cardiac_monitor": {
        runtime.scenarioEngine.updateIntervention("monitor", { leads: true });
        nurseResponse = "Patient on the cardiac monitor. Leads attached.";
        techResponse = "Monitor on. Displaying rhythm strip.";

        // Update SVT extended state
        const monState = runtime.scenarioEngine.getState();
        if (hasSVTExtended(monState)) {
          const ext = monState.extended;
          runtime.scenarioEngine.updateExtended({
            ...ext,
            checklistCompleted: ext.checklistCompleted.includes("monitor_placed")
              ? ext.checklistCompleted
              : [...ext.checklistCompleted, "monitor_placed"],
            timelineEvents: [
              ...ext.timelineEvents,
              { ts: Date.now(), type: "intervention", description: "Cardiac monitor placed" },
            ],
          });
        }
        break;
      }
      // ===== OTHER =====
      case "ng_tube":
      case "ng":
      case "nasogastric":
      case "ngt": {
        runtime.scenarioEngine.updateIntervention("ngTube", { placed: true });
        nurseResponse = "NG tube placed. Confirmed in stomach by auscultation.";
        break;
      }
      case "foley":
      case "foley_catheter":
      case "urinary_catheter": {
        runtime.scenarioEngine.updateIntervention("foley", { placed: true });
        nurseResponse = "Foley catheter placed. Draining clear yellow urine.";
        break;
      }

      // ===== OTHER TREATMENTS =====
      case "ibuprofen":
      case "motrin": {
        // 10 mg/kg PO (max 400mg)
        const recommendedDose = doseOrdered ?? Math.min(10 * weightKg, 400);
        const actualDose = Math.round(recommendedDose);
        delta.temp = -0.5;
        decayMs = 21600000; // 6 hours
        nurseResponse = `Ibuprofen ${actualDose} mg PO given. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
        break;
      }
      case "acetaminophen":
      case "tylenol": {
        // 15 mg/kg PO (max 1000mg)
        const recommendedDose = doseOrdered ?? Math.min(15 * weightKg, 1000);
        const actualDose = Math.round(recommendedDose);
        delta.temp = -0.5;
        decayMs = 14400000; // 4 hours
        nurseResponse = `Acetaminophen ${actualDose} mg PO given. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
        break;
      }
      case "aspirin":
      case "asa": {
        // Kawasaki: 80-100 mg/kg/day divided q6h (high dose) or 3-5 mg/kg/day (low dose)
        const recommendedDose = doseOrdered ?? Math.min(20 * weightKg, 650); // Single dose
        const actualDose = Math.round(recommendedDose);
        nurseResponse = `Aspirin ${actualDose} mg PO given. That's ${Math.round(actualDose / weightKg)} mg/kg.`;
        break;
      }

      default:
        // Unknown treatment - nurse asks for clarification
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_transcript_delta",
          sessionId,
          text: `I need the medication name, dose, and route. Patient weighs ${weightKg} kg.`,
          character: "nurse",
        });
        return;
    }

    // Apply vitals changes
    runtime.scenarioEngine.applyVitalsAdjustment(delta);

    // Update rhythm based on new vitals (treatments affecting HR change the rhythm)
    const newRhythm = runtime.scenarioEngine.getDynamicRhythm();
    runtime.scenarioEngine.setRhythm(newRhythm, `treatment: ${treatmentType}`);

    const telemetryWaveform = runtime.scenarioEngine.getState().telemetry
      ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90)
      : undefined;

    maybeAdvanceStageFromTreatment(runtime, treatmentType);

    // Record in treatment history
    const history = runtime.scenarioEngine.getState().treatmentHistory ?? [];
    runtime.scenarioEngine.setTreatmentHistory([
      ...history,
      { ts: Date.now(), treatmentType: treatmentType ?? "unknown", note: nurseResponse },
    ]);

    // Broadcast updated state
    broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      telemetryWaveform,
      treatmentHistory: runtime.scenarioEngine.getState().treatmentHistory,
    });

    // Nurse confirms dose
    if (nurseResponse) {
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: nurseResponse,
        character: "nurse",
      });
      if (techResponse && runtime.scenarioEngine.getState().telemetry) {
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_transcript_delta",
          sessionId,
          text: techResponse,
          character: "tech",
        });
      }
    }

    logSimEvent(sessionId, {
      type: "treatment.applied",
      payload: { treatmentType, weightKg, ...payload, nurseResponse },
    }).catch(() => {});

    // Schedule effect decay
    if (decayIntent) {
      setTimeout(() => {
        const rt = ensureRuntime(sessionId);
        if (!rt) return;
        rt.scenarioEngine.applyIntent(decayIntent);
        broadcastSimState(sessionId, {
          ...rt.scenarioEngine.getState(),
          stageIds: rt.scenarioEngine.getStageIds(),
          telemetryWaveform: rt.scenarioEngine.getState().telemetry
            ? buildTelemetryWaveform(rt.scenarioEngine.getState().vitals.hr ?? 90)
            : undefined,
        });
      }, decayMs);
    }
  };
}

function maybeAdvanceStageFromTreatment(
  runtime: { scenarioEngine: ScenarioEngine },
  treatmentType?: string
) {
  const scenarioId = runtime.scenarioEngine.getState().scenarioId;
  const stageId = runtime.scenarioEngine.getState().stageId;
  const t = (treatmentType ?? "").toLowerCase();

  if (scenarioId === "palpitations_svt" && stageId === "stage_2_episode" && t.includes("rate")) {
    runtime.scenarioEngine.setStage("stage_3_post_episode");
  }
  if (scenarioId === "ductal_shock" && stageId === "stage_1_shock" && (t.includes("fluid") || t.includes("bolus"))) {
    runtime.scenarioEngine.setStage("stage_2_improving");
  }
  if (scenarioId === "cyanotic_spell" && stageId === "stage_2_spell" && (t.includes("oxygen") || t.includes("knee") || t.includes("position"))) {
    runtime.scenarioEngine.setStage("stage_3_recovery");
  }
}
