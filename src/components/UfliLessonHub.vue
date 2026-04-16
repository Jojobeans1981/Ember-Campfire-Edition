<template>
  <div class="unit-hub">
    <div class="treasure-banner" aria-hidden="true">
      <span class="treasure-medal medal-left"></span>
      <span class="treasure-ribbon"></span>
      <span class="treasure-medal medal-right"></span>
    </div>
    <div class="hub-badges" aria-hidden="true">
      <span class="hub-badge">POP!</span>
      <span class="hub-badge">YAY!</span>
      <span class="hub-badge">ZAP!</span>
    </div>
    <div class="hub-header">
      <h2 class="unit-title">Lesson {{ meta?.lessonNumber }}</h2>
      <div class="unit-phonemes">
        <span v-if="meta?.grapheme" class="phoneme-badge">{{ meta.grapheme.toLowerCase() }}</span>
      </div>
      <div class="title-line" v-if="cleanTitle">{{ cleanTitle }}</div>
      <div class="hub-status">
        <span class="status-icon">{{ statusIcon }}</span>
        <span class="status-text">{{ statusLabel }}</span>
      </div>
    </div>

    <div class="spark-tracker" :class="trackerMood">
      <div class="tracker-stars" aria-hidden="true">
        <span
          v-for="star in trackerStars"
          :key="star.id"
          class="tracker-star"
          :class="[star.id, { earned: star.earned, super: star.super }]"
        ></span>
      </div>
      <div class="spark-bar">
        <div class="spark-fill" :class="{ full: sparksEarned === 7 }" :style="{ width: sparkPercent + '%' }"></div>
      </div>
      <div class="spark-dots">
        <span
          v-for="i in 7"
          :key="i"
          class="spark-dot"
          :class="{ earned: i <= sparksEarned }"
        ></span>
      </div>
    </div>

    <button
      class="lesson-card"
      :class="{ done: progress.lessonComplete }"
      @click="startLesson"
    >
      <span class="card-icon">{{ progress.lessonComplete ? '✅' : '📖' }}</span>
      <div class="card-text">
        <span class="card-title">Lesson</span>
        <span class="card-subtitle">{{ progress.lessonComplete ? 'Complete' : 'Learn the sounds' }}</span>
      </div>
    </button>

    <div class="activities-grid">
      <button
        v-for="act in visibleActivities"
        :key="act.type"
        class="activity-card"
        :class="{ done: progress.activitiesComplete[act.type], locked: !progress.lessonComplete }"
        :disabled="!progress.lessonComplete"
        @click="startActivity(act.type)"
      >
        <span class="card-icon">{{ progress.activitiesComplete[act.type] ? '✅' : act.icon }}</span>
        <span class="card-label">{{ act.label }}</span>
      </button>
    </div>

    <div class="hub-coin-trail" aria-hidden="true">
      <span
        v-for="coin in trailCoins"
        :key="coin.id"
        class="trail-coin"
        :class="[coin.id, { earned: coin.earned, current: coin.current }]"
      ></span>
    </div>

    <button
      v-if="showConnectedText"
      class="story-card"
      :class="{ done: progress.connectedTextRead, locked: !connectedTextUnlocked }"
      :disabled="!connectedTextUnlocked"
      @click="startConnectedText"
    >
      <span class="card-icon">{{ progress.connectedTextRead ? '🏕️' : '📕' }}</span>
      <div class="card-text">
        <span class="card-title">Connected Text</span>
        <span class="card-subtitle">{{
          progress.connectedTextRead
            ? 'Read again'
            : connectedTextUnlocked
              ? 'Ready to read!'
              : 'Complete activities to unlock'
        }}</span>
      </div>
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watchEffect, onMounted, watch, onBeforeUnmount } from 'vue';
import { store } from '../store';
import { getLessonMeta } from '../data/ufli/ufliCurriculum.js';
import { getUfliLesson } from '../data/ufli/ufliLessons.js';
import { useUfliProgression } from '../composables/useUfliProgression.js';
import { useEmber } from '../composables/useEmber.js';

const {
  getUfliLessonStatus,
  completeUfliLesson, // eslint-disable-line no-unused-vars
  ACTIVITY_TYPES,
} = useUfliProgression();
const ember = useEmber();

