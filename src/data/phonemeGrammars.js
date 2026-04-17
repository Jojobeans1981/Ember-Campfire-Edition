/**
 * Sound-only grammar constraints for single-phoneme recognition.
 *
 * These drills should validate the child saying the sound itself, not a whole
 * word that merely contains the sound. Word reading is handled elsewhere.
 */

export const PHONEME_GRAMMARS = {
  // --- Sustain consonants ---
  s: ['s', 'ss', 'sss', 'es', 'ess', 'suh'],
  m: ['m', 'mm', 'mmm', 'mmmm', 'em', 'um', 'umm', 'muh', 'hm', 'hmm', 'hmmm'],
  n: ['n', 'nn', 'nnn', 'en', 'nuh'],
  f: ['f', 'ff', 'fff', 'ef', 'eff', 'fuh'],
  l: ['l', 'll', 'lll', 'el', 'luh'],
  h: ['h', 'hh', 'huh', 'ha'],
  r: ['r', 'rr', 'er', 'ruh'],
  v: ['v', 'vv', 'vee', 'vuh'],
  z: ['z', 'zz', 'zee', 'zuh'],
  w: ['w', 'ww', 'wuh', 'woo'],
  y: ['y', 'yy', 'yee', 'yuh'],

  // --- Plosive consonants (sound-like labels only, not real words) ---
  t: ['t', 'tt', 'tee', 'te', 'tuh'],
  p: ['p', 'pp', 'pee', 'pe', 'puh'],
  c: ['c', 'k', 'kuh', 'cuh'],
  b: ['b', 'bb', 'bee', 'be', 'buh'],
  d: ['d', 'dd', 'dee', 'de', 'duh'],
  g: ['g', 'gg', 'gee', 'guh'],
  k: ['k', 'kk', 'kay', 'kuh'],
  j: ['j', 'jj', 'jay', 'juh'],
  x: ['x', 'ex', 'ks', 'kss'],
  q: ['q', 'qu', 'kw', 'qoo'],

  // --- Short vowels ---
  a: ['a', 'ah', 'aa', 'aah'],
  e: ['e', 'eh', 'eeh'],
  i: ['i', 'ih', 'ii', 'ihh'],
  o: ['o', 'ah', 'aw', 'oh'],
  u: ['u', 'uh', 'uhh'],
};

/**
 * Extra transcript variants from browser speech recognition. These are looser
 * than the Vosk grammar words and are mainly used to make the earliest
 * single-sound lessons work without the local Vosk model present.
 */
export const PHONEME_TRANSCRIPT_VARIANTS = {
  a: ['a', 'ah', 'aa', 'aah'],
  m: ['m', 'mm', 'mmm', 'mmmm', 'em', 'um', 'umm', 'muh', 'hm', 'hmm', 'hmmm'],
  s: ['s', 'ss', 'sss', 'es', 'ess', 'suh'],
  t: ['t', 'tt', 'tee', 'te', 'tuh'],
  p: ['p', 'pp', 'pee', 'pe', 'puh'],
  n: ['n', 'nn', 'nnn', 'en', 'nuh'],
  i: ['i', 'ih', 'ii', 'ee', 'ihh'],
  c: ['c', 'k', 'kuh', 'cuh'],
  b: ['b', 'bb', 'bee', 'be', 'buh'],
  d: ['d', 'dd', 'dee', 'de', 'duh'],
  g: ['g', 'gg', 'gee', 'guh'],
  e: ['e', 'eh', 'eeh'],
  o: ['o', 'ah', 'aw', 'oh'],
  u: ['u', 'uh', 'uhh'],
};

/**
 * Normalize a phoneme key to its bare-letter form. Accepts UFLI-style
 * notations like "/ă/", "/sh/" or bare letters and returns the lookup key
 * used in PHONEME_GRAMMARS.
 */
export function normalizePhonemeKey(phoneme) {
  if (!phoneme) return '';
  let p = String(phoneme).replace(/\//g, '').trim().toLowerCase();
  const map = {
    'ă': 'a', 'ĕ': 'e', 'ĭ': 'i', 'ŏ': 'o', 'ŭ': 'u',
    'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u',
    'ɹ': 'r', 'ŋ': 'n', 'ə': 'u', 'ɔ': 'o',
  };
  if (map[p]) return map[p];
  p = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return p;
}

/**
 * Get the grammar word list for a phoneme.
 * Returns null if the phoneme isn't mapped (caller falls back to broad).
 */
export function getGrammarForPhoneme(phoneme) {
  const key = normalizePhonemeKey(phoneme);
  return PHONEME_GRAMMARS[key] || null;
}

/**
 * Check if Vosk's output text matches the target phoneme.
 * Returns true if any word in the Vosk transcript appears in the
 * phoneme's accepted word list.
 */
export function isPhonemeMatch(phoneme, voskText) {
  const key = normalizePhonemeKey(phoneme);
  if (!voskText || !key) return false;

  const accepted = [
    ...(PHONEME_GRAMMARS[key] || []),
    ...(PHONEME_TRANSCRIPT_VARIANTS[key] || []),
  ];
  if (accepted.length === 0) return false;

  const words = voskText
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.some((word) => accepted.includes(word));
}
