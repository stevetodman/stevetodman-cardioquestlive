<div align="center">
  <img width="1200" height="475" alt="CardioQuest Live" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# CardioQuest Live

Interactive pediatric cardiology teaching with presenter + student modes, Gemini-styled decks, and live-session gamification (team + individual scoring for residents).

## Documentation map

- Start here: `docs/START_HERE.md`
- Architecture: `docs/ARCHITECTURE.md`
- **Facilitator guide**: `docs/FACILITATOR_GUIDE.md` - Complete scenario documentation with clinical details
- Admin deck editing: `docs/ADMIN_SLIDE_EDITING.md`
- Ops/deploy: `DEPLOY.md`, `RUNBOOK.md`
- Voice/virtual patient: `docs/virtual-patient-status.md`, `docs/voice-sim-state-and-harnesses.md`
- Testing matrix: `docs/TESTING_MATRIX.md`

## Overview

- **Presenter** runs a live session, opens questions, and shows live poll results and scoreboards.
- **Students** join with a code, answer MCQs/interactive tiles on their own device.
- **Gamified live sessions**: session-only points, streaks, automatic team assignment, team/individual score overlays in the presenter view.

## Features

- **Presenter view** with two mutually exclusive modes:
  - **Slides mode**: Full-screen presentation with slides, questions, scores, gamification overlays
  - **Sim mode**: Patient simulation with voice controls, vitals monitoring, telemetry, interventions
- **Shared orders with realistic timing**:
  - **EKG orders**: 90-120s delay, tech acknowledgment, Muse-like 12-lead viewer
  - **CXR orders**: 180-240s delay, PACS-like radiology viewer with L/R markers
  - **Duplicate detection**: "Still working on the current EKG" prevents re-ordering
  - **Mobile-friendly viewers**: Zoom toggle, large tap targets, dark radiology backgrounds
- **WebSocket resilience**: Heartbeat/ping every 30s, auto-reconnect with exponential backoff
- **Resuscitation simulation** (Dec 2024):
  - **Code Blue Panel**: Auto-detects critical rhythms (VFib, VTach, Asystole, PEA), PALS protocol timer
  - **CPR Metronome**: Audio/visual guide at 110 BPM with tap-to-track rate feedback
  - **Dynamic ECG Waveform**: Real-time animated rhythm display using Canvas API
- **Student mode**: join by code or QR, answer MCQs, view static interactive tiles, and quickly rejoin the last session.
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
- **Virtual patient voice (student) — simplified**
  - Single hold-to-speak button auto-takes/releases the floor; no manual take/release buttons.
  - Unified status badge (ready / active / waiting / unavailable) with clear recovery hints.
  - Auto-release after 2s when you stop pressing (and after 60s idle safety).
  - Advanced options hidden by default; defaults to asking the patient.
  - Mobile-first voice layout: collapsible voice panel plus floating mic button that respects safe areas.
  - Text fallback: if mic is blocked or voice is paused, switch to typing a question with inline help and keep that preference in localStorage.
- Accessibility: skip link to main content; live announcements when questions open/close and when results are shown.

## Data & Architecture (brief)

- `sessions/{sessionId}`: `title`, `joinCode`, `slides[]`, `questions[]`, `currentSlideIndex`, `currentQuestionId`, `showResults`, `createdAt`, `createdBy`.
- `sessions/{sessionId}/responses/{userId}_{questionId}`: one answer per user/question (`userId`, `questionId`, `choiceIndex`, `createdAt`, `sessionId`).
- `sessions/{sessionId}/participants/{userId}`: `teamId`, `teamName`, `points`, `streak`, `correctCount`, `incorrectCount`, `createdAt`, `role?` (`"member"` | `"lead"`), `displayName?`, `inactive?` (true when participant tab hidden/closed).
- `sessions/{sessionId}/teamMessages/{messageId}`: Team chat messages (`userId`, `teamId`, `text`, `createdAt`, `senderName?`). Only visible to same-team members.
- `configs/deck`: deck configuration loaded by `deckService`.

