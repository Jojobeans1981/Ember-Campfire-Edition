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

  it('mounts in UFLI mode when step.wordChain is present', () => {
    const wrapper = mount(BlendingStep, { props: { step: ufliStep } });
    expect(wrapper.find('.ufli-mode').exists()).toBe(true);
    expect(wrapper.text()).toContain('at');
  });

  it('renders tile pools', () => {
    const wrapper = mount(BlendingStep, { props: { step: ufliStep } });
    expect(wrapper.findAll('.tile').length).toBe(4); // m, s, a, t
  });

  it('advances chain and emits step-complete on last word', async () => {
    const wrapper = mount(BlendingStep, { props: { step: ufliStep } });
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.text()).toContain('mat');
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.text()).toContain('sat');
    await wrapper.find('.next-btn').trigger('click');
    expect(wrapper.emitted('step-complete')).toBeTruthy();
  });
});
