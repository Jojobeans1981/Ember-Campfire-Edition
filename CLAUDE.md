# CLAUDE.md — Project Guardrails

This file gives Claude (and other AI assistants) the rules of engagement for working on Ember Campfire Edition.

For project intent and structure, see:
- `docs/PRD.md` — what we're building
- `docs/TECH_STACK.md` — locked technology decisions
- `docs/MEMO.md` — architecture decisions and rationale
- `docs/TASK_LIST.md` — phased work breakdown
- `docs/TESTING_STRATEGY.md` — test conventions
- `docs/USER_FLOW.md` — user journey
- `docs/ERROR_FIX_LOG.md` — known issues and gotchas

## Environment Protection

- Never modify `.env` without user confirmation
- Never commit `.env` files (already in `.gitignore`)
- Never display API key values or hardcode secrets in source
- Never commit `public/models/` (Vosk models, gitignored)

## Error Logging

- Log build failures, runtime errors, Vue/Vite errors, audio/speech errors, lesson-data errors, persistence errors, and anything that took >5 minutes to diagnose to `docs/ERROR_FIX_LOG.md`
- Do NOT log: typos, linter warnings, expected test failures (red phase of TDD)
- Use the template at the top of `ERROR_FIX_LOG.md`
- Pick a category prefix from the list in that file: `[BUILD]`, `[VITE]`, `[VUE]`, `[VITEST]`, `[AUDIO]`, `[SPEECH]`, `[STORE]`, `[PERSISTENCE]`, `[LESSON-DATA]`, `[GAME]`, `[UI]`

## Tech Stack Lock

The following decisions are locked. Do not switch any of them without explicit user approval. New dependencies require justification in `docs/MEMO.md`.

- **Framework:** Vue 3 with Composition API and `<script setup>`. No Options API. No migration to React, Svelte, Solid, Next.js, Nuxt, or any other framework.
- **Build tool:** Vite. No swap to Webpack, Rollup-direct, Turbopack, or Parcel.
- **Test runner:** Vitest with happy-dom and @vue/test-utils. No Jest, no Playwright, no Cypress.
- **State:** Reactive store at `src/store/index.js`. No Pinia, no Vuex, no Redux, no Zustand.
- **Persistence:** `localStorage` via `usePersistence` composable. No IndexedDB, no remote backend, no auth service.
- **Speech recognition:** `vosk-browser` for word-level recognition, `@tensorflow-models/speech-commands` for phoneme detection. No swap to Web Speech API or cloud STT.
- **Lesson data:** Per-lesson JSON files at `src/data/ufli/lessons/lesson-{id}.json` loaded via dynamic `import()`. No SQLite, no remote CMS, no single megamodule.
- **Routing:** Manual page switching via `store.currentPage`. No `vue-router` (yet).
- **Styling:** Scoped CSS in SFCs. No CSS-in-JS, no Tailwind, no SCSS preprocessor.

## Code Conventions

- Vue SFCs use `<script setup>` exclusively
- Composables live in `src/composables/`, prefixed with `use`
- Test files live next to their source: `useFoo.js` → `useFoo.test.js`
- Components use PascalCase filenames; composables and utilities use camelCase
- Lesson IDs are zero-padded strings: `"001"`, `"045"`, `"035a"`. Never raw numbers in URLs or store fields.
- Use `getCumulativeWordList(lessonId)` to source words for games — never iterate lesson JSON directly from a game component

## Test Discipline

- Red/green TDD for the data layer, progression composable, and persistence — write the failing test first, run it to confirm it fails, then implement
- Do not skip or `.skip` failing tests; fix the root cause
- New step components get a smoke test (mount + minimal interaction + emit `step-complete`)
- No snapshot tests — write explicit assertions
- Mock `useEmber` and `useSpeechRecognition` in component tests; happy-dom can't run Web Audio

## Git Discipline

- Work for the UFLI integration lives on `feature/ufli-lessons`
- Commit after each logical task group (see `docs/TASK_LIST.md`)
- Do not amend committed work — create a new commit
- Do not force-push the feature branch without explicit user request
- Never push to `main` directly

## Files Not To Touch Without Asking

- `vite.config.js`, `vitest.config.js` — config changes can break the whole build
- `package.json` `dependencies` — new deps require justification
- `public/audio/phonemes/` — these are recorded assets, not generated
- `public/models/` — Vosk models, gitignored, large

## When in Doubt

- Read the relevant doc in `docs/` before improvising
- If a doc is wrong or stale, update it as part of the task
- If a decision isn't covered by any doc, ask before deciding
