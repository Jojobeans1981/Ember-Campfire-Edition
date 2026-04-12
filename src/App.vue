<template>
  <div class="stellar-theme">
    <div v-if="store.currentPage === 'selection'" class="page selection-view">
      <h1 class="accessible-text">Choose a Guardian</h1>
      <div class="character-grid">
        <div 
          v-for="(friend, index) in friendList" 
          :key="index" 
          @click="selectFriend(friend)" 
          class="char-card"
        >
          <img :src="'/assets/friends/' + friend.file" class="friend-icon" :alt="friend.name" />
        </div>
      </div>
    </div>

    <div v-else class="page campground-shell">
      <header class="top-ui">
        <button class="nav-btn" @click="store.currentPage = 'selection'">Orbit</button>
        <div class="xp-display">✨ {{ store.xp }} Sparks</div>
      </header>

      <main class="content-injector">
         <component :is="buildings[store.activeBuilding]" />
      </main>

      <nav class="bottom-nav">
        <button 
          @click="store.activeBuilding = 'Campfire'" 
          :class="{ 'nav-active': store.activeBuilding === 'Campfire' }"
        >Campfire</button>
        <button 
          @click="store.activeBuilding = 'Workshop'" 
          :class="{ 'nav-active': store.activeBuilding === 'Workshop' }"
        >Workshop</button>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { store } from './store';
import Campfire from './components/buildings/Campfire.vue';
import Workshop from './components/buildings/Workshop.vue';

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
</script>

<style>
:root { 
  --ember-orange: #FF8C00; 
  --stellar-teal: #64FFDA; 
  --bg-deep: #05070A; 
}

body { margin: 0; background: var(--bg-deep); overflow: hidden; font-family: 'Segoe UI', sans-serif; }

.stellar-theme { color: #E0E0E0; min-height: 100vh; display: flex; justify-content: center; }

/* Selection Grid Fix */
.selection-view { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; }
.character-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 2rem; }
.char-card { width: 180px; height: 180px; border: 4px solid #1a1c23; border-radius: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; background: #111; }
.friend-icon { width: 140px; height: 140px; object-fit: contain; }

/* Campground Shell Fix */
.campground-shell { width: 100%; display: flex; flex-direction: column; align-items: center; }
.top-ui { position: fixed; top: 20px; width: 90%; display: flex; justify-content: space-between; z-index: 100; }
.nav-btn { background: rgba(255,255,255,0.05); border: 1px solid var(--stellar-teal); color: var(--stellar-teal); padding: 10px 20px; border-radius: 10px; cursor: pointer; }
.xp-display { font-size: 1.2rem; color: var(--stellar-teal); font-weight: bold; }

.content-injector { padding-top: 100px; width: 100%; flex-grow: 1; display: flex; justify-content: center; }

.bottom-nav { position: fixed; bottom: 30px; display: flex; gap: 10px; background: #111; padding: 8px; border-radius: 18px; border: 1px solid #222; }
.bottom-nav button { background: transparent; border: none; color: #888; padding: 10px 20px; border-radius: 12px; cursor: pointer; font-size: 0.9rem; }
.bottom-nav button.nav-active { background: var(--stellar-teal); color: var(--bg-deep); font-weight: bold; }

.accessible-text { font-size: 2.2rem; margin-bottom: 10px; letter-spacing: 0.05em; }
</style>
