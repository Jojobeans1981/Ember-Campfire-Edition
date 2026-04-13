import { reactive } from 'vue';

/** @type {Record<string, import('../models').SkillState>} */
export const skillState = reactive({});

const initialPhonemes = ['m','s','t','a','p','n','i','c'];

initialPhonemes.forEach(p => {
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
  activeBuilding: 'Campfire',
  selectedFriend: null,
  xp: 0,
  currentLesson: null,
});
