<template>
  <div class="new-concept-step">
    <h3 class="step-title">New Concept</h3>

    <div v-if="phase === 'intro'" class="intro-section">
      <div v-if="grapheme" class="grapheme-card">{{ grapheme }}</div>
      <div v-if="phoneme" class="phoneme-label">{{ phoneme }}</div>
      <div v-if="currentScriptLine" class="script-line">{{ stripIpa(currentScriptLine.text) }}</div>
      <div v-if="articulation" class="articulation">{{ stripIpa(articulation) }}</div>
      <div class="btn-row">
        <button class="audio-btn" @click="speakCurrentLine">🔊 Hear again</button>
        <button class="next-btn" @click="advanceScript">{{ scriptDone ? "Let's practice" : 'Next' }}</button>
      </div>
    </div>

    <div v-else-if="phase === 'read'" class="practice-section">
      <div class="prompt">Read each word</div>
      <div class="word-pool">
        <button
          v-for="(w, i) in readWords"
          :key="`r-${i}`"
          class="word-chip"
          :class="{ done: readDone[i] }"
          @click="markRead(i)"
        >{{ w }}</button>
      </div>
      <button class="next-btn" :disabled="!allRead" @click="phase = 'spell'">Spell next</button>
    </div>

    <div v-else-if="phase === 'spell'" class="practice-section">
      <div class="prompt">Spell each word out loud</div>
      <div class="word-pool">
        <button
          v-for="(w, i) in spellWords"
          :key="`s-${i}`"
          class="word-chip"
          :class="{ done: spellDone[i] }"
          @click="markSpell(i)"
        >{{ w }}</button>
      </div>
      <button class="next-btn" :disabled="!allSpelled" @click="finish">Done</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
let cancelled = false;

const phase = ref('intro');
const scriptIndex = ref(0);

const script = computed(() => props.step?.introductionScript ?? []);
const articulation = computed(() => props.step?.articulatoryGesture ?? '');
const grapheme = computed(() => {
  const placements = props.step?.graphemePlacements ?? [];
  return placements[0]?.grapheme ?? '';
});
const phoneme = computed(() => {
  return '';
});

const currentScriptLine = computed(() => script.value[scriptIndex.value]);
const scriptDone = computed(() => scriptIndex.value >= script.value.length - 1);

function stripIpa(text) {
  if (!text) return '';
  // Remove /…/ phoneme notations and tidy whitespace/punctuation that's left behind
  return text.replace(/\/[^/]*\//g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}

async function speakCurrentLine() {
  const line = currentScriptLine.value;
  if (!line) return;
  await ember.speak(line.text);
  if (cancelled) return;
  // After speaking each script line, play the grapheme's sound to anchor it
  if (grapheme.value) {
    await ember.playPhoneme(grapheme.value);
  }
}

watch(scriptIndex, async () => {
  if (phase.value === 'intro') await speakCurrentLine();
});

onMounted(async () => {
  await speakCurrentLine();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
});

const readWords = computed(() => {
  const r = props.step?.readWords ?? {};
  return [...(r.iDo ?? []), ...(r.weDo ?? []), ...(r.youDo ?? [])];
});
const spellWords = computed(() => {
  const s = props.step?.spellWords ?? {};
  return [...(s.iDo ?? []), ...(s.weDo ?? []), ...(s.youDo ?? [])];
});

const readDone = ref([]);
const spellDone = ref([]);

const allRead = computed(() => readWords.value.length > 0 && readWords.value.every((_, i) => readDone.value[i]));
const allSpelled = computed(() => spellWords.value.length > 0 && spellWords.value.every((_, i) => spellDone.value[i]));

function advanceScript() {
  if (scriptDone.value) {
    if (readWords.value.length > 0) {
      phase.value = 'read';
    } else if (spellWords.value.length > 0) {
      phase.value = 'spell';
    } else {
      emit('step-complete');
    }
    return;
  }
  scriptIndex.value++;
}

async function markRead(i) {
  readDone.value[i] = true;
  const word = readWords.value[i];
  if (word) await ember.speak(word);
}

async function markSpell(i) {
  spellDone.value[i] = true;
  const word = spellWords.value[i];
  if (word) await ember.speak(word);
}

function finish() {
  emit('step-complete');
}
</script>

<style scoped>
.new-concept-step { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem; max-width: 360px; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.intro-section, .practice-section { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.grapheme-card { font-size: 5rem; color: #FF8C00; font-weight: bold; line-height: 1; }
.phoneme-label { font-size: 1.5rem; color: #64FFDA; }
.script-line { color: #E0E0E0; text-align: center; font-size: 1rem; min-height: 2.5rem; }
.articulation { color: #888; font-size: 0.85rem; text-align: center; font-style: italic; }
.prompt { color: #aaa; }
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
.next-btn, .audio-btn {
  background: rgba(255, 140, 0, 0.15);
  border: 1.5px solid #FF8C00;
  color: #FF8C00;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}
.next-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-row { display: flex; gap: 0.5rem; }
</style>
