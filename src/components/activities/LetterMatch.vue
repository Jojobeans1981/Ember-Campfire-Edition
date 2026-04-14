<template>
  <div class="letter-match">
    <div class="header">
      <h3>Match the Sound!</h3>
      <div class="round-dots">
        <span
          v-for="i in targetCount"
          :key="i"
          class="dot"
          :class="{ earned: i <= correct }"
        ></span>
      </div>
    </div>

    <div v-if="phase === 'listen'" class="listen-prompt">
      <div class="speaker-icon">🔊</div>
      <div class="listen-text">Listen...</div>
    </div>

    <div v-if="phase === 'pick' || showResult" class="choices">
      <button
        v-for="c in choices"
        :key="c"
        class="choice-btn"
        :class="{
          selected: selected === c,
          correct: showResult && c === targetPhoneme,
          wrong: showResult && selected === c && c !== targetPhoneme,
        }"
        :disabled="showResult"
        @click="pick(c)"
      >
        {{ c.toUpperCase() }}
      </button>
    </div>

    <div class="replay-area" v-if="phase === 'pick' && !showResult">
      <button class="replay-btn" @click="replaySound">🔊 Hear again</button>
    </div>

    <div v-if="phase === 'correct'" class="result success">Correct!</div>
    <div v-if="phase === 'wrong'" class="result wrong">It was {{ targetPhoneme?.toUpperCase() }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { UNITS } from '../../data/curriculum.js';
import { useProgression } from '../../composables/useProgression.js';
import { useEmber } from '../../composables/useEmber.js';
import { celebrateCorrect } from '../../composables/useCelebration.js';

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

async function replaySound() {
  await ember.playPhoneme(targetPhoneme.value);
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
    celebrateCorrect();
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
  gap: 1.5rem;
  padding: 1.5rem 1rem;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

h3 {
  color: #FF8C00;
  margin: 0;
  font-size: 1.3rem;
}

.round-dots {
  display: flex;
  gap: 0.5rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.3s, box-shadow 0.3s;
}

.dot.earned {
  background: #FFD93D;
  box-shadow: 0 0 6px rgba(255, 217, 61, 0.5);
}

/* Listen phase */
.listen-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 0;
}

.speaker-icon {
  font-size: 3rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.8; }
}

.listen-text {
  color: #999;
  font-size: 1rem;
}

/* Choices grid */
.choices {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 320px;
}

.choice-btn {
  width: 80px;
  height: 80px;
  font-size: 2.5rem;
  font-weight: bold;
  border: 2px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.6);
  color: #FF8C00;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.choice-btn:hover:not(:disabled) {
  transform: scale(1.04);
  border-color: rgba(255, 140, 0, 0.5);
  background: rgba(255, 140, 0, 0.08);
}

.choice-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.choice-btn.correct {
  background: rgba(100, 255, 218, 0.2);
  border-color: #64FFDA;
  color: #64FFDA;
}

.choice-btn.wrong {
  background: rgba(255, 107, 107, 0.2);
  border-color: #FF6B6B;
  color: #FF6B6B;
}

/* Replay button */
.replay-area {
  margin-top: -0.5rem;
}

.replay-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #888;
  padding: 0.4rem 1rem;
  border-radius: 1.5rem;
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.2s, color 0.2s;
}

.replay-btn:hover {
  border-color: rgba(255, 140, 0, 0.3);
  color: #ccc;
}

/* Result */
.result {
  font-size: 1.3rem;
  font-weight: 600;
}

.result.success { color: #64FFDA; }
.result.wrong { color: #FF6B6B; }
</style>
