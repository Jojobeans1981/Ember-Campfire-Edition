# User Flow

## Primary Flow

```
┌─────────────────────────┐
│   App boot (cold)       │  ~2 s target
│                         │
│   usePersistence.load() │
│   restores ufliProgress │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Selection screen      │  if no friend selected
│   "Choose a Guardian"   │  ~5–10 s
└───────────┬─────────────┘
            │ tap a friend
            ▼
┌─────────────────────────┐
│   Campground Map        │  one station per UFLI
│                         │  lesson, grouped into
│                         │  zones by lesson range
└───────────┬─────────────┘
            │ tap unlocked station (lesson "001")
            ▼
┌─────────────────────────┐
│   UfliLessonHub         │  shows lesson #, grapheme,
│                         │  phoneme, 7-spark tracker,
│                         │  lesson card, locked games,
│                         │  locked connected text
└───────────┬─────────────┘
            │ tap "Lesson"
            ▼
┌─────────────────────────────────────────────────────┐
│   LessonPlayer — 8 steps, ~10–15 min total          │
│                                                     │
│   step1 PhonemicAwareness (blend + segment)  ~90s   │
│   step2 VisualDrill (grapheme → say sound)   ~60s   │
│   step3 AuditoryDrill (sound → pick gr.)     ~60s   │
│   step4 BlendingDrill (tile word chain)      ~90s   │
│   step5 NewConcept (teach + I/We/You do)     ~3min  │
│   step6 WordWork (chain, sort, meaning)      ~2min  │
│   step7 IrregularWords (read tricky words)   ~1min  │
│   step8 ConnectedText (decodable sentences)  ~2min  │
│                                                     │
│   Each step emits step-complete → player advances   │
└───────────┬─────────────────────────────────────────┘
            │ final step done
            ▼
┌─────────────────────────┐
│  completeUfliLesson     │  +100 XP
│  Persist                │  spark 1 lit
└───────────┬─────────────┘
            │ return to hub
            ▼
┌─────────────────────────┐
│   UfliLessonHub         │  5 activity cards
│   (post-lesson)         │  unlocked
└───────────┬─────────────┘
            │ tap any activity (≥1, all 5 needed for next gate)
            ▼
┌─────────────────────────┐
│   ActivityPlayer        │  game uses
│   speech / match /      │  getCumulativeWordList(
│   blend / build /       │      activeLessonId)
│   sentence              │  ~2–3 min each
└───────────┬─────────────┘
            │ game complete
            ▼
┌─────────────────────────┐
│  completeUfliActivity   │  +50 XP per activity
│  Persist                │  spark lit
└───────────┬─────────────┘
            │ all 5 activities done
            ▼
┌─────────────────────────┐
│   Connected Text card   │  unlocks
│   on hub                │
└───────────┬─────────────┘
            │ tap
            ▼
┌─────────────────────────┐
│  Decodable passage      │  ~2 min
│  read aloud, mic        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  completeUfliConnected  │  +75 XP, spark 7 lit
│  Text                   │  Lesson now "complete"
│  Next lesson station    │
│  unlocks on map         │
└─────────────────────────┘
```

A typical session for one lesson is ~15–20 minutes for a focused child, longer if they explore multiple games. Sessions can be paused at any step boundary — progress persists.

## API Endpoints

This is a fully client-side app. There are no API endpoints. All data — lesson content, audio files, progress — is served as static files or held in `localStorage`.

The closest equivalents are the in-app data accessors:

| Accessor | Returns | Used by |
|---|---|---|
| `getUfliLesson(lessonId)` | `Promise<UfliLesson \| undefined>` | `LessonPlayer` |
| `getUfliLessonSync(lessonId)` | `UfliLesson \| undefined` (cached only) | `UfliLessonHub` (post-load) |
| `ALL_UFLI_LESSON_IDS` | `string[]` (canonical ordering) | `CampgroundMap`, progression composable |
| `getCumulativeWordList(lessonId)` | `Array<{word, phonemes}>` deduped | All five game components |
| `lessonIdFromNumber(n)` | `string` (e.g. `45 → "045"`, `"35a" → "035a"`) | Loader, store, navigation |
| `useUfliProgression().getUfliLessonStatus(id)` | `'locked'\|'kindling'\|'sparks'\|'fire'\|'complete'` | `MapStation`, `UfliLessonHub` |
| `useUfliProgression().isUfliLessonUnlocked(id)` | `boolean` | `CampgroundMap` |
| `useUfliProgression().completeUfliLesson(id)` | void (mutates store, persists) | `LessonPlayer` |
| `useUfliProgression().completeUfliActivity(id, type)` | void | Game components |
| `useUfliProgression().completeUfliConnectedText(id)` | void | Connected text card |

## Example Queries

| User intent | What the app does | Expected result |
|---|---|---|
| "I want to start the first lesson" | Map shows lesson 001 unlocked, all others locked | Tapping lesson 001 opens the hub for letter `a`; lessons 2–128 show a lock icon |
| "I finished the lesson; what's next?" | Hub re-renders, activity cards lose `locked` class | All 5 activity icons become tappable; story/connected-text card stays locked |
| "I want to play a blending game using words I already know" | Game pulls `getCumulativeWordList(currentLessonId)` | Returns deduplicated words from lessons 1 → current; if on lesson 5, includes words from lessons 1–5 |
| "I closed the app; will I lose my progress?" | `usePersistence.save` ran after every milestone | On reload, ufliProgress and XP are restored exactly |
| "I tapped the second lesson but it's locked" | `isUfliLessonUnlocked('002')` returns `false` because lesson 1 not complete | Station shows lock icon; tap is a no-op |
| "I want to read a story" | Connected Text card replaces old Story card | Card shows `locked` until all 5 activities complete; then plays step 8 of the lesson |
| "I want to switch which character is my Guardian" | (unchanged from current app) | Selection screen reachable via existing nav |
