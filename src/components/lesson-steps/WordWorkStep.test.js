import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import WordWorkStep from './WordWorkStep.vue';

vi.mock('../../composables/useEmber.js', () => ({
  useEmber: () => ({
    speak: vi.fn().mockResolvedValue(undefined),
    stopSpeaking: vi.fn(),
  }),
}));

describe('WordWorkStep', () => {
  it('renders the word chain as chips', () => {
    const wrapper = mount(WordWorkStep, {
      props: { step: { wordChain: ['at', 'mat', 'sat'] } },
    });
    expect(wrapper.findAll('.word-chip').length).toBe(3);
  });

  it('emits step-complete when chain is done and no sort/meaning', async () => {
    const wrapper = mount(WordWorkStep, {
      props: { step: { wordChain: ['at', 'mat'] } },
    });
    const chips = wrapper.findAll('.word-chip');
    for (const c of chips) await c.trigger('click');
    await wrapper.find('button[aria-label="Done"]').trigger('click');
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
    await wrapper.find('button[aria-label="Word meaning"]').trigger('click');
    await flushPromises();
    const focus = wrapper.findComponent({ name: 'FocusStage' });
    expect(focus.props('tokens')[0].text).toBe('unhappy');
    await wrapper.find('button[aria-label="Done"]').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('has no step title heading', () => {
    const wrapper = mount(WordWorkStep, {
      props: { step: { wordChain: ['at'] } },
    });
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
