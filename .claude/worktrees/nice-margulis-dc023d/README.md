# Ember Campfire Edition

A client-only Vue 3 phonics game for early readers (ages 5–8, including dyslexic learners), built around the [UFLI Foundations](https://ufli.education.ufl.edu/foundations/) scope and sequence. Children progress through 128 lessons on a campground map, each delivered via UFLI's research-backed 8-step routine and followed by games that draw from the cumulative set of words the child can decode.

Everything runs in the browser. No backend, no accounts, no network calls at runtime. Lesson content ships as JSON, progress persists to `localStorage`, and speech is recognized on-device with Vosk and TensorFlow.js.

## Features

- **128 UFLI lessons** delivered one grapheme at a time through the full 8-step routine: phonemic awareness, visual drill, auditory drill, blending, new concept, word work, irregular words, connected text.
- **Campground map** where each station is a lesson; stations unlock sequentially as the child completes the previous lesson's full cycle.
- **Five activity games** per lesson (letter match, word builder, blending, sentence reader, and more) that pull from `getCumulativeWordList(lessonId)` so the child is always practicing on decodable words they've already learned.
- **On-device speech recognition** via `vosk-browser` for word-level reading and `@tensorflow-models/speech-commands` for phoneme detection.
- **Offline-friendly persistence** — lesson progress, XP, and selected guardian character round-trip through `localStorage` via the `usePersistence` composable.
- **Pre-baked TTS audio** for teacher lines (stored in `public/audio/tts/`) plus recorded phoneme assets (`public/audio/phonemes/`).

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Build tool | Vite 6 |
| Test runner | Vitest + happy-dom + `@vue/test-utils` |
| State | Reactive store at `src/store/index.js` (no Pinia/Vuex) |
| Persistence | `localStorage` via `usePersistence` composable |
| Speech recognition | `vosk-browser` (words) + `@tensorflow-models/speech-commands` (phonemes) |
| Lesson data | Per-lesson JSON files loaded via dynamic `import()` |
| Styling | Scoped CSS in SFCs |

These decisions are locked — see `CLAUDE.md` and `docs/TECH_STACK.md` before proposing changes.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A modern Chromium-based browser (for Web Audio + Vosk). Safari is not officially supported.
- Microphone access for speech-driven activities.

### Install

```bash
npm install
```

### Download the Vosk speech model

The Vosk model is gitignored because of its size (~40 MB). Fetch it once before first run:

```bash
npm run setup:vosk-model
```

This downloads `vosk-model-small-en-us-0.15` into `public/models/`.

### Run the dev server

```bash
npm run dev
```

Opens at http://localhost:5173.

### Build for production

```bash
npm run build
```

### Run tests

```bash
npm test
```

Vitest runs the data-layer, progression, persistence, and component smoke tests.

## Project Structure

```
src/
  components/           Vue SFCs
    activities/         Five post-lesson game components
    steps/              The 8 UFLI step components used by LessonPlayer
  composables/          useEmber, useSpeechRecognition, useUfliProgression, usePersistence, ...
  data/
    ufli/
      lessons/          lesson-001.json ... lesson-128.json (MVP authors 001–010)
      ufliLessons.js    Loader: getUfliLesson, getCumulativeWordList, ALL_UFLI_LESSON_IDS
  store/
    index.js            Reactive store (activeLessonId, ufliProgress, xp, friend, ...)
public/
  audio/
    phonemes/           Recorded grapheme audio (not generated)
    tts/                Pre-baked teacher-line TTS audio
  models/               Vosk model (gitignored; run setup:vosk-model)
  assets/friends/       Guardian character art
scripts/
  download-vosk-model.mjs
  prebake-teacher-lines.mjs
docs/                   PRD, tech stack, memo, task list, testing strategy, user flow, error log
```

## How a Lesson Plays

1. Child opens the app → campground map shows lesson 001 unlocked, others locked.
2. Tap a station → `UfliLessonHub` shows the grapheme, phoneme, a 7-spark tracker, and the lesson card.
3. Tap "Lesson" → `LessonPlayer` walks through the 8 UFLI steps (~10–15 min).
4. Completing the lesson unlocks the 5 activity cards on the hub; each activity awards XP and lights a spark.
5. After all 5 activities, the connected-text card unlocks — the child reads a decodable passage aloud.
6. Finishing connected text completes the lesson, awards XP, and unlocks the next station on the map.

Progress persists between sessions. The child can pause at any step boundary and resume later.

## Adding or Editing Lessons

Each lesson is a JSON file at `src/data/ufli/lessons/lesson-{id}.json` conforming to the `UfliLesson` schema. Lesson IDs are zero-padded strings (`"001"`, `"045"`, `"035a"`). The loader picks up new files automatically through dynamic `import()`.

Games should never iterate lesson JSON directly — always source words via `getCumulativeWordList(lessonId)` so the cumulative review behavior is preserved.

## Documentation

- `docs/PRD.md` — what we're building and MVP requirements
- `docs/TECH_STACK.md` — locked technology decisions and architecture diagram
- `docs/MEMO.md` — architecture decisions and rationale
- `docs/USER_FLOW.md` — end-to-end user journey
- `docs/TASK_LIST.md` — phased work breakdown
- `docs/TESTING_STRATEGY.md` — test conventions
- `docs/ERROR_FIX_LOG.md` — known issues and gotchas
- `CLAUDE.md` — guardrails for AI assistants working on this repo

## Contributing

Please read `CLAUDE.md` before making changes. Key rules:

- Red/green TDD for the data layer, progression composable, and persistence.
- New step components get a smoke test (mount + minimal interaction + emit `step-complete`).
- Vue SFCs use `<script setup>` exclusively.
- Composables live in `src/composables/` and are prefixed with `use`.
- Don't commit `.env`, `public/models/`, or anything under `public/audio/phonemes/source/`.
- UFLI integration work lives on `feature/ufli-lessons`; never push directly to `main`.

## License

TBD.
