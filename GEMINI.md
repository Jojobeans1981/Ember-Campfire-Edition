# Project Overview: Fantasy Reader

**Fantasy Reader** is an interactive web-based phonics and reading application designed for children. It features a "fantasy campground" theme where users select a "Guardian" and visit different locations (buildings) to practice literacy skills through sound recognition and interactive games.

## Core Technologies
- **Framework:** Vue 3 (Composition API with `<script setup>`)
- **Build Tool:** Vite
- **State Management:** Simple reactive store via `src/store/index.js`
- **Audio Processing:** `AudioContext` API and TensorFlow.js (Speech Commands) for phoneme recognition.
- **Styling:** Custom CSS with a "Stellar/Deep Space" theme.

## Architecture
- `src/App.vue`: Root component managing top-level page routing (Selection vs. Campground).
- `src/components/buildings/`: Contains modular mini-games/activities.
  - `Campfire.vue`: Phonics practice using microphone input.
  - `Workshop.vue`: Drag-and-drop phoneme matching game.
- `src/composables/`: Reusable logic for microphone analysis and phoneme configuration.
- `src/store/`: Centralized state for user progress (XP), selected character, and navigation.

## Building and Running
- **Development:** `npm run dev` (Runs the Vite dev server)
- **Production Build:** `npm run build` (Outputs to `dist/`)
- **Testing:** No formal testing framework detected. TODO: Implement unit tests for composables.

## Development Conventions
1. **Component Structure:** Use Vue 3 SFCs with `<script setup>`.
2. **State:** Access global state through the `store` object imported from `@/store`.
3. **Assets:**
   - Character icons are stored in `public/assets/friends/`.
   - Audio files are stored in `public/audio/phonemes/`.
4. **Naming:** Components follow PascalCase (e.g., `Campfire.vue`), and variables follow camelCase.

## Known Issues / TODOs
- **Phoneme Recognition:** The `speechCommands` implementation in `Campfire.vue` relies on a global `speechCommands` object which may need explicit dependency management.
- **Asset Paths:** Some audio file references in `Campfire.vue` (e.g., `m.mp3`) might mismatch actual filenames in `public/audio/phonemes/` (e.g., `m-phoneme.mp3`).
- **Scalability:** The current routing is handled by a simple `v-if` in `App.vue`; consider `vue-router` if the map expands.
