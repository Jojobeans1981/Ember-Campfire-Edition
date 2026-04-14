<template>
  <div class="visual-drill-step">
    <h3 class="step-title">Say the Sound</h3>

    <div v-if="currentItem" class="big-letter">
      {{ currentItem.grapheme }}
    </div>

    <div class="instruction">{{ instruction }}</div>

    <div v-if="micPhase === 'listening'" class="mic-area">
      <div class="mic-icon">🎤</div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
      <div class="listening-label">Listening… say the sound!</div>
    </div>

    <div v-if="micPhase === 'matched'" class="result success">Great! You said it!</div>
    <div v-if="micPhase === 'missed'" class="result help">Try again. Tap 🎤 and say the sound.</div>

    <div class="controls">
      <button class="audio-btn" @click="playCurrent" :disabled="busy">
        🔊 Hear sound
      </button>
      <button class="audio-btn" @click="startMic" :disabled="busy || micPhase === 'listening'">
        🎤 My turn
      </button>
      <button class="next-btn" :disabled="!canAdvance" @click="next">
        {{ isLast ? 'Done' : 'Next' }}
      </button>
    </div>

    <div class="item-progress">{{ index + 1 }} / {{ items.length }}</div>

    <div class="debug-card">
      <div class="debug-title">Recognition Debug</div>
      <div class="debug-line"><strong>Target:</strong> {{ debugState.target || currentItem?.grapheme }}</div>
      <div class="debug-line"><strong>Transcript:</strong> {{ debugState.transcript || 'none' }}</div>
      <div class="debug-line"><strong>Recognizer:</strong> {{ debugState.recognizer }}</div>
      <div class="debug-line"><strong>Matched By:</strong> {{ debugState.matchedBy }}</div>
      <div class="debug-line"><strong>Vosk Error:</strong> {{ debugState.voskError || 'none' }}</div>
      <div class="debug-line"><strong>Speech Detected:</strong> {{ debugState.speechDetected ? 'yes' : 'no' }}</div>
      <div class="debug-line"><strong>Sustain Frames:</strong> {{ debugState.sustainFrames }}</div>
      <div class="debug-line"><strong>Avg Centroid:</strong> {{ debugState.avgCentroid }}</div>
      <div class="debug-line"><strong>High Energy:</strong> {{ debugState.avgHighEnergyRatio }}</div>
      <div class="debug-line"><strong>Low Energy:</strong> {{ debugState.avgLowEnergyRatio }}</div>
      <div class="debug-line"><strong>Zero Cross:</strong> {{ debugState.avgZeroCrossingRate }}</div>
      <div class="debug-line"><strong>Result:</strong> {{ debugState.result }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
const {
  startListening,
  cancelListening,
  requestMicPermission,
  sustainProgress: micProgress,
  debugState,
} = useSpeechRecognition();

const items = computed(() => props.step?.items ?? []);
const index = ref(0);
const currentItem = computed(() => items.value[index.value]);
const isLast = computed(() => index.value >= items.value.length - 1);
const busy = ref(false);
const micPhase = ref('idle'); // idle | listening | matched | missed
const canAdvance = computed(() => micPhase.value === 'matched');
let cancelled = false;

const instruction = computed(() => {
  const i = currentItem.value;
  if (!i) return '';
  return `This is ${i.grapheme}. Listen, then tap My turn.`;
});

async function playCurrent() {
  if (cancelled || busy.value) return;
  const item = currentItem.value;
  if (!item) return;
  busy.value = true;
  await ember.speak(`The letter is ${item.grapheme}. It says`);
  for (const p of item.phonemes ?? []) {
    if (cancelled) break;
    await ember.playPhoneme(p);
  }
  busy.value = false;
}

async function startMic() {
  if (cancelled || busy.value) return;
  const item = currentItem.value;
  if (!item) return;
  busy.value = true;
  micPhase.value = 'listening';
  const target = item.phonemes?.[0] ?? item.grapheme;
  const result = await startListening(target, 7000);
  if (cancelled) return;
  if (result?.matched) {
    micPhase.value = 'matched';
    await ember.speak('Great!');
  } else {
    micPhase.value = 'missed';
  }
  busy.value = false;
}

function next() {
  if (!canAdvance.value) return;
  cancelListening();
  micPhase.value = 'idle';
  if (isLast.value) {
    emit('step-complete');
    return;
  }
  index.value++;
  playCurrent();
}

onMounted(async () => {
  if (items.value.length === 0) {
    emit('step-complete');
    return;
  }
  await requestMicPermission();
  await playCurrent();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
  cancelListening();
});
</script>

<style scoped>
.visual-drill-step { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.big-letter { font-size: 6rem; color: #FF8C00; font-weight: bold; line-height: 1; text-shadow: 0 0 20px rgba(255, 140, 0, 0.3); }
.instruction { color: #aaa; font-size: 1rem; text-align: center; max-width: 320px; }
.mic-area { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.mic-icon { font-size: 2rem; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
.sustain-meter { width: 200px; height: 10px; background: #333; border-radius: 5px; overflow: hidden; }
.sustain-fill { height: 100%; background: #FF8C00; transition: width 0.1s; }
.listening-label { color: #64FFDA; font-size: 0.85rem; }
.result { font-size: 1.1rem; text-align: center; max-width: 320px; }
.result.success { color: #64FFDA; }
.result.help { color: #FFD93D; }
.controls { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
.audio-btn, .next-btn {
  background: rgba(255, 140, 0, 0.15);
  border: 1.5px solid #FF8C00;
  color: #FF8C00;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}
.audio-btn:disabled, .next-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.item-progress { color: #666; font-size: 0.75rem; }
.debug-card {
  width: 100%;
  max-width: 320px;
  padding: 0.75rem 0.9rem;
  border-radius: 0.9rem;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(100, 255, 218, 0.2);
  color: #cbd5e1;
  font-size: 0.8rem;
  text-align: left;
}
.debug-title { color: #64FFDA; font-weight: 700; margin-bottom: 0.45rem; }
.debug-line { margin-top: 0.2rem; word-break: break-word; }
</style>