const meta = computed(() => getLessonMeta(store.activeLessonId));
const lessonData = ref(null);

async function loadLessonData() {
  if (!store.activeLessonId) {
    lessonData.value = null;
    return;
  }
  lessonData.value = await getUfliLesson(store.activeLessonId);
}

onMounted(loadLessonData);
watch(() => store.activeLessonId, loadLessonData);

function stripIpa(text) {
  if (!text) return '';
  return String(text)
    .replace(/\/[^/]*\//g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

const cleanTitle = computed(() => {
  const t = meta.value?.title;
  if (!t) return '';
  // After stripping IPA from "a /ă/" we get just "a" — that duplicates
  // the grapheme badge, so suppress the title in that case.
  const cleaned = stripIpa(t);
  if (cleaned === meta.value?.grapheme) return '';
  return cleaned;
});

const progress = computed(() => store.ufliProgress[store.activeLessonId] ?? {
  lessonComplete: false,
  activitiesComplete: { speech: false, match: false, blend: false, build: false, sentence: false },
  connectedTextRead: false,
});

// Ensure the progress entry exists in the store so the template stays reactive.
watchEffect(() => {
  const id = store.activeLessonId;
  if (!id) return;
  if (!store.ufliProgress[id]) {
    const ac = {};
    for (const t of ACTIVITY_TYPES) ac[t] = false;
    store.ufliProgress[id] = {
      lessonComplete: false,
      activitiesComplete: ac,
      connectedTextRead: false,
    };
  }
});

const status = computed(() => getUfliLessonStatus(store.activeLessonId));

const statusIcon = computed(() => {
  const icons = { kindling: '🪵', sparks: '✨', fire: '🔥', complete: '🏕️', locked: '🔒' };
  return icons[status.value] || '🪵';
});

const statusLabel = computed(() => {
  const labels = {
    kindling: 'Ready to Learn',
    sparks: 'Practicing',
    fire: 'Story Time!',
    complete: 'Complete!',
    locked: 'Locked',
  };
  return labels[status.value] || '';
});

const sparksEarned = computed(() => {
  const p = progress.value;
  let count = 0;
  if (p.lessonComplete) count++;
  count += Object.values(p.activitiesComplete || {}).filter(Boolean).length;
  if (p.connectedTextRead) count++;
  return count;
});

const sparkPercent = computed(() => Math.round((sparksEarned.value / 7) * 100));
const trackerMood = computed(() => {
  if (sparksEarned.value >= 7) return 'champion';
  if (sparksEarned.value >= 4) return 'glowing';
  if (sparksEarned.value > 0) return 'warming';
  return 'waiting';
});

const trackerStars = computed(() => ([
  { id: 'star-1', earned: sparksEarned.value >= 1, super: sparksEarned.value >= 2 },
  { id: 'star-2', earned: sparksEarned.value >= 3, super: sparksEarned.value >= 5 },
  { id: 'star-3', earned: sparksEarned.value >= 6, super: sparksEarned.value >= 7 },
]));

const trailCoins = computed(() => ([
  { id: 'coin-1', earned: sparksEarned.value >= 2, current: sparksEarned.value === 1 },
  { id: 'coin-2', earned: sparksEarned.value >= 4, current: sparksEarned.value === 3 },
  { id: 'coin-3', earned: sparksEarned.value >= 6, current: sparksEarned.value === 5 },
  { id: 'coin-4', earned: sparksEarned.value >= 7, current: sparksEarned.value === 6 },
]));

const connectedTextUnlocked = computed(() => {
  const p = progress.value;
  if (!p.lessonComplete) return false;
  return ACTIVITY_TYPES.every((t) => p.activitiesComplete[t]);
});

const activityList = [
  { type: 'speech', label: 'Say It', icon: '🎤' },
  { type: 'match', label: 'Match', icon: '🔤' },
  { type: 'blend', label: 'Blend', icon: '🧩' },
  { type: 'build', label: 'Build', icon: '🏗️' },
  { type: 'sentence', label: 'Read', icon: '📝' },
];

const learnedLetterCount = computed(() => {
  const letters = new Set();
  for (const word of lessonData.value?.wordList ?? []) {
    for (const ch of String(word).toLowerCase()) {
      if (/[a-z]/.test(ch)) letters.add(ch);
    }
  }
  return letters.size;
});

const visibleActivities = computed(() => {
  const count = learnedLetterCount.value;
  return activityList.filter((activity) => {
    if (activity.type === 'sentence') return count >= 3;
    if (activity.type === 'blend' || activity.type === 'build') return count >= 2;
    return true;
  });
});

const showConnectedText = computed(() => learnedLetterCount.value >= 3);

function speakHubIntro() {
  const lessonNum = meta.value?.lessonNumber || '';
  const title = cleanTitle.value ? `${cleanTitle.value}.` : '';
  const statusText = statusLabel.value ? `${statusLabel.value}.` : '';
  void ember.speak(`Lesson ${lessonNum}. ${title} ${statusText} Tap Lesson to learn sounds, then play the activity cards.`, {
    priority: 'instruction',
    rate: 0.9,
    pitch: 1.04,
  });
}

watch(() => store.activeLessonId, () => {
  speakHubIntro();
});

onMounted(() => {
  speakHubIntro();
});

onBeforeUnmount(() => {
  ember.stopSpeaking();
});

function startLesson() {
  store.currentPage = 'lesson';
}

function startActivity(type) {
  store.activeActivity = type;
  store.currentPage = 'activity';
}

function startConnectedText() {
  store.currentPage = 'story';
}
</script>

<style scoped>
.unit-hub {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
  max-width: 380px;
  width: 100%;
  border-radius: 1.15rem;
  background:
    radial-gradient(circle at 10% 10%, rgba(255, 185, 103, 0.2), transparent 36%),
    radial-gradient(circle at 90% 0%, rgba(104, 229, 255, 0.18), transparent 40%),
    linear-gradient(180deg, rgba(25, 31, 52, 0.92), rgba(11, 18, 30, 0.94));
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.26);
  overflow: hidden;
}

.unit-hub::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 15% 85%, rgba(255, 210, 117, 0.08), transparent 18%),
    radial-gradient(circle at 85% 20%, rgba(116, 216, 255, 0.08), transparent 20%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 38%, rgba(255, 231, 164, 0.05) 70%, transparent 100%);
  pointer-events: none;
}

