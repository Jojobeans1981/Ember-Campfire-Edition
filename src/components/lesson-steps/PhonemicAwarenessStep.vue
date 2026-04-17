<template>
  <div class="phonemic-awareness-step">
    <FocusStage :tokens="focusTokens" :emphasis="focusEmphasis" />

    <div class="controls">
      <button
        v-if="phase === 'blend' && !showWord"
        class="icon-btn"
        type="button"
        aria-label="Show the word"
        @click="revealBlend"
      >👁️</button>
      <button
        class="icon-btn"
        type="button"
        aria-label="Hear again"
        @click="playCurrent"
      >🔊</button>
      <button
        class="icon-btn primary"
        type="button"
        :aria-label="isLast ? 'Done' : 'Next'"
        @click="next"
      >{{ isLast ? '✅' : '➡️' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { phonemeToDisplay } from '../../utils/phonemeDisplay.js';
import FocusStage from './FocusStage.vue';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
let cancelled = false;

const blendItems = computed(() => props.step?.blend ?? []);
const segmentItems = computed(() => props.step?.segment ?? []);
const totalItems = computed(() => blendItems.value.length + segmentItems.value.length);

const cursor = ref(0);
const showWord = ref(false);
const playingIndex = ref(-1);

const phase = computed(() => (cursor.value < blendItems.value.length ? 'blend' : 'segment'));
const currentBlend = computed(() => blendItems.value[cursor.value]);
const currentSegment = computed(() => segmentItems.value[cursor.value - blendItems.value.length]);
const isLast = computed(() => cursor.value >= totalItems.value - 1);

const focusEmphasis = computed(() => {
  if (phase.value === 'blend') return showWord.value ? 'word' : 'tiles';
  return 'word';
});

const focusTokens = computed(() => {
  if (phase.value === 'blend') {
    if (showWord.value && currentBlend.value) {
      return [{ text: currentBlend.value.word, kind: 'word', state: 'active' }];
    }
    const phonemes = currentBlend.value?.phonemes ?? [];
    return phonemes.map((p, i) => ({
      text: phonemeToDisplay(p),
      kind: 'phoneme',
      state: i === playingIndex.value ? 'active' : 'idle',
    }));
  }
  if (currentSegment.value) {
    return [{ text: currentSegment.value.word, kind: 'word', state: 'active' }];
  }
  return [];
});

async function playBlendPhonemes(item) {
  if (!item) return;
  const phonemes = item.phonemes ?? [];
  for (let i = 0; i < phonemes.length; i += 1) {
    if (cancelled) {
      playingIndex.value = -1;
      return;
    }
    playingIndex.value = i;
    await ember.playPhoneme(phonemes[i]);
  }
  playingIndex.value = -1;
}

async function playSegmentWord(item) {
  if (!item) return;
  await ember.speak(`The word is ${item.word}.`);
}

async function revealBlend() {
  showWord.value = true;
  if (currentBlend.value) {
    await ember.speak(currentBlend.value.word);
  }
}

async function playCurrent() {
  if (phase.value === 'blend') {
    await playBlendPhonemes(currentBlend.value);
  } else {
    await playSegmentWord(currentSegment.value);
  }
}

function next() {
  if (cursor.value >= totalItems.value - 1) {
    emit('step-complete');
    return;
  }
  cursor.value++;
  showWord.value = false;
}

watch(cursor, async (next, prev) => {
  if (next === prev) return;
  const isEntryIntoSegment = next >= blendItems.value.length && prev < blendItems.value.length;
  if (isEntryIntoSegment) {
    await ember.speak('Listen to the word.');
  }
  await playCurrent();
});

onMounted(async () => {
  if (totalItems.value === 0) {
    emit('step-complete');
    return;
  }
  await ember.speak('Listen and blend.');
  await playCurrent();
});

onBeforeUnmount(() => {
  cancelled = true;
  playingIndex.value = -1;
  ember.stopSpeaking();
});
</script>

<style scoped>
.phonemic-awareness-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 1rem;
  width: 100%;
}

.controls {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.25rem;
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
