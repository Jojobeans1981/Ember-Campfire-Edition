export const usePhonemeLogic = () => {
  const phonemeConfig = {
    // Sustain consonants — child holds the sound
    s: { type: 'sustain', holdTime: 3000, color: '#64FFDA' },
    m: { type: 'sustain', holdTime: 3000, color: '#FF8C00' },
    n: { type: 'sustain', holdTime: 3000, color: '#FFD93D' },
    f: { type: 'sustain', holdTime: 3000, color: '#A78BFA' },
    l: { type: 'sustain', holdTime: 3000, color: '#34D399' },
    h: { type: 'sustain', holdTime: 2000, color: '#F472B6' },
    r: { type: 'sustain', holdTime: 3000, color: '#FB923C' },
    v: { type: 'sustain', holdTime: 3000, color: '#60A5FA' },
    z: { type: 'sustain', holdTime: 3000, color: '#C084FC' },
    w: { type: 'sustain', holdTime: 2000, color: '#4ADE80' },
    y: { type: 'sustain', holdTime: 2000, color: '#FBBF24' },

    // Plosive consonants — brief burst
    t: { type: 'plosive', holdTime: 100, color: '#C0C0C0' },
    p: { type: 'plosive', holdTime: 100, color: '#F87171' },
    c: { type: 'plosive', holdTime: 100, color: '#38BDF8' },
    b: { type: 'plosive', holdTime: 100, color: '#FB7185' },
    d: { type: 'plosive', holdTime: 100, color: '#A3E635' },
    g: { type: 'plosive', holdTime: 100, color: '#2DD4BF' },
    k: { type: 'plosive', holdTime: 100, color: '#818CF8' },
    j: { type: 'plosive', holdTime: 100, color: '#E879F9' },
    x: { type: 'plosive', holdTime: 100, color: '#94A3B8' },
    q: { type: 'plosive', holdTime: 100, color: '#FCA5A5' },

    // Vowels — sustain
    a: { type: 'sustain', holdTime: 2000, color: '#F59E0B' },
    e: { type: 'sustain', holdTime: 2000, color: '#10B981' },
    i: { type: 'sustain', holdTime: 2000, color: '#6366F1' },
    o: { type: 'sustain', holdTime: 2000, color: '#EC4899' },
    u: { type: 'sustain', holdTime: 2000, color: '#8B5CF6' },
  };

  const getPhonemeParams = (phoneme) => phonemeConfig[phoneme] || phonemeConfig.m;

  return { getPhonemeParams };
};
