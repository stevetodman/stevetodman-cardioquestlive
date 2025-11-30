# Where We Are / Where We're Going

## Where We Are

- **Routing and Environment**: `/admin` is fully wired inside `src/App.tsx` and now reads the admin passcode via `import.meta.env`. The route renders reliably in both dev (`npm run dev`) and production (`https://steve-3228f.web.app/#/admin`) after the recent build/deploy.
- **Security**: Firebase Auth + Firestore rules are enforced (anonymous sign-in gates sessions/responses/configs). The Gemini callable and deck persistence endpoints are live behind these rules.
- **Testing**: Jest + Testing Library is configured (`npm test`), with coverage for the Admin Deck Editor to ensure loading, passcode, and save logic stay stable.
- **Build/Deploy**: Vite builds from `src/main.tsx`; Firebase Hosting deploy is healthy (`firebase deploy --only hosting`). Functions/Firestore rules are already deployed for the `steve-3228f` project.
- **Admin UI**: The `/admin` route currently shows the passcode prompt and placeholder body; we have the infrastructure to load/save deck data (see `src/utils/deckService.ts`), but the UI is not yet reconnected to those utilities.

## Where We're Going

1. **Reconnect Deck Editor UI**
   - Reintroduce the slide/question editing components (form controls, preview, ordering) into `AdminDeckEditor.tsx`.
   - Use `fetchDeck` to populate the UI on load and `persistDeck` to save changes.
   - Add user feedback (loading/error/success states) and guard against partial saves or offline mode.

2. **Role-based Admin Access**
   - Optionally move beyond the shared passcode by allowing only specific Firebase Auth users (custom claims or email allowlist) to reach `/admin`.

3. **Deck Versioning / Audit**
   - Store additional metadata (updatedBy, changelog) in Firestore so we can roll back to previous decks or track edits.

4. **Enhanced Testing & CI**
   - Expand Jest coverage to include presenter/learner flows and deck saving logic.
   - Add a CI workflow (GitHub Actions) to run `npm test` and `npm run build` on every PR before deploy.

5. **DX & Documentation**
   - Add screenshots of the admin flow to `README.md`.
   - Document the deck editing workflow (e.g., “How to update slides/questions” guide).

6. **Future Enhancements**
   - UI improvements for the presenter dashboard (e.g., real-time status for joined participants).
   - Streaming Gemini summaries for session outcomes (tying the callable into the admin or presenter view).
   - Automated content seeding or sharing decks between projects.

These steps will move us from a working admin route + tests to a fully interactive deck management experience with traceability and CI safeguards.