Deeper dive: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Gamification Details

- **Individual scoring** (`src/utils/scoringUtils.ts`)
  - Base 100 points for correct answers.
  - **Time bonus**: ≤5s = 1.3×, ≤10s = 1.15×, >10s = 1.0× (rewards fast responses)
  - **Streak bonus**: 2 correct = 1.1×, 3 = 1.2×, 4+ = 1.5× (capped)
  - Max per question: 195 points (100 × 1.5 × 1.3)
  - Incorrect: `0` points, streak resets, `incorrectCount++`.
  - **First-answer-only**: only the first submission per user/question affects points/streak; later edits update the response doc without changing score.
- **Teams**
  - Automatic least-loaded assignment on join (Team Ductus, Team Cyanosis, Team QpQs).
  - Team score = sum of member points.
  - **Empty teams hidden**: Teams with 0 members don't appear in scoreboard until someone joins.
  - **Team chat**: Private messaging within teams; teammates coordinate without other teams seeing.
  - **Team lead role**: One member per team can claim the "lead" role with visual indicator (star badge).
- **Participant status**
  - **Random names**: Anonymous users get medical-themed names (e.g., "Swift Atrium", "Keen Pulse").
  - **Inactive tracking**: Participants marked "away" when tab hidden/closed; re-marked active on return.
  - Individual leaderboard shows "(away)" tag for inactive participants.
- **Presenter overlays**
  - Team scoreboard (rank + points) and individual scoreboard (top N players).
  - Toggles in presenter controls to show/hide each overlay; overlays sit over the slide without blocking interactions.
- **Session wrap-up** (`src/components/SessionWrapUp.tsx`)
  - Answer recap with correct options and one-line rationale.
  - Score snapshot: top team, top player, overall accuracy.
  - Toggle via "Session summary" button in slides mode.

## Local Development & Emulators

**Prereqs:** Node.js, Firebase CLI, a Firebase project with Anonymous Auth enabled.

**Env flags**

- `VITE_FIREBASE_*` → your Firebase keys (set in `.env.local`).
- `VITE_USE_EMULATORS=true` → route Firestore/Auth/Functions to local emulators.
- Optional ports/host overrides: `VITE_FIRESTORE_EMULATOR_PORT` (default 8088), `VITE_AUTH_EMULATOR_PORT` (9099), `VITE_FUNCTIONS_EMULATOR_PORT` (5001), `VITE_EMULATOR_HOST` (127.0.0.1).

**Typical workflow**

```bash
# One-shot stack (emulators + gateway + web; keeps ports aligned)
npm run dev:stack:local
# Then in the browser: http://127.0.0.1:5173/#/create-demo → create session → join code.

# Cloudflare tunnel (app.cardioquestlive.com / voice.cardioquestlive.com)
npm run dev:tunnel:clean   # Recommended: auto-cleans ports before starting
npm run dev:tunnel         # Raw: assumes ports are free
# Opens app at https://app.cardioquestlive.com (via tunnel) and voice WS at wss://voice.cardioquestlive.com/ws/voice
# Requires: cloudflared tunnel run virtual-patient (see config) and ALLOW_INSECURE_VOICE_WS=true for local dev.
```

## Manual Testing (Quick Start)

**Option 1: Local only (desktop browser)**
```bash
npm run dev:stack:local
# Open http://127.0.0.1:5173/#/create-demo
# Click "Create Demo Session" → note the 4-letter join code
# Open presenter view, switch to "Sim" mode
# In a new tab: http://127.0.0.1:5173/#/join/CODE → participant view
```

**Option 2: iPhone/mobile testing (requires tunnel)**
```bash
npm run dev:tunnel:clean
# On iPhone: https://app.cardioquestlive.com/#/join/CODE
# Allow microphone access for voice interaction
```

