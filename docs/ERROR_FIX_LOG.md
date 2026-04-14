# Error & Fix Log

Log significant errors and their fixes here. Build failures, runtime errors, anything that took more than five minutes to diagnose. Skip typos and linter warnings.

## Template

```markdown
### YYYY-MM-DD — [CATEGORY] One-line summary

**Error:** Exact error message or symptom
**Context:** What you were doing when it happened (file, command, feature)
**Root Cause:** What was actually wrong
**Fix:** What you changed to resolve it
**Prevention:** How to avoid this in the future (test added, doc updated, lint rule, etc.)
```

Categories: `[BUILD]`, `[VITE]`, `[VUE]`, `[VITEST]`, `[AUDIO]`, `[SPEECH]`, `[STORE]`, `[PERSISTENCE]`, `[LESSON-DATA]`, `[GAME]`, `[UI]`

## Log

*No errors logged yet.*

## Common Issues to Watch For

### Vue 3 + `<script setup>`
- **Reactivity loss when destructuring** — Destructuring a reactive object loses reactivity. Use `toRefs()` or access via the parent reference. Example: `const { xp } = store` is broken; use `store.xp` directly or `const { xp } = toRefs(store)`.
- **`defineProps` / `defineEmits` are macros** — They are not imports. Don't `import { defineProps } from 'vue'` — Vite/Vue 3.5 will warn or error depending on version.
- **Lifecycle hooks must be called synchronously in `setup`** — Calling `onMounted` from inside an `await` block silently no-ops.

### Vite
- **Dynamic JSON imports need exact path strings (no full template variables)** — `import(\`./lessons/${id}.json\`)` works only when the variable is constrained to a literal-friendly shape. If lessons fail to load, check that Vite's glob analysis can see the path pattern at build time.
- **HMR breaks on circular imports between `store` and composables** — If you see "TypeError: Cannot read properties of undefined" after a hot reload but a full refresh fixes it, look for circular dependencies between `src/store/` and `src/composables/`.
- **Polyfills for Node-like globals** — Vosk/Tensorflow code paths sometimes reference `Buffer` or `process`. The project already has `buffer` and `process` shims in `package.json`. If a new dependency complains about `Buffer is not defined`, add a Vite `define` rather than a runtime polyfill.

### Vitest + happy-dom
- **`document` and `window` exist but `MediaStream` does not** — happy-dom doesn't implement Web Audio. Tests that touch `useMicAnalysis` or `useSpeechRecognition` must mock those composables.
- **Async `onMounted` in component tests** — `mount()` returns before async `onMounted` finishes. Use `await flushPromises()` from `@vue/test-utils` before asserting.
- **`vi.useFakeTimers()` doesn't advance promises** — Combine with `await vi.runAllTimersAsync()` or step manually.

### Audio + speech recognition
- **`AudioContext` requires user gesture** — Browsers block audio playback before the first user click. The campfire interaction unlocks it; tests should not rely on real audio.
- **Phoneme audio file naming mismatch** — `public/audio/phonemes/` uses files like `m-phoneme.mp3`, not `m.mp3`. The `useEmber` composable handles the mapping; new code should not hardcode filenames.
- **Vosk model file lives in `public/models/`** — Gitignored. Missing model is the most common cause of a hung "Listening..." indicator on a fresh checkout.

### Lesson data layer (UFLI)
- **Sub-lesson IDs do not sort lexicographically** — `"035a"` comes after `"035"`, not before. Always use `ALL_UFLI_LESSON_IDS` as the source of truth for ordering, not `Array.sort()`.
- **`getCumulativeWordList` returning duplicates** — Multiple lessons may share words. The loader deduplicates by `word`. If a game shows the same word twice, check the dedup set, not the lesson JSON.
- **Lesson JSON missing a step** — The schema requires all 8 steps populated. Data-layer tests assert this. If a test fails with "step5 is undefined," the lesson JSON is incomplete, not the player.

### Persistence
- **Renaming `unitProgress` → `ufliProgress` is destructive** — Old saves do not migrate. Document this in user-facing release notes; in dev, clear `localStorage` between branch switches.
- **localStorage quota errors** — Unlikely with 128 lessons, but if `usePersistence.save` starts throwing `QuotaExceededError`, prune `skillState` first (it's the largest field).

### Tests
- **Snapshot tests are not used** — If you find yourself reaching for `toMatchSnapshot`, write an explicit assertion instead. Snapshots rot fast on UI work.
- **Test files live next to source** — `usePhonemeLogic.test.js` sits next to `usePhonemeLogic.js`. Follow this pattern; do not create a top-level `tests/` directory.
