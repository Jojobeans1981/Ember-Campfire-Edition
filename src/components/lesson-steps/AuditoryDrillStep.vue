<template>
  <div class="auditory-drill-step">
    <FocusStage
      v-if="showFocus"
      :tokens="focusTokens"
      :emphasis="phase === 'wrong' ? 'tiles' : 'letter'"
    />

    <div class="choices" v-if="phase === 'pick'">
      <button
        v-for="choice in choices"
        :key="choice"
        class="choice-btn"
        type="button"
        :aria-label="`Pick the letter ${choice}`"
        @click="pick(choice)"
      >{{ choice }}</button>
    </div>

    <div class="controls" v-if="phase === 'listen' || phase === 'pick'">
      <button
        class="icon-btn"
        type="button"
        aria-label="Hear the sound again"
        :disabled="busy"
        @click="playPhonemeAgain"
      >🔊</button>
    </div>

    <div class="controls" v-if="phase === 'correct' || phase === 'wrong'">
      <button
        class="icon-btn primary"
        type="button"
        :aria-label="isLast ? 'Done' : 'Next'"
        @click="next"
      >{{ isLast ? '✅' : '➡️' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { getCumulativeLetters } from '../../data/ufli/ufliLessons.js';
import FocusStage from './FocusStage.vue';

const props = defineProps({
  step: { type: Object, required: true },
  lessonId: { type: String, default: '' },
});
const emit = defineEmits(['step-complete']);

const ember = useEmber();

const items = computed(() => props.step?.items ?? []);
const index = ref(0);
const currentItem = computed(() => items.value[index.value]);
const isLast = computed(() => index.value >= items.value.length - 1);
const phase = ref('listen');
const choices = ref([]);
const pickedChoice = ref('');
const busy = ref(false);
const knownLetters = ref([]);
let cancelled = false;

const targetGrapheme = computed(() => currentItem.value?.graphemes?.[0]);

const showFocus = computed(() => phase.value === 'correct' || phase.value === 'wrong');

const focusTokens = computed(() => {
  if (phase.value === 'correct') {
    return [{ text: pickedChoice.value || targetGrapheme.value || '', kind: 'grapheme', state: 'done' }];
  }
  if (phase.value === 'wrong') {
    return [
      { text: pickedChoice.value || '', kind: 'grapheme', state: 'idle' },
      { text: targetGrapheme.value || '', kind: 'grapheme', state: 'active' },
    ].filter((t) => t.text);
  }
  return [];
});

const allGraphemes = computed(() => {
  const set = new Set();
  for (const it of items.value) {
    for (const g of it.graphemes ?? []) set.add(g);
  }
  return Array.from(set);
});

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildChoices() {
  const target = targetGrapheme.value;
  if (!target) return [];

  const candidatePool = [
    ...allGraphemes.value,
    ...knownLetters.value,
    'm',
    's',
    't',
    'a',
  ]
    .map((grapheme) => String(grapheme).trim().toLowerCase())
    .filter((grapheme) => /^[a-z]$/.test(grapheme));

  const uniquePool = Array.from(new Set(candidatePool));
  const distractors = uniquePool
    .filter((g) => g !== target)
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(3, uniquePool.length));

  return shuffle([target, ...distractors].slice(0, 4));
}

async function playCurrent() {
  if (cancelled || busy.value) return;
  const item = currentItem.value;
  if (!item) return;
  busy.value = true;
  await ember.speak('Listen to the sound.');
  await ember.playPhoneme(item.phoneme);
  busy.value = false;
  if (cancelled) return;
  if (phase.value === 'listen') {
    choices.value = buildChoices();
    phase.value = 'pick';
    await ember.speak('Tap the letter that matches.');
  }
}

async function playPhonemeAgain() {
  if (cancelled || busy.value) return;
  const item = currentItem.value;
  if (!item) return;
  busy.value = true;
  await ember.playPhoneme(item.phoneme);
  busy.value = false;
}

async function pick(choice) {
  pickedChoice.value = choice;
  if (choice === targetGrapheme.value) {
    phase.value = 'correct';
    await ember.speak('Correct!');
  } else {
    phase.value = 'wrong';
    await ember.playPhoneme(currentItem.value.phoneme);
    const target = String(targetGrapheme.value || '').toUpperCase();
    if (target) {
      await ember.speak(`It was the letter ${target}.`);
    }
  }
}

async function next() {
  if (isLast.value) {
    emit('step-complete');
    return;
  }
  index.value++;
  phase.value = 'listen';
  pickedChoice.value = '';
  await playCurrent();
}

onMounted(async () => {
  if (items.value.length === 0) {
    emit('step-complete');
    return;
  }
  if (props.lessonId) {
    knownLetters.value = await getCumulativeLetters(props.lessonId);
  }
  await ember.speak('In this section, listen to the sound and tap the matching letter.');
  await playCurrent();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
});
</script>

<style scoped>
.auditory-drill-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  width: 100%;
}

.choices {
  display: flex;
  gap: 0.9rem;
  flex-wrap: wrap;
  justify-content: center;
}

.choice-btn {
  width: 88px;
  height: 88px;
  font-size: 2.6rem;
  font-weight: 700;
  border: 2px solid rgba(255, 209, 102, 0.35);
  background: rgba(25, 47, 74, 0.75);
  color: #ffd166;
  border-radius: 1rem;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease;
  font-family: inherit;
}

.choice-btn:hover { transform: scale(1.08); border-color: #ffd166; }
.choice-btn:active { transform: scale(0.96); }

.controls {
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
