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

### 2026-04-19 — [SPEECH] Lesson 3 /ă/ recognition always failed in VisualDrillStep

**Error:** In lesson 3's visual drill (review letters a, m, s), the /ă/ sound for the letter `a` always matched as "missed" regardless of what the child said. Lessons 1 and 2 worked fine.
**Context:** First usable review lesson after introducing UFLI lessons 002 onward.
**Root Cause:** `lesson-003.json` step2/step3 items used raw IPA `"æ"` for the short-a phoneme, where lesson 1 used UFLI notation `"/ă/"`. `normalizePhonemeKey('æ')` didn't resolve — `æ` has no entry in `directMap` and NFD decomposition does not split it into `a`+combining-mark — so every downstream lookup (`PHONEME_GRAMMARS`, `PHONEME_TRANSCRIPT_VARIANTS`, `EARLY_PHONEME_FALLBACKS`) missed. Lesson 2 looked the same but its single-item step2 was skipped by `isUfliLessonStepRenderable` (requires ≥2 items), so the bug hid until lesson 3.
**Fix:** (1) Normalized `"æ"`/`"ɪ"` in step2/step3 of lessons 002–005 (and 010) to bare letters `"a"`/`"i"`. (2) Extended `directMap` in [src/data/phonemeGrammars.js](src/data/phonemeGrammars.js) with IPA vowel variants (`æ`→`a`, `ɪ`→`i`, `ɛ`→`e`, `ɑ`→`o`, `ʌ`→`u`) as a safety net. (3) Added `'a'` to the transcript-bypass set in [src/composables/useSpeechRecognition.js](src/composables/useSpeechRecognition.js:550) so the audio-profile fallback can rescue an `a` target when the browser recognizer returns a confident-but-wrong transcript, matching the existing `'m'` bypass.
**Prevention:** The safety-net `directMap` now covers lowercase IPA vowels, so future lesson authoring in either `/ă/` or `æ` form lands on the same grammar key. If a new phoneme appears in lesson JSON, verify `normalizePhonemeKey` returns a key that exists in `PHONEME_GRAMMARS`.

### 2026-04-19 — [GAME] Cognito sign-in looped because backend returned 401 for unprovisioned users

**Error:** Cognito Hosted UI flow completed (`/oauth2/token` returned `200`) but app bootstrap calls (`/api/me`, `/api/account`, `/api/profiles`) returned `401`, so the UI fell back to "Sign-In Needed".
**Context:** Production auth validation after CloudFront/ALB routing fixes.
**Root Cause:** Backend validated Cognito id tokens but `IdentityProvisioningService` rejected first-time Cognito users as unprovisioned because auto-provisioning was not enabled in app bootstrap wiring.
**Fix:** Added explicit Cognito auto-provision configuration in backend (`COGNITO_AUTO_PROVISION`, default true for Cognito mode), wired `canAutoProvisionCognitoIdentity` in app bootstrap, and set `COGNITO_AUTO_PROVISION=true` in ECS task environment.
**Prevention:** Keep Cognito provisioning policy explicit in runtime config and align frontend sign-in UX with backend provisioning behavior.

### 2026-04-19 — [BUILD] Auth/API failed with `ERR_CERT_COMMON_NAME_INVALID` after ALB redirect

**Error:** Browser auth and API requests failed with `net::ERR_CERT_COMMON_NAME_INVALID` after `/api/*` requests were redirected to the ALB hostname.
**Context:** Production investigation after moving CloudFront API origin traffic to ALB HTTP to work around origin TLS validation failure.
**Root Cause:** ALB HTTP listener redirects to HTTPS; because the backend forward rule is on the HTTPS listener and CloudFront was hitting HTTP origin, responses exposed the ALB hostname (`*.elb.amazonaws.com`) while ALB served a non-matching certificate (`*.ds-gauntlet.link`).
**Fix:** Implemented dedicated ALB origin hostname and certificate wiring in Terraform: added `alb.readwithember.com` DNS record, created/validated a regional ACM cert for that hostname, attached it to the shared ALB HTTPS listener, and updated CloudFront backend origin to `https-only` against the custom ALB hostname.
**Prevention:** Keep HTTP listener redirect-only and ensure CloudFront HTTPS origins always use a hostname that matches a certificate installed on the origin listener.

### 2026-04-19 — [BUILD] CloudFront API origin returned 502 due to ALB certificate hostname mismatch

**Error:** `https://app.readwithember.com/api/health` returned CloudFront `502` while ECS and ALB target health were green.
**Context:** Production AWS investigation after backend task/image/runtime issues were mitigated.
**Root Cause:** CloudFront API origin was configured with `origin_protocol_policy = "https-only"` to an ALB DNS hostname, but the ALB certificate subject (`*.ds-gauntlet.link`) did not match the ALB host (`*.elb.amazonaws.com`). CloudFront TLS validation to the origin failed before request forwarding.
**Fix:** Switched CloudFront backend origin protocol policy to `http-only` in Terraform (`infra/frontend.tf`) so CloudFront reaches ALB over HTTP while keeping viewer traffic HTTPS.
**Prevention:** For CloudFront custom origins, only use HTTPS-to-origin when the origin certificate matches the origin domain; otherwise use HTTP-to-origin or a matching cert/domain pair.

### 2026-04-19 — [BUILD] Production API returned 502 due to missing ECR tag and RDS SSL mismatch

