import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import NewConceptStep from './NewConceptStep.vue';

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
    speakTeacher: vi.fn().mockResolvedValue(undefined),
    playPhoneme: vi.fn().mockResolvedValue(undefined),
    stopSpeaking: vi.fn(),
  }),
}));

const fixtureStep = {
  instructionalNotes: 'Teach the letter M.',
  introductionScript: [
    { line: '1', text: 'This is the letter M.' },
    { line: '2', text: 'M says /m/.' },
  ],
  articulatoryGesture: 'Lips together.',
  graphemePlacements: [
    { grapheme: 'm', position: 'initial', examples: ['mat'] },
  ],
  readWords: { iDo: ['am'], weDo: [], youDo: [] },
  spellWords: { iDo: ['am'], weDo: [], youDo: [] },
};

function tokens(wrapper) {
  return wrapper.findComponent({ name: 'FocusStage' }).props('tokens');
}

describe('NewConceptStep', () => {
  it('mounts and shows the grapheme via FocusStage', () => {
    const wrapper = mount(NewConceptStep, { props: { step: fixtureStep } });
    const first = tokens(wrapper)[0];
    expect(first).toMatchObject({ text: 'm', kind: 'grapheme' });
  });

  it('walks script → read → spell → emits step-complete', async () => {
    const wrapper = mount(NewConceptStep, { props: { step: fixtureStep } });
    await wrapper.find('button[aria-label="Next"]').trigger('click');
    await wrapper.find('button[aria-label="Start practice"]').trigger('click');
    await flushPromises();
    await wrapper.find('.word-chip').trigger('click');
    await wrapper.find('button[aria-label="Spell next"]').trigger('click');
    await flushPromises();
    await wrapper.find('.word-chip').trigger('click');
    await wrapper.find('button[aria-label="Done"]').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('has no step title heading', () => {
    const wrapper = mount(NewConceptStep, { props: { step: fixtureStep } });
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
