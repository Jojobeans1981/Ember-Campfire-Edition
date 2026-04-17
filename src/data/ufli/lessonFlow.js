export const UFLI_LESSON_STEP_KEYS = [
  'step1',
  'step2',
  'step3',
  'step4',
  'step5',
  'step6',
  'step7',
  'step8',
];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function letterCount(value) {
  const text = normalizeText(value);
  const matches = text.match(/[a-z]/gi);
  return matches ? matches.length : 0;
}

function hasRenderableWordList(list, minimumLetters = 2) {
  return Array.isArray(list) && list.some((entry) => letterCount(entry) >= minimumLetters);
}

function hasRenderableItems(list, predicate) {
  return Array.isArray(list) && list.some((entry) => predicate(entry ?? {}));
}

function hasRenderableScript(stepData) {
  return hasRenderableItems(stepData?.introductionScript, (line) => normalizeText(line?.text).length > 0);
}

function hasRenderablePlacements(stepData) {
  return hasRenderableItems(stepData?.graphemePlacements, (placement) => {
    return normalizeText(placement?.grapheme).length > 0
      || hasRenderableWordList(placement?.examples ?? [], 1);
  });
}

function hasRenderableSentenceList(list) {
  return Array.isArray(list) && list.some((entry) => normalizeText(entry).length > 0);
}

function hasRenderableIrregularWords(list) {
  return hasRenderableItems(list, (entry) => {
    return normalizeText(entry?.word).length > 0
      || hasRenderableItems(entry?.breakdown, (part) => normalizeText(part?.grapheme).length > 0);
  });
}

function hasRenderableTiles(tiles) {
  if (!tiles || typeof tiles !== 'object') return false;
  return ['initial', 'medial', 'final'].some((bucket) => Array.isArray(tiles[bucket]) && tiles[bucket].length > 0);
}

function hasRenderableWordSort(sortData) {
  if (!sortData || typeof sortData !== 'object') return false;
  const words = Array.isArray(sortData.words) ? sortData.words : [];
  return words.some((entry) => normalizeText(typeof entry === 'string' ? entry : entry?.word ?? entry?.text).length > 0);
}

function hasRenderableWordMeaning(meaningData) {
  if (!meaningData || typeof meaningData !== 'object') return false;
  return hasRenderableItems(meaningData.items, (item) => normalizeText(item?.word).length > 0);
}

export function isUfliLessonStepRenderable(stepKey, stepData) {
  if (!stepData) return false;

  switch (stepKey) {
    case 'step1':
      return hasRenderableItems(stepData?.blend, (item) => (item?.phonemes?.length ?? 0) >= 2)
        || hasRenderableItems(stepData?.segment, (item) => letterCount(item?.word) >= 2);
    case 'step2':
      return hasRenderableItems(stepData?.items, (item) => {
        return normalizeText(item?.grapheme).length > 0 || (item?.phonemes?.length ?? 0) > 0;
      });
    case 'step3':
      return hasRenderableItems(stepData?.items, (item) => {
        return normalizeText(item?.phoneme).length > 0 || (item?.graphemes?.length ?? 0) > 0;
      });
    case 'step4':
      return hasRenderableWordList(stepData?.wordChain ?? [], 2) || hasRenderableTiles(stepData?.tiles);
    case 'step5':
      return hasRenderableScript(stepData)
        || hasRenderablePlacements(stepData)
        || hasRenderableWordList([
          ...(stepData?.readWords?.iDo ?? []),
          ...(stepData?.readWords?.weDo ?? []),
          ...(stepData?.readWords?.youDo ?? []),
          ...(stepData?.spellWords?.iDo ?? []),
          ...(stepData?.spellWords?.weDo ?? []),
          ...(stepData?.spellWords?.youDo ?? []),
        ], 1)
        || normalizeText(stepData?.articulatoryGesture).length > 0;
    case 'step6':
      return hasRenderableWordList(stepData?.wordChain ?? [], 2)
        || hasRenderableWordSort(stepData?.wordSort)
        || hasRenderableWordMeaning(stepData?.wordMeaning);
    case 'step7':
      return hasRenderableIrregularWords(stepData?.review ?? [])
        || hasRenderableIrregularWords(stepData?.teach ?? []);
    case 'step8':
      return hasRenderableSentenceList(stepData?.readSentences)
        || hasRenderableSentenceList(stepData?.spellSentences);
    default:
      return true;
  }
}

export function getRenderableUfliStepKeys(lessonData) {
  if (!lessonData) return [];
  return UFLI_LESSON_STEP_KEYS.filter((stepKey) => isUfliLessonStepRenderable(stepKey, lessonData?.[stepKey]));
}
