import { describe, expect, it } from 'vitest';
import { isPhonemeMatch, normalizePhonemeKey } from './phonemeGrammars.js';

describe('normalizePhonemeKey', () => {
  it('normalizes ufli short vowels', () => {
    expect(normalizePhonemeKey('/ă/')).toBe('a');
    expect(normalizePhonemeKey('/ĭ/')).toBe('i');
  });

  it('normalizes bare phoneme letters', () => {
    expect(normalizePhonemeKey('m')).toBe('m');
    expect(normalizePhonemeKey('t')).toBe('t');
  });
});

describe('isPhonemeMatch', () => {
  it('matches early lesson phoneme variants from browser transcripts', () => {
    expect(isPhonemeMatch('m', 'em')).toBe(true);
    expect(isPhonemeMatch('s', 'ess')).toBe(true);
    expect(isPhonemeMatch('t', 'tee')).toBe(true);
    expect(isPhonemeMatch('/ă/', 'ah')).toBe(true);
  });

  it('rejects mismatched phonemes', () => {
    expect(isPhonemeMatch('m', 'sun')).toBe(false);
    expect(isPhonemeMatch('t', 'mom')).toBe(false);
  });
});
