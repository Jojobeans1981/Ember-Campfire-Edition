<template>
  <div class="app">
    <!-- Top bar -->
    <header v-if="store.currentPage !== 'selection'" class="top-bar">
      <button class="nav-btn" @click="goBack">
        <span class="back-arrow">&#8592;</span> Back
      </button>
      <div class="xp-display" :class="{ pop: xpPop }">
        <span class="spark-emoji">✨</span> {{ store.xp }} Sparks
      </div>
    </header>

    <!-- Main area -->
    <main class="main">
      <Transition name="page" mode="out-in">
        <!-- Selection screen -->
        <div v-if="store.currentPage === 'selection'" key="selection" class="selection">
          <div class="logo-area">
            <img src="/branding/ember-logo.svg" alt="Ember logo" class="hero-logo" />
            <h1 class="app-title">Ember Campground</h1>
            <p class="app-subtitle">Learn to Read, One Spark at a Time</p>
          </div>
          <h2>Choose a Guardian</h2>
          <div class="character-grid">
            <div v-for="friend in friendList" :key="friend.name" class="char-card" @click="selectFriend(friend)">
              <img :src="'/assets/friends/' + friend.file" class="friend-img" />
              <div class="friend-name">{{ friend.name }}</div>
            </div>
          </div>
        </div>

        <!-- Campground map -->
        <CampgroundMap v-else-if="store.currentPage === 'campground'" key="campground" />

        <!-- Unit hub -->
        <UfliLessonHub v-else-if="store.currentPage === 'unit-hub'" key="unit-hub" />

        <!-- Lesson player -->
        <LessonPlayer v-else-if="store.currentPage === 'lesson'" key="lesson" :unitId="store.activeLessonId" @complete="onLessonComplete" />

        <!-- Activity player -->
        <ActivityPlayer v-else-if="store.currentPage === 'activity'" key="activity" :lessonId="store.activeLessonId" :activityType="store.activeActivity" @complete="onActivityComplete" />

        <!-- Story reader -->
        <StoryReader v-else-if="store.currentPage === 'story'" key="story" :unitId="store.activeLessonId" @complete="onStoryComplete" />

        <!-- Dashboard -->
        <Dashboard v-else-if="store.currentPage === 'dashboard'" key="dashboard" />
      </Transition>
    </main>

    <!-- Celebration overlay -->
    <Transition name="celebration">
      <div v-if="showCelebration" class="celebration-overlay" @click="dismissCelebration">
        <div class="celebration-card">
          <div class="celebration-icon">{{ celebrationData.icon }}</div>
          <h2 class="celebration-title">{{ celebrationData.title }}</h2>
          <p class="celebration-message">{{ celebrationData.message }}</p>
          <div class="celebration-sparks">+{{ celebrationData.sparks }} Sparks</div>
          <button class="celebration-btn" @click="dismissCelebration">Continue</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { store } from './store';
import { usePersistence } from './composables/usePersistence.js';
import { useUfliProgression } from './composables/useUfliProgression.js';
import { stopAllAudio } from './composables/useEmber.js';
import { useSpeechRecognition } from './composables/useSpeechRecognition.js';
import { celebrateComplete, celebrateFireLit, celebrateStory, celebrateUnitComplete } from './composables/useCelebration.js';
import CampgroundMap from './components/CampgroundMap.vue';
import UfliLessonHub from './components/UfliLessonHub.vue';
import LessonPlayer from './components/LessonPlayer.vue';
import ActivityPlayer from './components/ActivityPlayer.vue';
import StoryReader from './components/StoryReader.vue';
import Dashboard from './components/Dashboard.vue';

const { save, load } = usePersistence();
const {
  completeUfliLesson,
  completeUfliActivity,
  completeUfliConnectedText,
  getUfliLessonStatus,
  ACTIVITY_TYPES,
} = useUfliProgression();
const { cancelListening } = useSpeechRecognition();

function isConnectedTextUnlocked(lessonId) {
  const p = store.ufliProgress[lessonId];
  if (!p || !p.lessonComplete) return false;
  return ACTIVITY_TYPES.every((t) => p.activitiesComplete[t]);
}

const xpPop = ref(false);
const showCelebration = ref(false);
const celebrationData = ref({ icon: '', title: '', message: '', sparks: 0 });
let celebrationResolve = null;
let completionFlowBusy = false;

function killAudio() {
  stopAllAudio();
  cancelListening();
}

// Animate XP counter on change
watch(() => store.xp, () => {
  xpPop.value = true;
  setTimeout(() => { xpPop.value = false; }, 500);
});

function showCelebrationScreen(icon, title, message, sparks) {
  return new Promise((resolve) => {
    celebrationData.value = { icon, title, message, sparks };
    showCelebration.value = true;
    celebrationResolve = resolve;
  });
}

function dismissCelebration() {
  showCelebration.value = false;
  if (celebrationResolve) {
    celebrationResolve();
    celebrationResolve = null;
  }
}

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
  killAudio();
  const page = store.currentPage;
  if (page === 'lesson' || page === 'activity' || page === 'story') {
    store.currentPage = 'unit-hub';
  } else if (page === 'unit-hub' || page === 'dashboard') {
    store.currentPage = 'campground';
  } else {
    store.currentPage = 'selection';
  }
}

async function onLessonComplete() {
  if (completionFlowBusy) return;
  completionFlowBusy = true;
  killAudio();
  try {
    completeUfliLesson(store.activeLessonId);
    save();
    celebrateComplete();
    await showCelebrationScreen('📖', 'Lesson Complete!', 'You learned new sounds!', 100);
    store.currentPage = 'unit-hub';
  } finally {
    completionFlowBusy = false;
  }
}

