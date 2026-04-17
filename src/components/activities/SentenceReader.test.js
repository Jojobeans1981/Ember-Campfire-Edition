import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SentenceReader from './SentenceReader.vue';

const mocks = vi.hoisted(() => ({
  startWordListening: vi.fn(),
  requestMicPermission: vi.fn().mockResolvedValue({}),
  cancelListening: vi.fn(),
  speak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../data/ufli/ufliLessons.js', () => ({
  getCumulativeReadSentences: vi.fn().mockResolvedValue(['I am.']),
}));

vi.mock('../../composables/useSpeechRecognition.js', () => ({
  useSpeechRecognition: () => ({
    startWordListening: mocks.startWordListening,
    requestMicPermission: mocks.requestMicPermission,
    cancelListening: mocks.cancelListening,
    sustainProgress: { value: 0 },
  }),
}));

vi.mock('../../composables/useEmber.js', () => ({
  useEmber: () => ({
    speak: mocks.speak,
    stopSpeaking: vi.fn(),
  }),
}));

describe('SentenceReader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.startWordListening.mockReset();
    mocks.requestMicPermission.mockClear();
    mocks.cancelListening.mockClear();
    mocks.speak.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not award progress when sentence recognition misses', async () => {
    mocks.startWordListening.mockResolvedValue({ matched: false });
    const wrapper = mount(SentenceReader, { props: { lessonId: '002', activityType: 'sentence' } });

    await flushPromises();
    await wrapper.get('.read-btn').trigger('click');
    await vi.advanceTimersByTimeAsync(180);
    await flushPromises();

    expect(wrapper.text()).toContain('0 / 3');
    expect(wrapper.emitted('complete')).toBeFalsy();
    expect(mocks.startWordListening).toHaveBeenCalledWith('I am.', 10000);
  });

  it('only advances after a real sentence match', async () => {
    mocks.startWordListening.mockResolvedValue({ matched: true });
    const wrapper = mount(SentenceReader, { props: { lessonId: '002', activityType: 'sentence' } });

    await flushPromises();
    await wrapper.get('.read-btn').trigger('click');
    await vi.advanceTimersByTimeAsync(180);
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();

    expect(wrapper.text()).toContain('1 / 3');
  });
});
