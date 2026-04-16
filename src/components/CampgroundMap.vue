<template>
  <div class="campground-map">
    <header class="map-hero">
      <p class="hero-kicker">Campground Trail Map</p>
      <h2 class="map-title">{{ friendName }}'s Reading Adventure</h2>
      <p class="map-subtitle">{{ missionLine }}</p>
    </header>

    <section v-if="viewMode === 'map'" class="storybook-map">
      <div class="parchment-roll left"></div>
      <div class="parchment-roll right"></div>

      <div class="parchment-board">
        <div class="paper-fold top-left" aria-hidden="true"></div>
        <div class="paper-fold top-right" aria-hidden="true"></div>
        <div class="paper-fold bottom-left" aria-hidden="true"></div>
        <div class="paper-fold bottom-right" aria-hidden="true"></div>

        <div class="landmark tent" aria-hidden="true"></div>
        <div class="landmark backpack" aria-hidden="true"></div>
        <div class="landmark camp-ring" aria-hidden="true"></div>
        <div class="landmark fire" aria-hidden="true"></div>
        <div class="landmark log" aria-hidden="true"></div>

        <div class="landmark mushroom m1" aria-hidden="true"></div>
        <div class="landmark mushroom m2" aria-hidden="true"></div>
        <div class="landmark flower f1" aria-hidden="true"></div>
        <div class="landmark flower f2" aria-hidden="true"></div>
        <div class="landmark flower f3" aria-hidden="true"></div>

        <span class="pine p1" aria-hidden="true"></span>
        <span class="pine p2" aria-hidden="true"></span>
        <span class="pine p3" aria-hidden="true"></span>
        <span class="pine p4" aria-hidden="true"></span>
        <span class="pine p5" aria-hidden="true"></span>
        <span class="pine p6" aria-hidden="true"></span>
        <span class="pine p7" aria-hidden="true"></span>
        <span class="pine p8" aria-hidden="true"></span>

        <span class="spark s1" aria-hidden="true"></span>
        <span class="spark s2" aria-hidden="true"></span>
        <span class="spark s3" aria-hidden="true"></span>

        <svg class="trail-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline :points="trailPointsAttr" class="trail-line-base"></polyline>
          <polyline :points="trailPointsAttr" class="trail-line-dash"></polyline>
        </svg>

        <button
          v-for="(zone, idx) in visibleZones"
          :key="`pin-${zone.id}`"
          class="map-stop"
          :class="{ locked: !zone.hasUnlockedLessons }"
          :style="{ '--pin-x': `${zone.mapX}%`, '--pin-y': `${zone.mapY}%` }"
          @click="openZoneFromMap(zone.id)"
        >
          <span class="stop-dot">{{ idx + 1 }}</span>
          <span class="stop-label">{{ zone.label }}</span>
        </button>

        <div class="campfire-goal" :class="{ ready: campfireReady }" aria-label="Story campfire destination">
          <span class="goal-fire" aria-hidden="true"></span>
          <span class="goal-label">Campfire</span>
        </div>
      </div>
    </section>

    <div v-else class="trail-list">
      <button class="map-back-btn" type="button" @click="viewMode = 'map'">Back To Map</button>
      <section
        v-for="zone in visibleZones"
        :key="zone.id"
        class="trail-card"
        :class="[{ active: openZoneId === zone.id, locked: !zone.hasUnlockedLessons }]"
        :style="{ '--trail-accent': zone.accent, '--trail-glow': zone.glow }"
      >
        <button class="trail-button" type="button" :aria-expanded="openZoneId === zone.id" @click="toggleZone(zone.id)">
          <div class="trail-art" aria-hidden="true">{{ zone.icon }}</div>
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
  { id: 'spark-meadow', label: 'Spark Meadow', icon: '??', description: 'Meet your first sounds.', accent: '#9AE6B4', glow: 'rgba(154,230,180,0.28)', range: ['001', '010'], mapX: 13, mapY: 84 },
  { id: 'letter-lake', label: 'Letter Lake', icon: '??', description: 'Grow letter power.', accent: '#7DD3FC', glow: 'rgba(125,211,252,0.28)', range: ['011', '019'], mapX: 26, mapY: 74 },
  { id: 'echo-hills', label: 'Echo Hills', icon: '??', description: 'Practice tricky sounds.', accent: '#FBBF24', glow: 'rgba(251,191,36,0.28)', range: ['020', '034'], mapX: 16, mapY: 61 },
  { id: 'vowel-garden', label: 'Vowel Garden', icon: '??', description: 'Vowel review trail.', accent: '#F9A8D4', glow: 'rgba(249,168,212,0.28)', range: ['035a', '041c'], mapX: 36, mapY: 53 },
  { id: 'dragon-bridge', label: 'Dragon Bridge', icon: '??', description: 'Digraph adventures.', accent: '#F97316', glow: 'rgba(249,115,22,0.28)', range: ['042', '053'], mapX: 56, mapY: 59 },
  { id: 'magic-mountain', label: 'Magic Mountain', icon: '??', description: 'Silent-e magic.', accent: '#C4B5FD', glow: 'rgba(196,181,253,0.3)', range: ['054', '062'], mapX: 76, mapY: 51 },
  { id: 'rhythm-river', label: 'Rhythm River', icon: '??', description: 'Syllable skills.', accent: '#38BDF8', glow: 'rgba(56,189,248,0.28)', range: ['063', '068'], mapX: 84, mapY: 39 },
  { id: 'sunset-ridge', label: 'Sunset Ridge', icon: '??', description: 'Long-sound trails.', accent: '#FB7185', glow: 'rgba(251,113,133,0.28)', range: ['069', '076'], mapX: 69, mapY: 29 },
  { id: 'roaring-caves', label: 'Roaring Caves', icon: '??', description: 'R-controlled sounds.', accent: '#F59E0B', glow: 'rgba(245,158,11,0.28)', range: ['077', '083'], mapX: 49, mapY: 26 },
  { id: 'rainbow-falls', label: 'Rainbow Falls', icon: '??', description: 'Vowel teams.', accent: '#34D399', glow: 'rgba(52,211,153,0.28)', range: ['084', '097'], mapX: 33, mapY: 18 },
  { id: 'builder-bay', label: 'Builder Bay', icon: '??', description: 'Word-building power.', accent: '#A78BFA', glow: 'rgba(167,139,250,0.28)', range: ['098', '110'], mapX: 57, mapY: 14 },
  { id: 'starry-summit', label: 'Starry Summit', icon: '?', description: 'Final mastery trail.', accent: '#FCD34D', glow: 'rgba(252,211,77,0.28)', range: ['111', '128'], mapX: 74, mapY: 11 },
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
  const z = zones.value;
  if (!z.length) return 0;
  const currentIdx = z.findIndex((zone) => !zone.isCompleted);
  if (currentIdx < 0) return z.length - 1;
  return Math.min(currentIdx + 1, z.length - 1);
});

