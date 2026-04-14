# UFLI Lessons Integration — Product Requirements Document

**Date:** 2026-04-13
**Owner:** Xian
**Branch:** `feature/ufli-lessons`
**Related design:** [2026-04-13-ufli-lessons-design.md](./2026-04-13-ufli-lessons-design.md)

---

## 1. Background

Ember Campfire Edition is a Vue 3 phonics game built on an Orton-Gillingham foundation. The current curriculum groups 26 phonemes into 13 themed campground "units," each containing a single shared lesson followed by 5 activities and a story.

The UFLI Foundations program — a research-backed, structured-literacy scope and sequence used in elementary classrooms — provides a far more rigorous progression: 128 individual lessons, each teaching one grapheme/concept through a fixed 8-step instructional routine. The user has shared the full UFLI manifest (`lesson-manifest.json`) and JSON schema (`lesson-types.ts`).

This PRD covers replacing the existing curriculum with the UFLI scope and sequence end-to-end.

## 2. Goals

1. **Curriculum fidelity:** The student progresses through the same 128 lessons UFLI prescribes, in the same order, using the same 8-step instructional routine per lesson.
2. **One letter, one lesson:** Each UFLI lesson is its own campground station. Completing a lesson unlocks games and a connected-text reading for that lesson.
3. **Cumulative practice:** Games after each lesson draw from every word the student can decode so far — not just the current lesson's words — to provide review and variety.
4. **Confidence-by-test:** All progression and data-loading logic has red/green test coverage. The full test suite passes when the work is done.

## 3. Non-Goals

- We are **not** authoring lesson content from a UFLI source-of-truth (PDF, spreadsheet). Lesson JSON is generated programmatically from the manifest plus phonics knowledge.
- We are **not** keeping the old curriculum running in parallel. The campground-themed unit groupings are being retired.
- We are **not** adding teacher-mode features beyond what already exists in `Dashboard.vue`.
- We are **not** redesigning the speech recognition, mascot, or audio layers — they get reused as-is.
- We are **not** building all 128 lesson JSON files in this first cut. Initial scope: lessons 1–10 (covering the existing demo phonemes), with the data layer ready to accept the rest.

## 4. Users & Use Cases

**Primary user:** A child (likely ages 5–8, possibly with dyslexia) using the app at home, supervised by a parent or guardian.

**Use case 1 — first-time learner:** Child opens app, sees the campground map, taps the only unlocked station (lesson 001 — letter `a`). They go through 8 steps: hear blends/segments, see the grapheme card, hear the sound, pick the grapheme, blend tiles into words, learn the new concept with read+spell practice, read irregular words, and read connected sentences. The lesson station fills with sparks. Activity cards unlock. They play one or two games. The next station unlocks.

**Use case 2 — review session:** Child has completed lessons 1–5. They open the app, tap any unlocked station, and play games using cumulative words from all 5 lessons.

**Use case 3 — picking up tomorrow:** Progress persists in localStorage. Child returns the next day, sees their unlocked stations and earned sparks intact.

## 5. Functional Requirements

### 5.1 Data layer
- All lesson content lives in `src/data/ufli/lessons/lesson-{id}.json`, where `{id}` matches `ALL_UFLI_LESSON_IDS` ordering (`"001"`–`"128"` plus sub-lessons like `"035a"`).
- Each lesson JSON conforms to the `UfliLesson` schema documented in `lesson-types.ts`: 8 populated step objects, a `wordList`, a `lessonNumber`, a `title`, a `grapheme`, and a `phoneme`.
- A loader (`src/data/ufli/ufliLessons.js`) provides `getUfliLesson(id)` (async), `getUfliLessonSync(id)` (cache-only), `ALL_UFLI_LESSON_IDS`, and `getCumulativeWordList(lessonId)`.
- `getCumulativeWordList(lessonId)` returns all `wordList` entries from lesson 1 through `lessonId`, deduplicated.
- The old files `src/data/curriculum.js`, `src/data/lessons.js`, and `src/data/wordLists.js` are deleted.

### 5.2 Progression
- Lesson `"001"` is unlocked by default. Lesson N unlocks when lesson N-1 is `lessonComplete`.
- Each lesson tracks: `lessonComplete`, `activitiesComplete` (5 activity types: speech, match, blend, build, sentence), and `connectedTextRead`.
- Activity cards on the lesson hub are locked until `lessonComplete: true`.
- The Connected Text card unlocks once all 5 activities are complete.
- XP rewards: lesson complete = +100, activity = +50, connected text = +75.
- Status states: `locked | kindling (unlocked, lesson incomplete) | sparks (lesson done, activities incomplete) | fire (activities done, text unread) | complete`.

