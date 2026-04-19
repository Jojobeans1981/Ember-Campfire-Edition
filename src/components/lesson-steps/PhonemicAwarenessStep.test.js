import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PhonemicAwarenessStep from './PhonemicAwarenessStep.vue';

vi.mock('../../composables/useEmber.js', () => ({
  useEmber: () => ({
    speak: vi.fn().mockResolvedValue(undefined),
    speakTeacher: vi.fn().mockResolvedValue(undefined),
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
  });

  it('emits step-complete after working through blend and segment items', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mount(PhonemicAwarenessStep, { props: { step: fixtureStep } });
      await wrapper.find('button[aria-label="Next"]').trigger('click');
      // Drain the segment phase: both the real setTimeout-based pauses
      // between reveal slots and the microtasks queued by the mocked
      // playPhoneme / speak calls between them.
      for (let i = 0; i < 10; i += 1) {
        await vi.advanceTimersByTimeAsync(500);
        await flushPromises();
      }
      await wrapper.find('button[aria-label="Done"]').trigger('click');
      expect(wrapper.emitted('step-complete')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('has no step title heading', () => {
    const wrapper = mount(PhonemicAwarenessStep, { props: { step: fixtureStep } });
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
