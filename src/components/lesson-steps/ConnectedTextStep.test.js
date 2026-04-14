import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ConnectedTextStep from './ConnectedTextStep.vue';

const startWordListening = vi.fn().mockResolvedValue({ matched: true });
const cancelListening = vi.fn();
const requestMicPermission = vi.fn().mockResolvedValue({});

vi.mock('../../composables/useSpeechRecognition.js', () => ({
  useSpeechRecognition: () => ({
    startWordListening,
    cancelListening,
    requestMicPermission,
    sustainProgress: { value: 0 },
  }),
}));

vi.mock('../../composables/useEmber.js', () => ({
  useEmber: () => ({
    speak: vi.fn().mockResolvedValue(undefined),
    playPhoneme: vi.fn().mockResolvedValue(undefined),
    stopSpeaking: vi.fn(),
  }),
}));

const fixtureStep = {
  readSentences: ['I am sam.', 'sam sat.'],
  spellSentences: [],
};

describe('ConnectedTextStep', () => {
  it('mounts and shows the first sentence', () => {
    const wrapper = mount(ConnectedTextStep, { props: { step: fixtureStep } });
    expect(wrapper.text()).toContain('I am sam.');
  });

  it('requires a mic match before advancing and emits step-complete on last', async () => {
    const wrapper = mount(ConnectedTextStep, { props: { step: fixtureStep } });

    // First sentence: trigger mic, then Next
    await wrapper.find('.audio-btn:nth-child(2)').trigger('click'); // 'My turn' is the second audio-btn
    await flushPromises();
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.text()).toContain('sam sat.');

    // Second sentence: same dance
    await wrapper.find('.audio-btn:nth-child(2)').trigger('click');
    await flushPromises();
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
