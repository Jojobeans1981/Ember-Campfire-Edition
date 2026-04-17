import { describe, it, expect } from 'vitest';
import { normalizePhonemeKey, getGrammarForPhoneme, isPhonemeMatch } from './phonemeGrammars.js';

describe('phonemeGrammars (Extended)', () => {
  describe('normalizePhonemeKey', () => {
    it('normalizes VCe patterns to long vowel keys', () => {
      expect(normalizePhonemeKey('a_e')).toBe('long_a');
      expect(normalizePhonemeKey('i_e')).toBe('long_i');
      expect(normalizePhonemeKey('/ā/')).toBe('long_a');
    });

    it('preserves digraphs', () => {
      expect(normalizePhonemeKey('sh')).toBe('sh');
      expect(normalizePhonemeKey('ch')).toBe('ch');
      expect(normalizePhonemeKey('/sh/')).toBe('sh');
    });

    it('maps complex tokens correctly', () => {
      expect(normalizePhonemeKey('ck')).toBe('ck');
      expect(normalizePhonemeKey('ph')).toBe('ph');
      expect(normalizePhonemeKey('ff')).toBe('f');
    });
  });

  describe('getGrammarForPhoneme', () => {
    it('returns grammar for digraphs', () => {
      const shGrammar = getGrammarForPhoneme('sh');
      expect(shGrammar).toContain('sh');
      expect(shGrammar).toContain('shh');
    });

    it('returns grammar for long vowels', () => {
      const longAGrammar = getGrammarForPhoneme('a_e');
      expect(longAGrammar).toContain('ay');
      expect(longAGrammar).toContain('ai');
    });
  });

  describe('isPhonemeMatch', () => {
    it('matches digraphs', () => {
      expect(isPhonemeMatch('sh', 'shh')).toBe(true);
      expect(isPhonemeMatch('ch', 'each')).toBe(true); // From variants
    });

    it('matches long vowels', () => {
      expect(isPhonemeMatch('a_e', 'play')).toBe(true);
      expect(isPhonemeMatch('i_e', 'tie')).toBe(true);
    });
  });
});
