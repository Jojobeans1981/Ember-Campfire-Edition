# Technology Stack

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (client only)                    │
│                                                              │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │  Vue 3 SFC │──▶│ Reactive store│◀─▶│  localStorage    │   │
│  │ components │   │ (src/store)   │   │  (persistence)   │   │
│  └─────┬──────┘   └───────┬──────┘   └──────────────────┘   │
│        │                  │                                  │
│        ▼                  ▼                                  │
│  ┌──────────────┐   ┌──────────────────────┐                 │
│  │ Composables  │   │ Dynamic JSON imports │                 │
│  │ (mic, speech,│   │ src/data/ufli/lessons│                 │
│  │  ember, etc.)│   │ /lesson-{id}.json    │                 │
│  └──────┬───────┘   └──────────────────────┘                 │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────┐             │
│  │ Web Audio API + Vosk (vosk-browser) +        │             │
│  │ TensorFlow.js Speech Commands                │             │
│  │ — phoneme + word recognition                 │             │
│  └─────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
              public/audio/phonemes/*.mp3
              public/assets/friends/*.png
              public/models/ (Vosk model, gitignored)
```

No backend. No database. No external API calls at runtime. All lesson content, audio, and progress stay on the client.

## Stack Decisions

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) | ^3.5.13 | Already in place; small footprint; SFCs match the existing component style |
| Build tool | Vite | ^6.0.7 | Already in place; fast HMR; native ESM; supports dynamic JSON imports for per-lesson loading |
| Test runner | Vitest | ^2.1.8 | Already in place; integrates with Vite config; same syntax as Jest |
| Test environment | happy-dom | ^20.8.9 | Already in place; faster than jsdom for component smoke tests |
| Component testing | @vue/test-utils | ^2.4.6 | Already in place; canonical for Vue 3 |
| State management | Reactive store (`src/store/index.js`) | n/a | Already in place; no need for Pinia/Vuex at this scale |
| Persistence | `localStorage` via `usePersistence` composable | n/a | Already in place; client-only app, no server |
| Speech recognition | `vosk-browser` + custom `useSpeechRecognition` | ^0.0.8 | Already integrated for phoneme evaluation |
| Audio analysis | Web Audio API + `@tensorflow-models/speech-commands` | ^0.5.4 | Already integrated for mic input and phoneme detection |
| Icons | `lucide-vue-next` | ^1.0.0 | Already in place |
| Celebration FX | `canvas-confetti` | ^1.9.4 | Already in place |
| Embeddings/NLP (deferred) | `@xenova/transformers` | ^2.17.2 | Already in dependencies; not exercised in MVP scope |
| Lesson data format | JSON files per lesson, dynamic `import()` | n/a | Bundle stays small; only the active lesson is loaded into memory |

**Locked decisions** (do not switch without explicit user approval):
- Vue 3 + Vite + Vitest. No migration to React, Svelte, Next.js, Nuxt, or other frameworks.
- localStorage for persistence. No IndexedDB, no remote backend.
- Vosk for word-level speech recognition. No swap to Web Speech API or cloud STT.
- JSON files for lesson data. No SQLite, no remote CMS.
- Composition API + `<script setup>`. No Options API, no `defineComponent`.

## Key Dependencies

**Frontend (runtime)**
- `vue` ^3.5.13
- `@tensorflow/tfjs` ^4.22.0 + `@tensorflow/tfjs-core`, `tfjs-data`, `tfjs-layers`
- `@tensorflow-models/speech-commands` ^0.5.4
- `vosk-browser` ^0.0.8
- `@xenova/transformers` ^2.17.2 (deferred — not used in MVP)
- `canvas-confetti` ^1.9.4
- `lucide-vue-next` ^1.0.0

**Build / dev**
- `vite` ^6.0.7
- `@vitejs/plugin-vue` ^5.2.1
- `@vue/compiler-sfc` ^3.5.13

**Test**
- `vitest` ^2.1.8
- `@vue/test-utils` ^2.4.6
- `happy-dom` ^20.8.9

**Tooling shims**
- `buffer`, `process` — Node polyfills for Vosk in browser
- `dotenv` ^17.4.2 — used by build/scripts only

## Environment Variables

The runtime app does not read any environment variables. `dotenv` is only used by build scripts (e.g. `scripts/`) and is not required to run or test the app.

```bash
# .env (gitignored — create locally if running scripts that need it)
# No runtime env vars required by the Vue app itself.
# Add script-specific vars here if your build/scripts need them.
```
