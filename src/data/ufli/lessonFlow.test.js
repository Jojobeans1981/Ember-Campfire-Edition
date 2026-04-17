import { describe, it, expect } from 'vitest';
import lesson001 from './lessons/lesson-001.json';
import lesson002 from './lessons/lesson-002.json';
import { getRenderableUfliStepKeys, isUfliLessonStepRenderable } from './lessonFlow.js';

describe('lessonFlow', () => {
  it('keeps lesson 001 focused on the new-concept step only', () => {
    expect(getRenderableUfliStepKeys(lesson001)).toEqual(['step5']);
  });

  it('shows every authored step for lesson 002 once real content exists', () => {
    expect(getRenderableUfliStepKeys(lesson002)).toEqual([
      'step1',
      'step2',
      'step3',
      'step4',
      'step5',
      'step6',
      'step7',
      'step8',
    ]);
  });

  it('treats irregular words and connected text as renderable even in very early lessons', () => {
    expect(isUfliLessonStepRenderable('step7', lesson002.step7)).toBe(true);
    expect(isUfliLessonStepRenderable('step8', lesson002.step8)).toBe(true);
  });

  it('treats word sort and meaning sections as valid word-work content', () => {
    expect(isUfliLessonStepRenderable('step6', {
      wordChain: [],
      wordSort: {
        words: [{ word: 'am', category: 'family' }],
        categories: ['family', 'school'],
      },
    })).toBe(true);

    expect(isUfliLessonStepRenderable('step6', {
      wordChain: [],
      wordMeaning: {
        items: [{ word: 'camp' }],
      },
    })).toBe(true);
  });
});
