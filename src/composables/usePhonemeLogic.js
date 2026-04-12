export const usePhonemeLogic = () => {
  const phonemeConfig = {
    m: { type: 'sustain', holdTime: 3000, color: '#FF8C00' },
    s: { type: 'sustain', holdTime: 3000, color: '#64FFDA' },
    t: { type: 'plosive', holdTime: 100,  color: '#C0C0C0' }
  };

  const getPhonemeParams = (phoneme) => phonemeConfig[phoneme] || phonemeConfig.m;

  return { getPhonemeParams };
};
