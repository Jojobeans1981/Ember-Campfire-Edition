<template>
  <div class="campground-map">
    <header class="map-hero">
      <p class="hero-kicker">Campground Trail Map</p>
      <h2 class="map-title">{{ friendName }}'s Reading Adventure</h2>
      <p class="map-subtitle">{{ missionLine }}</p>
    </header>

    <section v-if="viewMode === 'map'" class="storybook-map">
      <div class="map-board">
        <img
          class="map-image"
          src="/assets/campground-map-reference.webp"
          alt=""
          aria-hidden="true"
        />

        <button
          v-for="(zone, idx) in visibleZones"
          :key="zone.id"
          class="map-stop"
          :class="{
            current: currentZoneId === zone.id,
            done: zone.isCompleted,
            locked: !zone.hasUnlockedLessons,
          }"
          :style="{ '--pin-x': `${zone.mapX}%`, '--pin-y': `${zone.mapY}%` }"
          @click="openZoneFromMap(zone.id)"
        >
          <span class="stop-pin">{{ idx + 1 }}</span>
          <span class="stop-sign">
            <strong>{{ zone.short }}</strong>
            <em>{{ zone.label }}</em>
          </span>
        </button>
      </div>
    </section>

    <div v-else class="trail-list">
      <button class="map-back-btn" type="button" @click="viewMode = 'map'">Back To Map</button>
      <section
        v-for="zone in visibleZones"
        :key="zone.id"
        class="trail-card"
        :class="[{ active: openZoneId === zone.id, locked: !zone.hasUnlockedLessons }]"
        :style="{ '--trail-accent': zone.accent }"
      >
        <button class="trail-button" type="button" :aria-expanded="openZoneId === zone.id" @click="toggleZone(zone.id)">
          <div class="trail-art" aria-hidden="true">{{ zone.short }}</div>
          <div class="trail-copy">
            <div class="trail-topline">
              <span class="trail-name">{{ zone.label }}</span>
              <span class="trail-state">{{ zone.hasUnlockedLessons ? 'Ready' : 'Later' }}</span>
            </div>
            <p class="trail-description">{{ zone.description }}</p>
            <div class="trail-meta">
              <span>{{ zone.lessonIds.length }} stops</span>
              <span>{{ zone.completedCount }} done</span>
              <span v-if="zone.nextLessonLabel">{{ zone.nextLessonLabel }}</span>
            </div>
          </div>
        </button>

        <Transition name="trail-expand">
          <div v-if="openZoneId === zone.id" class="trail-panel">
            <div class="trail-panel-head">
              <p class="panel-title">Trail Stops</p>
              <p class="panel-subtitle">Start with the glowing stop and keep moving forward one step at a time.</p>
            </div>
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
        </Transition>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { ALL_UFLI_LESSON_IDS } from '../data/ufli/ufliLessons.js';
import { getLessonMeta } from '../data/ufli/ufliCurriculum.js';
import { useUfliProgression } from '../composables/useUfliProgression.js';
import { useEmber } from '../composables/useEmber.js';
import { store } from '../store';
import MapStation from './MapStation.vue';

const { getUfliLessonStatus } = useUfliProgression();
const ember = useEmber();

