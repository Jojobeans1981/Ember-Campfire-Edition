<template>
  <div class="word-work-step">
    <h3 class="step-title">Word Work</h3>

    <!-- Phase 1: word chain -->
    <div v-if="phase === 'chain'" class="chain-section">
      <div class="prompt">Tap each word when you read it.</div>
      <div class="word-pool">
        <button
          v-for="(w, i) in wordChain"
          :key="`c-${i}`"
          class="word-chip"
          :class="{ done: chainDone[i] }"
          @click="markChain(i)"
        >{{ w }}</button>
      </div>
      <button class="next-btn" :disabled="!allChainDone" @click="advancePhase">{{ nextPhaseLabel }}</button>
    </div>

    <!-- Phase 2: optional sort -->
    <div v-else-if="phase === 'sort'" class="sort-section">
      <div class="prompt">{{ sort.prompt }}</div>
      <div v-if="currentSortWord" class="sort-prompt">
        <div class="sort-word">{{ currentSortWord }}</div>
        <div class="sort-categories">
          <button
            v-for="cat in sort.categories"
            :key="cat"
            class="cat-btn"
            @click="pickCategory(cat)"
          >{{ cat }}</button>
        </div>
      </div>
      <div v-else class="sort-done">All sorted!</div>
      <button v-if="!currentSortWord" class="next-btn" @click="advancePhase">{{ nextPhaseLabel }}</button>
    </div>

    <!-- Phase 3: optional meaning -->
    <div v-else-if="phase === 'meaning'" class="meaning-section">
      <div class="prompt">{{ meaning.prompt }}</div>
      <div v-if="currentMeaningItem" class="meaning-item">
        <div class="word">{{ currentMeaningItem.word }}</div>
        <div class="morphemes">
          <span v-for="(m, i) in currentMeaningItem.morphemes" :key="i" class="morpheme">{{ m }}</span>
        </div>
        <div class="support">{{ currentMeaningItem.supportPrompt }}</div>
        <button class="next-btn" @click="nextMeaning">{{ isLastMeaning ? 'Done' : 'Next' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const wordChain = computed(() => props.step?.wordChain ?? []);
const sort = computed(() => props.step?.wordSort ?? null);
const meaning = computed(() => props.step?.wordMeaning ?? null);

const chainDone = ref([]);
const allChainDone = computed(() =>
  wordChain.value.length === 0 || wordChain.value.every((_, i) => chainDone.value[i])
);

const phase = ref('chain');

const sortIndex = ref(0);
const currentSortWord = computed(() => sort.value?.words?.[sortIndex.value]);

const meaningIndex = ref(0);
const currentMeaningItem = computed(() => meaning.value?.items?.[meaningIndex.value]);
const isLastMeaning = computed(
  () => meaningIndex.value >= (meaning.value?.items?.length ?? 0) - 1
);

const nextPhaseLabel = computed(() => {
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

function markChain(i) {
  chainDone.value[i] = true;
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
    return;
  }
}

function pickCategory(_cat) {
  if (sortIndex.value >= (sort.value?.words?.length ?? 0) - 1) {
    sortIndex.value++; // off the end → currentSortWord becomes undefined
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
</script>

<style scoped>
.word-work-step { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem; max-width: 360px; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.chain-section, .sort-section, .meaning-section { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.prompt { color: #aaa; font-size: 0.95rem; text-align: center; }
.word-pool { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; }
.word-chip {
  padding: 0.4rem 0.8rem;
  background: rgba(30, 41, 59, 0.7);
  border: 1.5px solid rgba(255, 140, 0, 0.3);
  color: #FF8C00;
  border-radius: 0.5rem;
  font-family: inherit;
  font-size: 1rem;
  cursor: pointer;
}
.word-chip.done { background: rgba(100, 255, 218, 0.15); border-color: #64FFDA; color: #64FFDA; }
.sort-prompt { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.sort-word { font-size: 2rem; color: #FF8C00; font-weight: bold; }
.sort-categories { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.cat-btn {
  padding: 0.5rem 1rem;
  background: rgba(30, 41, 59, 0.7);
  border: 1.5px solid rgba(100, 255, 218, 0.3);
  color: #64FFDA;
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: inherit;
}
.sort-done { color: #64FFDA; font-size: 1.1rem; }
.meaning-item { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.word { font-size: 1.8rem; color: #FF8C00; font-weight: bold; }
.morphemes { display: flex; gap: 0.3rem; }
.morpheme { padding: 0.2rem 0.5rem; background: rgba(255, 140, 0, 0.15); color: #FF8C00; border-radius: 0.3rem; font-size: 0.9rem; }
.support { color: #888; font-size: 0.85rem; text-align: center; }
.next-btn {
  background: rgba(255, 140, 0, 0.15);
  border: 1.5px solid #FF8C00;
  color: #FF8C00;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}
.next-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
