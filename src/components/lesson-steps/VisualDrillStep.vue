<template>
  <div class="visual-drill-step">
    <h3 class="step-title">Visual Drill</h3>

    <div v-if="currentItem" class="big-letter">
      {{ currentItem.grapheme }}
    </div>

    <div class="instruction">
      {{ instruction }}
    </div>

    <div v-if="micPhase === 'listening'" class="mic-area">
      <div class="mic-icon">🎤</div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
      <div class="listening-label">Listening…</div>
    </div>

    <div v-if="micPhase === 'matched'" class="result success">Great!</div>
    <div v-if="micPhase === 'missed'" class="result help">Good try! Let's keep going.</div>

    <div class="controls">
      <button class="audio-btn" @click="playCurrent" :disabled="busy">
        🔊 Hear sound
      </button>
      <button class="audio-btn" @click="startMic" :disabled="busy || micPhase === 'listening'">
        🎤 My turn
      </button>
      <button class="next-btn" @click="next">
        {{ isLast ? 'Done' : 'Next' }}
      </button>
    </div>

    <button v-if="micPhase === 'listening'" class="skip-btn" @click="skipMic">Skip</button>

    <div class="item-progress">{{ index + 1 }} / {{ items.length }}</div>
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
} = useSpeechRecognition();

const items = computed(() => props.step?.items ?? []);
const index = ref(0);
const currentItem = computed(() => items.value[index.value]);
const isLast = computed(() => index.value >= items.value.length - 1);
const busy = ref(false);
const micPhase = ref('idle'); // idle | listening | matched | missed
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

async function startMic() {
  if (cancelled || busy.value) return;
  const item = currentItem.value;
  if (!item) return;
  busy.value = true;
  micPhase.value = 'listening';
  const target = item.phonemes?.[0] ?? item.grapheme;
  const result = await startListening(target, 6000);
  if (cancelled) return;
  micPhase.value = result?.matched ? 'matched' : 'missed';
  busy.value = false;
}

function skipMic() {
  cancelListening();
  micPhase.value = 'missed';
  busy.value = false;
}

function next() {
  cancelListening();
  micPhase.value = 'idle';
  if (isLast.value) {
    emit('step-complete');
    return;
  }
  index.value++;
  // Auto-play the new item
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
.instruction { color: #aaa; font-size: 1rem; text-align: center; }
.mic-area { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.mic-icon { font-size: 2rem; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
.sustain-meter { width: 200px; height: 10px; background: #333; border-radius: 5px; overflow: hidden; }
.sustain-fill { height: 100%; background: #FF8C00; transition: width 0.1s; }
.listening-label { color: #64FFDA; font-size: 0.85rem; }
.result { font-size: 1.1rem; }
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
.audio-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.skip-btn {
  background: transparent;
  border: 1px solid #555;
  color: #888;
  padding: 0.3rem 1rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  cursor: pointer;
  font-family: inherit;
}
.item-progress { color: #666; font-size: 0.75rem; }
</style>
