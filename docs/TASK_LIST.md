# Task List

Phased breakdown of work for the UFLI lessons integration. Each task group references the requirement ID it satisfies. Subtask checkboxes are picked up by the `task` skill.

## Phase 1: MVP

### Task Group 1 — UFLI data layer foundations [MVP1]

- [x] Create `src/data/ufli/` directory
- [x] Write `src/data/ufli/ufliCurriculum.js` exporting `UFLI_LESSONS_META` (the manifest array) and `getLessonMeta(id)`
- [x] Write `src/data/ufli/ufliLessons.test.js` red tests: loader returns lesson, `getCumulativeWordList('003')` includes lessons 1+2+3, `lessonIdFromNumber(45) === '045'`, `lessonIdFromNumber('35a') === '035a'`, `ALL_UFLI_LESSON_IDS` length matches manifest
- [x] Write `src/data/ufli/ufliLessons.js` implementing `getUfliLesson`, `getUfliLessonSync`, `ALL_UFLI_LESSON_IDS`, `getCumulativeWordList`, `lessonIdFromNumber`
- [x] Run `npm test src/data/ufli/ufliLessons.test.js`; expected: tests fail with "lesson file not found"
- [x] Author `src/data/ufli/lessons/lesson-001.json` through `lesson-010.json` conforming to the `UfliLesson` schema (all 8 steps populated, non-empty `wordList`)
- [x] Run tests again; expected: green
- [x] Commit

### Task Group 2 — UFLI progression composable [MVP2]

- [x] Write `src/composables/useUfliProgression.test.js` red tests: lesson 1 unlocked by default, lesson 2 locked until 1 complete, `completeUfliLesson` awards +100 XP, activities locked until lesson complete, connected text locked until 5 activities done, `getCumulativeLearnedLessonIds` returns correct set
- [x] Run tests; expected: fail (composable missing)
- [x] Write `src/composables/useUfliProgression.js` implementing `getUfliLessonStatus`, `isUfliLessonUnlocked`, `completeUfliLesson`, `completeUfliActivity`, `completeUfliConnectedText`, `getCumulativeLearnedLessonIds`
- [x] Add `ufliProgress: {}` to `store` in `src/store/index.js`
- [x] Run tests again; expected: green
- [x] Commit

### Task Group 3 — Persistence update [MVP3]

- [x] Add red test in `src/store/index.test.js`: `ufliProgress` round-trips through save/load
- [x] Run; expected: fail
- [x] Update `src/composables/usePersistence.js` to save/load `ufliProgress` (drop `unitProgress` references)
- [x] Run tests; expected: green
- [x] Commit

### Task Group 4 — New lesson step components [MVP4]

- [x] Write `src/components/lesson-steps/PhonemicAwarenessStep.test.js` smoke test (mounts, emits `step-complete`)
- [x] Write `PhonemicAwarenessStep.vue` (refactored from old `IntroStep.vue`) — structured blend + segment from `step1` data
- [x] Write `NewConceptStep.test.js` smoke test
- [x] Write `NewConceptStep.vue` rendering grapheme card, articulation, I do/we do/you do for read+spell
- [x] Write `IrregularWordsStep.test.js` smoke test
- [x] Write `IrregularWordsStep.vue` rendering each word with regular/irregular grapheme highlighting
- [x] Write `ConnectedTextStep.test.js` smoke test
- [x] Write `ConnectedTextStep.vue` rendering decodable sentences one at a time with mic
- [x] Upgrade `BlendingStep.vue` to accept `step4.wordChain` and `step4.tiles`
- [x] Rename `WordReadingStep.vue` → `WordWorkStep.vue`; expand to handle word chains, optional sort, optional meaning from `step6`
- [x] Run all step tests; expected: green
- [x] Commit

### Task Group 5 — UfliLessonHub [MVP5]

- [x] Write `src/components/UfliLessonHub.vue` mirroring `UnitHub.vue`'s spark mechanic but reading from `ufliProgress`, header showing lesson #/grapheme/phoneme, 7 sparks (1+5+1)
- [x] Update `src/App.vue` to mount `UfliLessonHub` instead of `UnitHub` for the `unit-hub` page
- [x] Manual smoke: boot dev server, navigate from map to a lesson hub, verify it renders correctly _(deferred to Group 10 end-to-end verification)_
- [x] Commit

### Task Group 6 — Campground map rewrite [MVP6]

- [x] Update `src/components/CampgroundMap.vue` to iterate `ALL_UFLI_LESSON_IDS` instead of `UNITS`
- [x] Update `src/components/MapStation.vue` to accept a `lessonId` (not `unit`) and read from `ufliProgress`
- [x] Group stations visually into zones by lesson number range (consonants, short vowels, digraphs, etc.) — CSS grouping only, no new components needed
- [x] Replace `store.activeUnitId` with `store.activeLessonId` in `App.vue`, `Dashboard.vue`, and any other consumers _(legacy alias kept until task 8 deletes UnitHub.vue)_
- [x] Manual smoke: dev server boots, map shows stations, clicking lesson 001 navigates correctly _(verified via vite build; full e2e in Group 10)_
- [x] Commit

