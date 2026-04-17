import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VisualDrillStep from './VisualDrillStep.vue';

const startListening = vi.fn().mockResolvedValue({ matched: true });
const cancelListening = vi.fn();
const requestMicPermission = vi.fn().mockResolvedValue({});

vi.mock('../../composables/useSpeechRecognition.js', () => ({
  useSpeechRecognition: () => ({
    startListening,
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
  items: [
    { grapheme: 'm', phonemes: ['/m/'] },
  ],
};

function tokens(wrapper) {
  return wrapper.findComponent({ name: 'FocusStage' }).props('tokens');
}

describe('VisualDrillStep', () => {
  it('renders the current grapheme as a FocusStage token', () => {
    const wrapper = mount(VisualDrillStep, { props: { step: fixtureStep } });
    const first = tokens(wrapper)[0];
    expect(first).toMatchObject({ text: 'm', kind: 'grapheme' });
  });

  it('emits step-complete on mount when items are empty', async () => {
    const wrapper = mount(VisualDrillStep, { props: { step: { items: [] } } });
    await flushPromises();
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('has no debug card or step title', () => {
    const wrapper = mount(VisualDrillStep, { props: { step: fixtureStep } });
    expect(wrapper.find('.debug-card').exists()).toBe(false);
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
