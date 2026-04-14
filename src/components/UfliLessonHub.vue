<template>
  <div class="unit-hub">
    <div class="hub-header">
      <h2 class="unit-title">Lesson {{ meta?.lessonNumber }}</h2>
      <div class="unit-phonemes">
        <span v-if="meta?.grapheme" class="phoneme-badge">{{ meta.grapheme.toUpperCase() }}</span>
        <span v-if="meta?.phoneme" class="phoneme-badge ipa">{{ meta.phoneme }}</span>
      </div>
      <div class="title-line" v-if="meta?.title">{{ meta.title }}</div>
      <div class="hub-status">
        <span class="status-icon">{{ statusIcon }}</span>
        <span class="status-text">{{ statusLabel }}</span>
      </div>
    </div>

    <div class="spark-tracker">
      <div class="spark-bar">
        <div class="spark-fill" :style="{ width: sparkPercent + '%' }"></div>
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
        v-for="act in activityList"
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

    <button
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
import { computed, watchEffect } from 'vue';
import { store } from '../store';
import { getLessonMeta } from '../data/ufli/ufliCurriculum.js';
import { useUfliProgression } from '../composables/useUfliProgression.js';

const {
  getUfliLessonStatus,
  completeUfliLesson, // eslint-disable-line no-unused-vars
  ACTIVITY_TYPES,
} = useUfliProgression();

const meta = computed(() => getLessonMeta(store.activeLessonId));

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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
  max-width: 380px;
  width: 100%;
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
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

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
  background: linear-gradient(135deg, rgba(255, 140, 0, 0.1), rgba(255, 140, 0, 0.05));
  color: #E0E0E0;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.2s, transform 0.15s;
}

.lesson-card:hover, .story-card:hover:not(:disabled) {
  border-color: #FF8C00;
  transform: translateY(-1px);
}

.lesson-card.done { border-color: rgba(100, 255, 218, 0.3); }

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
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
  width: 100%;
}

.activity-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.75rem 0.25rem;
  border-radius: 0.75rem;
  border: 1.5px solid rgba(255, 255, 255, 0.08);
  background: rgba(30, 41, 59, 0.6);
  color: #ccc;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.7rem;
  transition: border-color 0.2s, transform 0.15s, opacity 0.2s;
}

.activity-card:hover:not(:disabled) {
  border-color: #FF8C00;
  transform: translateY(-1px);
}

.activity-card .card-icon { font-size: 1.3rem; }
.activity-card .card-label { font-weight: 500; }

.activity-card.done { border-color: rgba(100, 255, 218, 0.25); }
.activity-card.locked { opacity: 0.25; cursor: not-allowed; }

.story-card {
  border-color: rgba(100, 255, 218, 0.15);
  background: linear-gradient(135deg, rgba(100, 255, 218, 0.06), rgba(100, 255, 218, 0.02));
}

.story-card.done { border-color: rgba(100, 255, 218, 0.3); }
.story-card.locked { opacity: 0.3; cursor: not-allowed; }
</style>
