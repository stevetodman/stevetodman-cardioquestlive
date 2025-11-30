# Google AI Studio + Firebase Guide

CardioQuest Live is a Vite/React SPA that can run either as a standalone Firebase-hosted web app or inside Google AI Studio’s “Apps” container. This document walks through everything needed to configure the project, connect it to Google AI Studio and Gemini, and operate the presenter/student experience.

---

## 1. Architecture Overview

- **Frontend:** React 19 + Vite 6; see `src/` for pages, components, and the pediatric cardiology deck contents.
- **Backend data:** Cloud Firestore when Firebase credentials are provided; otherwise, `src/utils/firestore.ts` falls back to a localStorage-backed mock DB for quick demos.
- **Hosting:** Firebase Hosting serves the production bundle in `dist/`. Google AI Studio can either point at the Firebase URL or at a zipped build.
- **Realtime loop:** Presenters and learners read/write the `sessions` collection, push responses to `sessions/{id}/responses`, and stream updates through Firestore `onSnapshot`.
- **Gemini (Google AI Studio) access:** A `GEMINI_API_KEY` is injected at build time in `vite.config.ts` so client or server helpers can call Gemini APIs from within the app.

---

## 2. Prerequisites

1. **Google account with AI Studio access** and the ability to create Gemini API keys.
2. **Firebase project** (the repo ships with `.firebaserc` targeting `steve-3228f`, but you can create your own).
3. **Cloud Firestore enabled** in *Native* mode. No custom indexes are needed; the queries use equality filters and `limit(1)`.
4. **Firebase CLI** (`npm i -g firebase-tools`) for deployment.
5. **Node.js 18+** for local development, plus npm (shipped with Node).

---

## 3. Configure Environment Variables

Create `.env.local` at the repo root. Start from `.env.example` and populate:

```bash
cp .env.example .env.local
```

| Variable | Location in UI | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase console → Project Settings → General → “Your apps” → SDK setup | Authenticates the web SDK. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same panel | Enables Firebase Auth/Firestore domain routing. |
| `VITE_FIREBASE_PROJECT_ID` | Same panel | Used by `initializeApp`. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same panel (optional in this UI) | Required for consistency with SDK config. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same panel | Firebase messaging identifier. |
| `VITE_FIREBASE_APP_ID` | Same panel | Unique web app instance ID. |
| `VITE_FIREBASE_MEASUREMENT_ID` | Same panel | Optional but recommended if Analytics is enabled. |

> ℹ️ The Home screen badge (“Cloud Live” vs “Local Demo”) is driven by `isConfigured` in `src/firebase.ts:15`. If `VITE_FIREBASE_API_KEY` is absent, the app stays in local mock mode.

### Server-Only Gemini Key

Store your Gemini API key in Functions config (or as an environment variable when emulating) so it never ships to the browser:

```bash
firebase functions:config:set gemini.api_key="YOUR_GEMINI_KEY"
```

When running the Functions emulator you can also export `GEMINI_API_KEY=...` before `firebase emulators:start`.

---

## 4. Local Development

1. Install dependencies: `npm install`
2. Run the dev server: `npm run dev`
3. Visit `http://localhost:3000` (or the port Vite prints). Routes use `HashRouter`, so URLs look like `/#/presenter/...`, which also works inside the AI Studio iframe.

### Mock vs Cloud Data

- Without Firebase variables, `src/utils/firestore.ts` routes all Firestore calls to a localStorage store named `cq_live_db`. This is useful for quick demos or while prototyping slide decks.
- When Firebase credentials exist, Firestore’s SDK is used transparently. No code changes are required besides the `.env.local` values.

---

## 5. Deploying

### 5.1 Firebase Hosting

1. Build the production bundle: `npm run build`
2. Log in: `firebase login`
3. Confirm `.firebaserc` points to your project (`steve-3228f` by default).
4. Deploy: `firebase deploy --only hosting`

`firebase.json` rewrites every path to `index.html`, so the hash-based router works for `/presenter/:id` and `/join/:code`.

### 5.2 Secure backends

- **Firestore rules** live in `firestore.rules`; deploy them with `firebase deploy --only firestore:rules`.
- **Gemini Cloud Function** lives in `functions/index.js`. Deploy via `firebase deploy --only functions` (or bundle with hosting using `firebase deploy --only functions,firestore,hosting`).
- Remember to set the Gemini API key with `firebase functions:config:set gemini.api_key=...` before deploying; the callable function will throw if the key is missing.
- **Deck Admin UI** stores its state in `configs/deck`. Use `VITE_ADMIN_ACCESS_CODE` to gate access and ensure authenticated users only can reach `/admin`.
- **Unit tests** run with Jest/Testing Library (`npm test`). Example coverage for the deck admin lives under `src/pages/__tests__/`.

