<template>
  <div class="phonemic-awareness-step">
    <h3 class="step-title">Listen and Blend</h3>

    <div v-if="phase === 'blend' && currentBlend" class="task">
      <div class="prompt">I say the sounds, you say the word.</div>
      <div class="phonemes">
        <span v-for="(p, i) in currentBlend.phonemes" :key="i" class="phoneme">{{ p }}</span>
      </div>
      <button class="reveal-btn" @click="revealBlend">Show word</button>
      <div v-if="showWord" class="word">{{ currentBlend.word }}</div>
    </div>

    <div v-if="phase === 'segment' && currentSegment" class="task">
      <div class="prompt">I say the word, you tap the sounds.</div>
      <div class="word big">{{ currentSegment.word }}</div>
      <div class="phonemes">
        <button
          v-for="(p, i) in currentSegment.phonemes"
          :key="i"
          class="phoneme tappable"
          :class="{ tapped: tappedSegments[i] }"
          @click="tapSegment(i)"
        >{{ p }}</button>
      </div>
    </div>

    <div class="controls">
      <button class="next-btn" @click="next">{{ isLast ? 'Done' : 'Next' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const blendItems = computed(() => props.step?.blend ?? []);
const segmentItems = computed(() => props.step?.segment ?? []);
const totalItems = computed(() => blendItems.value.length + segmentItems.value.length);

const cursor = ref(0);
const tappedSegments = ref([]);
const showWord = ref(false);

const phase = computed(() => (cursor.value < blendItems.value.length ? 'blend' : 'segment'));
const currentBlend = computed(() => blendItems.value[cursor.value]);
const currentSegment = computed(() => segmentItems.value[cursor.value - blendItems.value.length]);
const isLast = computed(() => cursor.value >= totalItems.value - 1);

function revealBlend() {
  showWord.value = true;
}

function tapSegment(i) {
  tappedSegments.value[i] = true;
}

function next() {
  if (cursor.value >= totalItems.value - 1) {
    emit('step-complete');
    return;
  }
  cursor.value++;
  showWord.value = false;
  tappedSegments.value = [];
}
</script>

<style scoped>
.phonemic-awareness-step { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.task { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.prompt { color: #aaa; font-size: 0.95rem; }
.phonemes { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
.phoneme {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  background: rgba(255, 140, 0, 0.15);
  border: 1px solid rgba(255, 140, 0, 0.4);
  color: #FF8C00;
  border-radius: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  font-family: inherit;
}
.phoneme.tappable { cursor: pointer; }
.phoneme.tapped { background: rgba(100, 255, 218, 0.2); border-color: #64FFDA; color: #64FFDA; }
.word { font-size: 2rem; color: #64FFDA; font-weight: bold; }
.word.big { font-size: 2.5rem; }
.reveal-btn, .next-btn {
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
