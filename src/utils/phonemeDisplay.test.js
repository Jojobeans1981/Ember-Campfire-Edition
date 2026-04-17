import { describe, it, expect } from 'vitest';
import { phonemeToDisplay } from './phonemeDisplay.js';

describe('phonemeToDisplay', () => {
  it('maps short vowels to the base letter', () => {
    expect(phonemeToDisplay('/ă/')).toBe('a');
    expect(phonemeToDisplay('/ĕ/')).toBe('e');
    expect(phonemeToDisplay('/ĭ/')).toBe('i');
    expect(phonemeToDisplay('/ŏ/')).toBe('o');
    expect(phonemeToDisplay('/ŭ/')).toBe('u');
  });

  it('maps long vowels to the base letter without a macron', () => {
    expect(phonemeToDisplay('/ā/')).toBe('a');
    expect(phonemeToDisplay('/ē/')).toBe('e');
  });

  it('maps digraph IPA to the two-letter grapheme', () => {
    expect(phonemeToDisplay('/θ/')).toBe('th');
    expect(phonemeToDisplay('/ð/')).toBe('th');
    expect(phonemeToDisplay('/ʃ/')).toBe('sh');
    expect(phonemeToDisplay('/ŋ/')).toBe('ng');
    expect(phonemeToDisplay('/tʃ/')).toBe('ch');
  });

  it('maps schwa to e', () => {
    expect(phonemeToDisplay('/ə/')).toBe('e');
  });

  it('strips slashes from plain consonants', () => {
    expect(phonemeToDisplay('/t/')).toBe('t');
    expect(phonemeToDisplay('/b/')).toBe('b');
    expect(phonemeToDisplay('/m/')).toBe('m');
  });

  it('never returns slashes', () => {
    const samples = ['/ă/', '/t/', '/ð/', '/ə/', '/tʃ/', '/long_a/'];
    for (const s of samples) {
      expect(phonemeToDisplay(s)).not.toContain('/');
    }
  });

  it('returns empty string for empty or null input', () => {
    expect(phonemeToDisplay('')).toBe('');
    expect(phonemeToDisplay(null)).toBe('');
    expect(phonemeToDisplay(undefined)).toBe('');
    expect(phonemeToDisplay('//')).toBe('');
  });

  it('falls back to audio-key display for unknown IPA', () => {
    expect(phonemeToDisplay('long_a')).toBe('a');
    expect(phonemeToDisplay('th_v')).toBe('th');
  });

  it('returns lowercase output for letter-like inputs', () => {
    expect(phonemeToDisplay('/A/')).toBe('a');
    expect(phonemeToDisplay('/T/')).toBe('t');
  });
});
