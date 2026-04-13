<template>
  <div class="intro-step">
    <div class="narration-text" v-if="currentNarrationText">
      {{ currentNarrationText }}
    </div>
    <div v-if="waitingForSpeech" class="speech-prompt">
      <div class="mic-icon">🎤</div>
      <p>Say the sound!</p>
      <div class="volume-meter">
        <div class="volume-fill" :style="{ width: micVolume + '%' }"></div>
      </div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
      <div v-if="listening" class="listening-indicator">Listening...</div>
    </div>
    <button v-if="done" class="continue-btn" @click="$emit('step-complete')">Continue</button>
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

const currentNarrationText = ref('');
const waitingForSpeech = ref(false);
const done = ref(false);
let cancelled = false;

onMounted(async () => {
  // Request mic permission early so it's ready when we need it
  await requestMicPermission();

  if (!props.step.narration) {
    done.value = true;
    return;
  }

  for (const item of props.step.narration) {
    if (cancelled) return;

    if (item.action === 'speak') {
      currentNarrationText.value = item.text;
      await ember.speak(item.text);
    } else if (item.action === 'play_phoneme') {
      currentNarrationText.value = `/${item.phoneme}/`;
      await ember.playPhoneme(item.phoneme);
    } else if (item.action === 'prompt_speech') {
      currentNarrationText.value = item.text || `Can you say ${item.phoneme}?`;
      await ember.speak(item.text || `Can you say ${item.phoneme}?`);
      waitingForSpeech.value = true;
      const result = await startListening(item.phoneme, 5000);
      waitingForSpeech.value = false;
      if (result.matched) {
        currentNarrationText.value = 'Great job!';
        await ember.speak('Great job!');
      } else {
        currentNarrationText.value = 'Good try! Let\'s keep going.';
        await ember.speak('Good try! Let\'s keep going.');
      }
    } else if (item.action === 'pause') {
      await new Promise(r => setTimeout(r, item.duration || 1000));
    }
  }

  done.value = true;
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
});
</script>

<style scoped>
.intro-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  padding: 1rem;
}

.narration-text {
  font-size: 1.2rem;
  color: #E0E0E0;
  max-width: 300px;
  min-height: 3rem;
}

.speech-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
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

.listening-indicator {
  color: #64FFDA;
  font-size: 0.85rem;
}

.continue-btn {
  background: rgba(255, 140, 0, 0.2);
  border: 2px solid #FF8C00;
  color: #FF8C00;
  padding: 0.75rem 2rem;
  border-radius: 2rem;
  font-size: 1rem;
  cursor: pointer;
  font-family: inherit;
}
</style>
