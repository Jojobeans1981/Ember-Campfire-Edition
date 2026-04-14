import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WordWorkStep from './WordWorkStep.vue';

describe('WordWorkStep', () => {
  it('mounts and shows the word chain', () => {
    const wrapper = mount(WordWorkStep, {
      props: { step: { wordChain: ['at', 'mat', 'sat'] } },
    });
    expect(wrapper.text()).toContain('Word Work');
    expect(wrapper.findAll('.word-chip').length).toBe(3);
  });

  it('emits step-complete when chain is done and no sort/meaning', async () => {
    const wrapper = mount(WordWorkStep, {
      props: { step: { wordChain: ['at', 'mat'] } },
    });
    const chips = wrapper.findAll('.word-chip');
    for (const c of chips) await c.trigger('click');
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('progresses through optional word meaning section', async () => {
    const wrapper = mount(WordWorkStep, {
      props: {
        step: {
          wordChain: ['unhappy'],
          wordMeaning: {
            prompt: 'Define each word',
            items: [
              {
                word: 'unhappy',
                morphemes: ['un', 'happy'],
                supportPrompt: 'What does un- mean?',
                expectedMeaning: 'not happy',
                acceptableKeywords: ['not', 'sad'],
              },
            ],
          },
        },
      },
    });
    await wrapper.find('.word-chip').trigger('click');
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.text()).toContain('Define each word');
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });
});
