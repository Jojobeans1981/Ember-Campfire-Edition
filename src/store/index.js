import { reactive } from 'vue';
import { PHONEME_ORDER } from '../data/curriculum.js';

/** @type {Record<string, import('../models').SkillState>} */
export const skillState = reactive({});

PHONEME_ORDER.forEach(p => {
  skillState[p] = {
    conceptSlug: p,
    strand: 'foundational',
    taught: false,
    recognitionStatus: 'not_introduced',
    recallStatus: null,
    reviewPressure: 'none',
    lastPracticed: null,
    lastAssessed: null,
    currentSupportLevel: 'guided',
  };
});

export const store = reactive({
  currentPage: 'selection',
  activeUnitId: null,
  activeActivity: null,
  selectedFriend: null,
  xp: 0,
  currentLesson: null,
  unitProgress: {},
});
