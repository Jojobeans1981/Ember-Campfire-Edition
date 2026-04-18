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

vi.mock('../../composables/useMicTurn.js', () => ({
  useMicTurn: () => ({
    prepareMicTurn: vi.fn().mockResolvedValue(undefined),
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

const singleWordStep = {
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

const multiWordStep = {
  graphemePlacements: [
    { grapheme: 'a', position: 'initial', examples: ['apple', 'at', 'as'] },
  ],
  readWords: { iDo: [], weDo: [], youDo: [] },
};

function tokens(wrapper) {
  return wrapper.findComponent({ name: 'FocusStage' }).props('tokens');
}

describe('NewConceptStep', () => {
  it('mounts and shows the grapheme via FocusStage', () => {
    const wrapper = mount(NewConceptStep, { props: { step: singleWordStep } });
    const first = tokens(wrapper)[0];
    expect(first).toMatchObject({ text: 'm', kind: 'grapheme' });
  });

  it('emits phase-change with 3 phases on mount (letter → sound → read)', async () => {
    const wrapper = mount(NewConceptStep, { props: { step: singleWordStep } });
    await flushPromises();
    const events = wrapper.emitted('phase-change') ?? [];
    expect(events.length).toBeGreaterThan(0);
    expect(events[0][0]).toMatchObject({ phaseIndex: 0, phaseCount: 3 });
  });

  it('single-word group: letter → sound → read (walking) → step-complete', async () => {
    const wrapper = mount(NewConceptStep, { props: { step: singleWordStep } });
    await flushPromises(); // announceLetter
    await wrapper.find('button[aria-label="Next"]').trigger('click');
    await flushPromises(); // demoSoundAndPrompt
    await wrapper.find('button[aria-label="My turn to say the sound"]').trigger('click');
    await flushPromises();
    // Advance to read phase (walking, single word)
    await wrapper.find('button[aria-label="Next"]').trigger('click');
    await flushPromises();
    // Walking shows the word inline (not as a chip); the primary button is "Done"
    expect(wrapper.find('.word-display').exists()).toBe(true);
    await wrapper.find('button[aria-label="Done"]').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('multi-word group: walking advances through words, then review shows all chips', async () => {
    const wrapper = mount(NewConceptStep, { props: { step: multiWordStep } });
    await flushPromises();
    await wrapper.find('button[aria-label="Next"]').trigger('click'); // → sound
    await flushPromises();
    await wrapper.find('button[aria-label="My turn to say the sound"]').trigger('click');
    await flushPromises();
    await wrapper.find('button[aria-label="Next"]').trigger('click'); // → read walking (word 1: apple)
    await flushPromises();
    expect(wrapper.find('.word-display').exists()).toBe(true);
    await wrapper.find('button[aria-label="Next"]').trigger('click'); // word 2: at
    await flushPromises();
    await wrapper.find('button[aria-label="Next"]').trigger('click'); // word 3: as (last word)
    await flushPromises();
    // After last word in a multi-word group, primary button becomes "Review"
    await wrapper.find('button[aria-label="Review"]').trigger('click');
    await flushPromises();
    // Review: all group words render as chips, tappable to replay
    const chips = wrapper.findAll('.word-chip');
    expect(chips.length).toBe(3);
    await chips[0].trigger('click');
    await flushPromises();
    // Only one group → "Done" advances to step-complete
    await wrapper.find('button[aria-label="Done"]').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('has no step title heading', () => {
    const wrapper = mount(NewConceptStep, { props: { step: singleWordStep } });
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
