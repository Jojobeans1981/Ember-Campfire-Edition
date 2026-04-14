<template>
  <div class="visual-drill-step">
    <h3 class="step-title">Visual Drill</h3>

    <div v-if="currentItem" class="big-letter">
      {{ currentItem.grapheme }}
    </div>

    <div class="instruction">
      {{ instruction }}
    </div>

    <div class="controls">
      <button class="audio-btn" @click="playCurrent" :disabled="busy">
        🔊 Hear sound
      </button>
      <button class="next-btn" @click="next">
        {{ isLast ? 'Done' : 'Next' }}
      </button>
    </div>

    <div class="item-progress">{{ index + 1 }} / {{ items.length }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const ember = useEmber();

const items = computed(() => props.step?.items ?? []);
const index = ref(0);
const currentItem = computed(() => items.value[index.value]);
const isLast = computed(() => index.value >= items.value.length - 1);
const busy = ref(false);
let cancelled = false;

const instruction = computed(() => {
  const i = currentItem.value;
  if (!i) return '';
  return `What sound does ${i.grapheme} make?`;
});

async function playCurrent() {
  if (cancelled || busy.value) return;
  const item = currentItem.value;
  if (!item) return;
  busy.value = true;
  await ember.speak(`What sound does ${item.grapheme} make?`);
  for (const p of item.phonemes ?? []) {
    if (cancelled) break;
    await ember.playPhoneme(p);
  }
  busy.value = false;
}

function next() {
  if (isLast.value) {
    emit('step-complete');
    return;
  }
  index.value++;
}

onMounted(async () => {
  if (items.value.length === 0) {
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
.visual-drill-step { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.big-letter { font-size: 6rem; color: #FF8C00; font-weight: bold; line-height: 1; text-shadow: 0 0 20px rgba(255, 140, 0, 0.3); }
.instruction { color: #aaa; font-size: 1rem; text-align: center; }
.controls { display: flex; gap: 0.75rem; }
.audio-btn, .next-btn {
  background: rgba(255, 140, 0, 0.15);
  border: 1.5px solid #FF8C00;
  color: #FF8C00;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}
.audio-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.item-progress { color: #666; font-size: 0.75rem; }
</style>
