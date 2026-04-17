<template>
  <div class="connected-text-step">
    <FocusStage v-if="currentSentence" :tokens="sentenceTokens" emphasis="sentence" />

    <div v-if="micPhase === 'listening'" class="mic-area" aria-hidden="true">
      <div class="mic-icon">🎤</div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
    </div>

    <div class="controls">
      <button
        v-if="currentSentence"
        class="icon-btn"
        type="button"
        aria-label="Read to me"
        @click="speakCurrent"
      >🔊</button>
      <button
        v-if="currentSentence"
        class="icon-btn"
        type="button"
        aria-label="My turn to read"
        :disabled="micPhase === 'listening'"
        @click="startMic"
      >🎤</button>
      <button
        class="icon-btn primary"
        type="button"
        :aria-label="isLast ? 'Done' : 'Next'"
        :disabled="!canAdvance"
        @click="next"
      >{{ isLast ? '✅' : '➡️' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';
import FocusStage from './FocusStage.vue';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
const {
  startWordListening,
  cancelListening,
  requestMicPermission,
  sustainProgress: micProgress,
} = useSpeechRecognition();

let cancelled = false;

const sentences = computed(() => props.step?.readSentences ?? []);
const index = ref(0);
const currentSentence = computed(() => sentences.value[index.value]);
const isLast = computed(() => index.value >= sentences.value.length - 1);
const micPhase = ref('idle');
const canAdvance = computed(() => micPhase.value === 'matched' || sentences.value.length === 0);

const sentenceTokens = computed(() => {
  const s = currentSentence.value;
  if (!s) return [];
  return [{
    text: s,
    kind: 'sentence',
    state: micPhase.value === 'matched' ? 'done' : 'active',
  }];
});

async function speakCurrent() {
  const s = currentSentence.value;
  if (s) await ember.speak(s);
}

async function startMic() {
  const s = currentSentence.value;
  if (!s) return;
  micPhase.value = 'listening';
  await ember.speak('Listening.');
  const words = s
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const targetWord = words.find((word) => word.length >= 3)
    || words.find((word) => word.length >= 2)
    || words[0]
    || s;
  const result = await startWordListening(targetWord, 8000);
  if (cancelled) return;
  if (result?.matched) {
    micPhase.value = 'matched';
    await ember.speak('Great! You said it!');
  } else {
    micPhase.value = 'missed';
    await ember.speak('Try again. Tap the microphone and read it out loud.');
  }
}

watch(index, () => {
  micPhase.value = 'idle';
});

onMounted(async () => {
  if (sentences.value.length === 0) {
    emit('step-complete');
    return;
  }
  await requestMicPermission();
  await ember.speak('Tap the speaker to hear me read, then tap the microphone for your turn.');
  await speakCurrent();
});

watch(currentSentence, async (sentence, prevSentence) => {
  if (!sentence || sentence === prevSentence) return;
  if (micPhase.value === 'listening') return;
  await speakCurrent();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
  cancelListening();
});

function next() {
  if (!canAdvance.value) return;
  cancelListening();
  micPhase.value = 'idle';
  if (sentences.value.length === 0 || isLast.value) {
    emit('step-complete');
    return;
  }
  index.value++;
}
</script>

<style scoped>
.connected-text-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  width: 100%;
}

.mic-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
}

.mic-icon {
  font-size: 2rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.sustain-meter {
  width: 220px;
  height: 10px;
  background: #333;
  border-radius: 5px;
  overflow: hidden;
}

.sustain-fill {
  height: 100%;
  background: #7ee888;
  transition: width 0.1s;
}

.controls {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
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

.icon-btn:hover:not(:disabled) { transform: scale(1.06); border-color: #ffd166; }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.icon-btn.primary {
  background: rgba(255, 140, 0, 0.22);
  border-color: #ff8c00;
  color: #fff4dc;
}
</style>
