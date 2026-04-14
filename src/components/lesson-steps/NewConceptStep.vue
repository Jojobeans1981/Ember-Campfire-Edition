<template>
  <div class="new-concept-step">
    <h3 class="step-title">Meet the Letter</h3>

    <div v-if="phase === 'intro'" class="intro-section">
      <div v-if="grapheme" class="grapheme-card">{{ grapheme }}</div>
      <div v-if="currentScriptLine" class="script-line">{{ displayScriptLine }}</div>
      <div v-if="articulation" class="articulation">{{ stripIpa(articulation) }}</div>
      <div v-if="showMicPrompt" class="mic-card">
        <div v-if="micPhase === 'idle'" class="mic-help">Say the sound when you're ready.</div>
        <div v-else-if="micPhase === 'listening'" class="mic-help listening">Listening...</div>
        <div v-else-if="micPhase === 'matched'" class="mic-help success">Nice job! You said it.</div>
        <div v-else class="mic-help retry">Try again, then tap My turn.</div>
        <div v-if="micPhase === 'listening'" class="sustain-meter">
          <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
        </div>
      </div>
      <div class="btn-row">
        <button class="audio-btn" @click="speakCurrentLine">🔊 Hear again</button>
        <button
          v-if="showMicPrompt"
          class="audio-btn"
          @click="startMicPractice"
          :disabled="micPhase === 'listening'"
        >
          🎤 My turn
        </button>
        <button class="next-btn" :disabled="nextDisabled" @click="advanceScript">{{ scriptDone ? "Let's practice" : 'Next' }}</button>
      </div>
    </div>

    <div v-else-if="phase === 'read'" class="practice-section">
      <div class="prompt">Tap each word to read it.</div>
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
      <div class="prompt">Tap each word to practice it.</div>
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
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';

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

const script = computed(() => props.step?.introductionScript ?? []);
const articulation = computed(() => props.step?.articulatoryGesture ?? '');
const grapheme = computed(() => {
  const placements = props.step?.graphemePlacements ?? [];
  return placements[0]?.grapheme ?? '';
});

const currentScriptLine = computed(() => script.value[scriptIndex.value]);
const scriptDone = computed(() => scriptIndex.value >= script.value.length - 1);
const micPhase = ref('idle');

function stripIpa(text) {
  if (!text) return '';
  // Remove /…/ phoneme notations and tidy whitespace/punctuation that's left behind
  return text.replace(/\/[^/]*\//g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}

function lineNeedsResponse(text) {
  if (!text) return false;
  const normalized = String(text).toLowerCase();
  return normalized.includes('your turn') || normalized.includes('now you try') || normalized.includes('say /');
}

const showMicPrompt = computed(() => lineNeedsResponse(currentScriptLine.value?.text));

const displayScriptLine = computed(() => {
  const line = stripIpa(currentScriptLine.value?.text ?? '');
  if (!line) return '';
  const normalized = line.toLowerCase();

  if (normalized.includes('watch my mouth')) {
    return 'Listen closely to the sound, then try it too.';
  }

  if (normalized.includes('your turn') || normalized.includes('now you try')) {
    return 'Tap "My turn" and say the sound.';
  }

  return line;
});

const nextDisabled = computed(() => showMicPrompt.value && micPhase.value !== 'matched');

async function speakCurrentLine() {
  const line = currentScriptLine.value;
  if (!line) return;
  await ember.speak(displayScriptLine.value || line.text);
  if (cancelled) return;
  // After speaking each script line, play the grapheme's sound to anchor it
  if (grapheme.value) {
    await ember.playPhoneme(grapheme.value);
  }
}

async function startMicPractice() {
  if (!grapheme.value) {
    micPhase.value = 'matched';
    return;
  }
  micPhase.value = 'listening';
  const result = await startListening(grapheme.value, 7000);
  if (cancelled) return;
  micPhase.value = result?.matched ? 'matched' : 'missed';
  if (result?.matched) {
    await ember.speak('Nice job!');
  }
}

watch(scriptIndex, async () => {
  micPhase.value = 'idle';
  if (phase.value === 'intro') await speakCurrentLine();
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
.mic-card { display: flex; flex-direction: column; align-items: center; gap: 0.45rem; }
.mic-help { color: #cbd5e1; font-size: 0.9rem; text-align: center; }
.mic-help.listening { color: #64FFDA; }
.mic-help.success { color: #64FFDA; }
.mic-help.retry { color: #FFD93D; }
.sustain-meter { width: 200px; height: 10px; background: #333; border-radius: 5px; overflow: hidden; }
.sustain-fill { height: 100%; background: #FF8C00; transition: width 0.1s; }
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
