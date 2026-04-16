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
    'ă': 'a', 'ĕ': 'e', 'ĭ': 'i', 'ŏ': 'o', 'ŭ': 'u',
    'ā': 'long_a', 'ē': 'long_e', 'ī': 'long_i', 'ō': 'long_o', 'ū': 'long_u',
    'ɹ': 'r', 'ŋ': 'ng', 'ə': 'u', 'ɔ': 'o',
  };
  if (map[p]) return map[p];
  p = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aliases = { 'kw': 'q', 'ks': 'x', 'thv': 'th_v' };
  if (aliases[p]) return aliases[p];
  // Collapse stretched continuants (UFLI notation for sustained sounds):
  // "mmm" → "m", "sss" → "s", etc. The audio file is the same.
  if (/^([a-z])\1+$/.test(p)) return p[0];
  return p;
}
