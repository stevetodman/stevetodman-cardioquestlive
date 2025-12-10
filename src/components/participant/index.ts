/**
 * Participant view components.
 * Extracted from JoinSession.tsx for better code organization and token efficiency.
 */

export { QuickActionsBar } from "./QuickActionsBar";
export type { QuickActionsBarProps } from "./QuickActionsBar";

export { CharacterSelector } from "./CharacterSelector";
export type { CharacterSelectorProps } from "./CharacterSelector";

export { ExamFindingsPanel } from "./ExamFindingsPanel";
export type { ExamFindingsPanelProps, ExamFindings, ExamAudioClip } from "./ExamFindingsPanel";

export { ParticipantHeader } from "./ParticipantHeader";
export type { ParticipantHeaderProps, ParticipantHeaderVitals } from "./ParticipantHeader";

export { QuestionSection, QuestionPlaceholder } from "./QuestionSection";
export type { QuestionSectionProps } from "./QuestionSection";

// Re-export ParticipantOrdersPanel from parent directory
export { ParticipantOrdersPanel } from "../ParticipantOrdersPanel";
export type { ParticipantOrdersPanelProps, Order, OrderResult } from "../ParticipantOrdersPanel";
