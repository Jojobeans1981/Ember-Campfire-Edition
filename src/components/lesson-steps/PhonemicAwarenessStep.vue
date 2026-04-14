<template>
  <div class="phonemic-awareness-step">
    <h3 class="step-title">Listen and Blend</h3>

    <div v-if="phase === 'blend' && currentBlend" class="task">
      <div class="prompt">I say the sounds, you say the word.</div>
      <button class="reveal-btn" @click="revealBlend">Show word</button>
      <div v-if="showWord" class="word">{{ currentBlend.word }}</div>
    </div>

    <div v-if="phase === 'segment' && currentSegment" class="task">
      <div class="prompt">Listen to the word.</div>
      <div class="word big">{{ currentSegment.word }}</div>
    </div>

    <div class="controls">
      <button class="audio-btn" @click="playCurrent">🔊 Hear again</button>
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

const blendItems = computed(() => props.step?.blend ?? []);
const segmentItems = computed(() => props.step?.segment ?? []);
const totalItems = computed(() => blendItems.value.length + segmentItems.value.length);

const cursor = ref(0);
const showWord = ref(false);

const phase = computed(() => (cursor.value < blendItems.value.length ? 'blend' : 'segment'));
const currentBlend = computed(() => blendItems.value[cursor.value]);
const currentSegment = computed(() => segmentItems.value[cursor.value - blendItems.value.length]);
const isLast = computed(() => cursor.value >= totalItems.value - 1);

async function playBlendPhonemes(item) {
  if (!item) return;
  await ember.speak('Listen to the sounds.');
  for (const p of item.phonemes ?? []) {
    if (cancelled) return;
    await ember.playPhoneme(p);
  }
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

watch(cursor, async () => {
  await playCurrent();
});

onMounted(async () => {
  if (totalItems.value === 0) {
    emit('step-complete');
    return;
  }
  await playCurrent();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
});
</script>

<style scoped>
.phonemic-awareness-step { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.task { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.prompt { color: #aaa; font-size: 0.95rem; }
.word { font-size: 2rem; color: #64FFDA; font-weight: bold; }
.word.big { font-size: 2.5rem; }
.reveal-btn, .next-btn, .audio-btn {
  background: rgba(255, 140, 0, 0.15);
  border: 1.5px solid #FF8C00;
  color: #FF8C00;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}
.controls { margin-top: 0.5rem; }
</style>
