<template>
  <div class="new-concept-step">
    <!-- Phase 1: Meet the letter -->
    <template v-if="phase === 'letter'">
      <FocusStage v-if="grapheme" :tokens="[{ text: grapheme, kind: 'grapheme', state: 'active' }]" emphasis="letter" />
      <div class="btn-row">
        <button class="action-btn primary" type="button" aria-label="Next" :disabled="introBusy" @click="advanceFromLetter">
          <ArrowRight :size="36" :stroke-width="2.75" />
        </button>
      </div>
    </template>

    <!-- Phase 2: Hear the sound + say it -->
    <template v-else-if="phase === 'sound'">
      <FocusStage v-if="grapheme" :tokens="[{ text: grapheme, kind: 'grapheme', state: micPhase === 'matched' ? 'done' : 'active' }]" emphasis="letter" />
      <div v-if="micPhase === 'listening'" class="mic-area" aria-hidden="true">
        <div class="sustain-meter">
          <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
        </div>
      </div>
      <div class="btn-row">
        <button class="action-btn" type="button" aria-label="Hear the sound" :disabled="introBusy || audioBusy" @click="playSound">
          <Volume2 :size="30" :stroke-width="2.5" />
        </button>
        <button class="action-btn" type="button" aria-label="My turn to say the sound" :disabled="!canStartMic" @click="startMicPractice">
          <Mic :size="30" :stroke-width="2.5" />
        </button>
        <button class="action-btn primary" type="button" aria-label="Next" :disabled="micPhase !== 'matched'" @click="advanceFromSound">
          <ArrowRight :size="36" :stroke-width="2.75" />
        </button>
      </div>
    </template>

    <!-- Phase 3: Walk each readGroup one screen at a time -->
    <template v-else-if="phase === 'read'">
      <!-- 3a: walking — one word centered, target grapheme highlighted in-place -->
      <template v-if="readMode === 'walking' && currentWord">
        <div class="word-display" :aria-label="`Read the word ${currentWord}`">
          <span
            v-for="(ch, ci) in currentWordChars"
            :key="ci"
            class="word-char"
            :class="{ target: ci === targetCharIndex }"
          >{{ ch }}</span>
        </div>
        <div class="btn-row">
          <button class="action-btn" type="button" aria-label="Hear the word" :disabled="audioBusy" @click="speakCurrentWord">
            <Volume2 :size="30" :stroke-width="2.5" />
          </button>
          <button class="action-btn primary" type="button" :aria-label="walkNextLabel" :disabled="audioBusy" @click="advanceWalking">
            <Check v-if="walkNextLabel === 'Done'" :size="36" :stroke-width="2.75" />
            <ArrowRight v-else :size="36" :stroke-width="2.75" />
          </button>
        </div>
      </template>

      <!-- 3b: reviewing — all group words together, tap to replay -->
      <template v-else-if="readMode === 'reviewing' && currentGroup">
        <div class="word-pool">
          <button
            v-for="(w, wi) in currentGroup.words"
            :key="wi"
            class="word-chip"
            :disabled="audioBusy"
            type="button"
            :aria-label="`Read the word ${w}`"
            @click="speakWord(w)"
          >
            <span
              v-for="(ch, ci) in chipChars(w)"
              :key="ci"
              :class="{ 'chip-target': ci === chipTargetIndex(w, currentGroup.position) }"
            >{{ ch }}</span>
          </button>
        </div>
        <div class="btn-row">
          <button
            class="action-btn primary"
            type="button"
            :aria-label="isLastGroup ? 'Done' : 'Next'"
            @click="advanceFromReview"
          >
            <Check v-if="isLastGroup" :size="36" :stroke-width="2.75" />
            <ArrowRight v-else :size="36" :stroke-width="2.75" />
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { ArrowRight, Check, Mic, Volume2 } from 'lucide-vue-next';
import { useEmber } from '../../composables/useEmber.js';
import { useMicTurn } from '../../composables/useMicTurn.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';
import FocusStage from './FocusStage.vue';

const props = defineProps({
  step: { type: Object, required: true },
  lessonPhoneme: { type: String, default: '' },
});
const emit = defineEmits(['step-complete', 'phase-change']);

const ember = useEmber();
const {
  startListening,
  cancelListening,
  requestMicPermission,
  sustainProgress: micProgress,
} = useSpeechRecognition();
const { prepareMicTurn } = useMicTurn({ ember, cancelListening });
let cancelled = false;

// letter → sound → read (walks readGroups one at a time)
const phase = ref('letter');
const micPhase = ref('idle');
const introBusy = ref(false);
const audioBusy = ref(false);
const groupIdx = ref(0);
// read sub-mode: walking (one word at a time) → reviewing (all words)
const readMode = ref('walking');
const walkIdx = ref(0);

const PHASE_COUNT = 3;
const PHASE_INDEX = { letter: 0, sound: 1, read: 2 };

const grapheme = computed(() => {
  const placements = props.step?.graphemePlacements ?? [];
  return placements[0]?.grapheme ?? '';
});

