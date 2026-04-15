<template>
  <div class="blending-game">
    <h3>Blend It!</h3>

    <div class="tiles" v-if="currentWord">
      <button
        v-for="(seg, idx) in currentWord.phonemes"
        :key="idx"
        class="tile"
        :class="{ tapped: tappedIdx > idx, current: tappedIdx === idx }"
        @click="tapTile(idx)"
      >
        {{ seg }}
      </button>
    </div>

    <div v-if="phase === 'tap'" class="instruction">Tap each sound left to right!</div>
    <div v-if="phase === 'blend'" class="instruction">Now say the whole word!</div>
    <div v-if="phase === 'reveal'" class="word-reveal">{{ currentWord?.word }}</div>

    <div class="progress-info">{{ correct }} / {{ targetCount }}</div>
    <div class="meter">
      <div class="meter-fill" :style="{ width: (correct / targetCount * 100) + '%' }"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { getCumulativeDecodableWords } from '../../data/ufli/ufliLessons.js';
import { useEmber } from '../../composables/useEmber.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';
import { celebrateCorrect } from '../../composables/useCelebration.js';

const props = defineProps({ lessonId: String, activityType: String });
const emit = defineEmits(['complete']);

const ember = useEmber();
const { startWordListening, requestMicPermission, cancelListening } = useSpeechRecognition();

const words = ref([]);

const currentWord = ref(null);
const tappedIdx = ref(-1);
const phase = ref('tap');
const correct = ref(0);
const targetCount = 5;
let resolveTap = null;
let sessionRunning = false;
let completionEmitted = false;
let cancelled = false;
const MAX_BLEND_ATTEMPTS = 2;

function pickWord() {
  if (words.value.length === 0) {
    currentWord.value = null;
    return;
  }

  // Avoid immediate repeats when possible.
  const current = currentWord.value?.word;
  const pool = words.value.length > 1
    ? words.value.filter((w) => w.word !== current)
    : words.value;
  currentWord.value = pool[Math.floor(Math.random() * pool.length)];
  tappedIdx.value = 0;
  phase.value = 'tap';
}

function tapTile(idx) {
  if (phase.value === 'tap' && idx === tappedIdx.value && resolveTap) {
    resolveTap();
  }
}

async function runRound() {
  if (cancelled || !currentWord.value) return;
  const word = currentWord.value;

  for (let i = 0; i < word.phonemes.length; i++) {
    if (cancelled) return;
    tappedIdx.value = i;
    await new Promise(r => { resolveTap = r; });
    resolveTap = null;
    if (cancelled) return;
    await ember.playPhoneme(word.phonemes[i]);
  }
  tappedIdx.value = word.phonemes.length;

  if (cancelled) return;
  phase.value = 'blend';
  await ember.speak('Your turn. Say the whole word.');

  let attempts = 0;
  let matched = false;
  while (!cancelled && attempts < MAX_BLEND_ATTEMPTS && !matched) {
    attempts++;
    const result = await startWordListening(word.word, 7000);
    matched = Boolean(result?.matched);
    if (!matched && attempts < MAX_BLEND_ATTEMPTS) {
      await ember.speak('Try again. Say the whole word.');
    }
  }

  phase.value = 'reveal';
  if (!matched) {
    await ember.speak(`The word is ${word.word}.`);
  }
  await ember.speak(word.word);
  correct.value++;
  celebrateCorrect();

  await new Promise(r => setTimeout(r, 800));
}

async function runSession() {
  if (sessionRunning) return;
  sessionRunning = true;
  try {
    while (!cancelled && correct.value < targetCount) {
      if (!currentWord.value) pickWord();
      await runRound();
      if (cancelled) return;
      if (correct.value < targetCount) pickWord();
    }

    if (!cancelled && !completionEmitted && correct.value >= targetCount) {
      completionEmitted = true;
      emit('complete');
    }
  } finally {
    sessionRunning = false;
  }
}

onMounted(async () => {
  await requestMicPermission();
  await ember.speak('Blend it. Tap each sound from left to right, then say the whole word.', {
    priority: 'instruction',
    rate: 0.9,
    pitch: 1.06,
  });
  const all = await getCumulativeDecodableWords(props.lessonId);
  words.value = all.filter((w) => w.phonemes.length >= 3);
  if (words.value.length === 0) {
    completionEmitted = true;
    emit('complete');
    return;
  }
  pickWord();
  await runSession();
});

watch(phase, async (nextPhase) => {
  if (cancelled) return;
  if (nextPhase === 'tap') {
    await ember.speak('Tap each sound from left to right.', { priority: 'instruction', rate: 0.9, pitch: 1.05 });
  }
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
  cancelListening();
  if (resolveTap) resolveTap();
  resolveTap = null;
});
</script>

<style scoped>
.blending-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

h3 { color: #FF8C00; margin: 0; }

.tiles { display: flex; gap: 0.5rem; }

.tile {
  width: 60px; height: 60px;
  font-size: 1.8rem; font-weight: bold;
  border: 2px solid rgba(255,255,255,0.1);
  background: rgba(30,41,59,0.7);
  color: #888; border-radius: 0.75rem;
  cursor: pointer; transition: all 0.2s;
  font-family: inherit;
}

.tile.current { border-color: #FF8C00; color: #FF8C00; animation: bounce 0.8s infinite; }
.tile.tapped { background: rgba(255,140,0,0.2); color: #FF8C00; border-color: rgba(255,140,0,0.4); }

@keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

.instruction { color: #aaa; }
.word-reveal { font-size: 2.5rem; color: #64FFDA; font-weight: bold; }
.progress-info { color: #888; font-size: 0.85rem; }
.meter { width: 100%; max-width: 250px; height: 8px; background: #333; border-radius: 4px; overflow: hidden; }
.meter-fill { height: 100%; background: #FF8C00; transition: width 0.3s; }
</style>
