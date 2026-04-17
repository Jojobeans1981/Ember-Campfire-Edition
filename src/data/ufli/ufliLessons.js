/**
 * UFLI lesson loader.
 *
 * Lessons live as JSON files at ./lessons/lesson-{id}.json and are bundled
 * into a lookup map so both async callers and sync progression helpers can
 * read the same authored lesson data consistently.
 */

import { UFLI_LESSONS_META } from './ufliCurriculum.js';

/** Build the canonical ordered list of lesson IDs from the manifest. */
function buildAllLessonIds() {
  return UFLI_LESSONS_META.map((m) => lessonIdFromNumber(m.lessonNumber));
}

/**
 * Normalize a lesson identifier (number or string) to its canonical
 * zero-padded string form. Sub-lesson suffixes (a/b/c) are preserved
 * and lowercased.
 */
export function lessonIdFromNumber(n) {
  if (typeof n === 'number') {
    return String(n).padStart(3, '0');
  }
  const trimmed = String(n).trim().toLowerCase();
  const match = trimmed.match(/^(\d+)([a-z]?)$/);
  if (!match) return trimmed;
  const [, digits, suffix] = match;
  return `${String(parseInt(digits, 10)).padStart(3, '0')}${suffix}`;
}

/** All lesson IDs in curriculum order. */
export const ALL_UFLI_LESSON_IDS = buildAllLessonIds();

const lessonCache = new Map();
const bundledLessonModules = import.meta.glob('./lessons/lesson-*.json', { eager: true });
const bundledLessons = new Map(
  Object.entries(bundledLessonModules)
    .map(([path, mod]) => {
      const match = path.match(/lesson-(.+)\.json$/);
      if (!match) return null;
      return [match[1], mod.default ?? mod];
    })
    .filter(Boolean),
);

function getBundledLessonData(lessonId) {
  const id = lessonIdFromNumber(lessonId);
  return lessonCache.get(id) ?? bundledLessons.get(id);
}

/** Test helper — clears the in-memory lesson cache between tests. */
export function _clearLessonCache() {
  lessonCache.clear();
}

/**
 * Load a lesson by id (number or string).
 * Returns undefined if the lesson JSON file does not exist.
 */
export async function getUfliLesson(lessonId) {
  const id = lessonIdFromNumber(lessonId);
  if (lessonCache.has(id)) {
    return lessonCache.get(id);
  }
  const bundled = bundledLessons.get(id);
  if (bundled) {
    lessonCache.set(id, bundled);
    return bundled;
  }
  return undefined;
}

/**
 * Synchronous lesson getter. Only returns a lesson if it has already been
 * loaded via getUfliLesson() in this session. Returns undefined otherwise.
 */
export function getUfliLessonSync(lessonId) {
  const id = lessonIdFromNumber(lessonId);
  return lessonCache.get(id);
}

/**
 * Walk cumulative lesson JSON and collect the best-available
 * decomposition for each word — both phoneme (sound) and grapheme
 * (spelling unit) arrays.
 *
 * Sources (earliest definition wins):
 *   - step1.blend[]   — phonemes only (graphemes fall back to letter-split)
 *   - step1.segment[] — phonemes only
 *   - step7.teach[]   — phonemes + graphemes (via breakdown[])
 *   - step7.review[]  — phonemes + graphemes (via breakdown[])
 *
 * Keys are lowercase words. Values: { phonemes: string[], graphemes: string[] | null }.
 * When graphemes is null, callers should fall back to letter-split.
 */
async function buildCumulativeWordDecompositionMap(targetIndex) {
  const map = new Map();
  const record = (word, phonemes, graphemes) => {
    if (!word) return;
    const key = String(word).toLowerCase();
    if (map.has(key)) return;
    const p = Array.isArray(phonemes) && phonemes.length ? phonemes.slice() : null;
    const g = Array.isArray(graphemes) && graphemes.length ? graphemes.slice() : null;
    if (!p && !g) return;
    map.set(key, { phonemes: p, graphemes: g });
  };

  for (let i = 0; i <= targetIndex; i++) {
    const id = ALL_UFLI_LESSON_IDS[i];
    const lesson = await getUfliLesson(id);
    if (!lesson) continue;

    for (const item of lesson.step1?.blend ?? []) {
      record(item?.word, item?.phonemes, null);
    }
    for (const item of lesson.step1?.segment ?? []) {
      record(item?.word, item?.phonemes, null);
    }
    for (const bucket of ['teach', 'review']) {
      for (const entry of lesson.step7?.[bucket] ?? []) {
        const pieces = entry?.breakdown ?? [];
        const phonemes = pieces.map((b) => b?.phoneme).filter(Boolean);
        const graphemes = pieces.map((b) => b?.grapheme).filter(Boolean);
        record(entry?.word, phonemes, graphemes);
      }
    }
  }
  return map;
}