### 5.3 Lesson player & step components
- `LessonPlayer.vue` accepts a lesson ID, loads the lesson, and renders 8 step components in order.
- Reused as-is: `VisualDrillStep.vue` (step 2), `AuditoryDrillStep.vue` (step 3).
- Upgraded: `BlendingStep.vue` (step 4 — accepts `wordChain` + `tiles`), `WordReadingStep.vue` → `WordWorkStep.vue` (step 6 — handles word chains, optional sort, optional meaning).
- Refactored: `IntroStep.vue` → `PhonemicAwarenessStep.vue` (step 1 — structured blend + segment tasks).
- New: `NewConceptStep.vue` (step 5), `IrregularWordsStep.vue` (step 7), `ConnectedTextStep.vue` (step 8).
- Deleted: `ReviewStep.vue`, `IntroStep.vue`.

### 5.4 Hub & map
- `UnitHub.vue` → `UfliLessonHub.vue`. Header shows lesson number, grapheme badge, phoneme. Spark tracker keeps the 7-dot pattern (1 lesson + 5 activities + 1 connected text).
- `CampgroundMap.vue` renders one station per UFLI lesson, grouped visually into zones by lesson number range.
- `MapStation.vue` accepts a lesson (not a unit) and reads progress from `ufliProgress`.
- Store: `store.activeUnitId` → `store.activeLessonId` (string). All consumer files (`App.vue`, `Dashboard.vue`, etc.) updated.

### 5.5 Games
- All five activity components consume `getCumulativeWordList(store.activeLessonId)` instead of `getDecodableWords(...)`.
- No structural changes to the games themselves — only the word source.

### 5.6 Persistence
- `usePersistence.js` saves and loads `ufliProgress` instead of `unitProgress`. XP, selected friend, and skill state continue to persist.

## 6. Acceptance Criteria

A reviewer can verify the work is done by checking:

1. **Branch:** Work lives on `feature/ufli-lessons`.
2. **Tests:** `npm test` runs and exits 0 with all suites green, including new tests for the UFLI loader, progression, and persistence.
3. **Initial lessons exist:** `src/data/ufli/lessons/lesson-001.json` through `lesson-010.json` exist and conform to the schema (all 8 steps populated, non-empty `wordList`).
4. **Loader works:** `getUfliLesson("001")` returns a lesson; `getCumulativeWordList("003")` returns words from lessons 1+2+3 deduplicated; `lessonIdFromNumber(45) === "045"`; `lessonIdFromNumber("35a") === "035a"`.
5. **Progression works:** Lesson 1 unlocked by default; lesson 2 locked until lesson 1 complete; activities locked until lesson complete; connected text locked until all activities complete; XP awarded correctly.
6. **App runs:** `npm run dev` boots, the campground map shows one station per available UFLI lesson, clicking lesson 001 plays its 8 steps, completing the lesson unlocks its activities, the games consume cumulative words, persistence survives a reload.
7. **Old files gone:** `curriculum.js`, `lessons.js`, `wordLists.js`, `UnitHub.vue`, `ReviewStep.vue`, `IntroStep.vue` are deleted from the branch.
8. **No regressions:** Existing passing tests (`store/index.test.js`, `usePhonemeLogic.test.js`, `Workshop.test.js`) still pass.

## 7. Out of Scope (deferred)

- Authoring lessons 11–128 — the data layer accepts them, but content generation is left for follow-up.
- A teacher-facing tool to author/edit lessons.
- Audio recordings for new graphemes beyond what `public/audio/phonemes/` already provides.
- A11y audit, i18n, analytics, telemetry.

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Generated lesson content drifts from real UFLI material | Mark generated lessons as such in the JSON `source` field; flag for human review before content shipping |
| Deleting the old curriculum breaks features we forgot about | Run the full test suite after each deletion task; keep the design doc's build order |
| 128 lesson files would bloat the bundle | Loader uses dynamic `import()` per lesson — only the active lesson is loaded into memory |
| Sub-lesson IDs (`035a`–`041c`) break cumulative ordering | `ALL_UFLI_LESSON_IDS` is the single source of truth for ordering; tests cover sub-lesson sequencing |

## 9. Open Questions

None at this time. The design has been reviewed and approved.

---

**Next step:** Implementation plan at `docs/superpowers/plans/2026-04-13-ufli-lessons.md` (to be written by the writing-plans skill).
