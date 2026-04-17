<template>
  <div class="blending-step">
    <FocusStage :tokens="focusTokens" emphasis="tiles" />

    <div v-if="hasTiles" class="tile-pools" aria-label="Sound tiles">
      <div v-if="tiles.initial?.length" class="tile-row">
        <button
          v-for="t in tiles.initial"
          :key="`i-${t}`"
          class="tile"
          type="button"
          :aria-label="`Play sound ${t}`"
          @click="playTile(t)"
        >{{ t }}</button>
      </div>
      <div v-if="tiles.medial?.length" class="tile-row">
        <button
          v-for="t in tiles.medial"
          :key="`m-${t}`"
          class="tile vowel"
          type="button"
          :aria-label="`Play sound ${t}`"
          @click="playTile(t)"
        >{{ t }}</button>
      </div>
      <div v-if="tiles.final?.length" class="tile-row">
        <button
          v-for="t in tiles.final"
          :key="`f-${t}`"
          class="tile"
          type="button"
          :aria-label="`Play sound ${t}`"
          @click="playTile(t)"
        >{{ t }}</button>
      </div>
    </div>

    <div class="controls">
      <button
        class="icon-btn"
        type="button"
        aria-label="Hear the word"
        @click="speakCurrentWord"
      >🔊</button>
      <button
        class="icon-btn primary"
        type="button"
        :aria-label="isLastChain ? 'Done' : 'Next'"
        @click="nextChainWord"
      >{{ isLastChain ? '✅' : '➡️' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import FocusStage from './FocusStage.vue';

const props = defineProps({ step: Object, unitId: String });
const emit = defineEmits(['step-complete']);

const ember = useEmber();

const wordChain = computed(() => props.step?.wordChain ?? []);
const tiles = computed(() => props.step?.tiles ?? {});
const hasTiles = computed(() =>
  (tiles.value.initial?.length || 0)
    + (tiles.value.medial?.length || 0)
    + (tiles.value.final?.length || 0) > 0,
);

const chainIndex = ref(0);
const currentChainWord = computed(() => wordChain.value[chainIndex.value] ?? '');
const isLastChain = computed(() => chainIndex.value >= wordChain.value.length - 1);
const playingIndex = ref(-1);
let cancelled = false;

const focusTokens = computed(() => {
  const word = currentChainWord.value;
  if (!word) return [];
  return Array.from(word).map((letter, i) => ({
    text: letter,
    kind: 'grapheme',
    state: i === playingIndex.value ? 'active' : 'idle',
  }));
});

async function nextChainWord() {
  if (wordChain.value.length === 0 || isLastChain.value) {
    emit('step-complete');
    return;
  }
  chainIndex.value++;
}

async function speakCurrentWord() {
  const w = currentChainWord.value;
  if (!w) return;
  const letters = Array.from(w.toLowerCase());
  for (let i = 0; i < letters.length; i += 1) {
    if (cancelled) {
      playingIndex.value = -1;
      return;
    }
    const ch = letters[i];
    if (!/[a-z]/.test(ch)) continue;
    playingIndex.value = i;
    await ember.playPhoneme(ch);
  }
  playingIndex.value = -1;
  if (cancelled) return;
  await ember.speak(w);
}

async function playTile(letter) {
  await ember.playPhoneme(letter);
}

onBeforeUnmount(() => {
  cancelled = true;
  playingIndex.value = -1;
  ember.stopSpeaking();
});
</script>

<style scoped>
.blending-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  width: 100%;
}

.tile-pools {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  align-items: center;
}

.tile-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.tile {
  width: 64px;
  height: 64px;
  font-size: 2rem;
  font-weight: 700;
  border: 2px solid rgba(255, 209, 102, 0.35);
  background: rgba(25, 47, 74, 0.75);
  color: #ffd166;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease;
  font-family: inherit;
}

.tile.vowel { color: #7ee888; border-color: rgba(126, 232, 136, 0.4); }
.tile:hover { transform: scale(1.08); border-color: #ffd166; }
.tile:active { transform: scale(0.96); }

.controls {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.4rem;
}

.icon-btn {
  width: 64px;
  height: 64px;
  font-size: 1.6rem;
  border: 2px solid rgba(255, 209, 102, 0.35);
  background: rgba(25, 47, 74, 0.75);
  color: #ffd166;
  border-radius: 50%;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
}

.icon-btn:hover { transform: scale(1.06); border-color: #ffd166; }
.icon-btn:active { transform: scale(0.96); }

.icon-btn.primary {
  background: rgba(255, 140, 0, 0.22);
  border-color: #ff8c00;
  color: #fff4dc;
}
</style>
