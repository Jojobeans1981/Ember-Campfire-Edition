# Architecture Memo — Ember Campfire Edition (UFLI Lessons)

## Project Summary

Ember Campfire Edition is a client-only Vue 3 phonics app for early readers. The current effort replaces the existing 13-unit campground curriculum with the full UFLI Foundations scope and sequence (128 lessons, each delivered through an 8-step instructional routine), while keeping the existing campfire aesthetic, mascot, audio engine, and games intact.

## Key Architecture Decisions

### 1. One UFLI lesson = one campground station (rejected: keep unit groupings)

The current model groups 2–3 phonemes per "unit" (`First Flames` = s, a, m). UFLI teaches one grapheme per lesson with its own full 8-step routine.

**Decision:** Each UFLI lesson becomes its own station. The 13 unit groupings are retired.

**Why over the alternative:** Keeping unit groupings would require either merging multiple UFLI lessons into one (loses fidelity) or nesting sub-lessons inside each unit hub (adds a confusing extra layer for a young user). One-lesson-per-station maps directly to the manifest, makes the "complete the skill → unlock games" mechanic obvious, and matches how UFLI is actually delivered in classrooms.

### 2. Lesson data as per-lesson JSON files with dynamic import (rejected: single big JS module, rejected: SQLite/remote CMS)

128 lessons of structured 8-step content is too much for one JS module — it would bloat the bundle and make individual lessons hard to author or diff.

**Decision:** Each lesson lives in `src/data/ufli/lessons/lesson-{id}.json`. Loaded on demand via Vite's dynamic `import()`.

**Why over the alternatives:**
- One big JS module: bundle bloat, every lesson loaded even if unused, painful to author/diff in PRs.
- SQLite (sql.js or similar): adds a heavy dependency and a query layer for data that has no relational shape.
- Remote CMS: would force this client-only app onto a backend; offline use breaks; not justified for static curriculum content.

JSON + dynamic import keeps the bundle small, makes each lesson a reviewable diff, and lets the loader cache lessons as it goes.

### 3. Cumulative word lists for games (rejected: lesson-only words)

After completing a lesson, the player gets games. Should those games use only the new lesson's words, or every word the student can decode so far?

**Decision:** Cumulative. Games use `getCumulativeWordList(lessonId)`, which returns all `wordList` entries from lesson 1 through the current lesson, deduplicated.

**Why over the alternative:** Lesson 1 teaches `a` — there are essentially zero words to play with. Even by lesson 5, lesson-only word pools are tiny and repetitive. Cumulative pools grow with the student, provide built-in review of earlier phonemes, and match how Orton-Gillingham programs typically structure independent practice.

### 4. Replace the old curriculum entirely on a feature branch (rejected: parallel modes, rejected: big-bang on main)

The old `curriculum.js`/`UNITS`/`UnitHub` system and the new UFLI system have different data shapes. They could coexist with a mode toggle, get migrated all-at-once, or get replaced layer-by-layer on a branch.

**Decision:** Layered migration on `feature/ufli-lessons`. Old curriculum is deleted as the new layer comes online. No mode toggle. Tests gate each layer.

**Why over the alternatives:**
- Parallel modes: doubles the surface area, hides bugs, and forces every consumer (`App.vue`, `Dashboard.vue`, persistence, games) to branch on mode. The user explicitly rejected this.
- Big-bang on main: nothing works until the whole thing is done; no incremental safety net.

A branch with tests at every layer keeps `main` shippable and gives clean review checkpoints.

### 5. Reuse what works, replace what doesn't, in the lesson player (rejected: rebuild all 8 step components from scratch)

The current `LessonPlayer` already has 6 step components, three of which (`VisualDrillStep`, `AuditoryDrillStep`, `BlendingStep`) line up almost exactly with UFLI steps 2, 3, and 4.

**Decision:**
- Reuse: `VisualDrillStep`, `AuditoryDrillStep`
- Upgrade: `BlendingStep` (data shape change), `WordReadingStep` → `WordWorkStep` (rename + behavior expansion)
- Refactor: `IntroStep` → `PhonemicAwarenessStep` (structured blend + segment, not narration)
- New: `NewConceptStep`, `IrregularWordsStep`, `ConnectedTextStep`
- Delete: `ReviewStep`, old `IntroStep`

**Why over rebuild-from-scratch:** Throwing away working components that already integrate with the mascot, mic, and audio composables would burn time for no pedagogical gain.

