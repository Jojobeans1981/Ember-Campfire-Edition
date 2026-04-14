# Product Requirements Document — Ember Campfire Edition (UFLI Lessons)

## Overview

Ember Campfire Edition is a Vue 3 phonics game for early readers (ages 5–8, including dyslexic learners). This PRD covers replacing the current 13-unit campground curriculum with the full UFLI Foundations scope and sequence: 128 individual lessons, each delivered through UFLI's fixed 8-step instructional routine, with games unlocked per lesson and word lists drawn cumulatively from all completed lessons.

## Problem Statement

The existing curriculum groups multiple phonemes into themed campground "units," each with a single shared lesson. This deviates from research-backed structured-literacy practice, where each grapheme is taught individually through an 8-step routine (phonemic awareness, visual drill, auditory drill, blending, new concept, word work, irregular words, connected text). Without this fidelity, the app cannot serve as a real reading-instruction tool — it's closer to a phonics-themed game than an Orton-Gillingham program.

The user has UFLI's lesson manifest (`lesson-manifest.json`) and JSON schema (`lesson-types.ts`). The app needs a data layer, lesson player, and progression model that match this structure.

## Target Users

**Primary:** Children ages 5–8 learning to read, including those with dyslexia. They use the app at home, supervised by a parent or guardian, in 10–20 minute sessions.

**Secondary:** Parents and guardians who need a structured, low-friction way to support a child's reading instruction without becoming reading specialists themselves. They benefit from progress that persists across sessions and from a sequence they can trust matches what classroom programs use.

## MVP Requirements

- [ ] **[MVP1]** Data layer: 128 lesson JSON files conforming to the `UfliLesson` schema, plus a loader (`getUfliLesson`, `getCumulativeWordList`, `ALL_UFLI_LESSON_IDS`) with red/green tests. Initial scope: lessons 001–010 authored; loader ready to accept the rest.
- [ ] **[MVP2]** Progression model: lesson N unlocks when N-1 is complete; activities lock until lesson complete; connected text locks until activities complete; XP awarded per milestone. Backed by `useUfliProgression` composable with red/green tests.
- [ ] **[MVP3]** Persistence: `ufliProgress` saves and reloads from localStorage alongside XP, selected friend, and skill state. Test coverage in `store/index.test.js`.
- [ ] **[MVP4]** Lesson player rendering all 8 UFLI step types: PhonemicAwarenessStep, VisualDrillStep, AuditoryDrillStep, BlendingStep, NewConceptStep, WordWorkStep, IrregularWordsStep, ConnectedTextStep. Each new component has a smoke test.
- [ ] **[MVP5]** Lesson hub (`UfliLessonHub.vue`): header with lesson number/grapheme/phoneme, 7-spark tracker (1 lesson + 5 activities + 1 connected text), lesson button, 5 activity cards, connected-text card.
- [ ] **[MVP6]** Campground map: one station per UFLI lesson, grouped visually into zones by lesson number range. `MapStation` reads from `ufliProgress`.
- [ ] **[MVP7]** Games consume `getCumulativeWordList(activeLessonId)` instead of the old `getDecodableWords` / `WORD_BANK`. No structural changes to the games themselves.
- [ ] **[MVP8]** Old curriculum removed: `curriculum.js`, `lessons.js`, `wordLists.js`, `UnitHub.vue`, `ReviewStep.vue`, `IntroStep.vue` deleted from the branch.
- [ ] **[MVP9]** Full test suite (`npm test`) exits 0 with all suites green, including new tests for the loader, progression, and persistence. No regressions in existing tests (`store/index.test.js`, `usePhonemeLogic.test.js`, `Workshop.test.js`).
- [ ] **[MVP10]** App boots via `npm run dev`: campground map shows available lessons, clicking lesson 001 plays its 8 steps, completing it unlocks activities, games consume cumulative words, persistence survives reload.

## Final Submission Features

**Content authoring**
- Lesson JSON files for lessons 011–128 (the data layer accepts them; only the content needs to be authored).
- A teacher/author tool to edit lesson JSON without touching code.

**Audio**
- Recorded grapheme audio for any phonemes beyond what `public/audio/phonemes/` already provides (digraphs, vowel teams, etc.).

**Pedagogy polish**
- Spaced repetition surfacing previously taught lessons that need review.
- Per-child profile tracking error patterns for adaptive review.

**Accessibility**
- Screen-reader support for all step components.
- Adjustable font sizes and dyslexia-friendly font option.

**Telemetry**
- Anonymous progress analytics to inform curriculum adjustments.

## Performance Targets

| Metric | Target |
|---|---|
| Lesson JSON load time (single lesson) | < 100 ms |
| Cold app boot to campground map interactive | < 2 s |
| Lesson player step transition | < 150 ms |
| Game word list lookup (`getCumulativeWordList`) | < 10 ms after first call (cached) |
| Bundle size (initial JS) | No regression vs. current `main` |
| Test suite total runtime | < 30 s |

## Scope Boundaries

**In scope**
- Data layer for all 128 lessons (loader, schema enforcement, cumulative word list).
- Authored lesson content for lessons 001–010.
- Progression and persistence rewrite.
- Lesson player + 8 step components (3 reused, 2 upgraded, 1 refactored, 3 new, 2 deleted).
- Hub and map rewrite to be lesson-per-station.
- Games re-pointed to cumulative word list.
- Red/green test coverage for data, progression, persistence, and step component smoke tests.
- Deletion of old curriculum files.

**Out of scope**
- Authoring lessons 011–128 (the data layer accepts them; content is deferred).
- A teacher-facing lesson editor.
- New audio recordings for digraphs, vowel teams, etc.
- Speech recognition, mascot, or audio engine changes.
- Accessibility audit, i18n, telemetry, analytics.
- Backend/server work — this is a fully client-side app.
