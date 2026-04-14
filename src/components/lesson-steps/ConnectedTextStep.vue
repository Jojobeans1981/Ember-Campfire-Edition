<template>
  <div class="connected-text-step">
    <h3 class="step-title">Read the Sentences</h3>

    <div v-if="currentSentence" class="sentence-card">
      <div class="sentence">{{ currentSentence }}</div>
      <div class="instruction">Read it out loud.</div>
    </div>
    <div v-else class="empty">No sentences for this lesson.</div>

    <div class="controls">
      <div class="progress" v-if="sentences.length > 0">{{ index + 1 }} / {{ sentences.length }}</div>
      <button class="next-btn" @click="next">{{ isLast ? 'Done' : 'Next' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const sentences = computed(() => props.step?.readSentences ?? []);
const index = ref(0);
const currentSentence = computed(() => sentences.value[index.value]);
const isLast = computed(() => index.value >= sentences.value.length - 1);

function next() {
  if (sentences.value.length === 0 || isLast.value) {
    emit('step-complete');
    return;
  }
  index.value++;
}
</script>

<style scoped>
.connected-text-step { display: flex; flex-direction: column; align-items: center; gap: 1.25rem; padding: 1rem; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.sentence-card { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.sentence { font-size: 1.6rem; color: #E0E0E0; text-align: center; max-width: 320px; }
.instruction { color: #888; font-size: 0.85rem; }
.empty { color: #888; }
.controls { display: flex; align-items: center; gap: 1rem; }
.progress { color: #666; font-size: 0.8rem; }
.next-btn {
  background: rgba(100, 255, 218, 0.15);
  border: 1.5px solid #64FFDA;
  color: #64FFDA;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}
</style>
