import { UNITS } from './curriculum.js';
import { getDecodableWords } from './wordLists.js';
import { getPhonemesUpToUnit } from './curriculum.js';

function buildLesson(unit) {
  const phonemes = unit.phonemes;
  const allPhonemes = getPhonemesUpToUnit(unit.unitId);
  const words = getDecodableWords(allPhonemes).slice(0, 6);
  const blendWords = words.filter(w => w.phonemes.length >= 3).slice(0, 3);

  // Build narration intro
  const narration = [];
  narration.push({ text: `Welcome to ${unit.title}! Let's learn some new sounds.`, action: 'speak' });
  for (const p of phonemes) {
    narration.push({ text: `This is the letter ${p.toUpperCase()}.`, action: 'speak' });
    narration.push({ text: 'It says', action: 'speak' });
    narration.push({ phoneme: p, action: 'play_phoneme' });
    narration.push({ text: `Can you say ${p.toUpperCase()}?`, phoneme: p, action: 'prompt_speech' });
  }
  narration.push({ text: 'Great job! Now let\'s practice.', action: 'speak' });

  // Build visual drill items
  const visualItems = [];
  for (const p of phonemes) {
    visualItems.push({ grapheme: p, phonemeAudio: p });
  }
  // Add one review of each
  for (const p of phonemes) {
    visualItems.push({ grapheme: p, phonemeAudio: p });
  }

  // Build auditory drill items
  const auditoryItems = [];
  for (const p of phonemes) {
    const distractors = phonemes.filter(d => d !== p);
    // Add a previously learned phoneme as extra distractor if available
    const prevPhonemes = allPhonemes.filter(pp => !phonemes.includes(pp));
    if (prevPhonemes.length > 0) {
      distractors.push(prevPhonemes[prevPhonemes.length - 1]);
    }
    auditoryItems.push({ targetPhoneme: p, distractors: distractors.slice(0, 3) });
  }

  // Build blending items
  const blendingItems = blendWords.map(w => ({
    segments: w.phonemes,
    word: w.word,
  }));

  // Build word reading items
  const wordReadingItems = words.slice(0, 4).map(w => ({
    word: w.word,
    segments: w.phonemes,
  }));

  // Build review items (mix of types)
  const reviewItems = [];
  if (phonemes[0]) {
    reviewItems.push({ type: 'visual_drill', grapheme: phonemes[0], phonemeAudio: phonemes[0] });
  }
  if (phonemes[1]) {
    reviewItems.push({
      type: 'auditory_drill',
      targetPhoneme: phonemes[1],
      distractors: phonemes.filter(d => d !== phonemes[1]),
    });
  }
  if (blendWords[0]) {
    reviewItems.push({
      type: 'blending',
      segments: blendWords[0].phonemes,
      word: blendWords[0].word,
    });
  }

  return {
    lessonId: `lesson-${unit.unitId}`,
    unitId: unit.unitId,
    phonemes,
    steps: [
      { stepId: 'intro', type: 'intro', narration },
      { stepId: 'visual-drill', type: 'visual_drill', items: visualItems },
      { stepId: 'auditory-drill', type: 'auditory_drill', items: auditoryItems },
      ...(blendingItems.length > 0
        ? [{ stepId: 'blending', type: 'blending', items: blendingItems }]
        : []),
      ...(wordReadingItems.length > 0
        ? [{ stepId: 'word-reading', type: 'word_reading', items: wordReadingItems }]
        : []),
      { stepId: 'review', type: 'review', items: reviewItems },
    ],
  };
}

// Generate lessons for all units
export const LESSONS = {};
for (const unit of UNITS) {
  LESSONS[unit.unitId] = buildLesson(unit);
}

export function getLessonForUnit(unitId) {
  return LESSONS[unitId] || null;
}
