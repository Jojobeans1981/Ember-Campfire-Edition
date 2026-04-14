import { describe, it, expect, beforeEach } from 'vitest';
import {
  ALL_UFLI_LESSON_IDS,
  getUfliLesson,
  getUfliLessonSync,
  getCumulativeWordList,
  lessonIdFromNumber,
  _clearLessonCache,
} from './ufliLessons.js';
import { UFLI_LESSONS_META } from './ufliCurriculum.js';

describe('lessonIdFromNumber', () => {
  it('zero-pads numeric ids to 3 digits', () => {
    expect(lessonIdFromNumber(1)).toBe('001');
    expect(lessonIdFromNumber(45)).toBe('045');
    expect(lessonIdFromNumber(128)).toBe('128');
  });

  it('preserves sub-lesson suffixes and lowercases them', () => {
    expect(lessonIdFromNumber('35a')).toBe('035a');
    expect(lessonIdFromNumber('35A')).toBe('035a');
    expect(lessonIdFromNumber('67b')).toBe('067b');
    expect(lessonIdFromNumber('41c')).toBe('041c');
  });

  it('returns already-formatted ids unchanged', () => {
    expect(lessonIdFromNumber('001')).toBe('001');
    expect(lessonIdFromNumber('035a')).toBe('035a');
  });
});

describe('ALL_UFLI_LESSON_IDS', () => {
  it('has one entry per manifest lesson', () => {
    expect(ALL_UFLI_LESSON_IDS.length).toBe(UFLI_LESSONS_META.length);
  });

  it('places sub-lessons in the right order', () => {
    const idx34 = ALL_UFLI_LESSON_IDS.indexOf('034');
    const idx35a = ALL_UFLI_LESSON_IDS.indexOf('035a');
    const idx35b = ALL_UFLI_LESSON_IDS.indexOf('035b');
    const idx35c = ALL_UFLI_LESSON_IDS.indexOf('035c');
    const idx36a = ALL_UFLI_LESSON_IDS.indexOf('036a');

    expect(idx34).toBeGreaterThanOrEqual(0);
    expect(idx35a).toBe(idx34 + 1);
    expect(idx35b).toBe(idx35a + 1);
    expect(idx35c).toBe(idx35b + 1);
    expect(idx36a).toBe(idx35c + 1);
  });

  it('places 067a and 067b between 066 and 068', () => {
    const idx66 = ALL_UFLI_LESSON_IDS.indexOf('066');
    const idx67a = ALL_UFLI_LESSON_IDS.indexOf('067a');
    const idx67b = ALL_UFLI_LESSON_IDS.indexOf('067b');
    const idx68 = ALL_UFLI_LESSON_IDS.indexOf('068');
    expect(idx67a).toBe(idx66 + 1);
    expect(idx67b).toBe(idx67a + 1);
    expect(idx68).toBe(idx67b + 1);
  });
});

describe('getUfliLesson', () => {
  beforeEach(() => {
    _clearLessonCache();
  });

  it('loads lesson 001 with all 8 steps populated', async () => {
    const lesson = await getUfliLesson('001');
    expect(lesson).toBeDefined();
    expect(lesson.lessonNumber).toBe(1);
    for (const key of ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8']) {
      expect(lesson[key], `lesson 001 missing ${key}`).toBeDefined();
    }
    expect(Array.isArray(lesson.wordList)).toBe(true);
    expect(lesson.wordList.length).toBeGreaterThan(0);
  });

  it('accepts a number argument', async () => {
    const lesson = await getUfliLesson(1);
    expect(lesson).toBeDefined();
    expect(lesson.lessonNumber).toBe(1);
  });

  it('returns undefined for an unknown id', async () => {
    const lesson = await getUfliLesson('999');
    expect(lesson).toBeUndefined();
  });

  it('caches loaded lessons for sync access', async () => {
    expect(getUfliLessonSync('001')).toBeUndefined();
    await getUfliLesson('001');
    expect(getUfliLessonSync('001')).toBeDefined();
  });

  it('loads lessons 001 through 010 with all 8 steps and non-empty word lists', async () => {
    for (let i = 1; i <= 10; i++) {
      const id = lessonIdFromNumber(i);
      const lesson = await getUfliLesson(id);
      expect(lesson, `lesson ${id} failed to load`).toBeDefined();
      for (const key of ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8']) {
        expect(lesson[key], `lesson ${id} missing ${key}`).toBeDefined();
      }
      expect(lesson.wordList.length, `lesson ${id} has empty wordList`).toBeGreaterThan(0);
    }
  });
});

describe('getCumulativeWordList', () => {
  beforeEach(() => {
    _clearLessonCache();
  });

  it('returns at least one word for lesson 001', async () => {
    const words = await getCumulativeWordList('001');
    expect(words.length).toBeGreaterThan(0);
  });

  it('returns words from lessons 1+2+3 for lesson 003', async () => {
    const words = await getCumulativeWordList('003');
    const lesson1 = await getUfliLesson('001');
    const lesson2 = await getUfliLesson('002');
    const lesson3 = await getUfliLesson('003');
    const expected = new Set([
      ...lesson1.wordList,
      ...lesson2.wordList,
      ...lesson3.wordList,
    ]);
    expect(words.length).toBe(expected.size);
    for (const w of expected) {
      expect(words).toContain(w);
    }
  });

  it('deduplicates words that appear in multiple lessons', async () => {
    const words = await getCumulativeWordList('010');
    const set = new Set(words);
    expect(set.size).toBe(words.length);
  });

  it('returns more (or equal) words for later lessons', async () => {
    const w3 = await getCumulativeWordList('003');
    const w5 = await getCumulativeWordList('005');
    expect(w5.length).toBeGreaterThanOrEqual(w3.length);
  });
});
