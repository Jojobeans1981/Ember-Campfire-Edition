import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AuditoryDrillStep from './AuditoryDrillStep.vue';

vi.mock('../../composables/useEmber.js', () => ({
  useEmber: () => ({
    speak: vi.fn().mockResolvedValue(undefined),
    playPhoneme: vi.fn().mockResolvedValue(undefined),
    stopSpeaking: vi.fn(),
  }),
}));

vi.mock('../../data/ufli/ufliLessons.js', () => ({
  getCumulativeIntroducedGraphemes: vi.fn().mockReturnValue(['a', 'm', 's']),
  getUpcomingGraphemes: vi.fn().mockReturnValue(['t']),
}));

const fixtureStep = {
  items: [
    { phoneme: '/ă/', graphemes: ['a'] },
  ],
};

describe('AuditoryDrillStep', () => {
  it('shows distractor choices even when the current step has one grapheme', async () => {
    const wrapper = mount(AuditoryDrillStep, {
      props: {
        step: fixtureStep,
        lessonId: '001',
      },
    });

    await flushPromises();

    const choices = wrapper.findAll('.choice-btn').map((node) => node.text());
    expect(choices).toContain('a');
    expect(choices.length).toBeGreaterThan(1);
  });

  it('has no step title heading', () => {
    const wrapper = mount(AuditoryDrillStep, {
      props: {
        step: fixtureStep,
        lessonId: '001',
      },
    });
    expect(wrapper.find('h3').exists()).toBe(false);
  });
});
