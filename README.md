<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1MhhV-tJNaEOnpggBaha68lSiB7C4k3x0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Firebase project keys (`VITE_FIREBASE_*`). Keep this file out of source control.
3. Run the app:
   `npm run dev`
4. Open `http://localhost:3000` (default Vite port) and use the links provided, e.g. presenter `/create-demo`, learner `/#/join/CODE`, or admin `/#/admin`.

To enable the secure Gemini callable function, store your Gemini API key server-side:

```
firebase functions:config:set gemini.api_key="YOUR_GEMINI_KEY"
```

### Deck Admin

- Set an optional `VITE_ADMIN_ACCESS_CODE` in `.env.local` (and hosting secrets) to gate the deck editor UI.
- Visit `/#/admin` after running `npm run dev` (or on production) to edit slides/questions via the UI.
- Changes are saved to Firestore (`configs/deck`) and used automatically when creating new sessions.

### Testing

- The project uses Jest + Testing Library for unit tests. Run `npm test` to execute the suite (see `src/pages/__tests__/AdminDeckEditor.test.tsx` for an example).
- Jest is configured via `jest.config.ts`, and global helpers live under `test/`.

Looking for a full explanation of how the Firebase project, Google AI Studio, and Gemini API key work together? Read [docs/GOOGLE_AI_STUDIO.md](docs/GOOGLE_AI_STUDIO.md).
