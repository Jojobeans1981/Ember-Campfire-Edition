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
        {{ seg.toUpperCase() }}
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
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { getCumulativeDecodableWords } from '../../data/ufli/ufliLessons.js';
import { useEmber } from '../../composables/useEmber.js';
import { celebrateCorrect } from '../../composables/useCelebration.js';

const props = defineProps({ lessonId: String, activityType: String });
const emit = defineEmits(['complete']);

const ember = useEmber();

const words = ref([]);

const currentWord = ref(null);
const tappedIdx = ref(-1);
const phase = ref('tap');
const correct = ref(0);
const targetCount = 5;
let resolveTap = null;
let cancelled = false;

function pickWord() {
  currentWord.value = words.value[Math.floor(Math.random() * words.value.length)];
  tappedIdx.value = 0;
  phase.value = 'tap';
}

function tapTile(idx) {
  if (idx === tappedIdx.value && resolveTap) {
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
    await ember.playPhoneme(word.phonemes[i]);
  }
  tappedIdx.value = word.phonemes.length;

  if (cancelled) return;
  phase.value = 'blend';
  await ember.speak('Blend!');
  await new Promise(r => setTimeout(r, 400));

  phase.value = 'reveal';
  await ember.speak(word.word);
  correct.value++;
  celebrateCorrect();

  await new Promise(r => setTimeout(r, 800));

  if (correct.value >= targetCount) {
    emit('complete');
  } else {
    pickWord();
    await runRound();
  }
}

onMounted(async () => {
  const all = await getCumulativeDecodableWords(props.lessonId);
  words.value = all.filter((w) => w.phonemes.length >= 3);
  if (words.value.length === 0) {
    emit('complete');
    return;
  }
  pickWord();
  await runRound();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
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
