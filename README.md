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
  - Live presenter-style preview updates as you type. See `docs/ADMIN_SLIDE_EDITING.md` for a quick guide.

### Testing

- The project uses Jest + Testing Library for unit tests. Run `npm test` to execute the suite (see `src/pages/__tests__/AdminDeckEditor.test.tsx` for an example).
- Jest is configured via `jest.config.ts`, and global helpers live under `test/`.

Looking for a full explanation of how the Firebase project, Google AI Studio, and Gemini API key work together? Read [docs/GOOGLE_AI_STUDIO.md](docs/GOOGLE_AI_STUDIO.md).
