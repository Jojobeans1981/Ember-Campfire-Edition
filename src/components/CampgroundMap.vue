<template>
  <div class="campground-map">
    <header class="map-hero">
      <p class="hero-kicker">Choose a Trail</p>
      <h2 class="map-title">Pick Your Reading Adventure</h2>
      <p class="map-subtitle">
        Each trail teaches one family of reading skills. Open one trail at a time
        so the journey feels calm and easy to follow.
      </p>
    </header>

    <div class="trail-list">
      <section
        v-for="zone in zones"
        :key="zone.id"
        class="trail-card"
        :class="[{ active: openZoneId === zone.id, locked: !zone.hasUnlockedLessons }]"
        :style="{ '--trail-accent': zone.accent, '--trail-glow': zone.glow }"
      >
        <button
          class="trail-button"
          type="button"
          :aria-expanded="openZoneId === zone.id"
          @click="toggleZone(zone.id)"
        >
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
              <p class="panel-subtitle">
                Start with the glowing stop and keep moving forward one step at a time.
              </p>
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
import { computed, ref } from 'vue';
import { ALL_UFLI_LESSON_IDS } from '../data/ufli/ufliLessons.js';
import { getLessonMeta } from '../data/ufli/ufliCurriculum.js';
import { useUfliProgression } from '../composables/useUfliProgression.js';
import { store } from '../store';
import MapStation from './MapStation.vue';

const { getUfliLessonStatus } = useUfliProgression();

const ZONE_DEFS = [
  {
    id: 'spark-meadow',
    label: 'Spark Meadow',
    icon: '🌱',
    description: 'Meet your very first sounds and build tiny words.',
    accent: '#9AE6B4',
    glow: 'rgba(154, 230, 180, 0.28)',
    range: ['001', '010'],
  },
  {
    id: 'letter-lake',
    label: 'Letter Lake',
    icon: '💧',
    description: 'Learn more letters and make your word powers grow.',
    accent: '#7DD3FC',
    glow: 'rgba(125, 211, 252, 0.28)',
    range: ['011', '019'],
  },
  {
    id: 'echo-hills',
    label: 'Echo Hills',
    icon: '⛰️',
    description: 'Practice tricky consonants, endings, and sound patterns.',
    accent: '#FBBF24',
    glow: 'rgba(251, 191, 36, 0.28)',
    range: ['020', '034'],
  },
  {
    id: 'vowel-garden',
    label: 'Vowel Garden',
    icon: '🌸',
    description: 'Review short vowels with cozy practice trails.',
    accent: '#F9A8D4',
    glow: 'rgba(249, 168, 212, 0.28)',
    range: ['035a', '041c'],
  },
  {
    id: 'dragon-bridge',
    label: 'Dragon Bridge',
    icon: '🐉',
    description: 'Cross into double letters and digraph adventures.',
    accent: '#F97316',
    glow: 'rgba(249, 115, 22, 0.28)',
    range: ['042', '053'],
  },
  {
    id: 'magic-mountain',
    label: 'Magic Mountain',
    icon: '🏰',
    description: 'Discover silent-e magic and longer vowel sounds.',
    accent: '#C4B5FD',
    glow: 'rgba(196, 181, 253, 0.3)',
    range: ['054', '062'],
  },
  {
    id: 'rhythm-river',
    label: 'Rhythm River',
    icon: '🛶',
    description: 'Flow through endings and syllable-building skills.',
    accent: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.28)',
    range: ['063', '068'],
  },
  {
    id: 'sunset-ridge',
    label: 'Sunset Ridge',
    icon: '🌄',
    description: 'Explore bigger patterns and long-sound trails.',
    accent: '#FB7185',
    glow: 'rgba(251, 113, 133, 0.28)',
    range: ['069', '076'],
  },
  {
    id: 'roaring-caves',
    label: 'Roaring Caves',
    icon: '🦁',
    description: 'Roam through r-controlled sounds and strong word echoes.',
    accent: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.28)',
    range: ['077', '083'],
  },
  {
    id: 'rainbow-falls',
    label: 'Rainbow Falls',
    icon: '🌈',
    description: 'Splash into vowel teams and gliding sounds.',
    accent: '#34D399',
    glow: 'rgba(52, 211, 153, 0.28)',
    range: ['084', '097'],
  },
  {
    id: 'builder-bay',
    label: 'Builder Bay',
    icon: '🧰',
    description: 'Build bigger words with endings, rules, and hidden letters.',
    accent: '#A78BFA',
    glow: 'rgba(167, 139, 250, 0.28)',
    range: ['098', '110'],
  },
  {
    id: 'starry-summit',
    label: 'Starry Summit',
    icon: '⭐',
    description: 'Master advanced patterns on the final shining trail.',
    accent: '#FCD34D',
    glow: 'rgba(252, 211, 77, 0.28)',
    range: ['111', '128'],
  },
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
    const statuses = lessonIds.map((lessonId) => getUfliLessonStatus(lessonId));
    const completedCount = statuses.filter((status) => status === 'complete').length;
    const firstPlayableId = lessonIds.find((lessonId) => getUfliLessonStatus(lessonId) !== 'locked');
    const nextMeta = firstPlayableId ? getLessonMeta(firstPlayableId) : null;

    return {
      ...zone,
      lessonIds,
      completedCount,
      hasUnlockedLessons: Boolean(firstPlayableId),
      nextLessonLabel: nextMeta ? `Next: Stop ${nextMeta.lessonNumber}` : 'Locked for now',
    };
  });
});

