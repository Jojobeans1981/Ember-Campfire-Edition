<template>
  <div class="letter-match">
    <h3>Match the Sound!</h3>

    <div v-if="phase === 'listen'" class="listen-prompt">
      Listen...
    </div>

    <div v-if="phase === 'pick'" class="choices">
      <button
        v-for="c in choices"
        :key="c"
        class="choice-btn"
        :class="{ selected: selected === c, correct: showResult && c === targetPhoneme, wrong: showResult && selected === c && c !== targetPhoneme }"
        @click="pick(c)"
      >
        {{ c.toUpperCase() }}
      </button>
    </div>

    <div v-if="phase === 'correct'" class="result success">Correct!</div>
    <div v-if="phase === 'wrong'" class="result wrong">It was {{ targetPhoneme?.toUpperCase() }}</div>

    <div class="progress-info">{{ correct }} / {{ targetCount }}</div>
    <div class="meter">
      <div class="meter-fill" :style="{ width: (correct / targetCount * 100) + '%' }"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { UNITS } from '../../data/curriculum.js';
import { useProgression } from '../../composables/useProgression.js';
import { useEmber } from '../../composables/useEmber.js';

const props = defineProps({ unitId: String, activityType: String });
const emit = defineEmits(['complete']);

const { getPhonemesForUnit } = useProgression();
const ember = useEmber();

const unit = UNITS.find(u => u.unitId === props.unitId);
const allPhonemes = getPhonemesForUnit(props.unitId);

const targetPhoneme = ref('');
const choices = ref([]);
const selected = ref(null);
const showResult = ref(false);
const phase = ref('listen');
const correct = ref(0);
const targetCount = 5;
let cancelled = false;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setupRound() {
  const target = allPhonemes[Math.floor(Math.random() * Math.min(allPhonemes.length, unit.phonemes.length + 4))];
  targetPhoneme.value = target;

  const distractors = allPhonemes
    .filter(p => p !== target)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  choices.value = shuffle([target, ...distractors]);
  selected.value = null;
  showResult.value = false;
}

async function playRound() {
  if (cancelled) return;
  setupRound();
  phase.value = 'listen';
  await ember.playPhoneme(targetPhoneme.value);
  if (cancelled) return;
  phase.value = 'pick';
}

function pick(choice) {
  if (showResult.value) return;
  selected.value = choice;
  showResult.value = true;

  if (choice === targetPhoneme.value) {
    correct.value++;
    phase.value = 'correct';
  } else {
    phase.value = 'wrong';
  }

  setTimeout(async () => {
    if (cancelled) return;
    if (correct.value >= targetCount) {
      emit('complete');
    } else {
      await playRound();
    }
  }, 1000);
}

onMounted(() => {
  playRound();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
});
</script>

<style scoped>
.letter-match {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

h3 { color: #FF8C00; margin: 0; }

.listen-prompt { color: #aaa; font-size: 1.1rem; }

.choices {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.choice-btn {
  width: 75px;
  height: 75px;
  font-size: 2.2rem;
  font-weight: bold;
  border: 2px solid rgba(255, 140, 0, 0.3);
  background: rgba(30, 41, 59, 0.7);
  color: #FF8C00;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.choice-btn:hover { transform: scale(1.05); border-color: #FF8C00; }
.choice-btn.correct { background: rgba(100, 255, 218, 0.3); border-color: #64FFDA; }
.choice-btn.wrong { background: rgba(255, 107, 107, 0.3); border-color: #FF6B6B; }

.result { font-size: 1.2rem; }
.result.success { color: #64FFDA; }
.result.wrong { color: #FF6B6B; }

.progress-info { color: #888; font-size: 0.85rem; }
.meter { width: 100%; max-width: 250px; height: 8px; background: #333; border-radius: 4px; overflow: hidden; }
.meter-fill { height: 100%; background: #FF8C00; transition: width 0.3s; }
</style>
