# Design update report

This archive starts from the previous stable Phase 1–2 deploy archive and only changes the user-facing web UI copy/layout.

## Changed

- Reworked `apps/web/src/App.tsx` into a more user-oriented flow:
  - clearer hero section;
  - visible 3-step flow: fill form, preview structure, download ZIP;
  - less raw technical wording in the main UI;
  - technical JSON is still available in a collapsed details block for debugging;
  - generation mode and LLM notes are hidden from the main form and forced to stable baseline mode.
- Rebuilt `apps/web/src/styles.css` with a cleaner responsive layout, stronger cards, readable form sections, summary tiles, module chips and history cards.
- Updated `packages/shared/src/questionnaire.ts` labels/descriptions so the questionnaire is understandable for normal users, not only for developers.
- Updated browser title in `apps/web/index.html`.

## Safety notes

- API routes and deploy workflow were not changed.
- Phase 1–2 baseline generation logic was not changed.
- Source tree verification was run successfully with `bash scripts/verify/no_stale_source_artifacts.sh`.
- Full `npm install`/web build could not be run in this sandbox because dependency installation did not complete here, so the archive preserves the existing project dependency model and changes only frontend source files.
