# UFLI Lessons Integration Design

**Date:** 2026-04-13  
**Branch:** `feature/ufli-lessons`  
**Status:** Approved

## Overview

Replace the current unit-grouped phoneme system with the full UFLI Foundations scope and sequence (128 lessons). Each UFLI lesson corresponds to one campground station. Completing a lesson's 8 steps unlocks 5 games using the cumulative word list up to that lesson.

## Section 1 — Data Layer

### New files
- `src/data/ufli/lessons/lesson-001.json` through `lesson-128.json` — one file per UFLI lesson, following the `UfliLesson` schema from `lesson-types.ts`
- `src/data/ufli/ufliLessons.js` — dynamic loader, exports:
  - `getUfliLesson(id)` — async, loads from JSON
  - `getUfliLessonSync(id)` — sync, cache only
  - `ALL_UFLI_LESSON_IDS` — ordered array of all lesson ID strings
  - `getCumulativeWordList(lessonId)` — returns all `wordList` entries from lessons 1 through `lessonId`
- `src/data/ufli/ufliLessons.test.js` — red/green tests for loader and word list
- `src/data/ufli/ufliCurriculum.js` — exports `UFLI_LESSONS_META` (manifest array) and `getLessonMeta(id)`

### Lesson ID format
- Numeric lessons: zero-padded 3-digit strings (`"001"`–`"128"`)
- Sub-lessons: number + letter suffix (`"035a"`, `"067b"`)

### Removed
- `src/data/curriculum.js` — replaced by `ufliCurriculum.js`
- `src/data/lessons.js` — replaced by `ufliLessons.js`
- `src/data/wordLists.js` — word lists now live inside each lesson JSON

## Section 2 — Progression & Store

### Store change
Add `ufliProgress: {}` to `store` in `src/store/index.js`. Keyed by lesson ID string.

Each entry:
```js
{
  lessonComplete: false,
  activitiesComplete: { speech: false, match: false, blend: false, build: false, sentence: false },
  connectedTextRead: false
}
```

Remove `unitProgress` from store.

### New composable: `src/composables/useUfliProgression.js`
- `getUfliLessonStatus(lessonId)` → `locked | kindling | sparks | fire | complete`
- `isUfliLessonUnlocked(lessonId)` — lesson N unlocks when lesson N-1 is complete (lesson 1 always unlocked)
- `completeUfliLesson(lessonId)` — marks complete, +100 XP
- `completeUfliActivity(lessonId, activityType)` — marks done, +50 XP
- `completeUfliConnectedText(lessonId)` — marks done, +75 XP
- `getCumulativeLearnedLessonIds()` — all lessons where `lessonComplete: true`

### Tests: `src/composables/useUfliProgression.test.js`
- Lesson 1 unlocked by default
- Lesson 2 locked until lesson 1 complete
- `completeUfliLesson` awards XP, sets flag
- Activities locked until lesson complete
- `getCumulativeLearnedLessonIds` returns correct set

### Persistence
`usePersistence.js` saves/loads `ufliProgress` instead of `unitProgress`.

## Section 3 — Campground Map & Hub

### Map
- `CampgroundMap.vue` renders one station per UFLI lesson
- Stations grouped visually into zones by lesson number range (consonants, short vowels, digraphs, etc.)
- `store.activeUnitId` → `store.activeLessonId` (string, e.g. `"001"`) — update all references in `App.vue`, `Dashboard.vue`, `CampgroundMap.vue`, `MapStation.vue`

### Hub
- `UnitHub.vue` → replaced by `UfliLessonHub.vue`
- Header: lesson number, grapheme badge, phoneme notation
- Spark tracker: 7 dots (1 lesson + 5 activities + 1 connected text)
- Lesson button → 8-step UFLI lesson player
- 5 activity cards (same types: speech, match, blend, build, sentence) — locked until lesson complete
- Connected Text card replaces Story card — unlocks after all 5 activities complete

### LessonPlayer
- Loads from `getUfliLesson()` via `store.activeLessonId`
- Maps 8 UFLI step types to step components

## Section 4 — Lesson Step Components

### Reused as-is
- `VisualDrillStep.vue` — UFLI step 2
- `AuditoryDrillStep.vue` — UFLI step 3

### Upgraded
- `BlendingStep.vue` — accepts `step4.wordChain` and `step4.tiles`; tile columns show initial/medial/final
- `WordReadingStep.vue` → **`WordWorkStep.vue`** — handles `step6` word chains, optional word sort, optional word meaning

### Refactored
- `IntroStep.vue` → **`PhonemicAwarenessStep.vue`** — structured blend + segment tasks from `step1`
  - Blend: hear phonemes one at a time → say blended word
  - Segment: hear word → tap out / say each phoneme

### New components
- `NewConceptStep.vue` — step 5: grapheme card, articulation script, I do / we do / you do read+spell with mic
- `IrregularWordsStep.vue` — step 7: each word shown with regular/irregular grapheme highlighting, student reads aloud
- `ConnectedTextStep.vue` — step 8: decodable sentences one at a time, student reads aloud

### Deleted
- `ReviewStep.vue`
- `IntroStep.vue`

### Step type → component map
| Step | Component |
|------|-----------|
| step1 | PhonemicAwarenessStep |
| step2 | VisualDrillStep |
| step3 | AuditoryDrillStep |
| step4 | BlendingStep (upgraded) |
| step5 | NewConceptStep |
| step6 | WordWorkStep |
| step7 | IrregularWordsStep |
| step8 | ConnectedTextStep |

## Section 5 — Testing Strategy

All tests written red first, then implementation makes them green.

### Data layer (`src/data/ufli/ufliLessons.test.js`)
- Every ID in `ALL_UFLI_LESSON_IDS` loads without error
- Each loaded lesson has all 8 steps non-empty
- `getCumulativeWordList('003')` includes words from lessons 1+2+3
- `getCumulativeWordList('001')` returns ≥ 1 word
- `lessonIdFromNumber(45)` → `"045"`
- `lessonIdFromNumber('35a')` → `"035a"`

### Progression (`src/composables/useUfliProgression.test.js`)
- Lesson `"001"` is unlocked by default
- Lesson `"002"` is locked until lesson `"001"` complete
- `completeUfliLesson` awards +100 XP and sets `lessonComplete: true`
- Activities locked until `lessonComplete`
- `getCumulativeLearnedLessonIds` returns correct set after multiple completions

### Persistence (added to `src/store/index.test.js`)
- `ufliProgress` saves and reloads correctly via `usePersistence`

### Component smoke tests (one per new step component)
- Mounts without error given minimal valid props
- Emits `step-complete` after interaction or timeout

## Build order

1. Data layer + tests (red → green)
2. Progression + store + tests (red → green)
3. Persistence update + tests (red → green)
4. `UfliLessonHub` + map changes
5. `LessonPlayer` wired to UFLI data
6. Step components: PhonemicAwareness, NewConcept, IrregularWords, ConnectedText (new)
7. Step components: BlendingStep upgrade, WordWorkStep rename/upgrade
8. Delete old files (curriculum.js, lessons.js, UnitHub.vue, ReviewStep.vue, IntroStep.vue)
9. Games wired to `getCumulativeWordList`
10. Full test run green
