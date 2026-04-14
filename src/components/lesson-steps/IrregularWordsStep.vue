<template>
  <div class="irregular-words-step">
    <h3 class="step-title">Tricky Words</h3>

    <div v-if="allWords.length === 0" class="empty">
      No irregular words for this lesson.
    </div>

    <div v-else-if="currentWord" class="word-card">
      <div class="word">
        <span
          v-for="(part, i) in currentWord.breakdown"
          :key="i"
          class="grapheme"
          :class="{ irregular: !part.regular }"
        >{{ part.grapheme }}</span>
      </div>
      <div class="phoneme-row">
        <span v-for="(part, i) in currentWord.breakdown" :key="i" class="phoneme">{{ part.phoneme }}</span>
      </div>
      <div class="legend">
        <span class="dot regular"></span> regular
        <span class="dot irregular"></span> tricky
      </div>
    </div>

    <div class="controls">
      <div class="progress">{{ index + 1 }} / {{ allWords.length }}</div>
      <button class="next-btn" @click="next">{{ isLast ? 'Done' : 'Next' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';

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

async function speakCurrent() {
  const w = currentWord.value;
  if (!w) return;
  await ember.speak(w.word);
}

watch(index, async () => {
  await speakCurrent();
});

onMounted(async () => {
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
.irregular-words-step { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.empty { color: #888; }
.word-card { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
.word { display: flex; gap: 0.1rem; font-size: 3rem; font-weight: bold; }
.grapheme { color: #FF8C00; }
.grapheme.irregular { color: #FF6B6B; text-decoration: underline; }
.phoneme-row { display: flex; gap: 0.6rem; }
.phoneme { color: #aaa; font-size: 1rem; }
.legend { display: flex; gap: 0.75rem; font-size: 0.75rem; color: #888; align-items: center; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.2rem; }
.dot.regular { background: #FF8C00; }
.dot.irregular { background: #FF6B6B; }
.controls { display: flex; align-items: center; gap: 1rem; }
.progress { color: #666; font-size: 0.8rem; }
.next-btn {
  background: rgba(255, 140, 0, 0.15);
  border: 1.5px solid #FF8C00;
  color: #FF8C00;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}
</style>