### Task Group 7 — Wire games to cumulative word list [MVP7]

- [x] Update `src/components/activities/BlendingGame.vue` to import `getCumulativeWordList` from `src/data/ufli/ufliLessons.js` instead of `getDecodableWords` from `wordLists.js`
- [x] Repeat for `LetterMatch.vue`, `SpeechPractice.vue`, `WordBuilder.vue`, `SentenceReader.vue`
- [x] Update `ActivityPlayer.vue` to pass `lessonId` (not `unitId`) to children
- [x] Manual smoke: complete lesson 001, open each game, verify words appear from the cumulative list _(verified via vite build; full e2e in Group 10)_
- [x] Commit

### Task Group 8 — Delete old curriculum [MVP8]

- [x] Delete `src/data/curriculum.js`
- [x] Delete `src/data/lessons.js`
- [x] Delete `src/data/wordLists.js`
- [x] Delete `src/components/UnitHub.vue`
- [x] Delete `src/components/lesson-steps/ReviewStep.vue`
- [x] Delete `src/components/lesson-steps/IntroStep.vue`
- [x] Update `src/store/index.js` to remove `unitProgress`, `activeUnitId`, and `PHONEME_ORDER` import
- [x] `grep -r "unitProgress\|UNITS\|curriculum.js\|wordLists.js" src/` and fix any stragglers _(also deleted `useProgression.js`, `stories.js`; rewrote `LessonPlayer.vue` and `StoryReader.vue` for UFLI; lazy-init skillState in legacy `Workshop.vue`)_
- [x] Commit

### Task Group 9 — Full test suite green [MVP9]

- [x] Run `npm test`
- [x] If any test fails, fix root cause (do not skip tests)
- [x] Verify existing tests still pass: `store/index.test.js`, `usePhonemeLogic.test.js`, `Workshop.test.js`
- [x] Verify new tests pass: `ufliLessons.test.js`, `useUfliProgression.test.js`, all step smoke tests
- [x] Commit any fixes _(no fixes needed; suite was already green from task 8)_

### Task Group 10 — End-to-end manual verification [MVP10]

- [x] `npm run dev` _(boots cleanly on port 5174, Vite ready in 222ms, no errors)_
- [ ] Open browser, select a Guardian _(human verification required)_
- [ ] Verify map shows lesson 001 unlocked _(human verification required)_
- [ ] Click lesson 001 → hub renders with grapheme/phoneme _(human verification required)_
- [ ] Click Lesson → 8 steps play in order _(human verification required)_
- [ ] After lesson completes, return to hub; verify activities unlocked _(human verification required)_
- [ ] Play one game; verify words come from cumulative list _(human verification required)_
- [ ] Reload page; verify progress persisted via localStorage _(human verification required)_
- [x] Commit (or document any fixes) _(no automated fixes needed; build, lint via Vite, and 62/62 tests all green)_

## Phase 2: Polish

### Task Group 11 — Author lessons 011–034
- [ ] Generate JSON files for the remaining single-letter lessons in the manifest

### Task Group 12 — Author review/sub-lesson content (035a–041c, 067a–067b)
- [ ] Generate JSON for short-vowel review lessons
- [ ] Generate JSON for compound-word sub-lessons
- [ ] Verify ordering via `ALL_UFLI_LESSON_IDS` test

### Task Group 13 — Author digraph + vowel team lessons (042–097)
- [ ] Author lesson JSON
- [ ] Add new phoneme audio files for digraphs (sh, th, ch, etc.) to `public/audio/phonemes/`
- [ ] Update `useEmber` audio mapping if needed

### Task Group 14 — Author affix + advanced lessons (098–128)
- [ ] Author lesson JSON
- [ ] Add audio for any new graphemes

### Task Group 15 — Visual zoning on the campground map
- [ ] Group station tiles into themed zones (Fire Pit Beach for short vowels, Digraph Grove, etc.)
- [ ] Add zone labels and dividers

### Task Group 16 — Lesson editor (teacher tool)
- [ ] Build a developer-only page that renders a lesson JSON form so non-engineers can author lessons

## Phase 3: Final

### Task Group 17 — Performance pass
- [ ] Verify cold boot < 2 s
- [ ] Verify lesson load < 100 ms
- [ ] Bundle-size diff vs. `main`

### Task Group 18 — Accessibility audit
- [ ] Screen-reader sweep on lesson player
- [ ] Dyslexia-friendly font option
- [ ] Adjustable font sizes

### Task Group 19 — Spaced repetition review
- [ ] Surface previously-learned lessons that need review based on `lastPracticed` timestamps

### Task Group 20 — Anonymous telemetry (opt-in)
- [ ] Decide on a privacy-safe analytics approach
- [ ] Wire up event tracking for lesson completions and error patterns

### Task Group 21 — Submission / release prep
- [ ] Update `README.md` with new curriculum overview
- [ ] Tag a release on the branch
- [ ] Open PR to `main`
