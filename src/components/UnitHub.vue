<template>
  <div class="unit-hub">
    <h2 class="unit-title">{{ unit.title }}</h2>
    <div class="unit-phonemes">
      <span v-for="p in unit.phonemes" :key="p" class="phoneme-badge">{{ p.toUpperCase() }}</span>
    </div>

    <div class="hub-status">
      <span class="status-icon">{{ statusIcon }}</span>
      <span class="status-text">{{ statusLabel }}</span>
    </div>

    <!-- Spark tracker -->
    <div class="spark-tracker">
      <div class="spark-bar">
        <div class="spark-fill" :style="{ width: sparkPercent + '%' }"></div>
      </div>
      <div class="spark-label">{{ sparksEarned }} / 7 sparks</div>
    </div>

    <div class="hub-actions">
      <!-- Lesson -->
      <button
        class="hub-btn lesson-btn"
        :class="{ done: progress.lessonComplete }"
        @click="startLesson"
      >
        <span class="btn-icon">{{ progress.lessonComplete ? '✅' : '📖' }}</span>
        <span>Lesson</span>
      </button>

      <!-- Activities -->
      <div class="activities-row">
        <button
          v-for="act in activityList"
          :key="act.type"
          class="hub-btn activity-btn"
          :class="{ done: progress.activitiesComplete[act.type], locked: !progress.lessonComplete }"
          :disabled="!progress.lessonComplete"
          @click="startActivity(act.type)"
        >
          <span class="btn-icon">{{ act.icon }}</span>
          <span>{{ act.label }}</span>
        </button>
      </div>

      <!-- Story -->
      <button
        class="hub-btn story-btn"
        :class="{ done: progress.storyRead, locked: !storyUnlocked }"
        :disabled="!storyUnlocked"
        @click="startStory"
      >
        <span class="btn-icon">{{ progress.storyRead ? '🏕️' : '📕' }}</span>
        <span>Campfire Story</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { store } from '../store';
import { UNITS } from '../data/curriculum.js';
import { useProgression } from '../composables/useProgression.js';

const { getUnitStatus, isStoryUnlocked, ensureUnitProgress } = useProgression();

const unit = computed(() => UNITS.find(u => u.unitId === store.activeUnitId));
const progress = computed(() => {
  ensureUnitProgress(store.activeUnitId);
  return store.unitProgress[store.activeUnitId];
});

const status = computed(() => getUnitStatus(store.activeUnitId));
const storyUnlocked = computed(() => isStoryUnlocked(store.activeUnitId));

const statusIcon = computed(() => {
  const icons = { kindling: '🪵', sparks: '✨', fire: '🔥', stories: '🏕️' };
  return icons[status.value] || '🪵';
});

const statusLabel = computed(() => {
  const labels = {
    kindling: 'Ready to Learn',
    sparks: 'Practicing',
    fire: 'Story Time!',
    stories: 'Complete!',
  };
  return labels[status.value] || '';
});

const sparksEarned = computed(() => {
  const p = progress.value;
  if (!p) return 0;
  let count = 0;
  if (p.lessonComplete) count++;
  if (p.activitiesComplete) {
    count += Object.values(p.activitiesComplete).filter(Boolean).length;
  }
  if (p.storyRead) count++;
  return count;
});

const sparkPercent = computed(() => Math.round((sparksEarned.value / 7) * 100));

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

function startStory() {
  store.currentPage = 'story';
}
</script>

<style scoped>
.unit-hub {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  max-width: 400px;
  width: 100%;
}

.unit-title {
  font-size: 1.5rem;
  color: #FF8C00;
  margin: 0;
}

.unit-phonemes {
  display: flex;
  gap: 0.5rem;
}

.phoneme-badge {
  background: rgba(255, 140, 0, 0.2);
  color: #FF8C00;
  padding: 0.3rem 0.8rem;
  border-radius: 1rem;
  font-size: 1.2rem;
  font-weight: bold;
}

.hub-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  color: #aaa;
}

.status-icon {
  font-size: 1.5rem;
}

.hub-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.hub-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.7);
  color: #E0E0E0;
  cursor: pointer;
  font-size: 1rem;
  transition: border-color 0.2s, opacity 0.2s;
}

.hub-btn:hover:not(:disabled) {
  border-color: #FF8C00;
}

.hub-btn.done {
  border-color: rgba(100, 255, 218, 0.4);
  opacity: 0.8;
}

.hub-btn.locked {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 1.3rem;
}

.activities-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.activity-btn {
  flex-direction: column;
  text-align: center;
  font-size: 0.75rem;
  padding: 0.5rem;
}

.lesson-btn {
  background: rgba(255, 140, 0, 0.15);
  border-color: rgba(255, 140, 0, 0.3);
}

.story-btn {
  background: rgba(100, 255, 218, 0.1);
  border-color: rgba(100, 255, 218, 0.2);
}

.spark-tracker {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.spark-bar {
  width: 100%;
  height: 10px;
  background: #222;
  border-radius: 5px;
  overflow: hidden;
}

.spark-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF8C00, #FFD93D);
  transition: width 0.4s ease;
  border-radius: 5px;
}

.spark-label {
  font-size: 0.75rem;
  color: #FF8C00;
}
</style>
