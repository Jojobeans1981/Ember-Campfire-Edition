import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NewConceptStep from './NewConceptStep.vue';

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

describe('NewConceptStep', () => {
  it('mounts and shows the grapheme', () => {
    const wrapper = mount(NewConceptStep, { props: { step: fixtureStep } });
    expect(wrapper.text()).toContain('m');
    expect(wrapper.text()).toContain('This is the letter M.');
  });

  it('walks script → read → spell → emits step-complete', async () => {
    const wrapper = mount(NewConceptStep, { props: { step: fixtureStep } });
    // Advance through 2-line script
    await wrapper.find('.next-btn').trigger('click'); // line 1 → line 2
    await wrapper.find('.next-btn').trigger('click'); // line 2 → read phase
    // Mark the one read word
    await wrapper.find('.word-chip').trigger('click');
    await wrapper.find('.next-btn').trigger('click'); // read → spell
    // Mark the one spell word
    await wrapper.find('.word-chip').trigger('click');
    await wrapper.find('.next-btn').trigger('click'); // spell → done
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });
});