async function onActivityComplete() {
  if (completionFlowBusy) return;
  completionFlowBusy = true;
  killAudio();
  try {
    const wasLocked = !isConnectedTextUnlocked(store.activeLessonId);
    completeUfliActivity(store.activeLessonId, store.activeActivity);
    save();

    const nowUnlocked = isConnectedTextUnlocked(store.activeLessonId);

    if (wasLocked && nowUnlocked) {
      celebrateFireLit();
      await showCelebrationScreen('🔥', 'The Fire is Lit!', 'You completed all the games! Time for a campfire story!', 50);
    } else {
      celebrateComplete();
      await showCelebrationScreen('✨', 'Activity Complete!', 'You earned a spark!', 50);
    }

    store.currentPage = 'unit-hub';
  } finally {
    completionFlowBusy = false;
  }
}

async function onStoryComplete() {
  if (completionFlowBusy) return;
  completionFlowBusy = true;
  killAudio();
  try {
    const prevStatus = getUfliLessonStatus(store.activeLessonId);
    completeUfliConnectedText(store.activeLessonId);
    save();

    if (prevStatus !== 'complete') {
      celebrateUnitComplete();
      await showCelebrationScreen('🏕️', 'Lesson Mastered!', 'You finished this lesson! A new one awaits!', 75);
    } else {
      celebrateStory();
      await showCelebrationScreen('📕', 'Story Finished!', 'Great reading!', 0);
    }

    store.currentPage = 'unit-hub';
  } finally {
    completionFlowBusy = false;
  }
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
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 140, 0, 0.15);
}

.nav-btn {
  background: transparent;
  border: 1px solid rgba(100, 255, 218, 0.4);
  color: #64FFDA;
  padding: 0.4rem 0.8rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.nav-btn:hover {
  background: rgba(100, 255, 218, 0.1);
}

.back-arrow {
  font-size: 1.1rem;
}

.xp-display {
  color: #FFD93D;
  font-weight: bold;
  font-size: 1rem;
  transition: transform 0.3s;
}

.xp-display.pop {
  animation: xpBounce 0.5s ease;
}

@keyframes xpBounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.4); color: #FF8C00; }
  100% { transform: scale(1); }
}

.spark-emoji {
  display: inline-block;
  animation: sparkSpin 3s linear infinite;
}

@keyframes sparkSpin {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.2); }
}

.main {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

/* Page transitions */
.page-enter-active { animation: pageIn 0.3s ease-out; }
.page-leave-active { animation: pageOut 0.2s ease-in; }

@keyframes pageIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pageOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-8px); }
}

/* Selection screen */
.selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 90vw;
  gap: 0.5rem;
}

.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 0.5rem;
}

.hero-logo {
  width: clamp(144px, 34vw, 220px);
  height: auto;
  margin-bottom: 0.5rem;
  filter: drop-shadow(0 14px 28px rgba(16, 24, 40, 0.45));
  animation: logoFlicker 2s ease-in-out infinite alternate;
}

@keyframes logoFlicker {
  0% { transform: scale(1) rotate(-3deg); filter: brightness(1); }
  100% { transform: scale(1.1) rotate(3deg); filter: brightness(1.3); }
}

.app-title {
  font-size: 1.8rem;
  color: #FF8C00;
  margin: 0;
  text-shadow: 0 0 20px rgba(255, 140, 0, 0.3);
}

.app-subtitle {
  font-size: 0.85rem;
  color: #888;
  margin: 0.2rem 0 0;
}

.selection h2 {
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
  color: #aaa;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  width: 100%;
  max-width: 350px;
}

.char-card {
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid #1a1c23;
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 17, 0.8);
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.3s;
  gap: 0.3rem;
}

.char-card:hover {
  border-color: #FF8C00;
  transform: scale(1.03);
  box-shadow: 0 0 15px rgba(255, 140, 0, 0.15);
}

.friend-img {
  width: 60%;
  height: 60%;
  object-fit: contain;
}

.friend-name {
  font-size: 0.8rem;
  color: #aaa;
}

/* Celebration overlay */
.celebration-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.celebration-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  background: rgba(30, 41, 59, 0.95);
  border: 2px solid rgba(255, 140, 0, 0.4);
  border-radius: 1.5rem;
  max-width: 320px;
  text-align: center;
  box-shadow: 0 0 40px rgba(255, 140, 0, 0.15);
}

.celebration-icon {
  font-size: 4rem;
  animation: celebBounce 0.6s ease;
}

@keyframes celebBounce {
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.celebration-title {
  font-size: 1.5rem;
  color: #FF8C00;
  margin: 0;
}

.celebration-message {
  font-size: 1rem;
  color: #ccc;
  margin: 0;
}

.celebration-sparks {
  font-size: 1.2rem;
  color: #FFD93D;
  font-weight: bold;
}

.celebration-btn {
  background: rgba(255, 140, 0, 0.2);
  border: 2px solid #FF8C00;
  color: #FF8C00;
  padding: 0.6rem 2rem;
  border-radius: 2rem;
  font-size: 1rem;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s;
}

.celebration-btn:hover {
  background: rgba(255, 140, 0, 0.35);
}

.celebration-enter-active { animation: celebIn 0.3s ease; }
.celebration-leave-active { animation: celebOut 0.2s ease; }

@keyframes celebIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes celebOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
</style>