.treasure-banner {
  position: absolute;
  top: 0.7rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  opacity: 0.88;
}

.treasure-ribbon {
  width: 3.5rem;
  height: 0.55rem;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 222, 119, 0.9), rgba(255, 160, 90, 0.9), rgba(111, 224, 255, 0.85));
  box-shadow: 0 0 12px rgba(255, 196, 88, 0.26);
}

.treasure-medal {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #fff7b8 0%, #ffd75d 55%, #ef9e2d 100%);
  border: 2px solid rgba(151, 93, 7, 0.85);
  box-shadow: 0 0 10px rgba(255, 211, 94, 0.28);
  animation: medalBounce 2.3s ease-in-out infinite;
}

.medal-right {
  animation-delay: 0.35s;
}

.hub-badges {
  position: absolute;
  top: 1.45rem;
  right: 0.8rem;
  display: flex;
  gap: 0.35rem;
}

.hub-badge {
  padding: 0.16rem 0.5rem;
  border-radius: 999px;
  background: linear-gradient(140deg, #ffe08a, #ff9257);
  color: #3a1400;
  font-size: 0.6rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.22);
  animation: hubBadgeHop 0.95s ease-in-out infinite alternate;
}

.hub-badge:nth-child(2) { animation-delay: 0.2s; }
.hub-badge:nth-child(3) { animation-delay: 0.4s; }

@keyframes hubBadgeHop {
  from { transform: translateY(0) rotate(-2deg); }
  to { transform: translateY(-4px) rotate(2deg); }
}

.hub-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.unit-title {
  font-size: 1.4rem;
  color: #FF8C00;
  margin: 0;
  font-weight: 700;
}

.unit-phonemes {
  display: flex;
  gap: 0.4rem;
}

.phoneme-badge {
  background: rgba(255, 140, 0, 0.15);
  color: #FF8C00;
  padding: 0.2rem 0.7rem;
  border-radius: 1rem;
  font-size: 1.1rem;
  font-weight: bold;
  text-transform: lowercase;
}

