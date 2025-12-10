# CardioQuest Live Architecture

This guide is a quick map for developers joining the project. It highlights where core pieces live and how data flows.

## Core components

- **Presenter**: `src/pages/PresenterSession.tsx`
  - Renders the current session slide (Gemini-styled HTML) in an aspect-ratio container.
  - Poll overlay lives inside the slide; controls are in the top bar. Nav uses arrows/Space.
  - Slide HTML is trusted (`dangerouslySetInnerHTML`) and comes from session data.

- **Admin**: `src/pages/AdminDeckEditor.tsx`
  - Edits `slide.html` strings (templates, snippets, paste-to-image, live preview).
  - Saves decks to Firestore (`configs/deck`) via `deckService`.

- **Decks**: `src/data/case1Deck.ts`–`case11Deck.ts`, `src/data/ductalDeck.ts`
  - Gemini-styled slides + questions. Sessions pull from these to seed data.

- **Gamification**:
  - Participants tracked in `sessions/{sessionId}/participants/{userId}` with team, points, streak, correctness counts.
  - Presenter overlays (team + individual scoreboards) subscribe to participants.
  - Scoring is session-only and first-answer-only per question.

- **Shared helpers**:
  - `src/utils/interactiveTiles.ts`: presenter-only interactive clue tiles; participant tiles remain static.
  - `src/utils/geminiHeader.ts`: compact header for Gemini slides.
  - `src/styles/cq-theme.css`: shared slide styling (cards, tiles, nav, images).

- **Session creation**: `src/pages/CreateDemoSession.tsx`
  - Uses `createInitialSessionData` (from `ductalDeck.ts`) and adds `createdBy` to create a Firestore session.

## Data model (Firestore)

- `sessions/{sessionId}`: session metadata
  - Fields: `createdBy`, `joinCode`, `slides`, `questions`, `currentSlideIndex`, `currentQuestionId`, `showResults`, `createdAt`, `title`.
  - Security: only creator or admin can update/delete; shape validated in `firestore.rules`.
- `sessions/{sessionId}/responses/{responseId}`: poll responses
  - `responseId = "{uid}_{questionId}"` to enforce one response per user/question.
  - Fields: `userId`, `questionId`, `choiceIndex`, `createdAt`, `sessionId`.
  - Security: user can create/update their own deterministic doc; reads require auth.
- `sessions/{sessionId}/participants/{userId}`: participant state for gamification
  - Fields: `userId`, `sessionId`, `teamId`, `teamName`, `points`, `streak`, `correctCount`, `incorrectCount`, `createdAt`, `role?` (`"member"` | `"lead"`), `displayName?`.
  - Security: any authenticated user can read; only the user can write their own doc with validated shape.
- `sessions/{sessionId}/teamMessages/{messageId}`: team chat messages
  - Fields: `userId`, `teamId`, `text`, `createdAt`, `senderName?`.
  - Security: only users on the same team can read/write (enforced via `isSameTeam()` helper in rules).
  - 500-character limit enforced in rules.
- `configs/{...}`: deck/config documents
  - Admin-only writes; reads require auth.

## Data flow

1. Deck is authored in `src/data/*Deck.ts`.
2. Admin can edit deck via `/#/admin` and save to `configs/deck`.
3. Session is created (`CreateDemoSession`) from the deck: writes `sessions/{sessionId}` with slides/questions and state fields.
4. Presenter (`/#/presenter/:sessionId`) reads the session and renders slides; polls are opened/shown via top-bar controls.
5. Participants submit responses; responses are stored under `sessions/{sessionId}/responses/{uid_questionId}` and streamed to presenter/participants.
6. Scoring: on first submission per user/question, participant doc is updated (points/streak/correct/incorrect). Team scores derive from participant points.
7. Presenter overlays subscribe to participants to show team standings and top individuals.

## Notes

- Slides are raw HTML strings; no sanitizer is applied in presenter. Keep content trusted.
- Interactive clue tiles are a presenter affordance; participant view is static unless explicitly built otherwise.
- Firestore security rules mirror the above model (`firestore.rules`).

## Voice gateway (overview)

- **Transport**: `voice-gateway/src/transport.ts` boots the WebSocket server at `/ws/voice`.
- **Orchestration**: `voice-gateway/src/index.ts` wires message handling, scenarios, orders, telemetry, and safety; `orchestrator.ts` coordinates message flow.
- **Domain modules**:
  - Safety/rate limits: `autoReplyGuard.ts`, `speechHelpers.ts`.
  - Orders/telemetry: `orders.ts`, `telemetry.ts`, `assetUtils.ts`.
  - State/persistence: `sim/scenarioEngine.ts`, `persistence.ts`, `messageTypes.ts`, `validators.ts`.
  - OpenAI integrations: `sttClient.ts`, `ttsClient.ts`, `debriefAnalyzer.ts`, `openaiClient.ts`.
- **Tests**: `npm run test:gateway` runs gateway/unit behavior; page tests cover basic presenter flows; rules tests via `npm run test:rules` (or `test:rules:ports` with env overrides if ports are blocked).
