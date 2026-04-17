import { describe, it, expect } from 'vitest';
import { phonemeToAudioKey } from './ttsSegments.js';

describe('ttsSegments.js (Extended)', () => {
  describe('phonemeToAudioKey', () => {
    it('maps VCe to long_ keys', () => {
      expect(phonemeToAudioKey('a_e')).toBe('long_a');
      expect(phonemeToAudioKey('o_e')).toBe('long_o');
    });

    it('maps UFLI digraphs correctly', () => {
      expect(phonemeToAudioKey('ck')).toBe('k');
      expect(phonemeToAudioKey('ph')).toBe('f');
      expect(phonemeToAudioKey('dge')).toBe('j');
    });

    it('handles stripped dashes', () => {
      expect(phonemeToAudioKey('-all')).toBe('aw');
      expect(phonemeToAudioKey('-oll')).toBe('o');
    });

    it('maps double letters to single counterparts', () => {
      expect(phonemeToAudioKey('ff')).toBe('f');
      expect(phonemeToAudioKey('ll')).toBe('l');
    });

    it('handles IPA notation', () => {
      expect(phonemeToAudioKey('/ă/')).toBe('a');
      expect(phonemeToAudioKey('/ā/')).toBe('long_a');
    });
  });
});
