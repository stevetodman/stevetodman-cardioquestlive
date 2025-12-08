<div align="center">
  <img width="1200" height="475" alt="CardioQuest Live" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# CardioQuest Live

Interactive pediatric cardiology teaching with presenter + student modes, Gemini-styled decks, and live-session gamification (team + individual scoring for residents).

## Documentation map

- Start here: `docs/START_HERE.md`
- Architecture: `docs/ARCHITECTURE.md`
- Admin deck editing: `docs/ADMIN_SLIDE_EDITING.md`
- Ops/deploy: `DEPLOY.md`, `RUNBOOK.md`
- Voice/virtual patient: `docs/virtual-patient-status.md`, `docs/voice-sim-state-and-harnesses.md`
- Testing matrix: `docs/TESTING_MATRIX.md`

## Overview

- **Presenter** runs a live session, opens questions, and shows live poll results and scoreboards.
- **Students** join with a code, answer MCQs/interactive tiles on their own device.
- **Gamified live sessions**: session-only points, streaks, automatic team assignment, team/individual score overlays in the presenter view.

## Features

- **Presenter mode**: start a session, advance slides, open/close questions, show poll results inside the slide.
- **Student mode**: join by code, answer MCQs, view static interactive tiles.
- **Gamification (session-only)**:
  - Per-participant points/streaks; first answer per question counts for scoring.
  - Auto team assignment; team scores are sums of member points.
  - Presenter HUD overlays: team ranking and top players, with toggles.
- **Deck admin**: edit slides/questions with templates, snippets, paste-to-image, live preview.
- **Local dev with emulators**: Firestore/Auth emulators supported via `VITE_USE_EMULATORS=true`.
- **Virtual patient voice (presenter)**:
  - Text answers stream into the overlay; a transcript panel logs doctor ↔ patient turns with copy/download.
  - Optional TTS audio plays on the presenter side when OpenAI TTS is configured in `voice-gateway/.env`.
  - Push-to-talk resident questions are transcribed via OpenAI STT to auto-fill the doctor question box; optional auto Force Reply toggle.
  - Presenter can switch between predefined patient cases (exertional chest pain, syncope, SVT).

## Data & Architecture (brief)

- `sessions/{sessionId}`: `title`, `joinCode`, `slides[]`, `questions[]`, `currentSlideIndex`, `currentQuestionId`, `showResults`, `createdAt`, `createdBy`.
- `sessions/{sessionId}/responses/{userId}_{questionId}`: one answer per user/question (`userId`, `questionId`, `choiceIndex`, `createdAt`, `sessionId`).
- `sessions/{sessionId}/participants/{userId}`: `teamId`, `teamName`, `points`, `streak`, `correctCount`, `incorrectCount`, `createdAt`.
- `configs/deck`: deck configuration loaded by `deckService`.

Deeper dive: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Gamification Details

- **Individual scoring**
  - Base 100 points for correct answers.
  - Difficulty multiplier: `easy 1.0`, `medium 1.3`, `hard 1.6` (default 1.0 if unset).
  - Streak multiplier: grows with correct streak, capped at `1.5`.
  - Incorrect: `0` points, streak resets, `incorrectCount++`.
  - **First-answer-only**: only the first submission per user/question affects points/streak; later edits update the response doc without changing score.
- **Teams**
  - Automatic least-loaded assignment on join (Team Ductus, Team Cyanosis, Team QpQs).
  - Team score = sum of member points.
- **Presenter overlays**
  - Team scoreboard (rank + points) and individual scoreboard (top N players).
  - Toggles in presenter controls to show/hide each overlay; overlays sit over the slide without blocking interactions.

## Local Development & Emulators

**Prereqs:** Node.js, Firebase CLI, a Firebase project with Anonymous Auth enabled.

**Env flags**

- `VITE_FIREBASE_*` → your Firebase keys (set in `.env.local`).
- `VITE_USE_EMULATORS=true` → route Firestore/Auth/Functions to local emulators.
- Optional ports/host overrides: `VITE_FIRESTORE_EMULATOR_PORT` (default 8088), `VITE_AUTH_EMULATOR_PORT` (9099), `VITE_FUNCTIONS_EMULATOR_PORT` (5001), `VITE_EMULATOR_HOST` (127.0.0.1).

**Typical workflow**

```bash
# Terminal 1: Firestore + Auth (and Functions if needed) emulators
firebase emulators:start --only firestore,auth --project cardioquest-live-test

# Terminal 2: Vite dev server using emulators
VITE_USE_EMULATORS=true npm run dev
# Open http://localhost:3000 (or your Vite port)
```

**Voice gateway / AI patient**

```bash
# Terminal: voice gateway (WebSocket + patient brain + optional TTS)
cd voice-gateway
npm install
npm run build
npm start   # ws://localhost:8081/ws/voice
```

Env for gateway (in `voice-gateway/.env`):
- `OPENAI_API_KEY` (required for real replies / TTS; otherwise stub text only)
- `OPENAI_MODEL` (default `gpt-4.1-mini`)
- `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`)
- `OPENAI_TTS_VOICE` (default `alloy`)
- `PORT` (default `8081`)

**App entry points**
- Presenter: `/#/create-demo` (creates a session) → `/#/presenter/:sessionId`
- Student: `/#/join/CODE`
- Admin: `/#/admin` (guarded by optional `VITE_ADMIN_ACCESS_CODE`)

## Support matrix

- Node.js: 18.x or 20.x LTS (align with CI and voice gateway builds); npm from the same Node install.
- Firebase: Firestore/Auth in Native mode. Emulator defaults: Firestore 8088/9188, Auth 9099 (override via `VITE_*_PORT` envs).
- Build tooling: Vite 6, React 19, TypeScript (checked by `npm run build`).
- Voice gateway: Node 18+; `/ws/voice` on port 8081 by default; OpenAI models default to `gpt-4.1-mini` (text) and `gpt-4o-mini-tts` (TTS) unless overridden in `voice-gateway/.env`.

## Testing

- Unit/UI/rules tests: `npm test -- --runInBand`
- To run rules tests against the emulator, you can wrap with:

```bash
firebase emulators:exec --only firestore --project cardioquest-live-test "npm test -- --runInBand"
```

Emulator ports are set in `firebase.json` (Firestore 8088/9188). The test suite skips rules tests if it cannot reach the emulator.

## Deck Authoring & Admin

- Deck source: `src/data/case1Deck.ts`–`case11Deck.ts`, `src/data/ductalDeck.ts`.
- Admin editor (`/#/admin`): templates (Phenotype grid, Poll, Image+Caption, Teaching Pearl), snippets, paste-to-image (data URL), live preview. Writes to `configs/deck` via `deckService`.
- Creating sessions: `CreateDemoSession` seeds Firestore `sessions/{sessionId}` from the deck.

## Additional Notes

- Slides are trusted HTML strings rendered in presenter mode; keep content trusted.
- Poll responses are deterministic IDs `uid_questionId` to enforce one answer per user/question.
- Participants subcollection powers scores/teams; presenter overlays listen to participants in real time.

For admin editing tips: [docs/ADMIN_SLIDE_EDITING.md](docs/ADMIN_SLIDE_EDITING.md).  
For architecture details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
