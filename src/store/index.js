import { reactive } from 'vue';

/** @type {Record<string, import('../models').SkillState>} */
export const skillState = reactive({});

export const store = reactive({
  currentPage: 'selection',
  activeLessonId: null,
  activeActivity: null,
  selectedFriend: null,
  xp: 0,
  ufliProgress: {},
});
