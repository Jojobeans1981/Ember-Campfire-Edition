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

  // --- Digraphs & Clusters ---
  sh: ['sh', 'shh', 'shhh', 'esh', 'she'],
  ch: ['ch', 'chh', 'che', 'etch'],
  th: ['th', 'thh', 'the', 'eth'],
  wh: ['w', 'wh', 'wuh', 'woo'],
  ng: ['ng', 'ing', 'ang', 'ung'],
  ck: ['k', 'ck', 'kuh'],
  ph: ['f', 'ph', 'fuh'],
  ar: ['ar', 'ark', 'arr'],
  or: ['or', 'ore', 'orr'],
  er: ['er', 'ur', 'ir', 'err'],

  // --- Plosive consonants ---
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

  // --- Long vowels ---
  long_a: ['a', 'ay', 'ai', 'ey', 'ae'],
  long_e: ['e', 'ee', 'ea', 'ey', 'ie'],
  long_i: ['i', 'ie', 'y', 'igh'],
  long_o: ['o', 'oa', 'oe', 'ow'],
  long_u: ['u', 'ue', 'oo', 'ew'],
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
  sh: ['sh', 'she', 'shoe'],
  ch: ['ch', 'each', 'beach'],
  th: ['th', 'the', 'think'],
  long_a: ['a', 'hay', 'say', 'play'],
  long_e: ['e', 'he', 'see', 'tree'],
  long_i: ['i', 'my', 'tie', 'high'],
  long_o: ['o', 'go', 'no', 'low'],
  long_u: ['u', 'too', 'new', 'blue'],
};

/**
 * Normalize a phoneme key to its bare-letter form. Accepts UFLI-style
 * notations like "/ă/", "/sh/" or bare letters and returns the lookup key
 * used in PHONEME_GRAMMARS.
 */
export function normalizePhonemeKey(phoneme) {
  if (!phoneme) return '';
  let p = String(phoneme).replace(/\//g, '').trim().toLowerCase();

  // Handle UFLI notation variants directly
  const directMap = {
    'ă': 'a', 'ĕ': 'e', 'ĭ': 'i', 'ŏ': 'o', 'ŭ': 'u',
    'ā': 'long_a', 'ē': 'long_e', 'ī': 'long_i', 'ō': 'long_o', 'ū': 'long_u',
    'a_e': 'long_a', 'e_e': 'long_e', 'i_e': 'long_i', 'o_e': 'long_o', 'u_e': 'long_u',
    'æ': 'a', 'ɪ': 'i', 'ɛ': 'e', 'ɑ': 'o', 'ʌ': 'u',
    'ɹ': 'r', 'ŋ': 'ng', 'ə': 'u', 'ɔ': 'o',
    'sh': 'sh', 'ch': 'ch', 'th': 'th', 'wh': 'wh', 'ng': 'ng',
    'ck': 'ck', 'ph': 'ph', 'ar': 'ar', 'or': 'or', 'er': 'er',
    'ff': 'f', 'll': 'l', 'ss': 's', 'zz': 'z',
  };

  if (directMap[p]) return directMap[p];

  // Strip diacritics and try again
  const normalized = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (directMap[normalized]) return directMap[normalized];

  return normalized;
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
