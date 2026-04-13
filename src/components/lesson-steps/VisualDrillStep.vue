<template>
  <div class="visual-drill-step">
    <div class="big-letter" v-if="currentItem">
      {{ currentItem.grapheme.toUpperCase() }}
    </div>

    <div class="instruction" v-if="phase === 'model'">
      Listen to the sound...
    </div>
    <div class="instruction" v-else-if="phase === 'prompt'">
      <div class="mic-icon">🎤</div>
      Now you say it!
      <div class="volume-meter">
        <div class="volume-fill" :style="{ width: micVolume + '%' }"></div>
      </div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
      <div v-if="listening" class="listening-dot">Listening...</div>
    </div>
    <div class="instruction success" v-else-if="phase === 'success'">
      Great!
    </div>

    <div class="item-progress">
      {{ currentIndex + 1 }} / {{ step.items.length }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';

const props = defineProps({ step: Object, unitId: String });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
const { startListening, isListening: listening, volume: micVolume, sustainProgress: micProgress, requestMicPermission } = useSpeechRecognition();

const currentIndex = ref(0);
const currentItem = ref(null);
const phase = ref('model');
let cancelled = false;

async function runItem(item) {
  if (cancelled) return;
  currentItem.value = item;
  phase.value = 'model';

  await ember.speak('This letter says');
  await ember.playPhoneme(item.phonemeAudio);

  if (cancelled) return;
  phase.value = 'prompt';
  await ember.speak('Your turn!');
  const result = await startListening(item.phonemeAudio, 5000);

  if (cancelled) return;
  phase.value = 'success';
  if (result.matched) {
    await ember.speak('Great!');
  } else {
    await ember.speak('Good try!');
  }
  await new Promise(r => setTimeout(r, 500));
}

onMounted(async () => {
  await requestMicPermission();
  for (let i = 0; i < props.step.items.length; i++) {
    if (cancelled) return;
    currentIndex.value = i;
    await runItem(props.step.items[i]);
  }
  if (!cancelled) emit('step-complete');
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
});
</script>

<style scoped>
.visual-drill-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.big-letter {
  font-size: 6rem;
  color: #FF8C00;
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 0 20px rgba(255, 140, 0, 0.3);
}

.instruction {
  font-size: 1rem;
  color: #aaa;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.instruction.success {
  color: #64FFDA;
  font-size: 1.2rem;
}

.mic-icon {
  font-size: 2rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.volume-meter {
  width: 200px;
  height: 6px;
  background: #222;
  border-radius: 3px;
  overflow: hidden;
}

.volume-fill {
  height: 100%;
  background: #64FFDA;
  transition: width 0.05s;
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
  background: #FF8C00;
  transition: width 0.1s;
}

.listening-dot {
  color: #64FFDA;
  font-size: 0.8rem;
}

.item-progress {
  color: #666;
  font-size: 0.75rem;
}
</style>