const canStartMic = computed(() => !introBusy.value && !audioBusy.value && micPhase.value !== 'listening');

// readGroups: one per graphemePlacements entry when readWords is empty,
// or a single unlabeled group when readWords is authored. Position strings
// ("initial"/"medial"/"final") are passed through so the structure extends
// to any future position taxonomy without code changes.
const readGroups = computed(() => {
  const r = props.step?.readWords ?? {};
  const authored = Array.from(new Set([
    ...(r.iDo ?? []),
    ...(r.weDo ?? []),
    ...(r.youDo ?? []),
  ]));
  if (authored.length > 0) return [{ position: null, words: authored }];

  const placements = props.step?.graphemePlacements ?? [];
  return placements
    .map((p) => ({
      position: typeof p?.position === 'string' ? p.position.toLowerCase() : null,
      words: (Array.isArray(p?.examples) ? p.examples : [])
        .filter((w) => typeof w === 'string' && w.trim().length > 0),
    }))
    .filter((g) => g.words.length > 0);
});

const currentGroup = computed(() => readGroups.value[groupIdx.value] ?? null);
const isLastGroup = computed(() => groupIdx.value >= readGroups.value.length - 1);
const currentWord = computed(() => currentGroup.value?.words?.[walkIdx.value] ?? '');
const currentWordChars = computed(() => Array.from(currentWord.value));

// Highlight the grapheme at the slot matching the group's position.
// For medial, pick the first occurrence that isn't first or last character.
function findTargetIndex(word, position) {
  const w = String(word || '').toLowerCase();
  const g = String(grapheme.value || '').toLowerCase();
  if (!w || !g) return -1;
  const p = String(position || '').toLowerCase();
  if (p === 'initial' || p === 'start' || p === 'beginning') return w.indexOf(g);
  if (p === 'final' || p === 'end') return w.lastIndexOf(g);
  if (p === 'medial' || p === 'middle') {
    for (let i = 1; i < w.length - 1; i++) if (w[i] === g) return i;
  }
  return w.indexOf(g);
}

const targetCharIndex = computed(() => findTargetIndex(currentWord.value, currentGroup.value?.position));

function chipChars(word) {
  return Array.from(String(word || ''));
}

function chipTargetIndex(word, position) {
  return findTargetIndex(word, position);
}
const isLastWordInGroup = computed(() => {
  const words = currentGroup.value?.words ?? [];
  return walkIdx.value >= words.length - 1;
});
const walkNextLabel = computed(() => {
  // After the last word: review if group has >1 word, else advance group.
  if (!isLastWordInGroup.value) return 'Next';
  if ((currentGroup.value?.words?.length ?? 0) > 1) return 'Review';
  return isLastGroup.value ? 'Done' : 'Next';
});

function emitPhase(name) {
  emit('phase-change', { phaseIndex: PHASE_INDEX[name] ?? 0, phaseCount: PHASE_COUNT });
}

async function announceLetter() {
  if (introBusy.value) return;
  introBusy.value = true;
  try {
    const letter = String(grapheme.value || '').toUpperCase();
    if (letter) await ember.speakTeacher(`This is the letter ${letter}.`);
  } finally {
    introBusy.value = false;
  }
}

async function demoSoundAndPrompt() {
  if (introBusy.value) return;
  introBusy.value = true;
  try {
    // Play the sound first so the articulation description has something
    // concrete to refer back to, then explain how to make it.
    if (grapheme.value) await ember.playPhoneme(grapheme.value);
    if (cancelled) return;
    const instruction = String(props.step?.articulatoryGesture || '').trim();
    if (instruction) await ember.speakTeacher(`To make that sound, ${lowerFirst(instruction)}`);
  } finally {
    introBusy.value = false;
  }
}

function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

async function playSound() {
  if (audioBusy.value) return;
  audioBusy.value = true;
  try {
    if (grapheme.value) await ember.playPhoneme(grapheme.value);
  } finally {
    audioBusy.value = false;
  }
}

async function startMicPractice() {
  if (!grapheme.value) {
    micPhase.value = 'matched';
    return;
  }
  micPhase.value = 'listening';
  await prepareMicTurn();
  const result = await startListening(grapheme.value, 3500);
  if (cancelled) return;
  if (result?.matched) {
    micPhase.value = 'matched';
    await ember.speak('Nice job! You said it.');
  } else {
    micPhase.value = 'missed';
    await ember.speak('Try again, then tap my turn.');
  }
}

function advanceFromLetter() {
  phase.value = 'sound';
}

function advanceFromSound() {
  if (micPhase.value !== 'matched') return;
  if (readGroups.value.length > 0) {
    groupIdx.value = 0;
    walkIdx.value = 0;
    readMode.value = 'walking';
    phase.value = 'read';
  } else {
    emit('step-complete');
  }
}

async function speakCurrentWord() {
  if (audioBusy.value) return;
  audioBusy.value = true;
  try {
    if (currentWord.value) await ember.speakTeacher(currentWord.value);
  } finally {
    audioBusy.value = false;
  }
}