### 5.3 Packaging for Google AI Studio

1. Run `npm run build`. The bundle lands in `dist/`.
2. Copy `metadata.json` (defines the display name/description) next to the build artifacts.
3. Zip the contents (e.g., `cd dist && zip -r ../cardioquestlive.zip .` plus `metadata.json`).
4. In [Google AI Studio](https://ai.studio/):
   - Navigate to **Apps → New App → Upload custom app**.
   - Provide the zipped bundle or the public Firebase Hosting URL.
   - Grant any optional frame permissions if you plan to call additional Google APIs.
5. Publish the AI Studio App and share the generated link (example: `https://ai.studio/apps/drive/...`).

---

## 6. Using the App

1. **Presenter workflow**
   - Visit `/create-demo` to instantiate a session using `createInitialSessionData()` (`src/data/ductalDeck.ts`).
   - Share the four-character join code with learners (displayed in Presenter view sidebar and the “Session Created” card).
   - Use the slide navigation controls to advance. Opening a question emits the question ID to learners and reveals the live chart (`src/components/ResponsesChart.tsx`).
2. **Learner workflow**
   - Go to `/#/join/CODE`.
   - The UI polls Firestore (or localStorage) for slides and question state; answers are saved under `sessions/{sessionId}/responses`.
   - Learners see whether the presenter has opened the question, whether answers are locked, and the revealed result state.
3. **Data Model**
- Sessions contain sorted `slides[]` and `questions[]`. Slide templates live in `src/data/ductalDeck.ts`, and `types.ts` documents each field.
- Responses are lightweight docs with `sessionId`, `userId`, `questionId`, `choiceIndex`, and timestamps.
- Firestore security rules require authenticated users. Presenters own the session they created (`createdBy` UID) and learners submit `responses` tagged with their UID.
- The admin editor (`/#/admin`) persists deck edits to Firestore, so every new session uses the most recent content without touching the codebase.

---

## 7. Customizing Content & Gemini Usage

### 7.1 Updating the Deck

`src/data/ductalDeck.ts` stores every slide and question. Append new slides/questions following the commented template (IDs must be unique and cross-referenced). Because slides are HTML snippets, you can introduce Tailwind classes or inline styles to match your curriculum.

### 7.2 Calling Gemini

`functions/index.js` exposes `generateGeminiContent`, an HTTPS callable Function that checks the caller’s Firebase Auth token, pulls the Gemini API key from Functions config, and proxies the request to Gemini. Client code never touches the raw key—use the helper in `src/utils/gemini.ts`:

```ts
import { generateGeminiContent } from "@/utils/gemini";

async function getSessionSummary(sessionId: string) {
  const prompt = `Summarize responses for session ${sessionId}`;
  const { text } = await generateGeminiContent(prompt);
  return text;
}
```

Before calling this helper you must sign in (anonymous auth happens in `src/App.tsx`) and deploy the Function + stored key. For local emulation, run `firebase emulators:start --only functions,firestore` with `GEMINI_API_KEY` exported in your terminal.

---

## 8. Troubleshooting & Verification

- **“Cloud Live” indicator is orange?** Check `.env.local` and restart `npm run dev`. The flag reads `!!import.meta.env.VITE_FIREBASE_API_KEY`.
- **Learners don’t receive slides/questions:** Confirm `firestore.rules` allow read/write for authenticated/unauthed contexts that you expect, or temporarily relax rules while testing.
- **AI Studio iframe issues:** The app uses hash routing, so no additional rewrites are required. If you need cross-origin access to additional Google APIs, declare them in `metadata.json → requestFramePermissions`.
- **Gemini quota/403:** Validate the API key scope inside AI Studio → *API Keys*. Keys created in consumer accounts may have limited quota; consider upgrading the Google Cloud project for production.
- **Callable function says `unauthenticated`:** confirm anonymous sign-in succeeded (`ensureSignedIn()` in `src/App.tsx`) and that your Firestore rules/Emulator Auth settings allow anonymous users.

---

## 9. Important Files

- `src/firebase.ts` – Reads Firebase env vars and initializes Firebase App/Firestore.
- `src/utils/firestore.ts` – Switches between real Firestore and the mock local store.
- `src/pages/CreateDemoSession.tsx`, `PresenterSession.tsx`, `JoinSession.tsx` – Primary UX flows.
- `src/data/ductalDeck.ts` – Slide and question content seeded into new sessions.
- `metadata.json` – Display name/description for AI Studio.
- `firebase.json`, `.firebaserc` – Hosting configuration and default project binding.

Use this guide as the canonical reference when onboarding teammates, rotating API keys, or packaging the app for AI Studio showcases.
