<template>
  <div class="campground-map">
    <header class="map-hero">
      <p class="hero-kicker">Campground Trail Map</p>
      <h2 class="map-title">{{ friendName }}'s Reading Adventure</h2>
    </header>

    <section v-if="viewMode === 'map'" class="storybook-map">
      <div class="map-board">
        <span class="board-spark spark-a"></span>
        <span class="board-spark spark-b"></span>
        <span class="board-spark spark-c"></span>
        <span class="board-spark spark-d"></span>
        <span
          v-for="sparkle in revealSparkles"
          :key="sparkle.id"
          class="reveal-sparkle"
          :style="{
            '--sparkle-x': `${sparkle.x}%`,
            '--sparkle-y': `${sparkle.y}%`,
            '--sparkle-delay': `${sparkle.delay}ms`,
            '--sparkle-scale': sparkle.scale,
          }"
        ></span>
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
            revealed: recentlyRevealedZoneIds.includes(zone.id),
          }"
          :style="{ '--pin-x': `${zone.mapX}%`, '--pin-y': `${zone.mapY}%` }"
          @click="openZoneFromMap(zone.id)"
        >
          <span v-if="zone.id === guardianZoneId && selectedFriendImage" class="guardian-campsite" aria-hidden="true">
            <span class="guardian-flag">{{ friendName }}</span>
            <span class="guardian-mat"></span>
            <span class="guardian-pack"></span>
            <span class="guardian-lantern"></span>
            <img :src="selectedFriendImage" alt="" class="stop-guardian-img" />
          </span>
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
const revealSparkles = ref([]);
const recentlyRevealedZoneIds = ref([]);

const friendName = computed(() => store.selectedFriend?.name || 'Your Guardian');
const selectedFriendImage = computed(() => store.selectedFriend?.file ? `/assets/friends/${store.selectedFriend.file}` : '');
const guardianZoneId = computed(() => currentZoneId.value || visibleZones.value[0]?.id || '');

let revealSparkleSeed = 0;
let revealTimers = [];

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

watch(
  () => visibleZones.value.map((zone) => zone.id),
  (nextIds, prevIds) => {
    if (!prevIds?.length) return;
    const newZoneIds = nextIds.filter((zoneId) => !prevIds.includes(zoneId));
    newZoneIds.forEach((zoneId) => triggerZoneReveal(zoneId));
  },
);