const ZONE_DEFS = [
  { id: 'spark-meadow', label: 'Spark Meadow', short: '🌱', description: 'Meet your first sounds.', accent: '#9ae6b4', range: ['001', '010'], mapX: 77.5, mapY: 67.2 },
  { id: 'letter-lake', label: 'Letter Lake', short: '💧', description: 'Grow letter power.', accent: '#7dd3fc', range: ['011', '019'], mapX: 19.5, mapY: 66.5 },
  { id: 'echo-hills', label: 'Echo Hills', short: '⛰️', description: 'Practice tricky sounds.', accent: '#fbbf24', range: ['020', '034'], mapX: 28.5, mapY: 56.5 },
  { id: 'vowel-garden', label: 'Vowel Garden', short: '🌸', description: 'Vowel review trail.', accent: '#f9a8d4', range: ['035a', '041c'], mapX: 24, mapY: 45 },
  { id: 'dragon-bridge', label: 'Dragon Bridge', short: '🐉', description: 'Digraph adventures.', accent: '#fb923c', range: ['042', '053'], mapX: 39, mapY: 33 },
  { id: 'magic-mountain', label: 'Magic Mountain', short: '🏔️', description: 'Silent-e magic.', accent: '#c4b5fd', range: ['054', '062'], mapX: 51, mapY: 42 },
  { id: 'rhythm-river', label: 'Rhythm River', short: '🛶', description: 'Syllable skills.', accent: '#38bdf8', range: ['063', '068'], mapX: 52, mapY: 58 },
  { id: 'sunset-ridge', label: 'Sunset Ridge', short: '🌄', description: 'Long-sound trails.', accent: '#fb7185', range: ['069', '076'], mapX: 65, mapY: 60 },
  { id: 'roaring-caves', label: 'Roaring Caves', short: '🦁', description: 'R-controlled sounds.', accent: '#f59e0b', range: ['077', '083'], mapX: 76, mapY: 49 },
  { id: 'rainbow-falls', label: 'Rainbow Falls', short: '🌈', description: 'Vowel teams.', accent: '#34d399', range: ['084', '097'], mapX: 83, mapY: 37 },
  { id: 'builder-bay', label: 'Builder Bay', short: '🧰', description: 'Word-building power.', accent: '#a78bfa', range: ['098', '110'], mapX: 72, mapY: 26 },
  { id: 'starry-summit', label: 'Starry Summit', short: '⭐', description: 'Final mastery trail.', accent: '#fcd34d', range: ['111', '128'], mapX: 58, mapY: 15 },
];

function lessonIdsForRange([start, end]) {
  const startIdx = ALL_UFLI_LESSON_IDS.indexOf(start);
  const endIdx = ALL_UFLI_LESSON_IDS.indexOf(end);
  if (startIdx < 0 || endIdx < 0) return [];
  return ALL_UFLI_LESSON_IDS.slice(startIdx, endIdx + 1);
}

const zones = computed(() => {
  return ZONE_DEFS.map((zone) => {
    const lessonIds = lessonIdsForRange(zone.range);
    const completedCount = lessonIds.filter((lessonId) => store.ufliProgress[lessonId]?.lessonComplete === true).length;
    const firstPlayableId = lessonIds.find((lessonId) => getUfliLessonStatus(lessonId) !== 'locked');
    const nextMeta = firstPlayableId ? getLessonMeta(firstPlayableId) : null;
    const isCompleted = lessonIds.length > 0 && completedCount === lessonIds.length;

    return {
      ...zone,
      lessonIds,
      completedCount,
      isCompleted,
      hasUnlockedLessons: Boolean(firstPlayableId),
      nextLessonLabel: nextMeta ? `Next: Stop ${nextMeta.lessonNumber}` : 'Locked for now',
    };
  });
});

const revealThroughIndex = computed(() => {
  const currentIdx = zones.value.findIndex((zone) => !zone.isCompleted);
  if (currentIdx < 0) return zones.value.length - 1;
  return currentIdx;
});

const visibleZones = computed(() => zones.value.filter((_, index) => index <= revealThroughIndex.value));
const currentZoneId = computed(() => zones.value.find((zone) => !zone.isCompleted)?.id ?? zones.value.at(-1)?.id ?? '');
const openZoneId = ref('');
const viewMode = ref('map');

const friendName = computed(() => store.selectedFriend?.name || 'Your Guardian');
const missionLine = computed(() => `${friendName.value} needs your sounds to light the campfire path. Follow the campground trail to the fire.`);

function speakMapIntro() {
  void ember.speak(`${friendName.value}'s trail map is ready. Follow the campground trail to the campfire by lighting each reading stop.`);
}

onMounted(() => {
  openZoneId.value = visibleZones.value.find((zone) => zone.hasUnlockedLessons)?.id ?? '';
  speakMapIntro();
});

watch(friendName, () => {
  speakMapIntro();
});

onBeforeUnmount(() => {
  ember.stopSpeaking();
});

function getStatus(lessonId) {
  return getUfliLessonStatus(lessonId);
}

function openZoneFromMap(zoneId) {
  if (!visibleZones.value.some((zone) => zone.id === zoneId)) return;
  openZoneId.value = zoneId;
  viewMode.value = 'trails';
}

function toggleZone(zoneId) {
  openZoneId.value = openZoneId.value === zoneId ? '' : zoneId;
}

function selectLesson(lessonId) {
  store.activeLessonId = lessonId;
  store.currentPage = 'unit-hub';
}
</script>

