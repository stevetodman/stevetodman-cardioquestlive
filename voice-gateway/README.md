# Voice Gateway (CardioQuest Live)

WebSocket gateway for voice/control signaling and the AI virtual patient (text answers, optional TTS audio, optional STT for resident questions).

## Run

```bash
cd voice-gateway
npm install
npm run build
npm start           # serves ws on http://localhost:8081/ws/voice
```

Environment:
- `PORT` (default `8081`)
- `OPENAI_API_KEY` (required for real patient replies / TTS / STT; falls back to stub text if missing)
- `OPENAI_MODEL` (chat model for patient replies, default `gpt-4.1-mini`)
- `OPENAI_TTS_MODEL` (TTS model, default `gpt-4o-mini-tts`)
- `OPENAI_TTS_VOICE` (TTS voice, default `alloy`)
- `OPENAI_STT_MODEL` (speech-to-text model, default `whisper-1`)
- `OPENAI_DEBRIEF_MODEL` (model for debrief analysis, default `gpt-4.1-mini`)

## Protocol

WebSocket URL: `ws://localhost:8081/ws/voice`

### Client → Server
- `join`: `{ "type":"join", "sessionId":"abc", "userId":"u1", "displayName":"Alice", "role":"presenter" | "participant" }`
- `start_speaking`: `{ "type":"start_speaking", "sessionId":"abc", "userId":"u1" }`
- `stop_speaking`: `{ "type":"stop_speaking", "sessionId":"abc", "userId":"u1" }`
- `voice_command`: `{ "type":"voice_command", "sessionId":"abc", "userId":"u1", "commandType":"pause_ai"|"resume_ai"|"force_reply"|"end_turn"|"mute_user", "payload":{...} }`
- `doctor_audio`: `{ "type":"doctor_audio", "sessionId":"abc", "userId":"u1", "audioBase64":"...", "contentType":"audio/webm" }` (resident speech for STT)
- `set_scenario`: `{ "type":"set_scenario", "sessionId":"abc", "userId":"u1", "scenarioId":"exertional_chest_pain"|"syncope"|"palpitations_svt" }`
- `analyze_transcript`: `{ "type":"analyze_transcript", "sessionId":"abc", "userId":"u1", "turns":[{role:"doctor"|"patient", text:"..."}] }`
- `ping`: `{ "type":"ping", "sessionId":"abc" }`

### Server → Client
- `joined`: `{ "type":"joined", "sessionId":"abc", "role":"presenter" }`
- `participant_state`: `{ "type":"participant_state", "sessionId":"abc", "userId":"u1", "speaking":true }`
- `patient_state`: `{ "type":"patient_state", "sessionId":"abc", "state":"idle"|"listening"|"speaking"|"error" }`
- `patient_transcript_delta`: `{ "type":"patient_transcript_delta", "sessionId":"abc", "text":"Hi doctor..." }`
- `patient_audio`: `{ "type":"patient_audio", "sessionId":"abc", "audioBase64":"<base64 audio>" }` (sent to presenters after a reply completes when TTS is configured)
- `doctor_utterance`: `{ "type":"doctor_utterance", "sessionId":"abc", "userId":"u1", "text":"..." }` (STT result for presenter question box)
- `scenario_changed`: `{ "type":"scenario_changed", "sessionId":"abc", "scenarioId":"exertional_chest_pain"|"syncope"|"palpitations_svt" }`
- `analysis_result`: `{ "type":"analysis_result", "sessionId":"abc", "summary":"...", "strengths":[], "opportunities":[], "teachingPoints":[] }`
- `pong`: `{ "type":"pong" }`
- `error`: `{ "type":"error", "message":"..." }`

### Behavior
- `force_reply` streams a realistic patient answer from OpenAI (falls back to a stub if no API key), then optionally sends TTS audio.
- `doctor_audio` runs STT and emits `doctor_utterance` to presenters; presenter can edit and trigger Force Reply manually.
- `set_scenario` resets the patient engine for that session and switches persona/case.
- `analyze_transcript` runs a debrief/feedback summary of the transcript and returns `analysis_result` to presenters.
- `pause_ai`, `resume_ai`, `end_turn` update `patient_state` (idle/listening) for now. `mute_user` is logged only.

## Notes

- Clients must send `join` before any other message.
- Gateway tracks per-session sockets for presenters/participants and broadcasts within that session.
- In-memory only; restart clears state.

## Complex Scenarios

The gateway supports complex high-fidelity scenarios with advanced features:

### "The Silent Crash" (Pediatric Myocarditis)

A 30-minute simulation of acute fulminant myocarditis with:

**Key files:**
- `src/sim/scenarios/peds_myocarditis_silent_crash/` - Scenario definition, results, triggers, scoring
- `src/sim/physiologyEngine.ts` - Deterministic physiology rules
- `src/orderParser.ts` - Free-text order parsing with nurse clarification
- `src/debriefAnalyzer.ts` - Enhanced debrief with timeline and scoring

**Features:**
- Phase-based progression (6 phases over 30 min)
- Shock staging (1-5)
- Deterministic physiology rules (fluid overload, inotrope response, intubation collapse)
- Free-text order parsing with nurse clarification prompts
- Pass/fail scoring (need 4/5 checklist items)
- Enhanced debrief with timeline and teaching points

**Order parsing examples:**
```
"give 20 ml/kg saline" → { type: "fluids", params: { mlKg: 20 } }
"start epi at 0.1" → { type: "epi_drip", params: { doseMcgKgMin: 0.1 } }
"intubate with ketamine" → { type: "intubation", params: { inductionAgent: "ketamine" } }
"give fluids" → { needsClarification: true, clarificationQuestion: "10 or 20 mL/kg?" }
```
