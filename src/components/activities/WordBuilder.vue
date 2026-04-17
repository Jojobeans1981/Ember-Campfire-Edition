<template>
  <div class="word-builder">
    <h3>Build the Word!</h3>

    <div v-if="currentWord" class="prompt-area">
      <button class="hear-btn" @click="hearWord">🔊 Hear the word</button>
    </div>

    <!-- Built slots -->
    <div class="slots">
      <div
        v-for="(slot, idx) in slots"
        :key="idx"
        class="slot"
        :class="{ filled: slot !== null, correct: showResult && slot === currentWord?.graphemes[idx], wrong: showResult && slot !== null && slot !== currentWord?.graphemes[idx] }"
      >
        {{ slot ? slot : '_' }}
      </div>
    </div>

    <!-- Available letters -->
    <div class="letter-bank" v-if="!showResult">
      <button
        v-for="(letter, idx) in availableLetters"
        :key="idx"
        class="bank-letter"
        :class="{ used: usedIndices.has(idx) }"
        :disabled="usedIndices.has(idx)"
        @click="pickLetter(idx)"
      >
        {{ letter }}
      </button>
    </div>

    <button v-if="showResult && !allCorrect" class="retry-btn" @click="resetWord">Try Again</button>
    <div v-if="showResult && allCorrect" class="success">{{ currentWord?.word }}!</div>

    <div class="progress-info">{{ correct }} / {{ targetCount }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  getCumulativeDecodableWords,
  getCumulativeIntroducedGraphemes,
} from '../../data/ufli/ufliLessons.js';
import { useEmber } from '../../composables/useEmber.js';
import { celebrateCorrect } from '../../composables/useCelebration.js';

const props = defineProps({ lessonId: String, activityType: String });
const emit = defineEmits(['complete']);

const ember = useEmber();

const words = ref([]);
const allPhonemes = ref([]);

const currentWord = ref(null);
const slots = ref([]);
const availableLetters = ref([]);
const usedIndices = ref(new Set());
const showResult = ref(false);
const correct = ref(0);
const targetCount = 5;
let cancelled = false;

const allCorrect = computed(() => {
  if (!currentWord.value) return false;
  return slots.value.every((s, i) => s === currentWord.value.graphemes[i]);
});

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWord() {
  const word = words.value[Math.floor(Math.random() * words.value.length)];
  currentWord.value = word;
  slots.value = new Array(word.graphemes.length).fill(null);

  // Letter bank: the word's graphemes (so digraphs like "th" render as
  // one tile) + up to 2 distractors pulled from already-introduced
  // graphemes, so the child isn't offered letters they haven't learned.
  const distractors = allPhonemes.value
    .filter((g) => !word.graphemes.includes(g))
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  availableLetters.value = shuffle([...word.graphemes, ...distractors]);
  usedIndices.value = new Set();
  showResult.value = false;
}

function pickLetter(bankIdx) {
  const letter = availableLetters.value[bankIdx];
  const nextEmpty = slots.value.indexOf(null);
  if (nextEmpty === -1) return;

  slots.value[nextEmpty] = letter;
  usedIndices.value = new Set([...usedIndices.value, bankIdx]);

  // Check if all slots filled
  if (!slots.value.includes(null)) {
    showResult.value = true;
    if (allCorrect.value) {
      correct.value++;
      celebrateCorrect();
      ember.speak('Great spelling!');
      setTimeout(() => {
        if (cancelled) return;
        if (correct.value >= targetCount) {
          emit('complete');
        } else {
          pickWord();
        }
      }, 1200);
    }
  }
}

function resetWord() {
  slots.value = new Array(currentWord.value.graphemes.length).fill(null);
  usedIndices.value = new Set();
  showResult.value = false;
}

async function hearWord() {
  await ember.speak(currentWord.value.word);
}

onMounted(async () => {
  const all = await getCumulativeDecodableWords(props.lessonId);
  const introduced = getCumulativeIntroducedGraphemes(props.lessonId);
  const introducedSet = new Set(introduced.map((grapheme) => String(grapheme).toLowerCase()));
  words.value = all.filter((word) => {
    return (word.graphemes?.length ?? 0) >= 2
      && word.graphemes.every((grapheme) => introducedSet.has(String(grapheme).toLowerCase()));
  });
  // Keep the letter bank limited to taught graphemes so build practice
  // never jumps ahead of the lesson sequence.
  allPhonemes.value = introduced;
  if (words.value.length === 0) {
    emit('complete');
    return;
  }
  pickWord();
  ember.speak('Build the word! Tap the hear button to listen.');
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
});
</script>

<style scoped>
.word-builder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

h3 { color: #FF8C00; margin: 0; }

.hear-btn {
  background: rgba(255,140,0,0.15);
  border: 2px solid rgba(255,140,0,0.3);
  color: #FF8C00;
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  cursor: pointer;
  font-size: 1rem;
  font-family: inherit;
}

.slots { display: flex; gap: 0.5rem; }

.slot {
  width: 55px; height: 55px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.8rem; font-weight: bold;
  border: 2px dashed rgba(255,255,255,0.2);
  border-radius: 0.5rem;
  color: #FF8C00;
}

.slot.filled { border-style: solid; background: rgba(255,140,0,0.15); }
.slot.correct { border-color: #64FFDA; background: rgba(100,255,218,0.15); }
.slot.wrong { border-color: #FF6B6B; background: rgba(255,107,107,0.15); }

.letter-bank { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: center; }

.bank-letter {
  width: 50px; height: 50px;
  font-size: 1.5rem; font-weight: bold;
  border: 2px solid rgba(255,255,255,0.15);
  background: rgba(30,41,59,0.7);
  color: #E0E0E0; border-radius: 0.5rem;
  cursor: pointer; font-family: inherit;
}

.bank-letter:hover:not(:disabled) { border-color: #FF8C00; }
.bank-letter.used { opacity: 0.2; cursor: default; }

.retry-btn {
  background: rgba(255,200,0,0.15);
  border: 2px solid rgba(255,200,0,0.3);
  color: #FFD93D;
  padding: 0.5rem 1.5rem;
  border-radius: 1rem;
  cursor: pointer;
  font-family: inherit;
}

.success { color: #64FFDA; font-size: 1.5rem; font-weight: bold; }
.progress-info { color: #888; font-size: 0.85rem; }
</style>

