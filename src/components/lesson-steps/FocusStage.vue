<template>
  <div class="focus-stage" :class="emphasisClass" role="presentation">
    <span
      v-for="(token, index) in tokens"
      :key="`${token.text}-${index}`"
      class="focus-token"
      :class="[`kind-${token.kind || 'grapheme'}`, `state-${token.state || 'idle'}`]"
      :aria-hidden="true"
    >{{ token.text }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  tokens: { type: Array, required: true },
  emphasis: { type: String, default: 'tiles' },
});

const emphasisClass = computed(() => `emphasis-${props.emphasis}`);
</script>

<style scoped>
.focus-stage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(10px, 2vw, 20px);
  padding: clamp(16px, 4vw, 32px) clamp(12px, 3vw, 24px);
  min-height: clamp(140px, 24vh, 240px);
}

.focus-token {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  padding: 0.2em 0.5em;
  line-height: 1;
  font-family: 'Fredoka', 'Baloo 2', 'Nunito', system-ui, sans-serif;
  font-weight: 700;
  color: #fff4dc;
  background: linear-gradient(180deg, rgba(25, 47, 74, 0.95), rgba(8, 17, 31, 0.95));
  border: 2px solid rgba(255, 209, 102, 0.28);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.emphasis-letter .focus-token {
  font-size: clamp(120px, 22vw, 220px);
}

.emphasis-tiles .focus-token {
  font-size: clamp(72px, 14vw, 140px);
  min-width: clamp(90px, 16vw, 160px);
}

.emphasis-word .focus-token {
  font-size: clamp(64px, 12vw, 128px);
  letter-spacing: 0.04em;
}

.emphasis-sentence {
  max-width: min(900px, 96vw);
}

.emphasis-sentence .focus-token {
  font-size: clamp(28px, 4.5vw, 48px);
  padding: 0.4em 0.7em;
  line-height: 1.35;
  text-align: center;
  letter-spacing: 0.01em;
}

.focus-token.state-active {
  border-color: #ffd166;
  box-shadow: 0 0 0 6px rgba(255, 209, 102, 0.18), 0 16px 34px rgba(255, 140, 0, 0.35);
  animation: focus-pulse 1.1s ease-in-out infinite;
}

.focus-token.state-done {
  border-color: rgba(126, 232, 136, 0.75);
  box-shadow: 0 0 0 4px rgba(126, 232, 136, 0.22), 0 14px 28px rgba(0, 0, 0, 0.3);
}

.focus-token.kind-grapheme-irregular {
  color: #ffd9a0;
  text-decoration: underline;
  text-decoration-color: rgba(255, 140, 0, 0.75);
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.12em;
}

.focus-token.kind-phoneme {
  font-style: italic;
}

.focus-token.kind-punct {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

@keyframes focus-pulse {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-6px) scale(1.04); }
}

@media (prefers-reduced-motion: reduce) {
  .focus-token.state-active { animation: none; }
}
</style>
