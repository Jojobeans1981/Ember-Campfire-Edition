import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PhonemicAwarenessStep from './PhonemicAwarenessStep.vue';

vi.mock('../../composables/useEmber.js', () => ({
  useEmber: () => ({
    speak: vi.fn().mockResolvedValue(undefined),
    playPhoneme: vi.fn().mockResolvedValue(undefined),
    stopSpeaking: vi.fn(),
  }),
}));

const fixtureStep = {
  blend: [
    { phonemes: ['/ă/', '/m/'], word: 'am' },
  ],
  segment: [
    { word: 'am', phonemes: ['/ă/', '/m/'] },
  ],
};

describe('PhonemicAwarenessStep', () => {
  it('renders a word box per letter in the blend word', () => {
    const wrapper = mount(PhonemicAwarenessStep, { props: { step: fixtureStep } });
    expect(wrapper.exists()).toBe(true);
    const boxes = wrapper.findAll('.word-box');
    expect(boxes).toHaveLength(2); // "am" → two boxes
    // FocusStage is only rendered during the segment phase.
    expect(wrapper.findComponent({ name: 'FocusStage' }).exists()).toBe(false);
  });

  it('emits step-complete after working through blend and segment items', async () => {
    const wrapper = mount(PhonemicAwarenessStep, { props: { step: fixtureStep } });
    const nextBtn = wrapper.find('button[aria-label="Next"]');
    await nextBtn.trigger('click');
    await flushPromises();
    await wrapper.find('button[aria-label="Done"]').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('has no step title heading', () => {
    const wrapper = mount(PhonemicAwarenessStep, { props: { step: fixtureStep } });
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
