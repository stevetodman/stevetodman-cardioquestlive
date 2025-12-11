import React from "react";

// --- Types for patient interventions ---
export type IVLocation = "left_ac" | "right_ac" | "left_hand" | "right_hand" | "left_foot" | "right_foot";

export interface IVStatus {
  location: IVLocation;
  gauge?: number; // 22, 24, etc
  fluidsRunning?: boolean;
  fluidType?: string; // "NS", "LR", etc
}

export interface OxygenStatus {
  type: "nasal_cannula" | "mask" | "non_rebreather" | "high_flow" | "blow_by";
  flowRateLpm?: number;
}

export interface DefibPadsStatus {
  placed: boolean;
}

export interface MonitorStatus {
  leads: boolean;
}

export interface NGTubeStatus {
  placed: boolean;
}

export interface FoleyStatus {
  placed: boolean;
}

export interface ETTStatus {
  placed: boolean;
  size?: number; // ETT size (e.g., 6.0, 6.5, 7.0)
  depth?: number; // Depth at lip in cm
}

export interface Interventions {
  iv?: IVStatus;
  oxygen?: OxygenStatus;
  defibPads?: DefibPadsStatus;
  monitor?: MonitorStatus;
  ngTube?: NGTubeStatus;
  foley?: FoleyStatus;
  ett?: ETTStatus;
}

interface PatientStatusOutlineProps {
  interventions: Interventions;
  compact?: boolean;
}

// Hotspot coordinates for icon placement on the body outline (viewBox: 0 0 100 160)
const hotSpots: Record<string, { x: number; y: number }> = {
  // Head/face
  face: { x: 50, y: 18 },
  nose: { x: 50, y: 20 },
  mouth: { x: 50, y: 24 },
  // Chest
  chest_right: { x: 62, y: 50 }, // Patient's right (viewer's left)
  chest_left: { x: 38, y: 55 },  // Patient's left (viewer's right)
  chest_center: { x: 50, y: 52 },
  // Arms
  left_ac: { x: 22, y: 55 },
  right_ac: { x: 78, y: 55 },
  left_hand: { x: 12, y: 90 },
  right_hand: { x: 88, y: 90 },
  // Torso
  stomach: { x: 50, y: 70 },
  // Legs
  left_foot: { x: 38, y: 150 },
  right_foot: { x: 62, y: 150 },
  pelvis: { x: 50, y: 95 },
};

