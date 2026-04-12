import { reactive } from 'vue';

export const store = reactive({
  currentPage: 'selection',
  activeBuilding: 'Campfire',
  selectedFriend: null,
  xp: 0
});
