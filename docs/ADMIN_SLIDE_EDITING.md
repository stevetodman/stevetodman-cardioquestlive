# Admin Slide Editing Guide

This app stores each slide as a raw HTML string (`slide.html`). The admin editor now includes helpers so you rarely need to hand-type markup.

## Where to edit

- Go to `/#/admin` (requires `VITE_ADMIN_ACCESS_CODE` if set).
- Select a slide in the left list. The middle area shows:
  - Template picker + quick-insert buttons
  - HTML textarea (controlled)
  - Live presenter-style preview that updates as you type (no save required)

## Templates

- Use the **Template** dropdown above the editor to scaffold a slide:
  - Phenotype / Clue Grid
  - Poll (MCQ)
  - Image + Caption
  - Teaching Pearl / Summary
- If the slide has existing HTML, you’ll be asked to confirm before replacing it.

## Quick inserts

- Buttons next to the template picker insert common blocks at the caret:
  - `+ Heading` → `<h1>Slide Title</h1>`
  - `+ Subheading` → `<h2>Section Heading</h2>`
  - `+ Clue box` → wrapped in `cq-card`/`cq-hoverable`/`cq-mute` styles
  - `+ Teaching pearl` → `cq-card` + `cq-list`
- Snippets replace any selected text and use existing Gemini/CQ classes so styling stays consistent.

## Pasting images (data URLs)

- Copy an image (Cmd/Ctrl+C), click in the HTML editor, press Cmd/Ctrl+V.
- If the image is large (> ~2 MB), you’ll see a soft warning before inserting.
- You’ll be prompted for optional `alt` text (for accessibility). Leave blank to keep `alt=""`.
- The editor inserts `<img class="cq-slide-image" src="data:image/...;base64,..." alt="..."/>` at the cursor.
- `.cq-slide-image` is styled globally (centered, max-width, rounded, subtle border/shadow). You can edit `alt` text manually after insertion.
- Normal text paste is unchanged when no image is on the clipboard.

## Tips and best practices (quick checklist)

- Use templates first, then tweak with snippets to stay consistent.
- Keep headings concise; prefer `h1` for slide title, `h2` for sections.
- Add brief `alt` text when you paste an image; avoid multi-megabyte assets when possible.
- For clue grids, aim for 2–4 items; keep option text short on poll slides.
- Live preview is your friend—scan spacing and readability before saving.

## Live preview

- The right pane shows a presenter-style preview of the current `slide.html`, updated on every edit.
- Uses the same classes as presenter slides; verify spacing, grids, images, and polls without leaving admin.

## Style hints and class cheatsheet

- **Cards/Clues:** wrap content in `cq-card cq-hoverable`, label with `cq-cardLabel`, body text `cq-mute`, lists with `cq-list`.
- **Tiles/Options:** use `cq-tiles` + `cq-tile` for clue grids; `cq-option` for poll options.
- **Images:** prefer `cq-slide-image` for inline images you paste; existing grid image cards often use `cq-card` + `<img>` with borders.
- **Layout:** common wrappers include `cq-twoCol` (question layouts), `cq-tiles` (grids), `cq-shell`/`cq-body` are handled by slide scaffold—no need to add those manually.

## Best practices

- Keep headings concise; use `h1`/`h2` hierarchy in templates.
- Add brief `alt` text when appropriate (defaults to empty to avoid noise).
- Favor existing CQ classes over ad-hoc styling to stay on-brand.
- For polls, keep options short and ordered A–E; include a “Clue” card when helpful.
- For clue grids, aim for 2–4 items; interactive reveal on presenter already works for tiles using `renderInteractiveTiles`.

## Saving

- Edits are local until you click **Save Deck**. Live preview does not require saving.
- Saving persists to Firestore (`configs/deck`) and is used for new sessions.
