<template>
  <div class="speech-practice">
    <h3>Say It!</h3>

    <div class="current-phoneme">{{ currentPhoneme }}</div>

    <button v-if="phase === 'ready'" class="listen-btn" @click="playAndListen">
      🎤 Hear & Say '{{ currentPhoneme }}'
    </button>

    <div v-if="phase === 'playing'" class="status">Playing sound...</div>

    <div v-if="phase === 'listening'" class="listening-area">
      <div class="mic-icon-large">🎤</div>
      <div class="status listening">Listening...</div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
      <button class="skip-btn" @click="skipSpeech">Skip</button>
    </div>

    <div v-if="phase === 'success'" class="status success">Great job!</div>
    <div v-if="phase === 'retry'" class="status retry">Try again! Make the sound louder.</div>

    <div class="progress-info">{{ correct }} / {{ targetCount }}</div>
    <div class="meter">
      <div class="meter-fill" :style="{ width: (correct / targetCount * 100) + '%' }"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { getCumulativeLetters } from '../../data/ufli/ufliLessons.js';
import { getLessonMeta } from '../../data/ufli/ufliCurriculum.js';
import { useEmber } from '../../composables/useEmber.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';

const props = defineProps({ lessonId: String, activityType: String });
const emit = defineEmits(['complete']);

const ember = useEmber();
const { startListening, sustainProgress: micProgress, requestMicPermission, cancelListening } = useSpeechRecognition();

const allPhonemes = ref([]);
const focusPhonemes = ref([]);

const currentPhoneme = ref('');
const phase = ref('ready');
const correct = ref(0);
const targetCount = 5;
let cancelled = false;
let resolveSkip = null;

function skipSpeech() {
  cancelListening();
  if (resolveSkip) resolveSkip({ matched: true });
}

function pickPhoneme() {
  const focus = focusPhonemes.value;
  const all = allPhonemes.value;
  // 20% chance to surface a non-focus phoneme as review when other letters are available
  if (Math.random() < 0.2 && all.length > focus.length) {
    const reviewPhonemes = all.filter((p) => !focus.includes(p));
    currentPhoneme.value = reviewPhonemes[Math.floor(Math.random() * reviewPhonemes.length)];
  } else if (focus.length > 0) {
    currentPhoneme.value = focus[Math.floor(Math.random() * focus.length)];
  } else if (all.length > 0) {
    currentPhoneme.value = all[Math.floor(Math.random() * all.length)];
  }
}

async function playAndListen() {
  if (cancelled) return;
  phase.value = 'playing';
  await ember.playPhoneme(currentPhoneme.value);

  if (cancelled) return;
  phase.value = 'listening';

  const result = await new Promise((resolve) => {
    resolveSkip = resolve;
    startListening(currentPhoneme.value, 10000).then(resolve);
  });
  resolveSkip = null;

  if (cancelled) return;
  if (result.matched) {
    phase.value = 'success';
    correct.value++;
    await ember.speak('Great!');
  } else {
    phase.value = 'retry';
    await ember.speak('Try again!');
  }

  await new Promise(r => setTimeout(r, 600));

  if (correct.value >= targetCount) {
    emit('complete');
  } else {
    pickPhoneme();
    phase.value = 'ready';
  }
}

onMounted(async () => {
  await requestMicPermission();
  allPhonemes.value = await getCumulativeLetters(props.lessonId);
  // Focus phoneme(s) for this lesson — pulled from the manifest grapheme field
  const meta = getLessonMeta(props.lessonId);
  if (meta && meta.grapheme) {
    focusPhonemes.value = meta.grapheme
      .toLowerCase()
      .split(',')
      .map((g) => g.trim())
      .filter((g) => /^[a-z]$/.test(g));
  }
  if (allPhonemes.value.length === 0) {
    emit('complete');
    return;
  }
  pickPhoneme();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
  cancelListening();
});
</script>

<style scoped>
.speech-practice { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem; }
h3 { color: #FF8C00; margin: 0; }
.current-phoneme { font-size: 5rem; color: #FF8C00; font-weight: bold; }
.listen-btn {
  background: rgba(100, 255, 218, 0.1); border: 2px solid #64FFDA;
  color: #64FFDA; padding: 0.75rem 1.5rem; border-radius: 2rem;
  font-size: 1rem; cursor: pointer; font-family: inherit;
}
.listening-area { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.mic-icon-large { font-size: 3rem; animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }
.sustain-meter { width: 220px; height: 12px; background: #333; border-radius: 6px; overflow: hidden; }
.sustain-fill { height: 100%; background: #FF8C00; transition: width 0.1s; }
.skip-btn {
  background: transparent; border: 1px solid #555; color: #888;
  padding: 0.3rem 1rem; border-radius: 1rem; font-size: 0.75rem;
  cursor: pointer; font-family: inherit; margin-top: 0.3rem;
}
.status { color: #aaa; font-size: 1rem; }
.status.listening { color: #64FFDA; }
.status.success { color: #64FFDA; font-size: 1.2rem; }
.status.retry { color: #FFD93D; }
.progress-info { color: #888; font-size: 0.85rem; }
.meter { width: 100%; max-width: 250px; height: 8px; background: #333; border-radius: 4px; overflow: hidden; }
.meter-fill { height: 100%; background: #FF8C00; transition: width 0.3s; }
</style>