const visibleZones = computed(() => zones.value.filter((_, i) => i <= revealThroughIndex.value));
const openZoneId = ref(zones.value.find((zone) => zone.hasUnlockedLessons)?.id ?? ZONE_DEFS[0].id);
const viewMode = ref('map');
const friendName = computed(() => store.selectedFriend?.name || 'Your Guardian');
const missionLine = computed(() => `${friendName.value} needs your sounds to light the campfire path. Follow the trail to the campfire!`);
const campfirePoint = { x: 50, y: 10 };
const campfireReady = computed(() => revealThroughIndex.value >= zones.value.length - 1);
const trailPointsAttr = computed(() => {
  const points = visibleZones.value.map((zone) => `${zone.mapX},${zone.mapY}`);
  points.push(`${campfirePoint.x},${campfirePoint.y}`);
  return points.join(' ');
});

function speakMapIntro() {
  void ember.speak(`${friendName.value}'s trail map is ready. Follow the trail to the campfire by lighting each reading stop.`);
}

onMounted(() => {
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
  const idx = visibleZones.value.findIndex((zone) => zone.id === zoneId);
  if (idx < 0) return;
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
  max-width: 760px;
  padding: 1rem 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  max-height: 100%;
  border-radius: 1.4rem;
  background: radial-gradient(circle at 20% 0%, rgba(255, 208, 133, 0.2), transparent 40%), #14192a;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.map-hero { text-align: center; }
.hero-kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: #ffd798;
}
.map-title {
  margin: 0.2rem 0 0;
  color: #ffe3ba;
  font-size: clamp(1.5rem, 3.6vw, 2.2rem);
}
.map-subtitle {
  margin: 0.45rem auto 0;
  max-width: 560px;
  color: #d8e7f7;
}

.storybook-map {
  position: relative;
  min-height: 590px;
  padding: 0 52px;
}

.parchment-roll {
  position: absolute;
  top: 14px;
  bottom: 14px;
  width: 52px;
  background: linear-gradient(180deg, #efc99a, #cd9964);
  border: 2px solid #b8814d;
  z-index: 2;
}
.parchment-roll.left { left: 0; border-radius: 24px 0 0 24px; }
.parchment-roll.right { right: 0; border-radius: 0 24px 24px 0; }
.parchment-roll::after {
  content: '';
  position: absolute;
  bottom: 14px;
  left: 6px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 3px solid rgba(123, 70, 32, 0.55);
}

.parchment-board {
  position: relative;
  min-height: 590px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 22% 14%, rgba(255, 255, 255, 0.26), transparent 22%),
    radial-gradient(circle at 78% 16%, rgba(255, 255, 255, 0.2), transparent 24%),
    radial-gradient(circle at 52% 84%, rgba(118, 197, 73, 0.38), transparent 38%),
    linear-gradient(180deg, #c9f275 0%, #8fda55 44%, #79c74e 100%);
  border: 5px solid #d8ad7d;
  overflow: hidden;
  box-shadow:
    inset 0 0 0 2px rgba(118, 72, 34, 0.35),
    0 14px 24px rgba(0, 0, 0, 0.24);
}

.paper-fold {
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid rgba(145, 92, 49, 0.45);
  background: linear-gradient(145deg, #f1d8b2, #d3a672);
  z-index: 2;
}
.paper-fold.top-left { top: -8px; left: -8px; }
.paper-fold.top-right { top: -8px; right: -8px; }
.paper-fold.bottom-left { bottom: -8px; left: -8px; }
.paper-fold.bottom-right { bottom: -8px; right: -8px; }

.trail-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; }
.trail-line-base {
  fill: none;
  stroke: #f6ce4a;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.trail-line-dash {
  fill: none;
  stroke: #c22828;
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 2.8 2.8;
  animation: trailMarch 0.9s linear infinite;
}
@keyframes trailMarch { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -9; } }

.landmark {
  position: absolute;
  z-index: 4;
}
.landmark.tent {
  left: 26%;
  top: 7%;
  width: 118px;
  height: 86px;
  background: linear-gradient(145deg, #24b0e8, #1988c4);
  clip-path: polygon(50% 0%, 100% 100%, 0% 100%, 18% 100%, 50% 35%, 82% 100%);
  border: 2px solid rgba(11, 84, 128, 0.65);
  animation: tentBob 2s ease-in-out infinite;
}
.landmark.backpack {
  left: 15%;
  top: 11%;
  width: 52px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(180deg, #8e67d2, #6e4fb2);
  border: 2px solid rgba(58, 32, 99, 0.55);
}
.landmark.camp-ring {
  left: 53%;
  top: 9.2%;
  width: 58px;
  height: 58px;
  border-radius: 999px;
  border: 6px solid #9d8970;
  box-shadow: inset 0 0 0 3px #b8a892;
}
.landmark.fire {
  left: 56.2%;
  top: 8%;
  width: 28px;
  height: 46px;
  border-radius: 45% 45% 55% 55%;
  background: radial-gradient(circle at 50% 72%, #ffe88b 0%, #ffa22f 56%, #ff5f21 100%);
  animation: fireFlicker 0.42s ease-in-out infinite alternate;
}
.landmark.log {
  left: 46%;
  top: 82%;
  width: 92px;
  height: 46px;
  border-radius: 50% 50% 20% 20%;
  background: linear-gradient(180deg, #bf8e5d, #9e6839);
  border: 2px solid rgba(104, 57, 25, 0.35);
}
.landmark.mushroom {
  width: 24px;
  height: 24px;
  border-radius: 999px 999px 14px 14px;
  background: radial-gradient(circle at 40% 40%, #ffd7e1 0%, #ff6c88 62%, #d53e5f 100%);
  border: 2px solid rgba(126, 29, 52, 0.42);
}
.landmark.mushroom::after {
  content: '';
  position: absolute;
  left: 8px;
  bottom: -13px;
  width: 8px;
  height: 13px;
  border-radius: 6px;
  background: #efe5c3;
}
.m1 { left: 68%; top: 24%; }
.m2 { left: 12%; top: 76%; transform: scale(0.85); }
.landmark.flower {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: radial-gradient(circle at 50% 50%, #ffea78 0%, #ffea78 26%, #ffffff 27%, #ffffff 100%);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
  animation: flowerPop 2s ease-in-out infinite;
}
.f1 { left: 21%; top: 29%; }
.f2 { left: 74%; top: 73%; animation-delay: 0.5s; }
.f3 { left: 83%; top: 31%; animation-delay: 0.8s; }
@keyframes tentBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes fireFlicker { from { transform: scale(1) rotate(-2deg); } to { transform: scale(1.08) rotate(2deg); } }
@keyframes flowerPop { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }

.pine {
  position: absolute;
  width: 34px;
  height: 58px;
  background: linear-gradient(180deg, #14ad75, #0c7f53);
  clip-path: polygon(50% 0%, 86% 28%, 70% 28%, 100% 63%, 66% 63%, 88% 100%, 12% 100%, 34% 63%, 0% 63%, 30% 28%, 14% 28%);
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.18));
  animation: pineSway 2.6s ease-in-out infinite;
  z-index: 2;
}
.p1 { left: 8%; top: 20%; } .p2 { left: 11%; top: 55%; animation-delay: 0.3s; }
.p3 { left: 22%; top: 38%; animation-delay: 0.45s; } .p4 { left: 41%; top: 66%; animation-delay: 0.6s; }
.p5 { left: 62%; top: 33%; animation-delay: 0.75s; } .p6 { left: 74%; top: 52%; animation-delay: 0.9s; }
.p7 { left: 86%; top: 19%; animation-delay: 1.1s; } .p8 { left: 87%; top: 70%; animation-delay: 1.25s; }
@keyframes pineSway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }

.spark {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: radial-gradient(circle at 50% 50%, #fff8cc 0%, #ffcc52 62%, rgba(255, 204, 82, 0.1) 100%);
  z-index: 5;
  animation: sparkFloat 1.8s ease-in-out infinite;
}
.s1 { left: 57%; top: 8%; }
.s2 { left: 60%; top: 6%; animation-delay: 0.35s; }
.s3 { left: 54%; top: 7%; animation-delay: 0.7s; }
@keyframes sparkFloat {
  0%, 100% { transform: translateY(0) scale(0.9); opacity: 0.45; }
  50% { transform: translateY(-8px) scale(1.25); opacity: 1; }
}

.map-stop {
  position: absolute;
  left: var(--pin-x);
  top: var(--pin-y);
  transform: translate(-50%, -50%);
  border: 0;
  background: transparent;
  display: grid;
  justify-items: center;
  gap: 0.16rem;
  cursor: pointer;
  z-index: 7;
}
.map-stop.locked { opacity: 0.42; }
.stop-dot {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 1rem;
  font-weight: 900;
  color: #3f2000;
  background: radial-gradient(circle at 35% 35%, #fff9e5 0%, #ffd99a 62%, #f9c36b 100%);
  border: 3px solid #b93724;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.22);
  animation: stopPulse 1.4s ease-in-out infinite;
}
.stop-label {
  font-size: 0.6rem;
  font-weight: 800;
  color: #2c1900;
  background: rgba(255, 244, 213, 0.96);
  border-radius: 999px;
  padding: 0.1rem 0.42rem;
  border: 1px solid rgba(89, 43, 6, 0.25);
}
@keyframes stopPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }

.campfire-goal {
  position: absolute;
  left: 50%;
  top: 9.5%;
  transform: translate(-50%, -50%);
  display: grid;
  justify-items: center;
  gap: 0.08rem;
  z-index: 6;
}
.goal-fire {
  width: 30px;
  height: 46px;
  border-radius: 45% 45% 55% 55%;
  background: radial-gradient(circle at 50% 70%, #ffe9a0 0%, #ffad36 58%, #ff5e21 100%);
  animation: goalFire 0.6s ease-in-out infinite alternate;
}
.goal-label {
  font-size: 0.62rem;
  font-weight: 900;
  color: #452300;
  background: #ffeebd;
  border-radius: 999px;
  padding: 0.12rem 0.46rem;
  border: 1px solid rgba(103, 57, 16, 0.25);
}
.campfire-goal.ready .goal-label { background: #fff3a3; }
@keyframes goalFire { from { transform: scale(1); } to { transform: scale(1.11); } }

.trail-list { display: grid; gap: 0.9rem; }
.map-back-btn {
  justify-self: center;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  padding: 0.4rem 0.85rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #ffe7c0;
  background: rgba(14, 23, 38, 0.75);
  cursor: pointer;
}
.trail-card {
  border-radius: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(180deg, rgba(17, 29, 48, 0.95), rgba(11, 20, 34, 0.95));
  overflow: hidden;
}
.trail-button {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0.9rem;
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 0.8rem;
  text-align: left;
  cursor: pointer;
}
.trail-art {
  width: 70px;
  height: 70px;
  border-radius: 1rem;
  display: grid;
  place-items: center;
  font-size: 1.7rem;
  background: linear-gradient(180deg, color-mix(in srgb, var(--trail-accent) 32%, white 8%), rgba(255, 255, 255, 0.06));
}
.trail-topline { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; }
.trail-name { color: #fff0cb; font-weight: 800; }
.trail-state {
  font-size: 0.72rem;
  padding: 0.24rem 0.52rem;
  border-radius: 999px;
  color: #1b0d00;
  background: var(--trail-accent);
}
.trail-description { margin: 0.35rem 0 0; color: #d4dfef; font-size: 0.85rem; }
.trail-meta { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.3rem; }
.trail-meta span {
  font-size: 0.72rem;
  padding: 0.16rem 0.46rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #f2f6fa;
}
.trail-panel { padding: 0 0.9rem 0.9rem; }
.panel-title { margin: 0; color: #ffe8bb; font-size: 0.9rem; font-weight: 800; }
.panel-subtitle { margin: 0.2rem 0 0.7rem; color: #b8c6d7; font-size: 0.78rem; }
.map-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 0.5rem; }

.trail-expand-enter-active, .trail-expand-leave-active { transition: all 0.2s ease; }
.trail-expand-enter-from, .trail-expand-leave-to { opacity: 0; transform: translateY(-8px); }

@media (max-width: 640px) {
  .storybook-map { min-height: 520px; padding-inline: 36px; }
  .parchment-roll { width: 36px; }
  .parchment-roll::after { width: 24px; height: 24px; left: 4px; }
  .parchment-board { min-height: 520px; }
  .map-stop .stop-label { display: none; }
}
</style>
