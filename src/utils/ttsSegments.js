/**
 * Shared helpers for TTS / phoneme-audio routing.
 *
 * Used by both the inventory/generator scripts (Node) and the runtime
 * speak helper (browser), so keep this module free of DOM or
 * Node-specific APIs.
 *
 * Design:
 *   - Narration lines WITHOUT IPA tokens are voiced by ElevenLabs TTS
 *     (scripts/generate-tts.mjs → public/audio/tts/<hash>.mp3).
 *   - Narration lines WITH IPA tokens (/ă/, /m/, etc.) are NOT voiced by
 *     TTS. The app plays the matching context clip from
 *     public/audio/phonemes/context/<key>.mp3 (e.g. "a as in apple").
 *
 * This module therefore just needs:
 *   - hasIpaToken(text)   — used by the inventory generator to decide
 *                           whether a line is excluded from TTS.
 *   - phonemeToAudioKey() — used by the runtime to map an IPA token to
 *                           the context-clip filename.
 */

const IPA_PATTERN = /\/[^/]+\//g;

/**
 * True if the text contains one or more UFLI-style IPA tokens like
 * "/ă/" or "/mmm/". Used to skip lines from the TTS inventory so they
 * play via phoneme context clips instead.
 */
export function hasIpaToken(text) {
  if (text == null) return false;
  IPA_PATTERN.lastIndex = 0;
  return IPA_PATTERN.test(String(text));
}

/**
 * Map a phoneme (in any common notation) to the audio file key under
 * /audio/phonemes/. Accepts UFLI-style notation like "/ă/", "/sh/", or
 * bare letters like "a", "sh".
 */
export function phonemeToAudioKey(phoneme) {
  if (!phoneme) return '';
  let p = String(phoneme).replace(/\//g, '').trim().toLowerCase();
  const map = {
    // Short vowels — breve notation (lesson 1) and standard IPA (lessons 2–10)
    'ă': 'a', 'ĕ': 'e', 'ĭ': 'i', 'ŏ': 'o', 'ŭ': 'u',
    'æ': 'a', 'ɛ': 'e', 'ɪ': 'i', 'ɒ': 'o', 'ʌ': 'u',
    // Long vowels — macron notation
    'ā': 'long_a', 'ē': 'long_e', 'ī': 'long_i', 'ō': 'long_o', 'ū': 'long_u',
    // Split-vowel (silent-e) notation
    'a_e': 'long_a', 'e_e': 'long_e', 'i_e': 'long_i', 'o_e': 'long_o', 'u_e': 'long_u',
    // R-controlled / schwa / consonant IPA
    'ɹ': 'r', 'ŋ': 'ng', 'ə': 'u', 'ɔ': 'o',
  };
  if (map[p]) return map[p];

  p = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aliases = {
    'kw': 'q', 'ks': 'x', 'thv': 'th_v',
    'ck': 'k', 'ph': 'f', 'tch': 'ch', 'dge': 'j',
    'ff': 'f', 'll': 'l', 'ss': 's', 'zz': 'z',
    'qu': 'q',
    'all': 'aw', 'oll': 'o', 'ull': 'oo_short'
  };
  if (aliases[p]) return aliases[p];

  // Strip leading/trailing dashes used in some UFLI labels (e.g., -all)
  const stripped = p.replace(/^-|-$/g, '');
  if (aliases[stripped]) return aliases[stripped];
  if (map[stripped]) return map[stripped];

  // Collapse stretched continuants (UFLI notation for sustained sounds):
  // "mmm" → "m", "sss" → "s", etc. The audio file is the same.
  if (/^([a-z])\1+$/.test(p)) return p[0];
  return p;
}
