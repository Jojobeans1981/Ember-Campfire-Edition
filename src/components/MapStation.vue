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
    <div class="station-label">{{ stationLabel }}</div>
    <div v-if="status !== 'locked'" class="spark-dots">
      <span
        v-for="index in sparkTotal"
        :key="index"
        class="dot"
        :class="{ lit: sparksEarned >= index, big: index === sparkTotal }"
      ></span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getLessonMeta } from '../data/ufli/ufliCurriculum.js';
import { useUfliProgression } from '../composables/useUfliProgression.js';
import CampfireIcon from './ui/CampfireIcon.vue';

const props = defineProps({
  lessonId: { type: String, required: true },
  status: { type: String, required: true },
});

const emit = defineEmits(['select']);
const { getUfliLessonSparkProgress } = useUfliProgression();

const meta = computed(() => getLessonMeta(props.lessonId));

const stationLabel = computed(() => {
  const m = meta.value;
  if (!m) return props.lessonId;
  if (m.grapheme) return m.grapheme.toLowerCase();
  return `l${m.lessonNumber}`;
});

const sparksEarned = computed(() => {
  return getUfliLessonSparkProgress(props.lessonId).earned;
});

const sparkTotal = computed(() => getUfliLessonSparkProgress(props.lessonId).total);

function handleClick() {
  if (props.status === 'locked') return;
  emit('select', props.lessonId);
}
</script>

<style scoped>
.station {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.6rem 0.4rem;
  border-radius: 0.85rem;
  background: rgba(30, 41, 59, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.05);
  transition: transform 0.2s, border-color 0.3s, box-shadow 0.3s;
  min-width: 70px;
  animation: stationFloat 2.3s ease-in-out infinite;
}

.station.clickable { cursor: pointer; }
.station.clickable:hover { transform: scale(1.1) rotate(-2deg); }
.station.locked { opacity: 0.4; filter: grayscale(0.8); }
.station.kindling { border-color: rgba(160, 82, 45, 0.5); }
.station.sparks { border-color: rgba(255, 200, 0, 0.5); box-shadow: 0 0 8px rgba(255, 200, 0, 0.2); }
.station.fire { border-color: rgba(255, 140, 0, 0.6); box-shadow: 0 0 12px rgba(255, 140, 0, 0.3); }
.station.complete { border-color: rgba(100, 255, 218, 0.5); box-shadow: 0 0 12px rgba(100, 255, 218, 0.2); }
.station.sparks { animation-duration: 1.4s; }
.station.fire { animation-duration: 1s; }
.station.complete { animation-duration: 1.8s; }

.station-icon {
  font-size: 1.6rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sparks .fire-state { animation: sparkle 1.5s ease-in-out infinite; }
.fire .fire-state { animation: flicker 0.8s ease-in-out infinite alternate; }

@keyframes sparkle { 0%, 100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
@keyframes flicker { 0% { transform: scale(1) rotate(-2deg); } 100% { transform: scale(1.1) rotate(2deg); } }

.station-label {
  font-size: 0.85rem;
  color: #FF8C00;
  font-weight: 700;
  text-align: center;
  text-transform: lowercase;
}

.spark-dots {
  display: flex;
  gap: 2px;
  align-items: center;
  margin-top: 2px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #333;
  transition: background 0.3s;
}

.dot.lit {
  background: #FF8C00;
  box-shadow: 0 0 4px rgba(255, 140, 0, 0.5);
  animation: dotBlink 0.9s ease-in-out infinite alternate;
}

.dot.big {
  width: 7px;
  height: 7px;
}

.dot.big.lit {
  background: #64FFDA;
  box-shadow: 0 0 6px rgba(100, 255, 218, 0.5);
}

@keyframes stationFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes dotBlink {
  from { opacity: 0.55; }
  to { opacity: 1; }
}
</style>