const openZoneId = ref(
  zones.value.find((zone) => zone.hasUnlockedLessons)?.id ?? ZONE_DEFS[0].id,
);

function getStatus(lessonId) {
  return getUfliLessonStatus(lessonId);
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
}

.map-hero {
  text-align: center;
  padding: 1.2rem 1rem 0.4rem;
}

.hero-kicker {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.72rem;
  color: #ffd166;
}

.map-title {
  margin: 0;
  font-size: clamp(1.7rem, 4vw, 2.4rem);
  color: #fff4db;
}

.map-subtitle {
  margin: 0.65rem auto 0;
  max-width: 560px;
  color: #cdd6e3;
  line-height: 1.5;
  font-size: 0.98rem;
}

.trail-list {
  display: grid;
  gap: 0.9rem;
}

.trail-card {
  border-radius: 1.4rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top right, var(--trail-glow), transparent 35%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(10, 16, 28, 0.98));
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

.trail-card.locked {
  opacity: 0.68;
}

.trail-card.active {
  border-color: color-mix(in srgb, var(--trail-accent) 55%, white 10%);
  box-shadow: 0 22px 55px rgba(0, 0, 0, 0.28);
}

.trail-button {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 1rem;
  display: grid;
  grid-template-columns: 78px 1fr;
  gap: 0.9rem;
  text-align: left;
}

.trail-art {
  width: 78px;
  height: 78px;
  border-radius: 1.25rem;
  display: grid;
  place-items: center;
  font-size: 2rem;
  background: linear-gradient(180deg, color-mix(in srgb, var(--trail-accent) 28%, white 8%), rgba(255, 255, 255, 0.05));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.trail-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.trail-topline {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.trail-name {
  font-size: 1.1rem;
  font-weight: 800;
  color: #fff5dd;
}

.trail-state {
  flex-shrink: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: #07111d;
  background: var(--trail-accent);
  padding: 0.32rem 0.6rem;
  border-radius: 999px;
}

.trail-description {
  margin: 0;
  color: #d9e2ef;
  line-height: 1.45;
}

.trail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.1rem;
}

.trail-meta span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0.18rem 0.62rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #f3f6fa;
  font-size: 0.8rem;
}

.trail-panel {
  padding: 0 1rem 1rem;
}

.trail-panel-head {
  margin: 0.1rem 0 0.8rem;
}

.panel-title {
  margin: 0;
  color: #fff1cf;
  font-size: 0.95rem;
  font-weight: 800;
}

.panel-subtitle {
  margin: 0.2rem 0 0;
  color: #b9c4d4;
  font-size: 0.82rem;
}

.map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: 0.55rem;
  width: 100%;
}

.trail-expand-enter-active,
.trail-expand-leave-active {
  transition: all 0.22s ease;
}

.trail-expand-enter-from,
.trail-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 640px) {
  .campground-map {
    padding-inline: 0.8rem;
  }

  .trail-button {
    grid-template-columns: 68px 1fr;
    gap: 0.75rem;
  }

  .trail-art {
    width: 68px;
    height: 68px;
    font-size: 1.75rem;
  }

  .trail-topline {
    flex-direction: column;
    align-items: flex-start;
  }

  .map-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
