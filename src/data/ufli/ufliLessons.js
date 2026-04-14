/**
 * UFLI lesson loader.
 *
 * Lessons live as JSON files at ./lessons/lesson-{id}.json and are loaded
 * on demand via Vite's dynamic import. Loaded lessons are cached for sync
 * access by hub/player components after the initial async fetch.
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

/** Test helper — clears the in-memory lesson cache between tests. */
export function _clearLessonCache() {
  lessonCache.clear();
}

/**
 * Dynamically load a lesson by id (number or string).
 * Returns undefined if the lesson JSON file does not exist.
 */
export async function getUfliLesson(lessonId) {
  const id = lessonIdFromNumber(lessonId);
  if (lessonCache.has(id)) {
    return lessonCache.get(id);
  }
  try {
    const mod = await import(`./lessons/lesson-${id}.json`);
    const lesson = mod.default ?? mod;
    lessonCache.set(id, lesson);
    return lesson;
  } catch {
    return undefined;
  }
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
 * Returns decodable word objects (`{word, phonemes}`) for use in games.
 * Splits each cumulative word into its letters as a phoneme proxy.
 * Sufficient for early single-letter lessons; digraph-aware splitting
 * is a Phase 2 concern (see TASK_LIST.md).
 */
export async function getCumulativeDecodableWords(lessonId) {
  const words = await getCumulativeWordList(lessonId);
  return words.map((word) => ({
    word,
    phonemes: word.toLowerCase().split(''),
  }));
}

/**
 * Returns the unique letter set decodable up to and including `lessonId`.
 * Drawn from the cumulative word list, not the manifest grapheme field,
 * so it stays accurate as new lesson JSON is authored.
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
