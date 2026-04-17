import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

function currentSentence(wrapper) {
  const tokens = wrapper.findComponent({ name: 'FocusStage' }).props('tokens');
  return tokens[0]?.text ?? '';
}

describe('ConnectedTextStep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts and shows the first sentence via FocusStage', () => {
    const wrapper = mount(ConnectedTextStep, { props: { step: fixtureStep } });
    expect(currentSentence(wrapper)).toBe('I am sam.');
  });

  it('requires a mic match before advancing and emits step-complete on last', async () => {
    const wrapper = mount(ConnectedTextStep, { props: { step: fixtureStep } });

    await wrapper.find('button[aria-label="My turn to read"]').trigger('click');
    await vi.advanceTimersByTimeAsync(180);
    await flushPromises();
    await wrapper.find('button[aria-label="Next"]').trigger('click');
    expect(currentSentence(wrapper)).toBe('sam sat.');

    await wrapper.find('button[aria-label="My turn to read"]').trigger('click');
    await vi.advanceTimersByTimeAsync(180);
    await flushPromises();
    await wrapper.find('button[aria-label="Done"]').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('handles empty sentence list by emitting step-complete on mount', async () => {
    const wrapper = mount(ConnectedTextStep, { props: { step: { readSentences: [] } } });
    await flushPromises();
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('has no step title heading', () => {
    const wrapper = mount(ConnectedTextStep, { props: { step: fixtureStep } });
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