**Testing the Orders System**
1. In participant or presenter view, speak or type: "Order an EKG" or "Get a chest X-ray"
2. Watch for nurse acknowledgment: "Yes, Doctor. I'll have that EKG for you shortly."
3. Wait 90-120s (EKG) or 180-240s (CXR) for completion
4. Click "View EKG" or "View X-Ray" button to open full-screen viewer
5. Try ordering again while pending → should see "Still working on the current EKG"

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
Mic access: allow microphone for `127.0.0.1` in your browser, then tap **Re-check mic** in participant view.

**Common local gotchas**
- Connection refused to Firestore/gateway → restart stack (`npm run dev:stack:local`) and keep the terminal running.
- Mic blocked → allow microphone for 127.0.0.1 in browser/system settings, then use **Re-check mic**.
- Voice fallback/unavailable → ensure stack is running and presenter clicks **Enable voice** then **Release floor**.

**App entry points**
- Presenter: `/#/create-demo` (creates a session) → `/#/presenter/:sessionId`
- Student: `/#/join/CODE`
- Admin: `/#/admin` (guarded by optional `VITE_ADMIN_ACCESS_CODE`)

## Support matrix

- Node.js: 18.x or 20.x LTS (align with CI and voice gateway builds); npm from the same Node install.
- Firebase: Firestore/Auth in Native mode. Emulator defaults: Firestore 8088/9188, Auth 9099 (override via `VITE_*_PORT` envs).
- Build tooling: Vite 6, React 19, TypeScript (checked by `npm run build`).
- Voice gateway: Node 18+; `/ws/voice` on port 8081 by default; OpenAI models default to `gpt-4.1-mini` (text) and `gpt-4o-mini-tts` (TTS) unless overridden in `voice-gateway/.env`.
- Cloudflare tunnel (named `virtual-patient` expected):
  - App: `https://app.cardioquestlive.com` → localhost:3000
  - Voice WS: `wss://voice.cardioquestlive.com/ws/voice` → localhost:8081
  - Suggested env for tunnel dev: `VITE_USE_EMULATORS=false`, `VITE_VOICE_GATEWAY_URL=wss://voice.cardioquestlive.com/ws/voice`, `ALLOW_INSECURE_VOICE_WS=true` (gateway dev).

## Testing

- Latest status: v0.0.8 tagged with full mock Playwright suite green on bundled Chromium; emulator smoke also green when run against local emulators.
- Unit/UI/rules tests: `npm test -- --runInBand`
- E2E (Playwright, mock sessions): start dev server `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --clearScreen false`, then in another shell run  
  `PLAYWRIGHT_BROWSERS_PATH=0 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_USE_CHROMIUM=true PLAYWRIGHT_CHROMIUM_CHANNEL= npx playwright test`  
  (This forces the bundled Chromium to avoid system Chrome Crashpad permission issues.) If browsers are missing, install once with `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium webkit`.
- E2E (Firestore/Auth emulators, optional): start emulators + app (`npm run dev:stack:local` or your emulator stack on 127.0.0.1:5173 with `VITE_USE_EMULATORS=true`), then run  
  `PLAYWRIGHT_BROWSERS_PATH=0 E2E_EMULATOR=1 PLAYWRIGHT_USE_CHROMIUM=true PLAYWRIGHT_CHROMIUM_CHANNEL= npx playwright test e2e/emulator-smoke.spec.ts` (or `npm run test:e2e:emu`). Skips if `E2E_EMULATOR` is not set.
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
- Mock/test hooks (hash router keeps query after `#`):
  - `?mockSession=CODE` on `/#/create-demo`, `/#/presenter/:sessionId`, or `/#/join/CODE` seeds an in-memory session with a default question (skips Firestore). LocalStorage `cq_mock_session` (`{"joinCode":"MOCK","sessionId":"MOCK-SESSION"}`) is also respected.
  - `?mockVoice=ready|unavailable` forces participant voice banner state; `?mockNotFound=true` renders the Session Not Found view.
  - Playwright E2E relies on these mocks; run dev server with `--host 127.0.0.1 --port 5173 --strictPort` before `npx playwright test`.

For admin editing tips: [docs/ADMIN_SLIDE_EDITING.md](docs/ADMIN_SLIDE_EDITING.md).  
For architecture details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