**Error:** `https://app.readwithember.com/api/health` returned CloudFront `502`, ECS events repeated `CannotPullContainerError ... ember-backend:f710aac not found`, and a startup task that did run logged `PostgresError: no pg_hba.conf entry ... no encryption`.
**Context:** Production deployment verification for backend on ECS/Fargate after wiring image and Terraform automation.
**Root Cause:** Two issues combined: (1) backend-image workflow tried to overwrite `latest` in an immutable ECR repo, causing workflow failure and drift between pushed images and Terraform deploy selection; (2) runtime secret `DATABASE_URL` did not require SSL even though RDS enforces SSL (`rds.force_ssl=1`).
**Fix:** Updated backend-image workflow to push only immutable SHA tags and verify the pushed digest; updated Terraform deploy workflow to resolve only real SHA tags from ECR before writing TF vars; updated infra secret generation to set `DATABASE_URL` with `?sslmode=require`.
**Prevention:** Keep deploy automation constrained to verifiable immutable image tags and make DB SSL requirements explicit in generated runtime secrets.

### 2026-04-16 — [BUILD] Frontend Docker build failed because `package-lock.json` is out of sync for `happy-dom`

**Error:** `npm ci` failed in the frontend Docker image build with `Invalid: lock file's happy-dom@20.8.9 does not satisfy happy-dom@20.9.0`.
**Context:** First end-to-end `docker compose up --build` validation for the new frontend/backend container workflow.
**Root Cause:** The repo's root `package.json` requires `happy-dom@^20.9.0`, but the committed `package-lock.json` still pins `20.8.9`, so strict clean installs inside Docker reject the lockfile.
**Fix:** Switched the frontend container install step from `npm ci` to `npm install` so the compose-based local workflow can boot against the current manifest state.
**Prevention:** Keep `package-lock.json` synchronized with `package.json` before relying on `npm ci` in reproducible container builds.

### 2026-04-15 — [BUILD] Backend integration tests could not reach the local Postgres container with default env

**Error:** `ECONNREFUSED 127.0.0.1:5432` and then `ECONNREFUSED 127.0.0.1:54329` while running the backend Postgres integration tests in `backend/`.
**Context:** Phase 12 backend event-ingestion validation using the existing Postgres-backed Bun test suite.
**Root Cause:** In this workspace, the shared Postgres container was reachable only via its Docker network IP and required an explicit password, so the backend's default localhost/no-password connection settings did not match the active test environment.
**Fix:** Used the container's runtime connection details (`DATABASE_HOST=<container-ip>`, `DATABASE_PASSWORD=postgres`) to reach the existing database for targeted validation.
**Prevention:** When running backend integration tests in this environment, verify the live container host, port, and credentials first instead of assuming the default local config.

### 2026-04-15 — [BUILD] Backend migration runner fails with `ERR_POSTGRES_CONNECTION_CLOSED`

**Error:** `PostgresError: Connection closed` with code `ERR_POSTGRES_CONNECTION_CLOSED` while running `DATABASE_URL=... bun run src/infrastructure/db/migrations/runMigrations.ts`.
**Context:** Phase 3 backend foundation validation against the local Postgres Docker container in `backend/`.
**Root Cause:** The backend DB adapter used Bun's built-in Postgres client. In this Linux arm64 environment, that client closed the connection immediately before even a trivial query could complete, so the migration runner never reached `001_init.sql`.
**Fix:** Replaced the Bun-specific DB wrapper with a minimal `postgres`-based adapter, kept the migration runner plain SQL, and verified the live migration run against the container.
**Prevention:** Validate the DB adapter with a real `select 1` against the target runtime before treating migration wiring as complete.

### 2026-04-13 — [AUDIO] Phoneme audio silent in UFLI step components

**Error:** `Uncaught (in promise) TypeError: can't access property Symbol.iterator, item.distractors is undefined` in `AuditoryDrillStep.vue:73`. Plus broader silence: no phoneme audio playing in any of the new UFLI step components.
**Context:** First end-to-end run of a UFLI lesson after task 8. User reported "I don't hear any sounds for the phonemes" while inside the lesson player.
**Root Cause:** Two bugs:
1. The legacy `VisualDrillStep` and `AuditoryDrillStep` components were reused but their input-shape expectations didn't match the UFLI step2/step3 schema. Visual drill expected `item.phonemeAudio` (a bare letter); UFLI provides `item.phonemes: ['/ă/']` (IPA notation). Auditory drill expected `item.distractors` (pre-computed); UFLI provides only `{phoneme, graphemes}` and expects distractors to be derived at runtime.
2. The new step components (`PhonemicAwarenessStep`, `NewConceptStep`, `IrregularWordsStep`, `ConnectedTextStep`, `WordWorkStep`, and `BlendingStep` UFLI mode) were built test-first for emit logic and never wired to the audio engine at all. They rendered text and a Next button but called nothing on `useEmber`.
**Fix:**
- Added `phonemeToAudioKey()` in `useEmber.js` that maps UFLI notation (`/ă/`, `/sh/`, etc.) to the audio-file key (`a`, `sh`). Strips slashes, maps short-vowel diacritics, normalizes combining marks. `playPhoneme()` now calls this normalizer before constructing the audio URL.
- Rewrote `VisualDrillStep` and `AuditoryDrillStep` to consume the UFLI shapes. Auditory drill now derives its distractor pool from all `graphemes` across the step's items.
- Added `useEmber` calls to all new step components: PhonemicAwareness plays each blend phoneme then speaks the word; NewConcept plays the grapheme's sound after each script line and speaks each read/spell word on tap; BlendingStep UFLI mode sounds out the current word on advance and plays each tile on tap; IrregularWords speaks each tricky word; ConnectedText speaks each sentence with a "Read to me" button.
**Prevention:** Component smoke tests verified `step-complete` emit but did not assert audio side effects (and can't easily, since happy-dom can't run Web Audio). Future check: when reusing a legacy component against a new data shape, write a "shape adapter" test that asserts the component reads the expected fields, even if the audio side effect is mocked.

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
