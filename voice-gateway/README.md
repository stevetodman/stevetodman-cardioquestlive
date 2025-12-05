# Voice Gateway (CardioQuest Live)

Minimal WebSocket gateway for voice/control signaling. No OpenAI or audio streaming yet.

## Run

```bash
cd voice-gateway
npm install
npm run build
npm start           # serves ws on http://localhost:8081/ws/voice
```

Environment: `PORT` (default `8081`).

## Protocol

WebSocket URL: `ws://localhost:8081/ws/voice`

### Client → Server
- `join`: `{ "type":"join", "sessionId":"abc", "userId":"u1", "displayName":"Alice", "role":"presenter" | "participant" }`
- `start_speaking`: `{ "type":"start_speaking", "sessionId":"abc", "userId":"u1" }`
- `stop_speaking`: `{ "type":"stop_speaking", "sessionId":"abc", "userId":"u1" }`
- `voice_command`: `{ "type":"voice_command", "sessionId":"abc", "userId":"u1", "commandType":"pause_ai"|"resume_ai"|"force_reply"|"end_turn"|"mute_user", "payload":{...} }`
- `ping`: `{ "type":"ping", "sessionId":"abc" }`

### Server → Client
- `joined`: `{ "type":"joined", "sessionId":"abc", "role":"presenter" }`
- `participant_state`: `{ "type":"participant_state", "sessionId":"abc", "userId":"u1", "speaking":true }`
- `patient_state`: `{ "type":"patient_state", "sessionId":"abc", "state":"idle"|"listening"|"speaking"|"error" }`
- `patient_transcript_delta`: `{ "type":"patient_transcript_delta", "sessionId":"abc", "text":"Hi doctor..." }`
- `pong`: `{ "type":"pong" }`
- `error`: `{ "type":"error", "message":"..." }`

### Dev stub behavior
- `voice_command` with `force_reply` immediately emits `patient_state: speaking` and a sample `patient_transcript_delta`.
- `pause_ai`, `resume_ai`, `end_turn` update `patient_state` (idle/listening) for now. `mute_user` is logged only.

## Notes

- Clients must send `join` before any other message.
- Gateway tracks per-session sockets for presenters/participants and broadcasts within that session.
- In-memory only; restart clears state.***
