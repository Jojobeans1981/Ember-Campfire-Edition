export const LESSON_SEQUENCE = ['001', '002', '003'];

export const LESSONS = {
  '001': {
    lessonId: '001',
    title: 'Phoneme m',
    phoneme: 'm',
    steps: [
      { stepId: 'step1', type: 'visual_drill', items: [{ grapheme: 'm' }] },
      { stepId: 'step2', type: 'word_work', items: [{ word: 'map' }] },
    ],
  },
  '002': {
    lessonId: '002',
    title: 'Phoneme s',
    phoneme: 's',
    steps: [
      { stepId: 'step1', type: 'visual_drill', items: [{ grapheme: 's' }] },
      { stepId: 'step2', type: 'word_work', items: [{ word: 'sat' }] },
    ],
  },
};