<style scoped>
.campground-map {
  width: 100%;
  max-width: 1040px;
  padding: 1rem 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  max-height: 100%;
  border-radius: 1.5rem;
  background:
    radial-gradient(circle at 20% 0%, rgba(255, 198, 110, 0.2), transparent 36%),
    linear-gradient(180deg, #152334 0%, #0e1826 100%);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.map-hero {
  text-align: center;
}

.hero-kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.7rem;
  color: #ffd28d;
}

.map-title {
  margin: 0.2rem 0 0;
  color: #ffe8be;
  font-size: clamp(1.45rem, 3.5vw, 2.1rem);
}

.map-subtitle {
  margin: 0.45rem auto 0;
  max-width: 580px;
  color: #d9e7f5;
}

.storybook-map {
  position: relative;
  min-height: 560px;
}

.map-board {
  position: relative;
  width: min(100%, 900px);
  margin: 0 auto;
}

.map-image {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.8rem;
  box-shadow: 0 14px 26px rgba(0, 0, 0, 0.2);
}

.map-stop {
  position: absolute;
  left: var(--pin-x);
  top: var(--pin-y);
  transform: translate(-50%, -50%);
  display: grid;
  justify-items: center;
  gap: 0.22rem;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.map-stop.locked {
  opacity: 0.45;
}

.stop-pin {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 0.68rem;
  font-weight: 900;
  color: #571d00;
  background: #fff5cc;
  border: 3px solid #c83828;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
}

.stop-sign {
  min-width: 78px;
  padding: 0.18rem 0.4rem;
  border-radius: 999px;
  background: rgba(255, 248, 227, 0.96);
  border: 2px solid #bf8a51;
  color: #4b2908;
  text-align: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.14);
}

.stop-sign strong,
.stop-sign em {
  display: block;
}

.stop-sign strong {
  font-size: 0.7rem;
  line-height: 1;
}

.stop-sign em {
  margin-top: 0.08rem;
  font-style: normal;
  font-size: 0.54rem;
  font-weight: 800;
}

.map-stop.current .stop-pin {
  background: #ffd671;
  box-shadow: 0 0 0 5px rgba(255, 214, 105, 0.42), 0 3px 8px rgba(0, 0, 0, 0.18);
}

.map-stop.done .stop-pin {
  background: #ffe995;
}

.trail-list {
  display: grid;
  gap: 0.9rem;
}

.map-back-btn {
  justify-self: center;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  padding: 0.42rem 0.9rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: #ffe7c0;
  background: rgba(14, 23, 38, 0.72);
  cursor: pointer;
}

.trail-card {
  overflow: hidden;
  border-radius: 1.15rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(180deg, rgba(17, 29, 48, 0.96), rgba(11, 20, 34, 0.96));
}

.trail-button {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0.9rem;
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.trail-art {
  width: 72px;
  height: 72px;
  border-radius: 1rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  font-weight: 900;
  color: #251000;
  background: linear-gradient(180deg, color-mix(in srgb, var(--trail-accent) 68%, white 15%), rgba(255, 255, 255, 0.08));
}

.trail-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
}

.trail-name {
  color: #fff0cb;
  font-weight: 800;
}

.trail-state {
  font-size: 0.72rem;
  padding: 0.24rem 0.52rem;
  border-radius: 999px;
  color: #1b0d00;
  background: var(--trail-accent);
}

.trail-description {
  margin: 0.35rem 0 0;
  color: #d4dfef;
  font-size: 0.85rem;
}

.trail-meta {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.3rem;
}

.trail-meta span {
  font-size: 0.72rem;
  padding: 0.16rem 0.46rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #f2f6fa;
}

.trail-panel {
  padding: 0 0.9rem 0.9rem;
}

.panel-title {
  margin: 0;
  color: #ffe8bb;
  font-size: 0.9rem;
  font-weight: 800;
}

.panel-subtitle {
  margin: 0.2rem 0 0.7rem;
  color: #b8c6d7;
  font-size: 0.78rem;
}

.map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: 0.5rem;
}

.trail-expand-enter-active,
.trail-expand-leave-active {
  transition: all 0.2s ease;
}

.trail-expand-enter-from,
.trail-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 640px) {
  .map-board {
    width: 100%;
  }

  .stop-sign {
    min-width: 62px;
    padding-inline: 0.3rem;
  }

  .stop-sign strong {
    font-size: 0.58rem;
  }

  .stop-sign em {
    font-size: 0.46rem;
  }
}
</style>