.phoneme-badge.ipa {
  background: rgba(100, 255, 218, 0.12);
  color: #64FFDA;
  font-weight: 500;
}

.title-line { color: #aaa; font-size: 0.85rem; }

.hub-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: #999;
}

.status-icon { font-size: 1.2rem; }

.spark-tracker {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.spark-tracker.warming .spark-bar {
  box-shadow: 0 0 0 1px rgba(255, 205, 105, 0.16);
}

.spark-tracker.glowing .spark-bar {
  box-shadow: 0 0 0 1px rgba(255, 221, 126, 0.18), 0 0 16px rgba(255, 186, 89, 0.12);
}

.spark-tracker.champion .spark-bar {
  box-shadow:
    0 0 0 1px rgba(255, 237, 157, 0.26),
    0 0 20px rgba(255, 214, 112, 0.22);
}

.tracker-stars {
  position: absolute;
  top: -0.7rem;
  right: 0;
  display: flex;
  gap: 0.3rem;
}

.tracker-star {
  width: 0.6rem;
  height: 0.6rem;
  clip-path: polygon(50% 0, 63% 34%, 100% 38%, 71% 59%, 80% 100%, 50% 76%, 20% 100%, 29% 59%, 0 38%, 37% 34%);
  background: linear-gradient(180deg, rgba(255, 244, 173, 0.3) 0%, rgba(255, 204, 87, 0.24) 100%);
  box-shadow: 0 0 0 rgba(255, 210, 88, 0);
  opacity: 0.36;
}

.tracker-star.earned {
  opacity: 1;
  background: linear-gradient(180deg, #fff4ad 0%, #ffcc57 100%);
  box-shadow: 0 0 8px rgba(255, 210, 88, 0.45);
  animation: trackerTwinkle 1.4s ease-in-out infinite alternate;
}

.tracker-star.super {
  animation: trackerTwinkle 1.15s ease-in-out infinite alternate, starVictorySpin 3.8s linear infinite;
}

.star-2 { animation-delay: 0.25s; }
.star-3 { animation-delay: 0.5s; }

.spark-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.spark-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF8C00, #FFD93D);
  transition: width 0.4s ease;
  border-radius: 3px;
  box-shadow: 0 0 12px rgba(255, 217, 61, 0.7);
  animation: sparkFlow 1.1s linear infinite;
}

.spark-fill.full {
  background: linear-gradient(90deg, #ffb347 0%, #ffe57d 44%, #fff6b6 100%);
  box-shadow: 0 0 18px rgba(255, 232, 143, 0.9);
}

@keyframes sparkFlow {
  from { filter: hue-rotate(0deg); }
  to { filter: hue-rotate(28deg); }
}

.spark-dots {
  display: flex;
  gap: 0.4rem;
}

.spark-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.3s, box-shadow 0.3s;
}

.spark-dot.earned {
  background: #FFD93D;
  box-shadow: 0 0 6px rgba(255, 217, 61, 0.5);
}

.lesson-card, .story-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem 1.25rem;
  border-radius: 1rem;
  border: 2px solid rgba(255, 140, 0, 0.25);
  background:
    linear-gradient(135deg, rgba(255, 215, 123, 0.16), rgba(255, 140, 0, 0.08)),
    rgba(20, 25, 38, 0.64);
  color: #E0E0E0;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  animation: hubCardFloat 2.6s ease-in-out infinite;
  box-shadow: 0 10px 18px rgba(5, 10, 18, 0.24);
}

.lesson-card:hover, .story-card:hover:not(:disabled) {
  border-color: #FF8C00;
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 14px 24px rgba(255, 157, 68, 0.16);
}

.lesson-card.done { border-color: rgba(100, 255, 218, 0.3); }
.lesson-card.done .card-icon { animation: doneDance 0.95s ease-in-out infinite; }

.lesson-card .card-icon, .story-card .card-icon { font-size: 1.5rem; }

.card-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
}

.card-subtitle {
  font-size: 0.75rem;
  color: #888;
}

.activities-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
  width: 100%;
}

.activities-grid::before {
  content: '';
  position: absolute;
  left: 6%;
  right: 6%;
  top: 50%;
  border-top: 3px dashed rgba(255, 213, 101, 0.3);
  transform: translateY(-50%);
  pointer-events: none;
}

