/**
 * Grammar constraints for Vosk speech recognition.
 *
 * Each phoneme maps to a list of words that Vosk's recognizer is allowed to
 * output. By constraining the vocabulary, any recognition result is strong
 * evidence the child produced the target sound. The lists are intentionally
 * generous to handle unclear child speech.
 */

export const PHONEME_GRAMMARS = {
  // --- Sustain consonants ---
  s: ['s', 'ss', 'sss', 'sun', 'see', 'say', 'so', 'sit', 'set', 'six'],
  m: ['m', 'mm', 'mmm', 'mom', 'me', 'my', 'man', 'map', 'mat', 'hm'],
  n: ['n', 'nn', 'nnn', 'no', 'not', 'nap', 'net', 'nut', 'nine', 'nice'],
  f: ['f', 'ff', 'fff', 'fun', 'fan', 'fit', 'fix', 'five', 'for', 'fat'],
  l: ['l', 'll', 'lll', 'let', 'lap', 'lip', 'lot', 'leg', 'lit', 'log'],
  h: ['h', 'hh', 'ha', 'he', 'hi', 'hot', 'hat', 'hit', 'hug', 'hop'],
  r: ['r', 'rr', 'rrr', 'run', 'red', 'rip', 'rat', 'rug', 'ram', 'rob'],
  v: ['v', 'vv', 'vvv', 'van', 'vet', 'vine', 'very', 'vim', 'vat', 'vast'],
  z: ['z', 'zz', 'zzz', 'zip', 'zoo', 'zone', 'zero', 'zap', 'zen', 'zig'],
  w: ['w', 'ww', 'we', 'was', 'win', 'wet', 'wag', 'web', 'wit', 'wow'],
  y: ['y', 'yy', 'yes', 'yet', 'yam', 'yep', 'you', 'yell', 'your', 'yawn'],

  // --- Plosive consonants (need carrier words) ---
  t: ['t', 'to', 'top', 'ten', 'tap', 'tip', 'tub', 'two', 'tie', 'tin'],
  p: ['p', 'pop', 'pan', 'pat', 'pet', 'pin', 'pig', 'pot', 'put', 'pit'],
  c: ['c', 'k', 'cup', 'cat', 'can', 'cap', 'cut', 'cot', 'cub', 'cab'],
  b: ['b', 'but', 'bat', 'bed', 'big', 'bit', 'bus', 'bug', 'box', 'bun'],
  d: ['d', 'do', 'did', 'dog', 'dig', 'dug', 'den', 'dot', 'dip', 'dam'],
  g: ['g', 'go', 'got', 'get', 'gum', 'gap', 'gas', 'gun', 'gut', 'gig'],
  k: ['k', 'kid', 'kit', 'key', 'kin', 'keg', 'kick', 'king', 'keep', 'kept'],
  j: ['j', 'jug', 'jam', 'jet', 'jot', 'job', 'jump', 'just', 'joy', 'jar'],
  x: ['x', 'ax', 'ox', 'box', 'fox', 'fix', 'mix', 'six', 'wax', 'hex'],
  q: ['q', 'quick', 'quit', 'quiz', 'queen', 'quiet', 'quest', 'quote', 'quack', 'quilt'],

  // --- Short vowels ---
  a: ['a', 'ah', 'at', 'am', 'an', 'as', 'add', 'ant', 'and', 'ask'],
  e: ['e', 'eh', 'ed', 'egg', 'end', 'elf', 'elm', 'elk', 'edge', 'echo'],
  i: ['i', 'ih', 'it', 'in', 'is', 'if', 'ill', 'ink', 'inn', 'itch'],
  o: ['o', 'ah', 'on', 'ox', 'odd', 'off', 'opt', 'olive', 'opera', 'otter'],
  u: ['u', 'uh', 'up', 'us', 'ump', 'under', 'uncle', 'utter', 'ugly', 'until'],
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
  if (!voskText || !PHONEME_GRAMMARS[key]) return false;
  const words = voskText.toLowerCase().trim().split(/\s+/);
  const accepted = PHONEME_GRAMMARS[key];
  return words.some((w) => accepted.includes(w));
}
