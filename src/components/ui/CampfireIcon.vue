<template>
  <div class="campfire-icon" :class="stage">
    <svg viewBox="0 0 60 60" class="campfire-svg">
      <!-- Logs -->
      <rect x="10" y="45" width="40" height="6" rx="3" fill="#8B4513" />
      <rect x="15" y="40" width="30" height="5" rx="2.5" fill="#A0522D" />

      <!-- Flames (visible when sparks > 0) -->
      <g v-if="sparks > 0" class="flames">
        <!-- Small ember glow -->
        <ellipse cx="30" cy="42" :rx="4 + sparks" :ry="2 + sparks * 0.5" fill="#FF4500" opacity="0.3">
          <animate attributeName="rx" :values="`${4 + sparks};${6 + sparks};${4 + sparks}`" dur="1.5s" repeatCount="indefinite" />
        </ellipse>

        <!-- Main flame -->
        <path
          :d="flamePath"
          :fill="flameColor"
          class="flame-main"
        >
          <animate attributeName="d" :values="flameAnim" dur="0.8s" repeatCount="indefinite" />
        </path>

        <!-- Inner flame (when fire stage) -->
        <path
          v-if="sparks >= 5"
          d="M30 38C26 32 24 28 24 24C24 18 30 14 30 14C30 14 36 18 36 24C36 28 34 32 30 38Z"
          fill="#FFD93D"
          opacity="0.7"
        >
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="1.2s" repeatCount="indefinite" />
        </path>

        <!-- Spark particles -->
        <circle v-for="i in Math.min(sparks, 7)" :key="i"
          :cx="25 + (i * 5) % 15"
          :cy="30 - i * 3"
          r="1"
          fill="#FFD93D"
          opacity="0.8"
        >
          <animate attributeName="cy" :values="`${30 - i * 3};${20 - i * 3};${30 - i * 3}`" :dur="`${1 + i * 0.3}s`" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0;0.8" :dur="`${1 + i * 0.3}s`" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  sparks: { type: Number, default: 0 },
  stage: { type: String, default: 'kindling' },
});

const flameHeight = computed(() => {
  if (props.sparks <= 0) return 0;
  if (props.sparks <= 2) return 10;
  if (props.sparks <= 4) return 18;
  if (props.sparks <= 6) return 26;
  return 32;
});

const flameColor = computed(() => {
  if (props.sparks <= 2) return '#FF6347';
  if (props.sparks <= 4) return '#FF4500';
  if (props.sparks <= 6) return '#FF8C00';
  return '#FFD93D';
});

const flamePath = computed(() => {
  const h = flameHeight.value;
  const top = 42 - h;
  return `M30 42C24 ${42 - h * 0.6} 20 ${42 - h * 0.8} 20 ${top + 4}C20 ${top} 30 ${top - 4} 30 ${top - 4}C30 ${top - 4} 40 ${top} 40 ${top + 4}C40 ${42 - h * 0.8} 36 ${42 - h * 0.6} 30 42Z`;
});

const flameAnim = computed(() => {
  const h = flameHeight.value;
  const top = 42 - h;
  const p1 = `M30 42C24 ${42 - h * 0.6} 20 ${42 - h * 0.8} 20 ${top + 4}C20 ${top} 30 ${top - 4} 30 ${top - 4}C30 ${top - 4} 40 ${top} 40 ${top + 4}C40 ${42 - h * 0.8} 36 ${42 - h * 0.6} 30 42Z`;
  const p2 = `M30 42C22 ${42 - h * 0.5} 18 ${42 - h * 0.7} 19 ${top + 5}C19 ${top + 1} 30 ${top - 2} 30 ${top - 2}C30 ${top - 2} 41 ${top + 1} 41 ${top + 5}C42 ${42 - h * 0.7} 38 ${42 - h * 0.5} 30 42Z`;
  return `${p1};${p2};${p1}`;
});
</script>

<style scoped>
.campfire-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.campfire-svg {
  width: 50px;
  height: 50px;
}

.flames {
  filter: drop-shadow(0 0 4px rgba(255, 140, 0, 0.5));
}

.campfire-icon.fire .flames,
.campfire-icon.stories .flames {
  filter: drop-shadow(0 0 8px rgba(255, 140, 0, 0.7));
}

.flame-main {
  transition: fill 0.5s;
}
</style>
