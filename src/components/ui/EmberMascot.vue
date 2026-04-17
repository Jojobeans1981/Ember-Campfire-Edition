<template>
  <div class="ember-wrapper">
    <svg viewBox="0 0 100 100" class="ember-svg" :class="{ speaking }" aria-hidden="true">
      <path
        d="M50 10C30 40 20 60 20 80C20 91 33 100 50 100C67 100 80 91 80 80C80 60 70 40 50 10Z"
        :fill="speaking ? '#FF8C00' : '#A0522D'"
        class="ember-core"
      />
      <circle cx="50" cy="75" r="10" fill="yellow" opacity="0.6">
        <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  </div>
</template>

<script setup>
defineProps({
  speaking: { type: Boolean, default: false },
});
</script>

<style scoped>
.ember-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  position: relative;
}

.ember-svg {
  width: 60px;
  height: 80px;
  transition: filter 0.2s ease;
}

.ember-svg.speaking {
  filter: drop-shadow(0 0 8px rgba(255, 140, 0, 0.6));
  animation: speak-glow 0.6s ease-in-out infinite alternate;
}

@keyframes speak-glow {
  from { filter: drop-shadow(0 0 6px rgba(255, 140, 0, 0.4)); }
  to { filter: drop-shadow(0 0 14px rgba(255, 140, 0, 0.8)); }
}

.ember-core {
  transition: fill 0.3s ease;
}
</style>