export function PatientStatusOutline({ interventions, compact }: PatientStatusOutlineProps) {
  const hasAnyIntervention = Object.values(interventions).some(v => v);

  return (
    <div className={`bg-slate-900/60 border border-slate-700 rounded-lg ${compact ? "p-2" : "p-3"}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
          Patient Status
        </h3>
        {!hasAnyIntervention && (
          <span className="text-[9px] text-slate-500 italic">No interventions</span>
        )}
      </div>
      <div className={`${compact ? "max-w-[80px]" : "max-w-[120px]"} mx-auto`}>
        <svg viewBox="0 0 100 160" className="w-full">
          {/* Background glow for active patient */}
          {hasAnyIntervention && (
            <ellipse cx="50" cy="80" rx="45" ry="70" fill="rgba(34, 197, 94, 0.03)" />
          )}

          {/* Head */}
          <ellipse cx="50" cy="15" rx="12" ry="14" fill="none" stroke="#475569" strokeWidth="1.5" />

          {/* Neck */}
          <line x1="50" y1="29" x2="50" y2="35" stroke="#475569" strokeWidth="1.5" />

          {/* Torso */}
          <path
            d="M 30 35 L 70 35 L 75 80 L 65 95 L 35 95 L 25 80 Z"
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Left arm */}
          <path
            d="M 30 38 L 18 55 L 10 90"
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Right arm */}
          <path
            d="M 70 38 L 82 55 L 90 90"
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Left leg */}
          <path
            d="M 40 95 L 38 130 L 35 150"
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Right leg */}
          <path
            d="M 60 95 L 62 130 L 65 150"
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* --- INTERVENTION ICONS --- */}

          {/* IV Access */}
          {interventions.iv && (
            <IVIcon
              x={hotSpots[interventions.iv.location].x}
              y={hotSpots[interventions.iv.location].y}
              fluidsRunning={interventions.iv.fluidsRunning}
              gauge={interventions.iv.gauge}
              fluidType={interventions.iv.fluidType}
            />
          )}

          {/* Oxygen */}
          {interventions.oxygen && (
            <OxygenIcon
              x={hotSpots.face.x}
              y={hotSpots.face.y}
              type={interventions.oxygen.type}
              flowRate={interventions.oxygen.flowRateLpm}
            />
          )}

          {/* Defib Pads */}
          {interventions.defibPads?.placed && (
            <>
              <DefibPadIcon x={hotSpots.chest_right.x} y={hotSpots.chest_right.y} position="apex" />
              <DefibPadIcon x={hotSpots.chest_left.x} y={hotSpots.chest_left.y} position="sternum" />
            </>
          )}

          {/* Monitor Leads */}
          {interventions.monitor?.leads && (
            <MonitorLeadsIcon x={hotSpots.chest_center.x} y={hotSpots.chest_center.y} />
          )}

          {/* NG Tube */}
          {interventions.ngTube?.placed && (
            <NGTubeIcon x={hotSpots.nose.x} y={hotSpots.nose.y} />
          )}

          {/* Foley Catheter */}
          {interventions.foley?.placed && (
            <FoleyIcon x={hotSpots.pelvis.x} y={hotSpots.pelvis.y} />
          )}

          {/* ETT / Intubation */}
          {interventions.ett?.placed && (
            <ETTIcon x={hotSpots.mouth.x} y={hotSpots.mouth.y} size={interventions.ett.size} />
          )}
        </svg>
      </div>

      {/* Legend for active interventions */}
      {hasAnyIntervention && !compact && (
        <div className="mt-2 flex flex-wrap gap-1 justify-center">
          {interventions.iv && (
            <InterventionBadge
              color="sky"
              label={`IV ${interventions.iv.gauge || ""}g${interventions.iv.fluidsRunning ? " + fluids" : ""}`}
            />
          )}
          {interventions.oxygen && (
            <InterventionBadge
              color="emerald"
              label={`O₂ ${interventions.oxygen.flowRateLpm || ""}L`}
            />
          )}
          {interventions.defibPads?.placed && (
            <InterventionBadge color="amber" label="Pads" />
          )}
          {interventions.monitor?.leads && (
            <InterventionBadge color="cyan" label="Monitor" />
          )}
          {interventions.ngTube?.placed && (
            <InterventionBadge color="violet" label="NG" />
          )}
          {interventions.foley?.placed && (
            <InterventionBadge color="rose" label="Foley" />
          )}
          {interventions.ett?.placed && (
            <InterventionBadge color="orange" label={`ETT${interventions.ett.size ? ` ${interventions.ett.size}` : ""}`} />
          )}
        </div>
      )}
    </div>
  );
}

// --- Icon Components ---

function IVIcon({ x, y, fluidsRunning, gauge, fluidType }: { x: number; y: number; fluidsRunning?: boolean; gauge?: number; fluidType?: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <title>
        IV Access{gauge ? ` (${gauge}g)` : ""}{fluidsRunning ? ` - ${fluidType || "Fluids"} running` : ""}
      </title>
      {/* IV site marker */}
      <circle cx="0" cy="0" r="4" fill="#0ea5e9" stroke="#0284c7" strokeWidth="1" />
      {/* Catheter line */}
      <line x1="0" y1="-4" x2="0" y2="-10" stroke="#0ea5e9" strokeWidth="1.5" />
      {/* Pulsing animation when fluids running */}
      {fluidsRunning && (
        <>
          <circle cx="0" cy="0" r="4" fill="none" stroke="#0ea5e9" strokeWidth="1">
            <animate attributeName="r" from="4" to="8" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
          </circle>
          {/* Drip animation */}
          <circle cx="0" cy="-7" r="1" fill="#0ea5e9">
            <animate attributeName="cy" from="-10" to="-4" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="1" to="0.3" dur="0.8s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </g>
  );
}

function OxygenIcon({ x, y, type, flowRate }: { x: number; y: number; type: string; flowRate?: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <title>Oxygen: {type.replace(/_/g, " ")}{flowRate ? ` @ ${flowRate}L/min` : ""}</title>
      {type === "nasal_cannula" ? (
        // Nasal cannula - curved line under nose
        <path d="M -8 2 Q 0 6, 8 2" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
      ) : type === "blow_by" ? (
        // Blow-by - simple O2 symbol near face
        <text x="-4" y="8" fontSize="8" fill="#34d399" fontWeight="bold">O₂</text>
      ) : (
        // Mask (any type) - oval shape over face
        <>
          <ellipse cx="0" cy="4" rx="10" ry="7" fill="none" stroke="#34d399" strokeWidth="1.5" />
          <line x1="-10" y1="2" x2="-14" y2="-2" stroke="#34d399" strokeWidth="1" />
          <line x1="10" y1="2" x2="14" y2="-2" stroke="#34d399" strokeWidth="1" />
        </>
      )}
      {/* Pulsing glow to show active O2 */}
      <circle cx="0" cy="4" r="3" fill="#34d399" opacity="0.3">
        <animate attributeName="opacity" from="0.3" to="0.1" dur="2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

function DefibPadIcon({ x, y, position }: { x: number; y: number; position: "apex" | "sternum" }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <title>Defibrillator Pad ({position})</title>
      <rect x="-6" y="-4" width="12" height="8" fill="#f59e0b" stroke="#d97706" strokeWidth="1" rx="2" />
      {/* Lightning bolt symbol */}
      <path d="M -1 -2 L 1 0 L -1 0 L 1 2" fill="none" stroke="#78350f" strokeWidth="1" />
    </g>
  );
}

function MonitorLeadsIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <title>Cardiac Monitor Leads</title>
      {/* Three lead positions in triangle */}
      <circle cx="-8" cy="-5" r="2" fill="#22d3ee" />
      <circle cx="8" cy="-5" r="2" fill="#22d3ee" />
      <circle cx="0" cy="8" r="2" fill="#22d3ee" />
      {/* Connecting wires */}
      <line x1="-8" y1="-5" x2="0" y2="-12" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="1,1" />
      <line x1="8" y1="-5" x2="0" y2="-12" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="1,1" />
      <line x1="0" y1="8" x2="0" y2="-12" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="1,1" />
    </g>
  );
}

function NGTubeIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <title>NG Tube</title>
      {/* Tube going into nose */}
      <path d="M 0 0 L 0 8 Q 0 12, -3 15" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <circle cx="0" cy="0" r="2" fill="#a78bfa" />
    </g>
  );
}

function FoleyIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <title>Foley Catheter</title>
      {/* Catheter line */}
      <path d="M 0 0 L 0 8 L 5 15" fill="none" stroke="#fb7185" strokeWidth="1.5" />
      <circle cx="0" cy="0" r="2" fill="#fb7185" />
      {/* Bag symbol */}
      <rect x="3" y="13" width="6" height="8" fill="none" stroke="#fb7185" strokeWidth="1" rx="1" />
    </g>
  );
}

function ETTIcon({ x, y, size }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <title>ETT{size ? ` ${size}mm` : ""} - Endotracheal Tube</title>
      {/* Tube from mouth down to chest */}
      <path
        d="M 0 0 L 0 8 Q 0 12, 0 20"
        fill="none"
        stroke="#f97316"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Connector/flange at mouth */}
      <rect x="-5" y="-2" width="10" height="4" fill="#f97316" rx="1" />
      {/* Cuff indicator (small bulge) */}
      <ellipse cx="0" cy="16" rx="4" ry="2" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.6" />
      {/* Pulsing glow for ventilation */}
      <circle cx="0" cy="10" r="3" fill="#f97316" opacity="0.3">
        <animate attributeName="opacity" from="0.4" to="0.1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

function InterventionBadge({ color, label }: { color: string; label: string }) {
  const colorClasses: Record<string, string> = {
    sky: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    violet: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    rose: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    orange: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  };

  return (
    <span className={`px-1.5 py-0.5 text-[8px] rounded border ${colorClasses[color] || colorClasses.sky}`}>
      {label}
    </span>
  );
}
