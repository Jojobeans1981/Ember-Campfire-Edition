<template>
  <div
    class="station"
    :class="[status, { clickable: status !== 'locked' }]"
    @click="handleClick"
  >
    <div class="station-icon">
      <div v-if="status === 'locked'" class="lock-icon">🔒</div>
      <CampfireIcon v-else :sparks="sparksEarned" :stage="status" />
    </div>
    <div class="station-label">{{ unit.stationLabel }}</div>
    <!-- Spark progress dots -->
    <div v-if="status !== 'locked'" class="spark-dots">
      <span class="dot" :class="{ lit: sparksEarned >= 1 }"></span>
      <span class="dot" :class="{ lit: sparksEarned >= 2 }"></span>
      <span class="dot" :class="{ lit: sparksEarned >= 3 }"></span>
      <span class="dot" :class="{ lit: sparksEarned >= 4 }"></span>
      <span class="dot" :class="{ lit: sparksEarned >= 5 }"></span>
      <span class="dot" :class="{ lit: sparksEarned >= 6 }"></span>
      <span class="dot big" :class="{ lit: sparksEarned >= 7 }"></span>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from 'vue';
import { store } from '../store';
import CampfireIcon from './ui/CampfireIcon.vue';

const props = defineProps({
  unit: { type: Object, required: true },
  status: { type: String, required: true },
});

const emit = defineEmits(['select']);

// 7 sparks total per unit: lesson(1) + 5 activities(5) + story(1)
const sparksEarned = computed(() => {
  const progress = store.unitProgress[props.unit.unitId];
  if (!progress) return 0;
  let count = 0;
  if (progress.lessonComplete) count++;
  if (progress.activitiesComplete) {
    count += Object.values(progress.activitiesComplete).filter(Boolean).length;
  }
  if (progress.storyRead) count++;
  return count;
});

function handleClick() {
  if (props.status === 'locked') return;
  emit('select', props.unit);
}
</script>

<style scoped>
.station {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.5rem;
  border-radius: 1rem;
  background: rgba(30, 41, 59, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.05);
  transition: transform 0.2s, border-color 0.3s, box-shadow 0.3s;
  min-width: 90px;
}

.station.clickable { cursor: pointer; }
.station.clickable:hover { transform: scale(1.05); }
.station.locked { opacity: 0.4; filter: grayscale(0.8); }
.station.kindling { border-color: rgba(160, 82, 45, 0.5); }
.station.sparks { border-color: rgba(255, 200, 0, 0.5); box-shadow: 0 0 8px rgba(255, 200, 0, 0.2); }
.station.fire { border-color: rgba(255, 140, 0, 0.6); box-shadow: 0 0 12px rgba(255, 140, 0, 0.3); }
.station.stories { border-color: rgba(100, 255, 218, 0.5); box-shadow: 0 0 12px rgba(100, 255, 218, 0.2); }

.station-icon {
  font-size: 2rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sparks .fire-state { animation: sparkle 1.5s ease-in-out infinite; }
.fire .fire-state { animation: flicker 0.8s ease-in-out infinite alternate; }

@keyframes sparkle { 0%, 100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
@keyframes flicker { 0% { transform: scale(1) rotate(-2deg); } 100% { transform: scale(1.1) rotate(2deg); } }

.station-label { font-size: 0.7rem; color: #aaa; text-align: center; }

.spark-dots {
  display: flex;
  gap: 3px;
  align-items: center;
  margin-top: 2px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #333;
  transition: background 0.3s;
}

.dot.lit {
  background: #FF8C00;
  box-shadow: 0 0 4px rgba(255, 140, 0, 0.5);
}

.dot.big {
  width: 8px;
  height: 8px;
}

.dot.big.lit {
  background: #64FFDA;
  box-shadow: 0 0 6px rgba(100, 255, 218, 0.5);
}
</style>
