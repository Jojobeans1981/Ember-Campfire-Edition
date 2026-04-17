<template>
  <div class="new-concept-step">
    <FocusStage v-if="phase === 'intro' && grapheme" :tokens="introTokens" emphasis="letter" />

    <div v-if="phase === 'intro'" class="intro-section">
      <div v-if="showMicPrompt && micPhase === 'listening'" class="mic-area" aria-hidden="true">
        <div class="mic-icon">🎤</div>
        <div class="sustain-meter">
          <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
        </div>
      </div>
      <div class="btn-row">
        <button
          class="icon-btn"
          type="button"
          aria-label="Hear again"
          @click="speakCurrentLine"
        >🔊</button>
        <button
          v-if="showMicPrompt"
          class="icon-btn"
          type="button"
          aria-label="My turn to say the sound"
          :disabled="micPhase === 'listening'"
          @click="startMicPractice"
        >🎤</button>
        <button
          class="icon-btn primary"
          type="button"
          :aria-label="scriptDone ? 'Start practice' : 'Next'"
          :disabled="nextDisabled"
          @click="advanceScript"
        >➡️</button>
      </div>
    </div>

    <div v-else-if="phase === 'read'" class="practice-section">
      <FocusStage v-if="grapheme" :tokens="[{ text: grapheme, kind: 'grapheme', state: 'active' }]" emphasis="letter" />
      <div class="word-pool">
        <button
          v-for="(w, i) in readWords"
          :key="`r-${i}`"
          class="word-chip"
          :class="{ done: readDone[i] }"
          type="button"
          :aria-label="`Read the word ${w}`"
          @click="markRead(i)"
        >{{ w }}</button>
      </div>
      <button
        class="icon-btn primary"
        type="button"
        aria-label="Spell next"
        :disabled="!allRead"
        @click="phase = 'spell'"
      >➡️</button>
    </div>

    <div v-else-if="phase === 'spell'" class="practice-section">
      <FocusStage v-if="grapheme" :tokens="[{ text: grapheme, kind: 'grapheme', state: 'active' }]" emphasis="letter" />
      <div class="word-pool">
        <button
          v-for="(w, i) in spellWords"
          :key="`s-${i}`"
          class="word-chip"
          :class="{ done: spellDone[i] }"
          type="button"
          :aria-label="`Practice the word ${w}`"
          @click="markSpell(i)"
        >{{ w }}</button>
      </div>
      <button
        class="icon-btn primary"
        type="button"
        aria-label="Done"
        :disabled="!allSpelled"
        @click="finish"
      >✅</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';
import FocusStage from './FocusStage.vue';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
const {
  startListening,
  cancelListening,
  requestMicPermission,
  sustainProgress: micProgress,
} = useSpeechRecognition();
let cancelled = false;

const phase = ref('intro');
const scriptIndex = ref(0);
const playedAnchorSound = ref(false);

const script = computed(() => props.step?.introductionScript ?? []);
const grapheme = computed(() => {
  const placements = props.step?.graphemePlacements ?? [];
  return placements[0]?.grapheme ?? '';
});

const currentScriptLine = computed(() => script.value[scriptIndex.value]);
const scriptDone = computed(() => scriptIndex.value >= script.value.length - 1);
const micPhase = ref('idle');

const introTokens = computed(() => [{
  text: grapheme.value,
  kind: 'grapheme',
  state: micPhase.value === 'matched' ? 'done' : 'active',
}]);

function stripIpa(text) {
  if (!text) return '';
  return text
    .replace(/\/[^/]*\//g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

function lineNeedsResponse(text) {
  if (!text) return false;
  const normalized = String(text).toLowerCase();
  return normalized.includes('your turn')
    || normalized.includes('now you try')
    || normalized.includes('say /');
}

const showMicPrompt = computed(() => lineNeedsResponse(currentScriptLine.value?.text));

function spokenLineFor(text) {
  const line = stripIpa(text ?? '');
  if (!line) return '';
  const normalized = line.toLowerCase();
  if (normalized.includes('watch my mouth')) {
    return 'Listen closely to the sound, then try it too.';
  }
  if (normalized.includes('your turn') || normalized.includes('now you try')) {
    return 'Tap my turn and say the sound.';
  }
  return line;
}

const nextDisabled = computed(() => showMicPrompt.value && micPhase.value !== 'matched');

async function speakCurrentLine() {
  const line = currentScriptLine.value;
  if (!line) return;
  const spoken = spokenLineFor(line.text);
  if (spoken) await ember.speakTeacher(spoken);
  if (cancelled) return;
  if (!playedAnchorSound.value && scriptIndex.value === 0 && grapheme.value) {
    playedAnchorSound.value = true;
    await ember.playPhoneme(grapheme.value);
  }
}

async function startMicPractice() {
  if (!grapheme.value) {
    micPhase.value = 'matched';
    return;
  }
  micPhase.value = 'listening';
  await ember.speak('Say the sound when you are ready.');
  await ember.speak('Listening.');
  const result = await startListening(grapheme.value, 7000);
  if (cancelled) return;
  if (result?.matched) {
    micPhase.value = 'matched';
    await ember.speak('Nice job! You said it.');
  } else {
    micPhase.value = 'missed';
    await ember.speak('Try again, then tap my turn.');
  }
}

watch(scriptIndex, async () => {
  micPhase.value = 'idle';
  if (phase.value === 'intro') await speakCurrentLine();
});

watch(phase, async (next) => {
  if (next === 'read') await ember.speak('Tap each word to read it.');
  else if (next === 'spell') await ember.speak('Tap each word to practice it.');
});

onMounted(async () => {
  await requestMicPermission();
  await speakCurrentLine();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
  cancelListening();
});

const readWords = computed(() => {
  const r = props.step?.readWords ?? {};
  return Array.from(new Set([...(r.iDo ?? []), ...(r.weDo ?? []), ...(r.youDo ?? [])]));
});
const spellWords = computed(() => {
  const s = props.step?.spellWords ?? {};
  return Array.from(new Set([...(s.iDo ?? []), ...(s.weDo ?? []), ...(s.youDo ?? [])]));
});

const readDone = ref([]);
const spellDone = ref([]);

const allRead = computed(() => readWords.value.length > 0 && readWords.value.every((_, i) => readDone.value[i]));
const allSpelled = computed(() => spellWords.value.length > 0 && spellWords.value.every((_, i) => spellDone.value[i]));

function advanceScript() {
  if (nextDisabled.value) return;
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
  if (word) await ember.speakTeacher(word);
}

async function markSpell(i) {
  spellDone.value[i] = true;
  const word = spellWords.value[i];
  if (word) await ember.speakTeacher(word);
}

function finish() {
  emit('step-complete');
}
</script>

<style scoped>
.new-concept-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  max-width: 480px;
  width: 100%;
}

.intro-section, .practice-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.mic-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
}

.mic-icon {
  font-size: 2rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
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
  background: #ff8c00;
  transition: width 0.1s;
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

.btn-row {
  display: flex;
  gap: 0.75rem;
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
