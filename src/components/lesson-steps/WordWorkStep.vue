<template>
  <div class="word-work-step">
    <div v-if="phase === 'chain'" class="chain-section">
      <div class="word-pool">
        <button
          v-for="(w, i) in wordChain"
          :key="`c-${i}`"
          class="word-chip"
          :class="{ done: chainDone[i] }"
          type="button"
          :aria-label="`Read the word ${w}`"
          @click="markChain(i)"
        >{{ w }}</button>
      </div>
      <button
        class="icon-btn primary"
        type="button"
        :aria-label="nextPhaseAria"
        :disabled="!allChainDone"
        @click="advancePhase"
      >{{ nextPhaseAria === 'Done' ? '✅' : '➡️' }}</button>
    </div>

    <div v-else-if="phase === 'sort'" class="sort-section">
      <FocusStage
        v-if="currentSortWord"
        :tokens="[{ text: currentSortWord, kind: 'word', state: 'active' }]"
        emphasis="word"
      />
      <div v-if="currentSortWord" class="sort-categories">
        <button
          v-for="cat in sort.categories"
          :key="cat"
          class="cat-btn"
          type="button"
          :aria-label="`Sort under ${cat}`"
          @click="pickCategory(cat)"
        >{{ cat }}</button>
      </div>
      <button
        v-if="!currentSortWord"
        class="icon-btn primary"
        type="button"
        :aria-label="nextPhaseAria"
        @click="advancePhase"
      >{{ nextPhaseAria === 'Done' ? '✅' : '➡️' }}</button>
    </div>

    <div v-else-if="phase === 'meaning'" class="meaning-section">
      <FocusStage
        v-if="currentMeaningItem"
        :tokens="[{ text: currentMeaningItem.word, kind: 'word', state: 'active' }]"
        emphasis="word"
      />
      <div v-if="currentMeaningItem?.morphemes?.length" class="morphemes">
        <span
          v-for="(m, i) in currentMeaningItem.morphemes"
          :key="i"
          class="morpheme"
        >{{ m }}</span>
      </div>
      <button
        v-if="currentMeaningItem"
        class="icon-btn primary"
        type="button"
        :aria-label="isLastMeaning ? 'Done' : 'Next'"
        @click="nextMeaning"
      >{{ isLastMeaning ? '✅' : '➡️' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import FocusStage from './FocusStage.vue';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);
const ember = useEmber();

const wordChain = computed(() => props.step?.wordChain ?? []);
const sort = computed(() => props.step?.wordSort ?? null);
const meaning = computed(() => props.step?.wordMeaning ?? null);

const chainDone = ref([]);
const allChainDone = computed(() =>
  wordChain.value.length === 0 || wordChain.value.every((_, i) => chainDone.value[i])
);

const phase = ref('chain');

const sortIndex = ref(0);
function normalizeCategoryToken(value) {
  return String(value ?? '').trim().toLowerCase();
}

const sortEntries = computed(() => {
  const words = Array.isArray(sort.value?.words) ? sort.value.words : [];
  return words
    .map((entry) => {
      if (typeof entry === 'string') {
        return {
          word: entry,
          category: sort.value?.answers?.[entry] ?? sort.value?.expected?.[entry] ?? sort.value?.map?.[entry] ?? '',
        };
      }
      return {
        word: entry?.word ?? entry?.text ?? '',
        category: entry?.category ?? entry?.expectedCategory ?? entry?.answer ?? '',
      };
    })
    .filter((entry) => String(entry.word ?? '').trim().length > 0);
});
const currentSortEntry = computed(() => sortEntries.value[sortIndex.value] ?? null);
const currentSortWord = computed(() => currentSortEntry.value?.word ?? '');

const meaningIndex = ref(0);
const currentMeaningItem = computed(() => meaning.value?.items?.[meaningIndex.value]);
const isLastMeaning = computed(
  () => meaningIndex.value >= (meaning.value?.items?.length ?? 0) - 1
);

const nextPhaseAria = computed(() => {
  if (phase.value === 'chain') {
    if (sort.value) return 'Word sort';
    if (meaning.value) return 'Word meaning';
    return 'Done';
  }
  if (phase.value === 'sort') {
    if (meaning.value) return 'Word meaning';
    return 'Done';
  }
  return 'Done';
});

function currentInstruction() {
  if (phase.value === 'chain') return 'Tap each word to read it.';
  if (phase.value === 'sort') return sort.value?.prompt || 'Sort the words by category.';
  if (phase.value === 'meaning') return meaning.value?.prompt || 'Let us explore word meaning.';
  return '';
}

async function speakInstruction() {
  const line = currentInstruction();
  if (line) await ember.speak(line);
}

async function markChain(i) {
  chainDone.value[i] = true;
  const word = wordChain.value[i];
  if (word) await ember.speak(word);
}

function advancePhase() {
  if (phase.value === 'chain') {
    if (sort.value) { phase.value = 'sort'; return; }
    if (meaning.value) { phase.value = 'meaning'; return; }
    emit('step-complete');
    return;
  }
  if (phase.value === 'sort') {
    if (meaning.value) { phase.value = 'meaning'; return; }
    emit('step-complete');
  }
}

async function pickCategory(cat) {
  const expectedCategory = normalizeCategoryToken(currentSortEntry.value?.category);
  const chosenCategory = normalizeCategoryToken(cat);

  if (expectedCategory && expectedCategory !== chosenCategory) {
    await ember.speak('Try a different group.');
    return;
  }

  if (sortIndex.value >= sortEntries.value.length - 1) {
    sortIndex.value++;
    return;
  }
  sortIndex.value++;
}

function nextMeaning() {
  if (isLastMeaning.value) {
    emit('step-complete');
    return;
  }
  meaningIndex.value++;
}

onMounted(() => {
  void speakInstruction();
});

watch(phase, () => {
  void speakInstruction();
});

onBeforeUnmount(() => {
  ember.stopSpeaking();
});
</script>

<style scoped>
.word-work-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  max-width: 480px;
  width: 100%;
}

.chain-section, .sort-section, .meaning-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
}

.word-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.word-chip {
  padding: 0.5rem 0.9rem;
  background: rgba(25, 47, 74, 0.75);
  border: 2px solid rgba(255, 209, 102, 0.35);
  color: #ffd166;
  border-radius: 0.6rem;
  font-family: inherit;
  font-size: 1.15rem;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease;
}

.word-chip:hover { transform: scale(1.05); border-color: #ffd166; }
.word-chip.done {
  background: rgba(126, 232, 136, 0.15);
  border-color: rgba(126, 232, 136, 0.75);
  color: #bff3c1;
}

.sort-categories {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.cat-btn {
  padding: 0.5rem 1rem;
  background: rgba(25, 47, 74, 0.75);
  border: 2px solid rgba(126, 232, 136, 0.4);
  color: #bff3c1;
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: inherit;
  font-size: 1rem;
  transition: transform 160ms ease, border-color 160ms ease;
}

.cat-btn:hover { transform: scale(1.05); border-color: #7ee888; }

.morphemes {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: center;
}

.morpheme {
  padding: 0.25rem 0.55rem;
  background: rgba(255, 140, 0, 0.15);
  color: #ffd166;
  border-radius: 0.3rem;
  font-size: 1rem;
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
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.icon-btn.primary {
  background: rgba(255, 140, 0, 0.22);
  border-color: #ff8c00;
  color: #fff4dc;
}
</style>
