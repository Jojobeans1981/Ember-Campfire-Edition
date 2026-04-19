<template>
  <div class="phonemic-awareness-step">
    <div v-if="phase === 'blend'" class="blend-stage">
      <div
        class="word-boxes"
        :aria-label="`Blend ${currentBlendGraphemes.length} sounds`"
      >
        <span
          v-for="(letter, i) in currentBlendGraphemes"
          :key="i"
          class="word-box"
          :class="{ revealed: i <= revealedIndex, active: i === playingIndex }"
        >{{ i <= revealedIndex ? letter : '' }}</span>
      </div>
    </div>
    <div v-else class="segment-stage">
      <div
        class="word-boxes"
        :aria-label="`Say ${currentSegmentGraphemes.length} sounds`"
      >
        <span
          v-for="(letter, i) in currentSegmentGraphemes"
          :key="i"
          class="word-box"
          :class="{ revealed: i <= revealedIndex, active: i === playingIndex }"
        >{{ i <= revealedIndex ? letter : '' }}</span>
      </div>
    </div>

    <div class="controls">
      <button
        class="action-btn"
        type="button"
        :aria-label="phase === 'blend' ? 'Start over' : 'Hear again'"
        :disabled="audioBusy"
        @click="repeatCurrent"
      >
        <RotateCcw :size="30" :stroke-width="2.5" />
      </button>
      <button
        class="action-btn primary"
        type="button"
        :aria-label="isLast ? 'Done' : 'Next'"
        :disabled="audioBusy"
        @click="next"
      >
        <Check v-if="isLast" :size="36" :stroke-width="2.75" />
        <ArrowRight v-else :size="36" :stroke-width="2.75" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { ArrowRight, Check, RotateCcw } from 'lucide-vue-next';
import { useEmber } from '../../composables/useEmber.js';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
let cancelled = false;

const blendItems = computed(() => props.step?.blend ?? []);
const segmentItems = computed(() => props.step?.segment ?? []);
const totalItems = computed(() => blendItems.value.length + segmentItems.value.length);

const cursor = ref(0);
const revealedIndex = ref(-1);
const playingIndex = ref(-1);
const audioBusy = ref(false);
// Bumped on every new playback trigger so an in-flight sequence exits
// cleanly when the user hits Repeat or Next mid-playback.
let playbackGeneration = 0;

const phase = computed(() => (cursor.value < blendItems.value.length ? 'blend' : 'segment'));
const currentBlend = computed(() => blendItems.value[cursor.value]);
const currentSegment = computed(() => segmentItems.value[cursor.value - blendItems.value.length]);
const isLast = computed(() => cursor.value >= totalItems.value - 1);

// Split the current item into per-phoneme slots. Prefer an authored
// `graphemes` array so digraphs like "ck" in "tack" stay atomic; fall
// back to a letter-split when authoring doesn't include graphemes.
function slotsFor(item) {
  if (!item) return [];
  if (Array.isArray(item.graphemes) && item.graphemes.length > 0) {
    return item.graphemes.slice();
  }
  return Array.from(item.word ?? '');
}

const currentBlendGraphemes = computed(() => slotsFor(currentBlend.value));
const currentSegmentGraphemes = computed(() => slotsFor(currentSegment.value));

function wait(ms, generation) {
  return new Promise((resolve) => {
    const id = setTimeout(() => {
      if (generation !== playbackGeneration || cancelled) resolve(false);
      else resolve(true);
    }, ms);
    // Stored on closure — cleanup happens naturally via generation check
    return id;
  });
}

const PHONEME_PAUSE_MS = 420;
const BEFORE_INVITE_PAUSE_MS = 500;
const INVITE_TO_WORD_PAUSE_MS = 800;

async function runBlendSequence() {
  const item = currentBlend.value;
  if (!item) return;
  playbackGeneration += 1;
  const generation = playbackGeneration;
  audioBusy.value = true;
  revealedIndex.value = -1;
  playingIndex.value = -1;

  try {
    const phonemes = item.phonemes ?? [];
    const letters = currentBlendGraphemes.value;
    for (let i = 0; i < phonemes.length; i += 1) {
      if (cancelled || generation !== playbackGeneration) return;
      playingIndex.value = i;
      await ember.playPhoneme(phonemes[i]);
      if (cancelled || generation !== playbackGeneration) return;
      // Reveal the grapheme that matches this phoneme.
      if (i < letters.length) revealedIndex.value = i;
      playingIndex.value = -1;
      if (i < phonemes.length - 1) {
        const ok = await wait(PHONEME_PAUSE_MS, generation);
        if (!ok) return;
      }
    }
    // After all phonemes: brief silence, invite the learner to blend along,
    // another brief silence, then say the word itself (no wrapper sentence).
    const beforeInvite = await wait(BEFORE_INVITE_PAUSE_MS, generation);
    if (!beforeInvite) return;
    await ember.speak('Try it with me.');
    if (cancelled || generation !== playbackGeneration) return;
    const beforeWord = await wait(INVITE_TO_WORD_PAUSE_MS, generation);
    if (!beforeWord) return;
    await ember.speakTeacher(item.word);
  } finally {
    if (generation === playbackGeneration) {
      playingIndex.value = -1;
      audioBusy.value = false;
    }
  }
}