.activity-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.75rem 0.25rem;
  border-radius: 0.75rem;
  border: 1.5px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top, rgba(255, 223, 136, 0.14), transparent 46%),
    rgba(30, 41, 59, 0.72);
  color: #ccc;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.7rem;
  transition: border-color 0.2s, transform 0.15s, opacity 0.2s, box-shadow 0.2s;
  animation: actHop 2.1s ease-in-out infinite;
  box-shadow: 0 10px 14px rgba(5, 10, 18, 0.2);
}

.activity-card:nth-child(2) { animation-delay: 0.13s; }
.activity-card:nth-child(3) { animation-delay: 0.25s; }
.activity-card:nth-child(4) { animation-delay: 0.38s; }
.activity-card:nth-child(5) { animation-delay: 0.5s; }

.activity-card:hover:not(:disabled) {
  border-color: #FF8C00;
  transform: translateY(-4px) scale(1.05) rotate(-1deg);
  box-shadow: 0 12px 18px rgba(255, 161, 73, 0.18);
}

.activity-card .card-icon { font-size: 1.3rem; }
.activity-card .card-label { font-weight: 500; }

.activity-card.done { border-color: rgba(100, 255, 218, 0.25); }
.activity-card.locked { opacity: 0.25; cursor: not-allowed; }

.story-card {
  border-color: rgba(100, 255, 218, 0.15);
  background:
    linear-gradient(135deg, rgba(100, 255, 218, 0.12), rgba(100, 255, 218, 0.03)),
    rgba(14, 23, 38, 0.7);
}

.story-card.done { border-color: rgba(100, 255, 218, 0.3); }
.story-card.locked { opacity: 0.3; cursor: not-allowed; }

.hub-coin-trail {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: -0.2rem;
}

.trail-coin {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, rgba(255, 246, 183, 0.28) 0%, rgba(255, 216, 100, 0.18) 56%, rgba(231, 162, 44, 0.12) 100%);
  border: 2px solid rgba(147, 91, 10, 0.82);
  box-shadow: 0 0 0 rgba(255, 206, 93, 0);
  opacity: 0.42;
}

.trail-coin.current {
  opacity: 1;
  background: radial-gradient(circle at 35% 35%, #fff4c3 0%, #ffd968 58%, #ec9f33 100%);
  box-shadow: 0 0 12px rgba(255, 206, 93, 0.42);
  animation: coinCurrentPulse 1s ease-in-out infinite;
}

.trail-coin.earned {
  opacity: 1;
  background: radial-gradient(circle at 35% 35%, #fff6b7 0%, #ffd864 56%, #e7a22c 100%);
  box-shadow: 0 0 8px rgba(255, 206, 93, 0.28);
  animation: coinWiggle 1.9s ease-in-out infinite;
}

.coin-2 { animation-delay: 0.15s; }
.coin-3 { animation-delay: 0.3s; }
.coin-4 { animation-delay: 0.45s; }

@keyframes hubCardFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

@keyframes medalBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px) scale(1.04); }
}

@keyframes trackerTwinkle {
  from {
    transform: scale(0.9);
    box-shadow: 0 0 6px rgba(255, 210, 88, 0.28);
  }

  to {
    transform: scale(1.08);
    box-shadow: 0 0 12px rgba(255, 210, 88, 0.5);
  }
}

@keyframes starVictorySpin {
  0%, 100% {
    transform: rotate(0deg) scale(1);
  }

  50% {
    transform: rotate(180deg) scale(1.12);
  }
}

@keyframes doneDance {
  0%, 100% { transform: rotate(0deg) scale(1); }
  25% { transform: rotate(-8deg) scale(1.1); }
  75% { transform: rotate(8deg) scale(1.1); }
}

@keyframes actHop {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

@keyframes coinWiggle {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-2px) rotate(8deg); }
}

@keyframes coinCurrentPulse {
  0%, 100% {
    transform: translateY(0) scale(0.96);
    box-shadow: 0 0 8px rgba(255, 206, 93, 0.26);
  }

  50% {
    transform: translateY(-4px) scale(1.1);
    box-shadow: 0 0 16px rgba(255, 216, 112, 0.58);
  }
}
</style>
