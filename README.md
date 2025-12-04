<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1MhhV-tJNaEOnpggBaha68lSiB7C4k3x0

## Run Locally

**Prerequisites:** Node.js, Firebase project with **Anonymous Auth enabled**.

1. Install dependencies:  
   `npm install`
2. Copy `.env.example` to `.env.local` and set your Firebase keys (`VITE_FIREBASE_*`). Keep this file out of source control.
3. Start dev server:  
   `npm run dev`
4. Open `http://localhost:3000` (default Vite port) and use:
   - Presenter: `/#/create-demo` (gets the join code)
   - Student: `/#/join/CODE` (same network; anonymous auth required)
   - Admin: `/#/admin` (guarded by `VITE_ADMIN_ACCESS_CODE` if set)

### Styling

Tailwind is built locally (no CDN). The build pipeline uses `tailwind.config.js`, `postcss.config.js`, and the `@tailwind` imports in `src/index.css`. Just run `npm run dev` or `npm run build`; no extra steps needed.

### Decks

- Default deck uses the Gemini shell for intro/goals and Cases 1–11 (each follows: presentation → phenotype/features → images/notes → poll(s) → diagnosis).
- Presenter UX:
  - Polls render once in the slide; results overlay inside the slide when you click **Show results** (no separate tray). Poll controls now sit in the top bar.
  - Navigation is streamlined to a single left/right arrow with a passive `Space = Next` hint; keyboard arrows/space still advance slides.
  - “Grid of clues” slides (e.g., Case 3 phenotype, Case 7 phenotype) are interactive on presenter: click a tile to reveal its image, click again to clear. Participant view stays static.

### Deploy

- Build: `npm run build`
- Deploy hosting + rules: `firebase deploy --only hosting,firestore:rules`
- Functions are optional and require billing + secret if you use Gemini:
  - Set secret: `firebase functions:secrets:set GEMINI_API_KEY`
  - Deploy with functions: `firebase deploy --only hosting,firestore:rules,functions`

### Gemini (optional)

The callable function needs the secret set server-side (see above) and billing enabled on your Firebase project.

### Deck Admin

- Set an optional `VITE_ADMIN_ACCESS_CODE` in `.env.local` (and hosting secrets) to gate the deck editor UI.
- Visit `/#/admin` after running `npm run dev` (or on production) to edit slides/questions via the UI.
- Changes are saved to Firestore (`configs/deck`) and used automatically when creating new sessions.
- Slide editing comforts:
  - Templates to scaffold common slides (phenotype grids, polls, image + caption, teaching summary).
  - Quick-insert snippets (headings, clue boxes, teaching pearls).
  - Paste images directly into the HTML editor (inserts a styled `cq-slide-image` data-URL tag).
  - Live presenter-style preview updates as you type. See [docs/ADMIN_SLIDE_EDITING.md](docs/ADMIN_SLIDE_EDITING.md) for a quick guide.

## How to build a slide (Admin)

- Go to `/#/admin` (requires `VITE_ADMIN_ACCESS_CODE` if set), select a slide from the list.
- Slides are plain HTML strings rendered as-is in the presenter.
- The editor supports:
  - **Templates**: Phenotype / Clue Grid, Poll (MCQ), Image + Caption, Teaching Pearl.
  - **Snippets**: one-click inserts for headings, clue boxes, teaching pearls.
  - **Paste images**: copy an image, click in the editor, Cmd/Ctrl+V to insert a styled `<img>` with a data URL (soft warning on large images; optional alt text prompt).
- A live presenter-style preview sits next to the editor so you can see changes immediately.
- For step-by-step details, see [docs/ADMIN_SLIDE_EDITING.md](docs/ADMIN_SLIDE_EDITING.md).

## Architecture overview

- **Deck content**: Gemini-styled decks live under `src/data` (`case1Deck.ts`–`case11Deck.ts`, `ductalDeck.ts`) and are consumed by sessions.
- **Admin editor**: `/#/admin` (`src/pages/AdminDeckEditor.tsx`) edits `slide.html` strings with templates, snippets, paste-to-image, and a live preview.
- **Presenter**: `/#/presenter/:sessionId` (`src/pages/PresenterSession.tsx`) renders the current session slide and in-slide poll overlay; nav uses arrows/Space.
- **Data model**: Firestore `sessions/{sessionId}` hold slide/question state; `responses/{uid_questionId}` subcollection stores poll answers; `configs/**` holds deck config (admin writes only). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and `firestore.rules`.
- Slide editing comforts:
  - Templates to scaffold common slides (phenotype grids, polls, image + caption, teaching summary).
  - Quick-insert snippets (headings, clue boxes, teaching pearls).
  - Paste images directly into the HTML editor (inserts a styled `cq-slide-image` data-URL tag).
  - Live presenter-style preview updates as you type. See `docs/ADMIN_SLIDE_EDITING.md` for a quick guide.

### Testing

- The project uses Jest + Testing Library for unit tests. Run `npm test` to execute the suite (see `src/pages/__tests__/AdminDeckEditor.test.tsx` for an example).
- Jest is configured via `jest.config.ts`, and global helpers live under `test/`.

Looking for a full explanation of how the Firebase project, Google AI Studio, and Gemini API key work together? Read [docs/GOOGLE_AI_STUDIO.md](docs/GOOGLE_AI_STUDIO.md).

### Firebase emulators (for future uploads)

If we later add Firebase Storage–based uploads (e.g., for images instead of data URLs), we will use the Firebase emulators in development.

When that happens, you’ll likely need something like:

- `VITE_USE_EMULATORS=true` in `.env.local`
- Storage emulator running (e.g., `localhost:9199`)

We’ll update this section with concrete instructions once uploads are wired in.