async function runSegmentPlayback() {
  const item = currentSegment.value;
  if (!item) return;
  playbackGeneration += 1;
  const generation = playbackGeneration;
  audioBusy.value = true;
  revealedIndex.value = -1;
  playingIndex.value = -1;

  try {
    // Mirror the blend sequence visually: reveal each grapheme tile as
    // we play its phoneme, then say the whole word. Keeps lesson 4's
    // second half (at, tap, tack) in the same cadence as the first half
    // (mat, sat, map) instead of stacking a spoken-word layer on top.
    const phonemes = item.phonemes ?? [];
    const letters = currentSegmentGraphemes.value;
    const steps = Math.min(phonemes.length, letters.length);
    for (let i = 0; i < steps; i += 1) {
      if (cancelled || generation !== playbackGeneration) return;
      playingIndex.value = i;
      await ember.playPhoneme(phonemes[i]);
      if (cancelled || generation !== playbackGeneration) return;
      revealedIndex.value = i;
      playingIndex.value = -1;
      if (i < steps - 1) {
        const ok = await wait(PHONEME_PAUSE_MS, generation);
        if (!ok) return;
      }
    }
    const beforeInvite = await wait(BEFORE_INVITE_PAUSE_MS, generation);
    if (!beforeInvite) return;
    await ember.speakTeacher(item.word);
  } finally {
    if (generation === playbackGeneration) {
      playingIndex.value = -1;
      audioBusy.value = false;
    }
  }
}

async function repeatCurrent() {
  if (audioBusy.value) return;
  if (phase.value === 'blend') await runBlendSequence();
  else await runSegmentPlayback();
}

function next() {
  if (audioBusy.value) return;
  playbackGeneration += 1; // cancel any trailing sequence work
  if (cursor.value >= totalItems.value - 1) {
    emit('step-complete');
    return;
  }
  cursor.value++;
}

watch(cursor, async (nextCursor, prev) => {
  if (nextCursor === prev) return;
  revealedIndex.value = -1;
  playingIndex.value = -1;
  if (nextCursor < blendItems.value.length) {
    await runBlendSequence();
  } else {
    await runSegmentPlayback();
  }
});

onMounted(async () => {
  if (totalItems.value === 0) {
    emit('step-complete');
    return;
  }
  if (phase.value === 'blend') {
    await ember.speak("Let's put sounds together to make a word.");
    if (cancelled) return;
    await runBlendSequence();
  } else {
    await runSegmentPlayback();
  }
});

onBeforeUnmount(() => {
  cancelled = true;
  playingIndex.value = -1;
  ember.stopSpeaking();
});
</script>

<style scoped>
.phonemic-awareness-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 1rem;
  width: 100%;
}

.blend-stage,
.segment-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: clamp(16px, 4vw, 32px) clamp(12px, 3vw, 24px);
  min-height: clamp(160px, 26vh, 260px);
  justify-content: center;
  width: 100%;
}

.word-boxes {
  display: flex;
  flex-wrap: nowrap;
  gap: clamp(6px, 1.5vw, 14px);
  align-items: center;
  justify-content: center;
}

.word-box {
  width: clamp(58px, 10vw, 96px);
  height: clamp(74px, 13vw, 120px);
  border-radius: 14px;
  background: rgba(25, 47, 74, 0.7);
  border: 2px dashed rgba(255, 209, 102, 0.3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'Fredoka', 'Baloo 2', 'Nunito', system-ui, sans-serif;
  font-size: clamp(44px, 7.5vw, 72px);
  font-weight: 800;
  color: #fff4dc;
  flex: 0 0 auto;
  transition: transform 240ms ease, background 240ms ease, border-color 240ms ease, box-shadow 240ms ease;
}

.word-box.revealed {
  background: linear-gradient(180deg, rgba(25, 47, 74, 0.95), rgba(8, 17, 31, 0.95));
  border-style: solid;
  border-color: rgba(255, 209, 102, 0.6);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
}

.word-box.active {
  border-color: #ffd166;
  box-shadow: 0 0 0 6px rgba(255, 209, 102, 0.18), 0 14px 28px rgba(255, 140, 0, 0.35);
  transform: translateY(-4px) scale(1.04);
}

.controls {
  display: flex;
  gap: 0.9rem;
  margin-top: 0.25rem;
  align-items: center;
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
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.action-btn.primary {
  width: 84px;
  height: 84px;
  background: linear-gradient(180deg, rgba(255, 180, 90, 0.35), rgba(255, 140, 0, 0.22));
  border-color: #ff8c00;
  color: #fff4dc;
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
  .word-box { transition: none; }
}
</style>
