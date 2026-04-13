<template>
  <div class="word-reading-step">
    <div class="prompt-text">Can you read this word?</div>

    <div class="word-display" v-if="currentItem">
      {{ currentItem.word }}
    </div>

    <div v-if="phase === 'listening'" class="mic-area">
      <div class="mic-icon">🎤</div>
      <div class="volume-meter">
        <div class="volume-fill" :style="{ width: micVolume + '%' }"></div>
      </div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
      <div v-if="listening" class="listening-label">Listening...</div>
    </div>

    <div v-if="phase === 'success'" class="result success">Yes! That's right!</div>
    <div v-if="phase === 'help'" class="result help">
      Let's sound it out:
      <span class="segments">{{ currentItem?.segments?.join(' - ') }}</span>
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
const { startWordListening, isListening: listening, volume: micVolume, sustainProgress: micProgress, requestMicPermission, cancelListening } = useSpeechRecognition();

const currentIndex = ref(0);
const currentItem = ref(null);
const phase = ref('listening');
let cancelled = false;

async function runItem(item) {
  if (cancelled) return;
  currentItem.value = item;
  phase.value = 'listening';

  await ember.speak('Can you read this word?');

  const result = await startWordListening(item.word, 6000);

  if (cancelled) return;

  if (result.matched) {
    phase.value = 'success';
    await ember.speak('Yes! Great reading!');
  } else {
    phase.value = 'help';
    await ember.speak("Let's sound it out together.");
    for (const seg of item.segments) {
      await ember.playPhoneme(seg);
      await new Promise(r => setTimeout(r, 200));
    }
    await ember.speak(item.word);
  }

  await new Promise(r => setTimeout(r, 800));
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
  cancelListening();
});
</script>

<style scoped>
.word-reading-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.prompt-text {
  font-size: 1rem;
  color: #aaa;
}

.word-display {
  font-size: 3.5rem;
  color: #FF8C00;
  font-weight: bold;
  letter-spacing: 0.1em;
}

.mic-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.mic-icon {
  font-size: 2.5rem;
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

.listening-label {
  color: #64FFDA;
  font-size: 0.85rem;
}

.result {
  font-size: 1.1rem;
  text-align: center;
}

.result.success { color: #64FFDA; }
.result.help { color: #FFD93D; }

.segments {
  display: block;
  font-size: 1.5rem;
  letter-spacing: 0.2em;
  margin-top: 0.3rem;
}

.item-progress {
  color: #666;
  font-size: 0.75rem;
}
</style>
