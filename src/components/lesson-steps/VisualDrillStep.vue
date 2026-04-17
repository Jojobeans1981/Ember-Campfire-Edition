<template>
  <div class="visual-drill-step">
    <FocusStage :tokens="focusTokens" emphasis="letter" />

    <div v-if="micPhase === 'listening'" class="mic-area" aria-hidden="true">
      <div class="mic-icon">🎤</div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
    </div>

    <div class="controls">
      <button
        class="icon-btn"
        type="button"
        aria-label="Hear the sound"
        :disabled="busy"
        @click="playCurrent"
      >🔊</button>
      <button
        class="icon-btn"
        type="button"
        aria-label="My turn to say the sound"
        :disabled="busy || micPhase === 'listening'"
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { useMicTurn } from '../../composables/useMicTurn.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';
import FocusStage from './FocusStage.vue';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
const {
  startListening,
  cancelListening,
  requestMicPermission,
  sustainProgress: micProgress,
} = useSpeechRecognition();
const { prepareMicTurn } = useMicTurn({ ember, cancelListening });

const items = computed(() => props.step?.items ?? []);
const index = ref(0);
const currentItem = computed(() => items.value[index.value]);
const isLast = computed(() => index.value >= items.value.length - 1);
const busy = ref(false);
const micPhase = ref('idle');
const canAdvance = computed(() => micPhase.value === 'matched');
let cancelled = false;

const focusTokens = computed(() => {
  const item = currentItem.value;
  if (!item) return [];
  return [{
    text: String(item.grapheme || ''),
    kind: 'grapheme',
    state: micPhase.value === 'matched' ? 'done' : 'active',
  }];
});

async function playCurrent() {
  if (cancelled || busy.value) return;
  const item = currentItem.value;
  if (!item) return;
  busy.value = true;
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
  try {
    await prepareMicTurn();
    const target = item.phonemes?.[0] ?? item.grapheme;
    const result = await startListening(target, 9000);
    if (cancelled) return;
    if (result?.matched) {
      micPhase.value = 'matched';
      await ember.speak('Great! You said it!');
    } else {
      micPhase.value = 'missed';
      await ember.speak('Try again. Tap the microphone and say the sound.');
    }
  } finally {
    busy.value = false;
  }
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
  await ember.speak('In this section, listen to the sound, then tap My turn and say it.');
  await playCurrent();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
  cancelListening();
});
</script>

<style scoped>
.visual-drill-step {
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
  width: 200px;
  height: 10px;
  background: #333;
  border-radius: 5px;
  overflow: hidden;
}

.sustain-fill {
  height: 100%;
  background: #ff8c00;
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
.icon-btn:active:not(:disabled) { transform: scale(0.96); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.icon-btn.primary {
  background: rgba(255, 140, 0, 0.22);
  border-color: #ff8c00;
  color: #fff4dc;
}
</style>
