<template>
  <div class="ember-wrapper">
    <div v-if="text" class="speech-bubble">
      {{ text }}
    </div>
    <svg viewBox="0 0 100 100" class="ember-svg" :class="{ speaking }">
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
  text: { type: String, default: '' },
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

.speech-bubble {
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(255, 140, 0, 0.3);
  border-radius: 0.75rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  color: #E0E0E0;
  max-width: 250px;
  text-align: center;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
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