### 6. Test-first for data, progression, and persistence (rejected: write code first, test later)

The data layer (loader, cumulative word list, ID parsing) and progression rules (lock/unlock, XP, status) have well-defined inputs and outputs and are exactly the layers where regressions silently break the app.

**Decision:** Red/green TDD for `ufliLessons.test.js`, `useUfliProgression.test.js`, and persistence additions to `store/index.test.js`. Step components get smoke tests only (mount + emit `step-complete`).

**Why over the alternative:** Untested progression logic is how unlock bugs and persistence regressions ship. The data layer is also a content-correctness gate — tests catch malformed lesson JSON before the UI tries to render it.

## Processing Strategy

**Lesson playthrough flow:**

```
User taps station on CampgroundMap
  → store.activeLessonId = "001"
  → store.currentPage = 'unit-hub' (now UfliLessonHub)

UfliLessonHub mounts
  → Reads ufliProgress[lessonId]
  → Renders header (lesson #, grapheme, phoneme), spark tracker, lesson card, locked activity grid

User taps Lesson card
  → store.currentPage = 'lesson'
  → LessonPlayer mounts, calls getUfliLesson(lessonId) (dynamic JSON import)
  → Iterates lesson.step1..step8, mounts the matching step component for each
  → On final step-complete: completeUfliLesson(lessonId), award +100 XP, persist

Back to UfliLessonHub
  → Activity cards now unlocked
  → Tapping one: store.currentPage = 'activity', game pulls getCumulativeWordList(lessonId)
  → Game complete: completeUfliActivity(lessonId, type), +50 XP

After all 5 activities done
  → Connected Text card unlocks
  → Plays Step 8 standalone (or surfaces decodable passage)
  → completeUfliConnectedText(lessonId), +75 XP

Lesson "complete" status set
  → Next lesson station unlocks on the map
```

**Persistence flow:** `usePersistence.save()` is called after every progress mutation. It serializes `ufliProgress`, `xp`, `selectedFriend`, and `skillState` to a single localStorage key. `load()` runs on app boot and rehydrates the reactive store.

**Data-loading discipline:** No lesson is loaded eagerly. `getUfliLesson(id)` uses Vite dynamic import; the loader caches by ID so repeated calls within a session are O(1). `getCumulativeWordList` walks `ALL_UFLI_LESSON_IDS` up to and including the requested ID, ensuring sub-lessons (`035a`, `067b`) are ordered correctly via the canonical ID array.

## Known Failure Modes

| Failure | How it manifests | Mitigation |
|---|---|---|
| Lesson JSON missing or malformed | `getUfliLesson` returns `undefined`, lesson player crashes | Loader returns `undefined` on failure; data-layer tests assert every ID in `ALL_UFLI_LESSON_IDS` loads with all 8 steps populated |
| Cumulative word list grows unbounded as lessons advance | Game performance degrades, repeated words | Loader caches results; word list is deduplicated by `word`; games sample N words rather than iterating the full list |
| Sub-lesson IDs (`035a`–`041c`, `067a`–`067b`) order incorrectly | Cumulative word list returns wrong words; "lesson 36 unlocks" gates fire at wrong time | `ALL_UFLI_LESSON_IDS` is the single source of truth for ordering. Tests cover sub-lesson sequencing explicitly. |
| Persistence schema drifts (renaming `unitProgress` → `ufliProgress`) | Old saves load into wrong shape, students lose progress | This branch is destructive on purpose — old saves are not migrated. Documented in PRD scope boundaries. Future schema changes should add migration logic in `usePersistence.load()`. |
| Vosk model fails to load on slow connections | Speech-recognition steps hang | `useSpeechRecognition` already has a skip button; user can advance past mic prompts. No regression. |
| Audio file missing for a phoneme that a new lesson introduces | `ember.playPhoneme()` fails silently | `public/audio/phonemes/` already covers the 26 letters; lessons 1–10 will use only existing files. Future digraph/vowel-team lessons need new audio (out of MVP scope). |
| Bundle size grows from 128 JSON files | Slow initial load | Dynamic `import()` ensures only the active lesson is in the chunk graph. Bundle-size check is part of acceptance criteria. |
| Test suite times out from cold-loading every lesson | CI flakes | Data-layer test loads in parallel via `Promise.all`; budget < 30s in performance targets |
