/**
 * Handler exports
 * Barrel file for all extracted WebSocket message handlers.
 */

export { createDoctorAudioHandler, type DoctorAudioDeps, type DoctorAudioHandlers } from "./doctorAudio";
export { createAnalysisHandler, type AnalysisDeps, type AnalysisHandlers } from "./analysisRequests";
