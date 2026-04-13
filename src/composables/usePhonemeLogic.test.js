import { describe, it, expect } from 'vitest';
import { usePhonemeLogic } from './usePhonemeLogic';

describe('usePhonemeLogic Composable', () => {
  const { getPhonemeParams } = usePhonemeLogic();

  it('should return correct params for m', () => {
    const params = getPhonemeParams('m');
    expect(params.type).toBe('sustain');
    expect(params.holdTime).toBe(3000);
  });

  it('should return correct params for s', () => {
    const params = getPhonemeParams('s');
    expect(params.type).toBe('sustain');
  });

  it('should return correct params for t', () => {
    const params = getPhonemeParams('t');
    expect(params.type).toBe('plosive');
  });

  it('should default to m params for unknown phonemes', () => {
    const params = getPhonemeParams('z');
    expect(params.type).toBe('sustain');
    expect(params.holdTime).toBe(3000);
  });
});
