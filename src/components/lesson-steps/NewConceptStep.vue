<template>
  <div class="new-concept-step">
    <!-- Phase 1: Meet the letter -->
    <template v-if="phase === 'letter'">
      <FocusStage v-if="grapheme" :tokens="[{ text: grapheme, kind: 'grapheme', state: 'active' }]" emphasis="letter" />
      <div class="btn-row">
        <button class="action-btn primary" type="button" aria-label="Next" @click="advanceFromLetter">
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
      <FocusStage v-if="grapheme" :tokens="[{ text: grapheme, kind: 'grapheme', state: 'active' }]" emphasis="letter" />
      <div v-if="currentGroup" class="read-group">
        <div
          v-if="positionSlotIndex(currentGroup.position) > 0"
          class="position-badge"
          :aria-label="currentGroup.position ? `Letter at ${currentGroup.position}` : 'Letter position'"
        >
          <span
            v-for="slot in 3"
            :key="slot"
            class="pos-slot"
            :class="{ filled: positionSlotIndex(currentGroup.position) === slot }"
          >{{ positionSlotIndex(currentGroup.position) === slot ? grapheme : '' }}</span>
        </div>
        <div class="word-pool">
          <button
            v-for="(w, wi) in currentGroup.words"
            :key="wi"
            class="word-chip"
            :class="{ done: !!groupDone[wi] }"
            :disabled="audioBusy"
            type="button"
            :aria-label="`Read the word ${w}`"
            @click="markRead(wi)"
          >{{ w }}</button>
        </div>
      </div>
      <div class="btn-row">
        <button
          class="action-btn primary"
          type="button"
          :aria-label="isLastGroup ? 'Done' : 'Next'"
          :disabled="!allGroupRead"
          @click="advanceFromRead"
        >
          <Check v-if="isLastGroup" :size="36" :stroke-width="2.75" />
          <ArrowRight v-else :size="36" :stroke-width="2.75" />
        </button>
      </div>
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

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

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
const groupDone = ref({});

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
const allGroupRead = computed(() => {
  const g = currentGroup.value;
  if (!g) return false;
  return g.words.every((_w, wi) => !!groupDone.value[wi]);
});

function positionSlotIndex(position) {
  const p = String(position || '').toLowerCase();
  if (p === 'initial' || p === 'start' || p === 'beginning') return 1;
  if (p === 'medial' || p === 'middle') return 2;
  if (p === 'final' || p === 'end') return 3;
  return 0;
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
    if (grapheme.value) await ember.playPhoneme(grapheme.value);
    if (cancelled) return;
    await ember.speak('Now you try.');
  } finally {
    introBusy.value = false;
  }
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
  const result = await startListening(grapheme.value, 9000);
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
    groupDone.value = {};
    phase.value = 'read';
  } else {
    emit('step-complete');
  }
}

function advanceFromRead() {
  if (!allGroupRead.value) return;
  if (groupIdx.value < readGroups.value.length - 1) {
    groupIdx.value += 1;
    groupDone.value = {};
  } else {
    emit('step-complete');
  }
}

async function markRead(wi) {
  if (audioBusy.value) return;
  audioBusy.value = true;
  try {
    groupDone.value = { ...groupDone.value, [wi]: true };
    const word = currentGroup.value?.words?.[wi];
    if (word) await ember.speakTeacher(word);
  } finally {
    audioBusy.value = false;
  }
}

watch(phase, async (next) => {
  if (next === 'sound') await demoSoundAndPrompt();
  else if (next === 'read') await ember.speak('Tap each word to read it.');
});

onMounted(async () => {
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

.read-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
}

.position-badge {
  display: inline-flex;
  gap: 4px;
  padding: 5px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 209, 102, 0.22);
}

.pos-slot {
  width: 28px;
  height: 32px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 800;
  color: rgba(255, 244, 220, 0.3);
  line-height: 1;
}

.pos-slot.filled {
  background: rgba(255, 209, 102, 0.3);
  color: #fff4dc;
  box-shadow: inset 0 0 0 2px rgba(255, 209, 102, 0.75);
}

.word-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.word-chip {
  padding: 0.6rem 1rem;
  background: rgba(25, 47, 74, 0.75);
  border: 2px solid rgba(255, 209, 102, 0.35);
  color: #ffd166;
  border-radius: 0.7rem;
  font-family: inherit;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease, opacity 160ms ease;
}

.word-chip:hover:not(:disabled) { transform: scale(1.05); border-color: #ffd166; }
.word-chip:disabled { opacity: 0.55; cursor: wait; }
.word-chip.done {
  background: rgba(126, 232, 136, 0.18);
  border-color: rgba(126, 232, 136, 0.8);
  color: #bff3c1;
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
