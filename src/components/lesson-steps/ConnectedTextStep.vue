<template>
  <div class="connected-text-step">
    <h3 class="step-title">Read the Story</h3>

    <div v-if="currentSentence" class="sentence-card">
      <div class="sentence">{{ currentSentence }}</div>
      <div class="instruction">Tap Read to me, then tap My turn.</div>
    </div>
    <div v-else class="empty">No sentences for this lesson.</div>

    <div v-if="micPhase === 'listening'" class="mic-area">
      <div class="mic-icon">🎤</div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
      <div class="listening-label">Listening…</div>
    </div>

    <div v-if="micPhase === 'matched'" class="result success">Great reading!</div>
    <div v-if="micPhase === 'missed'" class="result help">Try again. Tap 🎤 and read it out loud.</div>

    <div class="controls">
      <button v-if="currentSentence" class="audio-btn" @click="speakCurrent">🔊 Read to me</button>
      <button v-if="currentSentence" class="audio-btn" @click="startMic" :disabled="micPhase === 'listening'">
        🎤 My turn
      </button>
      <button class="next-btn" :disabled="!canAdvance" @click="next">{{ isLast ? 'Done' : 'Next' }}</button>
    </div>

    <div v-if="sentences.length > 0" class="progress">{{ index + 1 }} / {{ sentences.length }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';

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
const micPhase = ref('idle'); // idle | listening | matched | missed
const canAdvance = computed(() => micPhase.value === 'matched' || sentences.value.length === 0);

async function speakCurrent() {
  const s = currentSentence.value;
  if (s) await ember.speak(s);
}

async function startMic() {
  const s = currentSentence.value;
  if (!s) return;
  micPhase.value = 'listening';
  // Sentence-level recognition is unreliable; match a real content word
  // instead of tiny opener words like "I" when possible.
  const words = s
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const targetWord =
    words.find((word) => word.length >= 3) ||
    words.find((word) => word.length >= 2) ||
    words[0] ||
    s;
  const result = await startWordListening(targetWord, 8000);
  if (cancelled) return;
  if (result?.matched) {
    micPhase.value = 'matched';
    await ember.speak('Great reading!');
  } else {
    micPhase.value = 'missed';
  }
}

watch(index, () => {
  micPhase.value = 'idle';
});

onMounted(async () => {
  await requestMicPermission();
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
.connected-text-step { display: flex; flex-direction: column; align-items: center; gap: 1.25rem; padding: 1rem; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.sentence-card { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.sentence { font-size: 1.6rem; color: #E0E0E0; text-align: center; max-width: 320px; }
.instruction { color: #888; font-size: 0.85rem; }
.empty { color: #888; }
.mic-area { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.mic-icon { font-size: 2rem; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
.sustain-meter { width: 200px; height: 10px; background: #333; border-radius: 5px; overflow: hidden; }
.sustain-fill { height: 100%; background: #64FFDA; transition: width 0.1s; }
.listening-label { color: #64FFDA; font-size: 0.85rem; }
.result { font-size: 1.1rem; }
.result.success { color: #64FFDA; }
.result.help { color: #FFD93D; }
.controls { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
.progress { color: #666; font-size: 0.8rem; }
.audio-btn, .next-btn {
  background: rgba(100, 255, 218, 0.15);
  border: 1.5px solid #64FFDA;
  color: #64FFDA;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}
.audio-btn:disabled, .next-btn:disabled { opacity: 0.35; cursor: not-allowed; }
</style>
