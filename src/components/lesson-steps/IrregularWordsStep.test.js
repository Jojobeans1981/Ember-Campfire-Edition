import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import IrregularWordsStep from './IrregularWordsStep.vue';

vi.mock('../../composables/useEmber.js', () => ({
  useEmber: () => ({
    speak: vi.fn().mockResolvedValue(undefined),
    playPhoneme: vi.fn().mockResolvedValue(undefined),
    stopSpeaking: vi.fn(),
  }),
}));

const fixtureStep = {
  review: [],
  teach: [
    {
      word: 'is',
      breakdown: [
        { grapheme: 'i', phoneme: '/ĭ/', regular: true },
        { grapheme: 's', phoneme: '/z/', regular: false },
      ],
    },
  ],
};

function tokens(wrapper) {
  return wrapper.findComponent({ name: 'FocusStage' }).props('tokens');
}

describe('IrregularWordsStep', () => {
  it('renders a token per breakdown part with the irregular kind marked', () => {
    const wrapper = mount(IrregularWordsStep, { props: { step: fixtureStep } });
    const result = tokens(wrapper);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ text: 'i', kind: 'grapheme' });
    expect(result[1]).toMatchObject({ text: 's', kind: 'grapheme-irregular' });
  });

  it('emits step-complete after the last word', async () => {
    const wrapper = mount(IrregularWordsStep, { props: { step: fixtureStep } });
    await wrapper.find('button[aria-label="Done"]').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('emits step-complete on mount when review/teach are empty', async () => {
    const wrapper = mount(IrregularWordsStep, { props: { step: { review: [], teach: [] } } });
    await flushPromises();
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('has no step title heading', () => {
    const wrapper = mount(IrregularWordsStep, { props: { step: fixtureStep } });
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