function buildCumulativeWordDecompositionMapSync(targetIndex) {
  const map = new Map();
  const record = (word, phonemes, graphemes) => {
    if (!word) return;
    const key = String(word).toLowerCase();
    if (map.has(key)) return;
    const p = Array.isArray(phonemes) && phonemes.length ? phonemes.slice() : null;
    const g = Array.isArray(graphemes) && graphemes.length ? graphemes.slice() : null;
    if (!p && !g) return;
    map.set(key, { phonemes: p, graphemes: g });
  };

  for (let i = 0; i <= targetIndex; i++) {
    const id = ALL_UFLI_LESSON_IDS[i];
    const lesson = getBundledLessonData(id);
    if (!lesson) continue;

    for (const item of lesson.step1?.blend ?? []) {
      record(item?.word, item?.phonemes, null);
    }
    for (const item of lesson.step1?.segment ?? []) {
      record(item?.word, item?.phonemes, null);
    }
    for (const bucket of ['teach', 'review']) {
      for (const entry of lesson.step7?.[bucket] ?? []) {
        const pieces = entry?.breakdown ?? [];
        const phonemes = pieces.map((b) => b?.phoneme).filter(Boolean);
        const graphemes = pieces.map((b) => b?.grapheme).filter(Boolean);
        record(entry?.word, phonemes, graphemes);
      }
    }
  }
  return map;
}

/**
 * Returns decodable word objects for use in games:
 *   { word, phonemes: string[], graphemes: string[] }
 *
 * - `phonemes` are sound units (IPA slash notation when authored, e.g.
 *   ["/ă/", "/t/"] for "at" or ["/ð/", "/ə/"] for "the"). Used by
 *   blending/audio game logic.
 * - `graphemes` are spelling units the child taps (e.g. ["th", "e"] for
 *   "the", ["c", "a", "t"] for "cat"). Used by WordBuilder slot/letter-
 *   bank rendering. Multi-char tiles like "th" render atomically.
 *
 * When curriculum JSON doesn't provide a decomposition, both arrays
 * fall back to the letter-split of the word so early CVC lessons still
 * work without authoring full breakdowns.
 */
export async function getCumulativeDecodableWords(lessonId) {
  const targetId = lessonIdFromNumber(lessonId);
  const targetIndex = ALL_UFLI_LESSON_IDS.indexOf(targetId);
  if (targetIndex < 0) return [];

  const words = await getCumulativeWordList(targetId);
  const decomp = await buildCumulativeWordDecompositionMap(targetIndex);

  return words.map((word) => {
    const key = String(word).toLowerCase();
    const entry = decomp.get(key) ?? null;
    const letterSplit = key.split('');
    return {
      word,
      phonemes: entry?.phonemes ?? letterSplit,
      graphemes: entry?.graphemes ?? letterSplit,
    };
  });
}

/**
 * Returns every `step8.readSentences` entry across lessons 1..lessonId,
 * deduplicated, preserving curriculum order. Use this for reading-
 * practice activities (SentenceReader) so the child reads authored
 * decodable sentences rather than random word joins.
 *
 * Returns [] if no sentences are authored yet — callers should then
 * auto-complete or hide the activity.
 */
