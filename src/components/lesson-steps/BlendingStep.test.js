import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BlendingStep from './BlendingStep.vue';

vi.mock('../../composables/useEmber.js', () => ({
  useEmber: () => ({
    speak: vi.fn().mockResolvedValue(undefined),
    playPhoneme: vi.fn().mockResolvedValue(undefined),
    stopSpeaking: vi.fn(),
  }),
}));

describe('BlendingStep — UFLI mode', () => {
  const ufliStep = {
    wordChain: ['at', 'mat', 'sat'],
    tiles: {
      initial: ['m', 's'],
      medial: ['a'],
      final: ['t'],
    },
  };

  it('renders FocusStage tokens for the current word', () => {
    const wrapper = mount(BlendingStep, { props: { step: ufliStep } });
    const focus = wrapper.findComponent({ name: 'FocusStage' });
    expect(focus.exists()).toBe(true);
    expect(focus.props('tokens').map((t) => t.text).join('')).toBe('at');
  });

  it('renders tile pools', () => {
    const wrapper = mount(BlendingStep, { props: { step: ufliStep } });
    expect(wrapper.findAll('.tile').length).toBe(4);
  });

  it('advances chain and emits step-complete on last word', async () => {
    const wrapper = mount(BlendingStep, { props: { step: ufliStep } });
    const nextBtn = wrapper.find('button[aria-label="Next"]');
    await nextBtn.trigger('click');
    expect(wrapper.findComponent({ name: 'FocusStage' }).props('tokens').map((t) => t.text).join('')).toBe('mat');
    await nextBtn.trigger('click');
    expect(wrapper.findComponent({ name: 'FocusStage' }).props('tokens').map((t) => t.text).join('')).toBe('sat');
    await wrapper.find('button[aria-label="Done"]').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });

  it('has no step title heading', () => {
    const wrapper = mount(BlendingStep, { props: { step: ufliStep } });
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
