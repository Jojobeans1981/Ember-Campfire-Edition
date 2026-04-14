import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ConnectedTextStep from './ConnectedTextStep.vue';

const fixtureStep = {
  readSentences: ['I am Sam.', 'Sam sat.'],
  spellSentences: [],
};

describe('ConnectedTextStep', () => {
  it('mounts and shows the first sentence', () => {
    const wrapper = mount(ConnectedTextStep, { props: { step: fixtureStep } });
    expect(wrapper.text()).toContain('I am Sam.');
  });

  it('advances through sentences and emits step-complete on last', async () => {
    const wrapper = mount(ConnectedTextStep, { props: { step: fixtureStep } });
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.text()).toContain('Sam sat.');
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('handles empty sentence list gracefully', async () => {
    const wrapper = mount(ConnectedTextStep, { props: { step: { readSentences: [] } } });
    expect(wrapper.text()).toContain('No sentences');
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });
});
