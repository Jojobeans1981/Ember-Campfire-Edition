import { describe, it, expect, beforeEach } from 'vitest';
import {
  ALL_UFLI_LESSON_IDS,
  getUfliLesson,
  getUfliLessonSync,
  getCumulativeWordList,
  getCumulativeDecodableWords,
  getCumulativeIntroducedGraphemes,
  getCumulativeReadSentences,
  getUpcomingGraphemes,
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

describe('getCumulativeIntroducedGraphemes', () => {
  it('returns just the grapheme meta.grapheme taught through the target lesson', () => {
    // Lesson 1 teaches only "a"; no other letters have been introduced yet
    // even though lesson 1's wordList contains "cat", "map", "the".
    expect(getCumulativeIntroducedGraphemes('001')).toEqual(['a']);
  });

  it('accumulates graphemes across lessons in manifest order', () => {
    // Lessons 1..4 introduce a, m, s, t (per UFLI_LESSONS_META).
    expect(getCumulativeIntroducedGraphemes('004')).toEqual(['a', 'm', 's', 't']);
  });

  it('splits comma-separated grapheme entries (e.g. "a, i")', () => {
    // Lesson 10 has grapheme "a, i"; result should include both.
    const result = getCumulativeIntroducedGraphemes('010');
    expect(result).toContain('a');
    expect(result).toContain('i');
  });

  it('ignores lessons with empty grapheme fields (review lessons)', () => {
    // Lesson 5 ("VC & CVC Words") has grapheme "" — should contribute nothing.
    const before = getCumulativeIntroducedGraphemes('004');
    const after = getCumulativeIntroducedGraphemes('005');
    expect(after).toEqual(before);
  });

  it('preserves digraph graphemes like "sh" and "ck" atomically', () => {
    // Lesson 44 introduces "ck", lesson 45 introduces "sh".
    const idx44 = ALL_UFLI_LESSON_IDS.indexOf('044');
    const idx45 = ALL_UFLI_LESSON_IDS.indexOf('045');
    if (idx44 >= 0) expect(getCumulativeIntroducedGraphemes('044')).toContain('ck');
    if (idx45 >= 0) expect(getCumulativeIntroducedGraphemes('045')).toContain('sh');
  });

  it('returns [] for an unknown lesson id', () => {
    expect(getCumulativeIntroducedGraphemes('999')).toEqual([]);
  });
});

describe('getCumulativeDecodableWords with authored decompositions', () => {
  beforeEach(() => {
    _clearLessonCache();
  });

  it('uses step7.teach breakdown phonemes for heart words (the → /ð/ + /ə/)', async () => {
    const words = await getCumulativeDecodableWords('001');
    const the = words.find((w) => w.word.toLowerCase() === 'the');
    expect(the).toBeDefined();
    expect(the.phonemes).toEqual(['/ð/', '/ə/']);
  });

  it('uses step7.teach breakdown graphemes for heart words (the → th + e)', async () => {
    const words = await getCumulativeDecodableWords('001');
    const the = words.find((w) => w.word.toLowerCase() === 'the');
    expect(the.graphemes).toEqual(['th', 'e']);
  });

  it('uses step1.blend phonemes when available', async () => {
    const words = await getCumulativeDecodableWords('001');
    const at = words.find((w) => w.word.toLowerCase() === 'at');
    expect(at).toBeDefined();
    expect(at.phonemes).toEqual(['/ă/', '/t/']);
  });

  it('falls back to letter-split for words without an authored breakdown', async () => {
    const words = await getCumulativeDecodableWords('001');
    // "cat" is in lesson 1's wordList but has no authored breakdown —
    // expect letter-split fallback for both phonemes and graphemes.
    const cat = words.find((w) => w.word.toLowerCase() === 'cat');
    expect(cat).toBeDefined();
    expect(cat.phonemes).toEqual(['c', 'a', 't']);
    expect(cat.graphemes).toEqual(['c', 'a', 't']);
  });
});

describe('getCumulativeReadSentences', () => {
  beforeEach(() => {
    _clearLessonCache();
  });

  it('returns [] for lesson 001 (status:"no_decodable", empty step8)', async () => {
    const sentences = await getCumulativeReadSentences('001');
    expect(sentences).toEqual([]);
  });

  it('returns [] for an unknown lesson id', async () => {
    const sentences = await getCumulativeReadSentences('999');
    expect(sentences).toEqual([]);
  });
});

describe('getUpcomingGraphemes', () => {
  it('returns the next few lesson graphemes that come after the target', () => {
    // After lesson 1 (a), the next three introduce m, s, t.
    expect(getUpcomingGraphemes('001', 3)).toEqual(['m', 's', 't']);
  });

  it('skips review/practice lessons with empty grapheme fields', () => {
    // Lesson 5 is "VC & CVC Words" (grapheme ""); lesson 6 introduces p.
    // Looking forward from lesson 4 should skip over 5 to p, f, i.
    expect(getUpcomingGraphemes('004', 3)).toEqual(['p', 'f', 'i']);
  });

  it('honors the limit', () => {
    expect(getUpcomingGraphemes('001', 1)).toEqual(['m']);
  });

  it('returns [] for an unknown lesson id', () => {
    expect(getUpcomingGraphemes('999', 3)).toEqual([]);
  });

  it('never returns a grapheme already introduced through the target', () => {
    const introduced = new Set(getCumulativeIntroducedGraphemes('004'));
    const upcoming = getUpcomingGraphemes('004', 5);
    for (const g of upcoming) {
      expect(introduced.has(g)).toBe(false);
    }
  });
});
