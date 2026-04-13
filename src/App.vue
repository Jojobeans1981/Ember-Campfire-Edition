<template>
  <div class="app">
    <!-- Top bar -->
    <header v-if="store.currentPage !== 'selection'" class="top-bar">
      <button class="nav-btn" @click="goBack">Back</button>
      <div class="xp-display">✨ {{ store.xp }} Sparks</div>
    </header>

    <!-- Main area -->
    <main class="main">
      <!-- Selection screen -->
      <div v-if="store.currentPage === 'selection'" class="selection">
        <h2>Choose a Guardian</h2>
        <div class="character-grid">
          <div v-for="friend in friendList" :key="friend.name" class="char-card" @click="selectFriend(friend)">
            <img :src="'/assets/friends/' + friend.file" class="friend-img" />
          </div>
        </div>
      </div>

      <!-- Campground map -->
      <CampgroundMap v-else-if="store.currentPage === 'campground'" />

      <!-- Unit hub -->
      <UnitHub v-else-if="store.currentPage === 'unit-hub'" />

      <!-- Lesson player -->
      <LessonPlayer v-else-if="store.currentPage === 'lesson'" :unitId="store.activeUnitId" @complete="onLessonComplete" />

      <!-- Activity player -->
      <ActivityPlayer v-else-if="store.currentPage === 'activity'" :unitId="store.activeUnitId" :activityType="store.activeActivity" @complete="onActivityComplete" />

      <!-- Story reader -->
      <StoryReader v-else-if="store.currentPage === 'story'" :unitId="store.activeUnitId" @complete="onStoryComplete" />

      <!-- Dashboard -->
      <Dashboard v-else-if="store.currentPage === 'dashboard'" />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { store } from './store';
import { usePersistence } from './composables/usePersistence.js';
import { useProgression } from './composables/useProgression.js';
import CampgroundMap from './components/CampgroundMap.vue';
import UnitHub from './components/UnitHub.vue';
import LessonPlayer from './components/LessonPlayer.vue';
import ActivityPlayer from './components/ActivityPlayer.vue';
import StoryReader from './components/StoryReader.vue';
import Dashboard from './components/Dashboard.vue';

const { save, load } = usePersistence();
const { completeLesson, completeActivity, completeStory } = useProgression();

const friendList = [
  { name: 'Fox', file: 'fox_1984443.png' },
  { name: 'Lion', file: 'lion_1817275.png' },
  { name: 'Panda', file: 'panda_8493111.png' },
  { name: 'Guardian', file: 'fox_1984443.png' },
];

onMounted(() => {
  const loaded = load();
  if (loaded && store.selectedFriend) {
    store.currentPage = 'campground';
  }
});

function selectFriend(friend) {
  store.selectedFriend = friend;
  store.currentPage = 'campground';
  save();
}

function goBack() {
  const page = store.currentPage;
  if (page === 'lesson' || page === 'activity' || page === 'story') {
    store.currentPage = 'unit-hub';
  } else if (page === 'unit-hub' || page === 'dashboard') {
    store.currentPage = 'campground';
  } else {
    store.currentPage = 'selection';
  }
}

function onLessonComplete() {
  completeLesson(store.activeUnitId);
  save();
  store.currentPage = 'unit-hub';
}

function onActivityComplete() {
  completeActivity(store.activeUnitId, store.activeActivity);
  save();
  store.currentPage = 'unit-hub';
}

function onStoryComplete() {
  completeStory(store.activeUnitId);
  save();
  store.currentPage = 'unit-hub';
}
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #05070A;
  color: #E0E0E0;
  font-family: 'Andika', 'OpenDyslexicRegular', system-ui, sans-serif;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 100vw;
  overflow: hidden;
}

.top-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid #222;
}

.nav-btn {
  background: transparent;
  border: 1px solid #64FFDA;
  color: #64FFDA;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: inherit;
}

.xp-display {
  color: #64FFDA;
  font-weight: bold;
}

.main {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

.selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 90vw;
}

.selection h2 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  width: 100%;
  max-width: 400px;
}

.char-card {
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid #1a1c23;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111;
  cursor: pointer;
  transition: border-color 0.2s;
}

.char-card:hover {
  border-color: #FF8C00;
}

.friend-img {
  width: 70%;
  height: 70%;
  object-fit: contain;
}
</style>
