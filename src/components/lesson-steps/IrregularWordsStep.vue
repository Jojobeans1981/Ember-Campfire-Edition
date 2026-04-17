<template>
  <div class="irregular-words-step">
    <FocusStage
      v-if="currentWord"
      :tokens="wordTokens"
      emphasis="tiles"
    />

    <div class="controls">
      <button
        v-if="currentWord"
        class="icon-btn"
        type="button"
        aria-label="Hear again"
        @click="speakCurrent"
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
import FocusStage from './FocusStage.vue';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
let cancelled = false;

const allWords = computed(() => [
  ...(props.step?.review ?? []),
  ...(props.step?.teach ?? []),
]);

const index = ref(0);
const currentWord = computed(() => allWords.value[index.value]);
const isLast = computed(() => index.value >= allWords.value.length - 1);

const wordTokens = computed(() => {
  const w = currentWord.value;
  if (!w) return [];
  const breakdown = w.breakdown ?? [];
  if (breakdown.length === 0) {
    return [{ text: w.word, kind: 'word', state: 'active' }];
  }
  return breakdown.map((part) => ({
    text: part.grapheme,
    kind: part.regular ? 'grapheme' : 'grapheme-irregular',
    state: 'active',
  }));
});

async function speakCurrent() {
  const w = currentWord.value;
  if (!w) return;
  if (!cancelled) {
    await ember.speak('This is a tricky word. The tricky part is underlined.');
  }
  if (cancelled) return;
  await ember.speak(w.word);
}

watch(index, async () => {
  if (!cancelled) await ember.speak(currentWord.value?.word ?? '');
});

onMounted(async () => {
  if (allWords.value.length === 0) {
    emit('step-complete');
    return;
  }
  await speakCurrent();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
});

function next() {
  if (allWords.value.length === 0 || isLast.value) {
    emit('step-complete');
    return;
  }
  index.value++;
}
</script>

<style scoped>
.irregular-words-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  width: 100%;
}

.controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
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