async function speakWord(word) {
  if (audioBusy.value) return;
  audioBusy.value = true;
  try {
    if (word) await ember.speakTeacher(word);
  } finally {
    audioBusy.value = false;
  }
}

function advanceWalking() {
  if (!isLastWordInGroup.value) {
    walkIdx.value += 1;
    return;
  }
  // Last word: if group has >1 word, go to review; else advance group.
  if ((currentGroup.value?.words?.length ?? 0) > 1) {
    readMode.value = 'reviewing';
    return;
  }
  stepForwardGroup();
}

function advanceFromReview() {
  stepForwardGroup();
}

function stepForwardGroup() {
  if (groupIdx.value < readGroups.value.length - 1) {
    groupIdx.value += 1;
    walkIdx.value = 0;
    readMode.value = 'walking';
  } else {
    emit('step-complete');
  }
}

// Auto-speak the word when it becomes active in walking mode, so learners
// hear each word as it's revealed without needing to tap play first.
async function autoSpeakWalking() {
  if (phase.value !== 'read' || readMode.value !== 'walking') return;
  const word = currentWord.value;
  if (!word) return;
  audioBusy.value = true;
  try {
    await ember.speakTeacher(word);
  } finally {
    audioBusy.value = false;
  }
}

watch(phase, async (next) => {
  emitPhase(next);
  if (next === 'sound') await demoSoundAndPrompt();
  else if (next === 'read') {
    // Bridge from the sound they just practiced to words that contain it.
    await ember.speak("Now let's find that sound in real words.");
    if (!cancelled) await autoSpeakWalking();
  }
});

watch([walkIdx, readMode], async ([, mode], [prevIdx, prevMode]) => {
  if (phase.value !== 'read') return;
  if (mode === 'walking' && (prevMode !== 'walking' || walkIdx.value !== prevIdx)) {
    await autoSpeakWalking();
  } else if (mode === 'reviewing' && prevMode !== 'reviewing') {
    await ember.speak('Tap any word to hear it again.');
  }
});

onMounted(async () => {
  emitPhase('letter');
  await requestMicPermission();
  await announceLetter();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
  cancelListening();
});
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

.mic-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
}

.sustain-meter {
  width: min(240px, 70vw);
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
}

.sustain-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff8c00, #ffd166);
  transition: width 0.1s;
}

.word-display {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  padding: clamp(16px, 4vw, 32px) clamp(20px, 5vw, 40px);
  min-height: clamp(140px, 24vh, 220px);
  font-family: 'Fredoka', 'Baloo 2', 'Nunito', system-ui, sans-serif;
  font-weight: 700;
  color: #fff4dc;
  letter-spacing: 0.02em;
  line-height: 1;
}

.word-char {
  font-size: clamp(80px, 16vw, 160px);
  color: rgba(255, 244, 220, 0.72);
  transition: color 200ms ease, text-shadow 200ms ease;
}

.word-char.target {
  color: #ffd166;
  text-shadow: 0 0 16px rgba(255, 209, 102, 0.55), 0 0 4px rgba(255, 209, 102, 0.75);
}

.word-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  padding: 0.5rem 0;
}

.word-chip {
  padding: 0.75rem 1.4rem;
  background: rgba(25, 47, 74, 0.75);
  border: 2px solid rgba(255, 209, 102, 0.35);
  color: rgba(255, 244, 220, 0.78);
  border-radius: 0.9rem;
  font-family: inherit;
  font-size: clamp(1.8rem, 5vw, 2.4rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease, opacity 160ms ease;
}

.word-chip:hover:not(:disabled) { transform: scale(1.05); border-color: #ffd166; }
.word-chip:disabled { opacity: 0.55; cursor: wait; }

.word-chip .chip-target {
  color: #ffd166;
  text-shadow: 0 0 10px rgba(255, 209, 102, 0.45);
}

.btn-row {
  display: flex;
  gap: 0.9rem;
  align-items: center;
  margin-top: 0.25rem;
}

.action-btn {
  width: 64px;
  height: 64px;
  border: 2px solid rgba(255, 209, 102, 0.3);
  background: rgba(25, 47, 74, 0.8);
  color: #ffd166;
  border-radius: 50%;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, opacity 160ms ease;
}

.action-btn:hover:not(:disabled) { transform: scale(1.06); border-color: #ffd166; }
.action-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.action-btn.primary {
  width: 84px;
  height: 84px;
  background: linear-gradient(180deg, rgba(255, 180, 90, 0.35), rgba(255, 140, 0, 0.22));
  border-color: #ff8c00;
  color: #fff4dc;
  box-shadow: 0 0 0 0 rgba(255, 140, 0, 0);
}

.action-btn.primary:not(:disabled) {
  animation: primary-glow 1.6s ease-in-out infinite;
}

@keyframes primary-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 140, 0, 0); transform: translateY(0); }
  50% { box-shadow: 0 0 0 10px rgba(255, 140, 0, 0.14), 0 0 20px rgba(255, 140, 0, 0.3); transform: translateY(-3px); }
}

@media (prefers-reduced-motion: reduce) {
  .action-btn.primary:not(:disabled) { animation: none; }
}
</style>
