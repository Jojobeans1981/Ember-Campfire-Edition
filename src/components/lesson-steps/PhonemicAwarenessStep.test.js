import { describe, it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PhonemicAwarenessStep from './PhonemicAwarenessStep.vue';

const fixtureStep = {
  blend: [
    { phonemes: ['/ă/', '/m/'], word: 'am' },
  ],
  segment: [
    { word: 'am', phonemes: ['/ă/', '/m/'] },
  ],
};

describe('PhonemicAwarenessStep', () => {
  it('mounts without error', () => {
    const wrapper = mount(PhonemicAwarenessStep, { props: { step: fixtureStep } });
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain('Listen and Blend');
  });

  it('emits step-complete after working through blend and segment items', async () => {
    const wrapper = mount(PhonemicAwarenessStep, { props: { step: fixtureStep } });
    // First item is blend → click Next
    await wrapper.find('.next-btn').trigger('click');
    await flushPromises();
    // Second item is segment → click Next (which is now Done)
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });
});
