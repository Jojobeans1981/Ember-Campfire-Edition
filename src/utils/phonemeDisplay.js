import { phonemeToAudioKey } from './ttsSegments.js';

const IPA_DISPLAY = {
  'ă': 'a', 'ĕ': 'e', 'ĭ': 'i', 'ŏ': 'o', 'ŭ': 'u',
  'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u',
  'θ': 'th', 'ð': 'th', 'ʃ': 'sh', 'ʒ': 'zh', 'ŋ': 'ng',
  'tʃ': 'ch', 'dʒ': 'j',
  'ə': 'e', 'ɚ': 'er',
  'eɪ': 'a', 'aɪ': 'i', 'oʊ': 'o', 'aʊ': 'ou', 'ɔɪ': 'oi',
  'ɑː': 'ar', 'ɔː': 'aw', 'ɝ': 'er',
};

const AUDIO_KEY_DISPLAY = {
  long_a: 'a', long_e: 'e', long_i: 'i', long_o: 'o', long_u: 'u',
  th_v: 'th', ng: 'ng', ch: 'ch', sh: 'sh',
};

export function phonemeToDisplay(phoneme) {
  if (phoneme === null || phoneme === undefined) return '';
  const cleaned = String(phoneme).replace(/\//g, '').trim();
  if (cleaned.length === 0) return '';

  if (IPA_DISPLAY[cleaned]) return IPA_DISPLAY[cleaned];

  const lower = cleaned.toLowerCase();
  if (IPA_DISPLAY[lower]) return IPA_DISPLAY[lower];

  const audioKey = phonemeToAudioKey(phoneme);
  if (AUDIO_KEY_DISPLAY[audioKey]) return AUDIO_KEY_DISPLAY[audioKey];

  return audioKey || lower;
}
