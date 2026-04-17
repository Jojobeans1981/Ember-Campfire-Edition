import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BlendingGame from './BlendingGame.vue';

const mocks = vi.hoisted(() => ({
  startWordListening: vi.fn(),
  requestMicPermission: vi.fn().mockResolvedValue({}),
  cancelListening: vi.fn(),
  speak: vi.fn().mockResolvedValue(undefined),
  playPhoneme: vi.fn().mockResolvedValue(undefined),
  celebrateCorrect: vi.fn(),
}));

vi.mock('../../data/ufli/ufliLessons.js', () => ({
  getCumulativeDecodableWords: vi.fn().mockResolvedValue([
    { word: 'am', phonemes: ['/a/', '/m/'], graphemes: ['a', 'm'] },
  ]),
  getCumulativeIntroducedGraphemes: vi.fn().mockReturnValue(['a', 'm']),
}));

vi.mock('../../composables/useSpeechRecognition.js', () => ({
  useSpeechRecognition: () => ({
    startWordListening: mocks.startWordListening,
    requestMicPermission: mocks.requestMicPermission,
    cancelListening: mocks.cancelListening,
  }),
}));

vi.mock('../../composables/useEmber.js', () => ({
  useEmber: () => ({
    speak: mocks.speak,
    playPhoneme: mocks.playPhoneme,
    stopSpeaking: vi.fn(),
  }),
}));

vi.mock('../../composables/useCelebration.js', () => ({
  celebrateCorrect: mocks.celebrateCorrect,
}));

describe('BlendingGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.startWordListening.mockReset();
    mocks.requestMicPermission.mockClear();
    mocks.cancelListening.mockClear();
    mocks.speak.mockClear();
    mocks.playPhoneme.mockClear();
    mocks.celebrateCorrect.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not award a point when the child never matches the word', async () => {
    mocks.startWordListening.mockResolvedValue({ matched: false });
    const wrapper = mount(BlendingGame, { props: { lessonId: '002', activityType: 'blend' } });

    await flushPromises();

    const tiles = wrapper.findAll('.tile');
    await tiles[0].trigger('click');
    await flushPromises();
    await tiles[1].trigger('click');
    await vi.advanceTimersByTimeAsync(180);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();

    expect(wrapper.text()).toContain('0 / 5');
    expect(mocks.celebrateCorrect).not.toHaveBeenCalled();
  });
});