export async function getCumulativeReadSentences(lessonId) {
  const targetId = lessonIdFromNumber(lessonId);
  const targetIndex = ALL_UFLI_LESSON_IDS.indexOf(targetId);
  if (targetIndex < 0) return [];

  const seen = new Set();
  const out = [];
  for (let i = 0; i <= targetIndex; i++) {
    const id = ALL_UFLI_LESSON_IDS[i];
    const lesson = await getUfliLesson(id);
    const list = lesson?.step8?.readSentences;
    if (!Array.isArray(list)) continue;
    for (const s of list) {
      const text = String(s ?? '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

export function getCumulativeReadSentencesSync(lessonId) {
  const targetId = lessonIdFromNumber(lessonId);
  const targetIndex = ALL_UFLI_LESSON_IDS.indexOf(targetId);
  if (targetIndex < 0) return [];

  const seen = new Set();
  const out = [];
  for (let i = 0; i <= targetIndex; i++) {
    const id = ALL_UFLI_LESSON_IDS[i];
    const lesson = getBundledLessonData(id);
    const list = lesson?.step8?.readSentences;
    if (!Array.isArray(list)) continue;
    for (const s of list) {
      const text = String(s ?? '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

/**
 * Returns the unique letter set decodable up to and including `lessonId`.
 * Drawn from the cumulative word list, not the manifest grapheme field,
 * so it stays accurate as new lesson JSON is authored.
 *
 * Prefer `getCumulativeIntroducedGraphemes` for UI that should reflect
 * only pedagogically-introduced letters. This helper is kept for callers
 * that genuinely want every letter present in the cumulative word list.
 */
export async function getCumulativeLetters(lessonId) {
  const words = await getCumulativeWordList(lessonId);
  const letters = new Set();
  for (const w of words) {
    for (const ch of w.toLowerCase()) {
      if (/[a-z]/.test(ch)) letters.add(ch);
    }
  }
  return Array.from(letters);
}

/**
 * Parse a UFLI_LESSONS_META.grapheme field into its individual grapheme
 * tokens. "a, i" → ["a","i"]; "ff, ll, ss, zz" → ["ff","ll","ss","zz"];
 * "" → []. Case-normalized to lowercase.
 */
function splitGraphemeField(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the cumulative set of graphemes a child has been formally
 * introduced to up to and including `lessonId`. Sourced from
 * `UFLI_LESSONS_META[i].grapheme` (canonical "what this lesson teaches"),
 * NOT from letters extracted out of cumulative word lists.
 *
 * Multi-grapheme entries like "a, i" or "ff, ll, ss, zz" are split on
 * commas and trimmed. Empty entries (review/practice lessons) contribute
 * nothing. Digraphs like "sh", "th", "ck" are preserved as multi-char
 * entries so callers can render them atomically.
 *
 * Use this for `target` picks in drill activities so the child is only
 * tested on sounds they've been taught. For DISTRACTOR variety early on,
 * pair this with `getUpcomingGraphemes`.
 */
export function getCumulativeIntroducedGraphemes(lessonId) {
  const targetId = lessonIdFromNumber(lessonId);
  const targetIndex = ALL_UFLI_LESSON_IDS.indexOf(targetId);
  if (targetIndex < 0) return [];

  const seen = new Set();
  const out = [];
  for (let i = 0; i <= targetIndex; i++) {
    for (const g of splitGraphemeField(UFLI_LESSONS_META[i]?.grapheme)) {
      if (seen.has(g)) continue;
      seen.add(g);
      out.push(g);
    }
  }
  return out;
}

/**
 * Returns graphemes from the next `limit` lessons AFTER `lessonId` —
 * useful for padding match/drill distractor pools on early lessons
 * where too few graphemes have been introduced to fill a round.
 *
 * Only returns graphemes that are NOT already in the introduced-through-
 * `lessonId` set, so callers can safely mix with the introduced set
 * without duplicates. Order follows curriculum sequence.
 */
export function getUpcomingGraphemes(lessonId, limit = 3) {
  const targetId = lessonIdFromNumber(lessonId);
  const targetIndex = ALL_UFLI_LESSON_IDS.indexOf(targetId);
  if (targetIndex < 0) return [];

  const already = new Set(getCumulativeIntroducedGraphemes(targetId));
  const out = [];
  for (let i = targetIndex + 1; i < ALL_UFLI_LESSON_IDS.length && out.length < limit; i++) {
    for (const g of splitGraphemeField(UFLI_LESSONS_META[i]?.grapheme)) {
      if (already.has(g)) continue;
      already.add(g);
      out.push(g);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Returns all wordList entries from lesson 1 through `lessonId`,
 * deduplicated, preserving curriculum order.
 *
 * Lessons that fail to load (e.g. not yet authored) are skipped silently
 * so games still work as content is filled in.
 */
export async function getCumulativeWordList(lessonId) {
  const targetId = lessonIdFromNumber(lessonId);
  const targetIndex = ALL_UFLI_LESSON_IDS.indexOf(targetId);
  if (targetIndex < 0) return [];

  const seen = new Set();
  const out = [];
  for (let i = 0; i <= targetIndex; i++) {
    const id = ALL_UFLI_LESSON_IDS[i];
    const lesson = await getUfliLesson(id);
    if (!lesson || !Array.isArray(lesson.wordList)) continue;
    for (const word of lesson.wordList) {
      if (!seen.has(word)) {
        seen.add(word);
        out.push(word);
      }
    }
  }
  return out;
}

export function getCumulativeWordListSync(lessonId) {
  const targetId = lessonIdFromNumber(lessonId);
  const targetIndex = ALL_UFLI_LESSON_IDS.indexOf(targetId);
  if (targetIndex < 0) return [];

  const seen = new Set();
  const out = [];
  for (let i = 0; i <= targetIndex; i++) {
    const id = ALL_UFLI_LESSON_IDS[i];
    const lesson = getBundledLessonData(id);
    if (!lesson || !Array.isArray(lesson.wordList)) continue;
    for (const word of lesson.wordList) {
      if (seen.has(word)) continue;
      seen.add(word);
      out.push(word);
    }
  }
  return out;
}

export function getCumulativeDecodableWordsSync(lessonId) {
  const targetId = lessonIdFromNumber(lessonId);
  const targetIndex = ALL_UFLI_LESSON_IDS.indexOf(targetId);
  if (targetIndex < 0) return [];

  const words = getCumulativeWordListSync(targetId);
  const decomp = buildCumulativeWordDecompositionMapSync(targetIndex);

  return words.map((word) => {
    const key = String(word).toLowerCase();
    const entry = decomp.get(key) ?? null;
    const letterSplit = key.split('');
    return {
      word,
      phonemes: entry?.phonemes ?? letterSplit,
      graphemes: entry?.graphemes ?? letterSplit,
    };
  });
}

function normalizeGraphemeToken(token) {
  return String(token ?? '').trim().toLowerCase();
}

function usesOnlyIntroducedGraphemes(word, introducedSet) {
  const graphemes = Array.isArray(word?.graphemes) ? word.graphemes : [];
  if (graphemes.length === 0) return false;
  // Special case: Single-letter words like 'a' and 'I' are decodable as soon as
  // their letter is introduced.
  if (graphemes.length === 1) {
    const single = normalizeGraphemeToken(graphemes[0]);
    return single === 'a' || single === 'i';
  }
  return graphemes.every((grapheme) => introducedSet.has(normalizeGraphemeToken(grapheme)));
}

export function hasUfliConnectedText(lessonId) {
  return getCumulativeReadSentencesSync(lessonId).length > 0;
}

export function getAvailableUfliActivityTypes(lessonId) {
  const targetId = lessonIdFromNumber(lessonId);
  if (!ALL_UFLI_LESSON_IDS.includes(targetId)) return [];

  const introduced = new Set(
    getCumulativeIntroducedGraphemes(targetId).map((grapheme) => normalizeGraphemeToken(grapheme)),
  );
  const words = getCumulativeDecodableWordsSync(targetId);

  const activityTypes = ['speech', 'match'];

  const hasBlendableWord = words.some((word) => {
    return (word.phonemes?.length ?? 0) >= 2 && usesOnlyIntroducedGraphemes(word, introduced);
  });
  if (hasBlendableWord) activityTypes.push('blend');

  const hasBuildableWord = words.some((word) => usesOnlyIntroducedGraphemes(word, introduced));
  if (hasBuildableWord) activityTypes.push('build');

  if (hasUfliConnectedText(targetId)) {
    activityTypes.push('sentence');
  }

  return activityTypes;
}

export function getUfliLessonSparkTotal(lessonId) {
  const targetId = lessonIdFromNumber(lessonId);
  if (!ALL_UFLI_LESSON_IDS.includes(targetId)) return 0;

  const activityCount = getAvailableUfliActivityTypes(targetId).length;
  const connectedTextCount = hasUfliConnectedText(targetId) ? 1 : 0;
  return 1 + activityCount + connectedTextCount;
}
