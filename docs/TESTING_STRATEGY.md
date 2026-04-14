# Testing Strategy

## Testing Pyramid

This is a small client-only app. The pyramid is intentionally bottom-heavy:

- **~80% unit tests** — pure functions, composables, data loader
- **~20% component smoke tests** — mount + minimal interaction + emit
- **~0% end-to-end** — no Playwright/Cypress in scope; manual smoke tests serve as e2e

No snapshot tests. Snapshot tests rot fast on UI work and provide weak signal.

## Coverage Targets

| Layer | Target | Tool |
|---|---|---|
| Data loader (`ufliLessons.js`) | 100% line + branch | Vitest |
| Progression composable (`useUfliProgression.js`) | 100% line + branch | Vitest |
| Persistence (`usePersistence.js`) | 100% line for save/load round-trip | Vitest |
| Store (`store/index.js`) | Round-trip test for every persisted field | Vitest |
| New step components | Smoke test only (mount + emit `step-complete`) | Vitest + @vue/test-utils |
| Existing composables (`usePhonemeLogic`) | Already covered; do not regress | Vitest |
| Existing components (`Workshop`) | Already covered; do not regress | Vitest |
| Hub, map, lesson player | Manual smoke (no automated) | npm run dev |
| Game components | Manual smoke (no automated) | npm run dev |

## Test Categories

### Unit tests (the bulk of coverage)

- **Data loader tests** (`src/data/ufli/ufliLessons.test.js`)
  - Every ID in `ALL_UFLI_LESSON_IDS` loads without error
  - Loaded lessons have all 8 steps populated and non-empty
  - `getCumulativeWordList('001')` returns ≥ 1 word
  - `getCumulativeWordList('003')` includes words from lessons 1+2+3
  - Cumulative list is deduplicated by `word`
  - `lessonIdFromNumber(45) === '045'`
  - `lessonIdFromNumber('35a') === '035a'`
  - `lessonIdFromNumber('35A') === '035a'` (case insensitive)
  - Sub-lesson ordering: `ALL_UFLI_LESSON_IDS` places `'035a'` after `'034'` and before `'035b'`

- **Progression tests** (`src/composables/useUfliProgression.test.js`)
  - Lesson `'001'` is unlocked by default
  - Lesson `'002'` is locked until `'001'` is `lessonComplete`
  - `completeUfliLesson('001')` sets `lessonComplete: true` and awards +100 XP
  - Activities are locked while `lessonComplete` is false
  - `completeUfliActivity('001', 'speech')` awards +50 XP and sets the flag
  - Connected text card is locked until all 5 activities complete
  - `completeUfliConnectedText('001')` awards +75 XP
  - `getCumulativeLearnedLessonIds()` returns lessons with `lessonComplete: true` in canonical order
  - Status state machine: `locked → kindling → sparks → fire → complete`

- **Persistence tests** (`src/store/index.test.js`)
  - `ufliProgress` field saves and reloads correctly
  - XP, selected friend, and skill state continue to round-trip (no regression)

### Component smoke tests

For each new step component:
- `PhonemicAwarenessStep.test.js`
- `NewConceptStep.test.js`
- `IrregularWordsStep.test.js`
- `ConnectedTextStep.test.js`

Each test:
- Mocks `useEmber` and `useSpeechRecognition` (happy-dom can't run Web Audio)
- Mounts the component with minimal valid props from a fixture lesson
- Triggers the path that completes the step (skip mic, click Continue, etc.)
- Asserts the component emits `step-complete`

### Manual smoke tests (in `TASK_LIST.md` Group 10)

End-to-end paths verified by `npm run dev`:
- Lesson 001 unlocks → lesson plays → activities unlock → game uses cumulative words → connected text unlocks → next lesson unlocks
- Reload mid-progress; everything restores

## CI Integration

There is no CI pipeline configured for this project today. Tests run locally via `npm test`.

When CI is added (Phase 3), it should:
- Run `npm test` on every PR
- Block merge if any test fails
- Report bundle-size diff vs. base branch
- Optionally run `npm run build` to catch Vite errors

The test suite must finish in under 30 seconds (per `docs/PRD.md` performance targets) so it can run on every PR without friction.

## Requirement Coverage Matrix

| Requirement | Verified by |
|---|---|
| [MVP1] Data layer + 10 lessons | `src/data/ufli/ufliLessons.test.js` |
| [MVP2] Progression model | `src/composables/useUfliProgression.test.js` |
| [MVP3] Persistence | `src/store/index.test.js` (added cases) |
| [MVP4] 8 step components | `src/components/lesson-steps/*.test.js` (smoke tests) |
| [MVP5] UfliLessonHub | Manual smoke in TASK_LIST Group 5 |
| [MVP6] Campground map per-lesson | Manual smoke in TASK_LIST Group 6 |
| [MVP7] Games consume cumulative word list | Manual smoke in TASK_LIST Group 7 |
| [MVP8] Old curriculum deleted | `grep` check in TASK_LIST Group 8; full test pass |
| [MVP9] Full test suite green | `npm test` exits 0 |
| [MVP10] Manual end-to-end | TASK_LIST Group 10 checklist |
