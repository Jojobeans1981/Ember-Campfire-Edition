import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import IrregularWordsStep from './IrregularWordsStep.vue';

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

describe('IrregularWordsStep', () => {
  it('mounts and shows the tricky word grapheme breakdown', () => {
    const wrapper = mount(IrregularWordsStep, { props: { step: fixtureStep } });
    expect(wrapper.text()).toContain('Tricky Words');
    expect(wrapper.findAll('.grapheme').length).toBe(2);
    expect(wrapper.findAll('.grapheme.irregular').length).toBe(1);
  });

  it('emits step-complete after the last word', async () => {
    const wrapper = mount(IrregularWordsStep, { props: { step: fixtureStep } });
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('handles empty review/teach gracefully', async () => {
    const wrapper = mount(IrregularWordsStep, { props: { step: { review: [], teach: [] } } });
    expect(wrapper.text()).toContain('No irregular words');
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });
});
