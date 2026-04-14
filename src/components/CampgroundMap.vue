<template>
  <div class="campground-map">
    <h2 class="map-title">Ember Campground</h2>
    <p class="map-subtitle">UFLI Lessons</p>

    <div v-for="zone in zones" :key="zone.label" class="map-zone">
      <div class="zone-label">{{ zone.label }}</div>
      <div class="map-grid">
        <MapStation
          v-for="lessonId in zone.lessonIds"
          :key="lessonId"
          :lessonId="lessonId"
          :status="getStatus(lessonId)"
          @select="selectLesson"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ALL_UFLI_LESSON_IDS } from '../data/ufli/ufliLessons.js';
import { useUfliProgression } from '../composables/useUfliProgression.js';
import { store } from '../store';
import MapStation from './MapStation.vue';

const { getUfliLessonStatus } = useUfliProgression();

// Group lessons into pedagogical zones by their position in the manifest.
const ZONE_DEFS = [
  { label: 'First Sounds', range: ['001', '010'] },
  { label: 'More Letters', range: ['011', '019'] },
  { label: 'Plurals & Consonants', range: ['020', '034'] },
  { label: 'Short Vowel Review', range: ['035a', '041c'] },
  { label: 'Doubles & Digraphs', range: ['042', '053'] },
  { label: 'Magic E', range: ['054', '062'] },
  { label: 'Endings & Syllables', range: ['063', '068'] },
  { label: 'Trigraphs & Long VCC', range: ['069', '076'] },
  { label: 'R-Controlled', range: ['077', '083'] },
  { label: 'Vowel Teams', range: ['084', '097'] },
  { label: 'Silent Letters & Suffixes', range: ['098', '110'] },
  { label: 'Advanced Patterns', range: ['111', '128'] },
];

const zones = computed(() => {
  return ZONE_DEFS.map((zone) => {
    const startIdx = ALL_UFLI_LESSON_IDS.indexOf(zone.range[0]);
    const endIdx = ALL_UFLI_LESSON_IDS.indexOf(zone.range[1]);
    if (startIdx < 0 || endIdx < 0) return { ...zone, lessonIds: [] };
    return { ...zone, lessonIds: ALL_UFLI_LESSON_IDS.slice(startIdx, endIdx + 1) };
  });
});

function getStatus(lessonId) {
  return getUfliLessonStatus(lessonId);
}

function selectLesson(lessonId) {
  store.activeLessonId = lessonId;
  store.activeUnitId = lessonId; // legacy alias until task 8 deletes it
  store.currentPage = 'unit-hub';
}
</script>

<style scoped>
.campground-map {
  width: 100%;
  max-width: 540px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  overflow-y: auto;
  max-height: 100%;
}

.map-title { font-size: 1.4rem; color: #FF8C00; margin: 0; }
.map-subtitle { color: #888; margin: 0; font-size: 0.85rem; }

.map-zone {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed rgba(255, 140, 0, 0.15);
}

.zone-label {
  font-size: 0.75rem;
  color: #FF8C00;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-left: 0.25rem;
}

.map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
  width: 100%;
}
</style>
