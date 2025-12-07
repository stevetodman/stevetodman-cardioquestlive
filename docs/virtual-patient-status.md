# CardioQuest Live — Virtual Patient Status (Checkpoint)

## Overview

- **CardioQuest Live**: React/Firestore app for presenter-led pediatric cardiology sessions with live slides, polling, and gamified scoring for residents.
- **Voice Gateway**: Separate Node/TypeScript WebSocket service (`voice-gateway/`) handling real-time voice/control plane, OpenAI STT/TTS, and AI patient responses.
- **Virtual patient feature set**: Residents speak via push-to-talk; audio is transcribed (STT) into the doctor question box, then a Force Reply (manual or auto) sends the question to the AI patient engine. Patient replies stream as text and (optionally) as TTS audio. All turns are logged for transcript export and AI debrief.

## Implemented Features (bullet list)

- **STT pipeline**: Resident push-to-talk → `doctor_audio` WS → OpenAI STT → `doctor_utterance` → doctor question textbox auto-fill (editable).
- **Force Reply modes**: Manual click or optional “Auto Force Reply after resident question” toggle. Both reuse the same logging + WS/Firestore command path.
- **Patient scenarios**: Presenter-selectable cases per session:
  - `exertional_chest_pain` (Taylor) — chest pain/palpitations with exertion.
  - `syncope` — exertional syncope.
  - `palpitations_svt` — recurrent palpitations/SVT-like episodes.
  - `myocarditis` — viral prodrome with evolving myocarditis.
  - `exertional_syncope_hcm` — exertional presyncope with HCM suspicion.
  - `ductal_shock` — infant shock (duct-dependent lesion).
  - `cyanotic_spell` — toddler cyanotic spell (tet spell-like).
  Scenario change resets patient engine/persona and clears local transcript/debrief.
- **Patient responses**: Streaming text deltas; optional TTS playback on presenter side via `patient_audio`.
- **Interaction safety**: Keyboard navigation (space/arrows) disabled during patient interaction and while typing to prevent slide jumps.
- **Transcript tools**: Doctor/patient turn log grouped by role, copy-to-clipboard, download .txt, save timeline snapshot to the session (owner only), and save full transcript to the session; overlay shows streaming text by role.
- **Orders + multi-character**: Voice commands can target nurse/tech/consultant; orders (vitals/ekg/labs/imaging) tracked in sim_state and rendered as cards with status/results; order completions appear in transcript timeline.
- **AI debrief**: “Generate debrief” button sends transcript to gateway for OpenAI analysis → summary, strengths, opportunities, teaching points; debrief can be copied/downloaded as Markdown (includes last 20 timeline events).

## How to Run Locally

1. **Voice gateway**
   ```bash
   cd voice-gateway
   npm install
   npm run build
   npm start    # ws://localhost:8081/ws/voice
   ```
   Env (`voice-gateway/.env`, no secrets committed):
   - `OPENAI_API_KEY` (required for STT/TTS/AI replies)
   - `OPENAI_MODEL` (default `gpt-4.1-mini`)
   - `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`)
   - `OPENAI_TTS_VOICE` (default `alloy`)
   - `OPENAI_STT_MODEL` (default `whisper-1`)
   - `OPENAI_DEBRIEF_MODEL` (default `gpt-4.1-mini`)
   - `PORT` (default `8081`)
   - `ALLOW_INSECURE_VOICE_WS` (default `false`; set `true` only for local dev/tunnels if you cannot pass Firebase ID tokens)

2. **App**
   ```bash
   npm install
   npm run dev   # default http://localhost:3000
   ```
   - Presenter on Mac: use localhost.
   - Participants on phone: use LAN URL, e.g., `http://<your-LAN-IP>:3000` (and point VITE_VOICE_GATEWAY_URL if needed).

## Important File Map

- **Presenter UI / logic**
  - `src/pages/PresenterSession.tsx`: Wiring of voice state, transcript, auto Force Reply, scenario selection, debrief, overlay.
  - `src/components/PresenterVoiceControls.tsx`: Voice controls, scenario dropdown, auto Force Reply toggle.
  - `src/components/VoicePatientOverlay.tsx`: Streaming transcript display + patient audio playback.
  - `src/components/SessionTranscriptPanel.tsx`: Transcript log + copy/download.
  - `src/components/DebriefPanel.tsx`: Generate/show AI debrief.
- **Participant / resident**
  - `src/pages/JoinSession.tsx`: Take floor, hold-to-speak, mic level, STT upload, error messaging.
  - `src/services/VoicePatientService.ts`: Mic permission, RMS, MediaRecorder blobs, turn-complete event.
- **Shared voice client/types**
  - `src/services/VoiceGatewayClient.ts`: WS client, commands (`doctor_audio`, `set_scenario`, `analyze_transcript`), patient audio/utterance handling.
  - `src/types/voiceGateway.ts`: Message/type definitions.
- **Voice gateway**
  - `voice-gateway/src/index.ts`: WS server, message handling, scenarios, STT, TTS, debrief.
  - Per-role voices supported via env:
    - `OPENAI_TTS_VOICE_PATIENT`, `OPENAI_TTS_VOICE_NURSE`, `OPENAI_TTS_VOICE_TECH`, `OPENAI_TTS_VOICE_CONSULTANT` (fallback: `OPENAI_TTS_VOICE`).
  - `voice-gateway/src/messageTypes.ts`: Protocol types.
  - `voice-gateway/src/patientCase.ts`, `patientEngine.ts`, `patientPersona.ts`: Cases/personas and per-session engine.
  - `voice-gateway/src/sttClient.ts`, `ttsClient.ts`, `debriefAnalyzer.ts`: OpenAI integrations for STT/TTS/debrief.
- **Firestore**
  - `firestore.rules`: Session/voice rules; voice-only updates allowed for authenticated users when valid.

## Open TODOs / Next Ideas

- Improve mobile UX for floor/voice (e.g., banners for permissions/network).
- Add persistence of debrief/transcripts to Firestore for post-session review.
- Improve debrief with saved timeline and role evidence, plus presenter export to PDF.
- More patient scenarios and richer personas; deck-driven scenario selection.
- Participant-side audio playback fan-out (currently presenter-only).
- Consider soft locks or presenter override flows for floor control; polish error surfaced to users.
- For iPhone mic support in dev, run over HTTPS/WSS via quick or named Cloudflare tunnels; see `docs/virtual-patient-https-iphone.md` for quick/named tunnel recipes and the one-command scripts (`dev:vp:quick`, `dev:vp:named`).
- Deterministic voice sim core: `sim_state` is now published and consumed in UI; see `docs/voice-sim-state-and-harnesses.md` for current harnesses and remaining wiring (Firestore persistence, Realtime smoke, budget guardrails).
- Voice WS auth is secure by default; clients should join with Firebase ID tokens. Only use `ALLOW_INSECURE_VOICE_WS=true` for local/emulator or quick-tunnel dev.
