<template>
  <div class="app">
    <!-- Top bar (if not on selection screen) -->
    <header v-if="store.currentPage !== 'selection'" class="top-bar">
      <button class="nav-btn" @click="goToSelection">Back</button>
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

      <!-- Campground screen -->
      <div v-else class="campground">
        <component :is="buildings[store.activeBuilding]" />
      </div>
    </main>

    <!-- Bottom nav (only on campground) -->
    <nav v-if="store.currentPage !== 'selection'" class="bottom-nav">
      <button :class="{ active: store.activeBuilding === 'Campfire' }" @click="store.activeBuilding = 'Campfire'">Campfire</button>
      <button :class="{ active: store.activeBuilding === 'Workshop' }" @click="store.activeBuilding = 'Workshop'">Workshop</button>
      <button @click="showLesson = true">Lesson 1</button>
      <button @click="showDashboard = true">Dashboard</button>
    </nav>

    <!-- Lesson overlay -->
    <div v-if="showLesson" class="overlay">
      <div class="overlay-card">
        <button class="close-btn" @click="showLesson = false">×</button>
        <LessonPlayer lessonId="001" />
      </div>
    </div>

    <!-- Dashboard overlay -->
    <div v-if="showDashboard" class="overlay">
      <div class="overlay-card">
        <button class="close-btn" @click="showDashboard = false">×</button>
        <Dashboard />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { store } from './store';
import Campfire from './components/buildings/Campfire.vue';
import Workshop from './components/buildings/Workshop.vue';
import LessonPlayer from './components/LessonPlayer.vue';
import Dashboard from './components/Dashboard.vue';

const buildings = { Campfire, Workshop };

const friendList = [
  { name: 'Fox', file: 'fox_1984443.png' },
  { name: 'Lion', file: 'lion_1817275.png' },
  { name: 'Panda', file: 'panda_8493111.png' },
  { name: 'Guardian', file: 'fox_1984443.png' }
];

const selectFriend = (friend) => {
  store.selectedFriend = friend;
  store.currentPage = 'campground';
};

const goToSelection = () => {
  store.currentPage = 'selection';
};

const showLesson = ref(false);
const showDashboard = ref(false);
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #05070A;
  color: #E0E0E0;
  font-family: 'Segoe UI', sans-serif;
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
  background: rgba(0,0,0,0.2);
  border-bottom: 1px solid #222;
}

.nav-btn {
  background: transparent;
  border: 1px solid #64FFDA;
  color: #64FFDA;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
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
}

.friend-img {
  width: 70%;
  height: 70%;
  object-fit: contain;
}

.campground {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-nav {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #111;
  border-top: 1px solid #222;
}

.bottom-nav button {
  background: transparent;
  border: none;
  color: #888;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
}

.bottom-nav button.active {
  background: #64FFDA;
  color: #05070A;
  font-weight: bold;
}

/* Overlays */
.overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.overlay-card {
  background: #111;
  border-radius: 1rem;
  padding: 1rem;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: transparent;
  border: none;
  color: #888;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
}
</style>
