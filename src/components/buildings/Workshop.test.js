import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Workshop from './Workshop.vue';
import { store } from '../../store';

const submitSkillStateUpdateMock = vi.fn(() => Promise.resolve());

vi.mock('../../composables/useProfileProgress.js', () => ({
  useProfileProgress: () => ({
    submitSkillStateUpdate: submitSkillStateUpdateMock,
  }),
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('Workshop Component', () => {
  beforeEach(() => {
    store.xp = 0;
    submitSkillStateUpdateMock.mockClear();
  });

  it('should display the match heading', () => {
    const wrapper = mount(Workshop);
    expect(wrapper.text()).toContain('Match the phoneme');
  });

  it('should show choice buttons for phonemes', () => {
    const wrapper = mount(Workshop);
    const buttons = wrapper.findAll('.choice');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('routes skill state changes through canonical progress sync on correct match', async () => {
    const wrapper = mount(Workshop);
    // Find the button matching the current target
    const targetText = wrapper.find('.target-letter').text().toLowerCase();
    const correctBtn = wrapper.findAll('.choice').find(
      (btn) => btn.text().toLowerCase() === targetText
    );
    expect(correctBtn).toBeTruthy();

    await correctBtn.trigger('click');
    expect(store.xp).toBe(0);
    expect(submitSkillStateUpdateMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Correct');
  });
});