onBeforeUnmount(() => {
  ember.stopSpeaking();
  revealTimers.forEach((timerId) => window.clearTimeout(timerId));
  revealTimers = [];
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

function triggerZoneReveal(zoneId) {
  const zone = visibleZones.value.find((item) => item.id === zoneId);
  if (!zone) return;

  recentlyRevealedZoneIds.value = [...new Set([...recentlyRevealedZoneIds.value, zoneId])];

  const sparkles = Array.from({ length: 8 }, (_, index) => ({
    id: `sparkle-${++revealSparkleSeed}`,
    x: zone.mapX + (Math.random() * 7 - 3.5),
    y: zone.mapY + (Math.random() * 7 - 3.5),
    delay: index * 55,
    scale: (0.85 + Math.random() * 0.5).toFixed(2),
  }));

  revealSparkles.value = [...revealSparkles.value, ...sparkles];

  revealTimers.push(window.setTimeout(() => {
    const sparkleIds = new Set(sparkles.map((sparkle) => sparkle.id));
    revealSparkles.value = revealSparkles.value.filter((sparkle) => !sparkleIds.has(sparkle.id));
  }, 1400));

  revealTimers.push(window.setTimeout(() => {
    recentlyRevealedZoneIds.value = recentlyRevealedZoneIds.value.filter((id) => id !== zoneId);
  }, 1200));
}

function selectLesson(lessonId) {
  store.activeLessonId = lessonId;
  store.currentPage = 'lesson';
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
    radial-gradient(circle at 82% 12%, rgba(120, 226, 255, 0.16), transparent 24%),
    linear-gradient(180deg, rgba(21, 35, 52, 0.96) 0%, rgba(9, 18, 31, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 22px 36px rgba(6, 12, 24, 0.34);
}

.map-hero {
  text-align: center;
  position: relative;
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
  text-shadow: 0 0 18px rgba(255, 176, 96, 0.2);
}

.storybook-map {
  position: relative;
  min-height: 560px;
}

.map-board {
  position: relative;
  width: min(100%, 900px);
  margin: 0 auto;
  isolation: isolate;
}

.map-board::before {
  content: '';
  position: absolute;
  inset: -0.8rem;
  z-index: 0;
  border-radius: 1.4rem;
  background:
    radial-gradient(circle at 50% 10%, rgba(149, 229, 255, 0.16), transparent 28%),
    radial-gradient(circle at 8% 75%, rgba(255, 188, 117, 0.12), transparent 20%),
    radial-gradient(circle at 88% 80%, rgba(126, 226, 170, 0.12), transparent 18%);
  filter: blur(10px);
}

.board-spark {
  position: absolute;
  z-index: 1;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, rgba(255, 251, 225, 0.98) 0%, rgba(255, 206, 108, 0.95) 62%, rgba(255, 161, 86, 0.1) 100%);
  box-shadow: 0 0 10px rgba(255, 213, 111, 0.42);
  animation: boardSparkFloat 3.2s ease-in-out infinite;
}

.spark-a { left: 10%; top: 18%; }
.spark-b { left: 86%; top: 24%; animation-delay: 0.5s; }
.spark-c { left: 18%; top: 76%; animation-delay: 0.9s; }
.spark-d { left: 80%; top: 70%; animation-delay: 1.2s; }

.reveal-sparkle {
  position: absolute;
  left: var(--sparkle-x);
  top: var(--sparkle-y);
  z-index: 2;
  width: calc(0.7rem * var(--sparkle-scale));
  height: calc(0.7rem * var(--sparkle-scale));
  transform: translate(-50%, -50%);
  clip-path: polygon(50% 0, 63% 34%, 100% 38%, 71% 59%, 80% 100%, 50% 76%, 20% 100%, 29% 59%, 0 38%, 37% 34%);
  background: radial-gradient(circle at 35% 35%, rgba(255, 255, 247, 0.98) 0%, rgba(255, 220, 115, 0.95) 52%, rgba(255, 173, 87, 0.08) 100%);
  box-shadow: 0 0 12px rgba(255, 212, 105, 0.48);
  animation: revealSparklePop 1.1s ease-out forwards;
  animation-delay: var(--sparkle-delay);
}

.map-image {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.8rem;
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.26);
  position: relative;
  z-index: 1;
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
  z-index: 2;
}

.map-stop.locked {
  opacity: 0.45;
}

.map-stop.revealed .stop-pin {
  animation: revealedStopPulse 0.95s ease-in-out 2;
}

.map-stop.revealed .stop-sign {
  animation: revealedSignPop 0.9s ease-out 1;
}

.guardian-campsite {
  position: absolute;
  right: 0.85rem;
  bottom: 1.2rem;
  display: grid;
  justify-items: center;
  align-items: end;
  pointer-events: none;
  z-index: 1;
  animation: guardian-bob 2.8s ease-in-out infinite;
}

.guardian-flag {
  position: relative;
  z-index: 3;
  padding: 0.18rem 0.56rem;
  border-radius: 999px;
  white-space: nowrap;
  color: #5b2d00;
  font-size: 0.56rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #fff5d2 0%, #ffd585 100%);
  border: 2px solid #ab6a29;
  box-shadow: 0 5px 12px rgba(60, 25, 0, 0.2);
}

.guardian-flag::after {
  content: '';
  position: absolute;
  left: 0.7rem;
  top: 100%;
  width: 2px;
  height: 0.6rem;
  border-radius: 999px;
  background: #8d5420;
}

.guardian-mat {
  position: absolute;
  bottom: -0.05rem;
  width: 3.7rem;
  height: 1rem;
  border-radius: 999px;
  background:
    radial-gradient(circle at 50% 55%, rgba(151, 205, 110, 0.9) 0%, rgba(101, 160, 73, 0.82) 45%, rgba(64, 107, 45, 0.12) 78%, transparent 82%);
}

.guardian-pack {
  position: absolute;
  left: -0.2rem;
  bottom: 0.55rem;
  width: 0.82rem;
  height: 0.98rem;
  border-radius: 0.35rem;
  background: linear-gradient(180deg, #8c53d0 0%, #6732ad 100%);
  border: 2px solid #4f1d88;
  box-shadow: 0 4px 8px rgba(34, 15, 59, 0.22);
}

.guardian-pack::before {
  content: '';
  position: absolute;
  inset: 0.15rem 0.18rem auto;
  height: 0.18rem;
  border-radius: 999px;
  background: rgba(255, 235, 180, 0.9);
}

.guardian-lantern {
  position: absolute;
  right: -0.1rem;
  bottom: 0.68rem;
  width: 0.56rem;
  height: 0.86rem;
  border-radius: 0.28rem 0.28rem 0.22rem 0.22rem;
  background: linear-gradient(180deg, #ffe796 0%, #ffbb50 65%, #9f5821 100%);
  border: 2px solid #96521e;
  box-shadow: 0 0 10px rgba(255, 202, 83, 0.45);
}

.guardian-lantern::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 0.38rem;
  height: 0.22rem;
  transform: translateX(-50%);
  border: 2px solid #96521e;
  border-bottom: 0;
  border-radius: 0.4rem 0.4rem 0 0;
}

.stop-guardian-img {
  position: relative;
  z-index: 2;
  width: 3.15rem;
  height: 3.15rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  padding: 0.16rem;
  object-fit: contain;
  background: linear-gradient(180deg, rgba(255, 245, 214, 0.98), rgba(255, 221, 142, 0.98));
  border: 3px solid #b66a22;
  box-shadow: 0 10px 18px rgba(53, 25, 0, 0.26);
}

.stop-guardian-img {
  object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(44, 19, 2, 0.25));
}

@keyframes guardian-bob {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}


@keyframes boardSparkFloat {
  0%,
  100% {
    transform: translateY(0) scale(0.94);
    opacity: 0.72;
  }

  50% {
    transform: translateY(-7px) scale(1.08);
    opacity: 1;
  }
}

@keyframes revealSparklePop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.25) rotate(0deg);
  }

  35% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.08) rotate(18deg);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, calc(-50% - 20px)) scale(0.76) rotate(34deg);
  }
}

@keyframes revealedStopPulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
  }

  50% {
    transform: scale(1.18);
    box-shadow:
      0 0 0 7px rgba(255, 221, 128, 0.28),
      0 3px 12px rgba(0, 0, 0, 0.22);
  }
}

@keyframes revealedSignPop {
  0% {
    transform: scale(0.9);
  }

  60% {
    transform: scale(1.08);
  }

  100% {
    transform: scale(1);
  }
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
