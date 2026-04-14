<template>
  <div class="auditory-drill-step">
    <h3 class="step-title">Pick the Letter</h3>

    <div class="prompt-text" v-if="phase === 'listen'">Listen to the sound.</div>
    <div class="prompt-text" v-else-if="phase === 'pick'">Tap the letter that matches.</div>
    <div class="prompt-text success" v-else-if="phase === 'correct'">Correct!</div>
    <div class="prompt-text wrong" v-else-if="phase === 'wrong'">It was {{ targetGrapheme }}</div>

    <div class="choices" v-if="phase === 'pick'">
      <button
        v-for="choice in choices"
        :key="choice"
        class="choice-btn"
        @click="pick(choice)"
      >{{ choice }}</button>
    </div>

    <div class="controls" v-if="phase === 'listen' || phase === 'pick'">
      <button class="audio-btn" @click="playPhonemeAgain" :disabled="busy">
        🔊 Hear again
      </button>
    </div>

    <div class="controls" v-if="phase === 'correct' || phase === 'wrong'">
      <button class="next-btn" @click="next">{{ isLast ? 'Done' : 'Next' }}</button>
    </div>

    <div class="item-progress">{{ index + 1 }} / {{ items.length }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { getCumulativeLetters } from '../../data/ufli/ufliLessons.js';

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
const busy = ref(false);
const knownLetters = ref([]);
let cancelled = false;

const targetGrapheme = computed(() => currentItem.value?.graphemes?.[0]);

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
  await ember.playPhoneme(item.phoneme);
  busy.value = false;
  if (cancelled) return;
  if (phase.value === 'listen') {
    choices.value = buildChoices();
    phase.value = 'pick';
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
  if (choice === targetGrapheme.value) {
    phase.value = 'correct';
    await ember.speak('Yes!');
  } else {
    phase.value = 'wrong';
    await ember.playPhoneme(currentItem.value.phoneme);
  }
}

async function next() {
  if (isLast.value) {
    emit('step-complete');
    return;
  }
  index.value++;
  phase.value = 'listen';
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
.auditory-drill-step { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem; }
.step-title { color: #FF8C00; font-size: 1.2rem; margin: 0; }
.prompt-text { font-size: 1.1rem; color: #E0E0E0; text-align: center; }
.prompt-text.success { color: #64FFDA; }
.prompt-text.wrong { color: #FF6B6B; }
.choices { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; }
.choice-btn {
  width: 70px;
  height: 70px;
  font-size: 2rem;
  font-weight: bold;
  border: 2px solid rgba(255, 140, 0, 0.3);
  background: rgba(30, 41, 59, 0.7);
  color: #FF8C00;
  border-radius: 1rem;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.2s;
  font-family: inherit;
}
.choice-btn:hover { transform: scale(1.1); border-color: #FF8C00; }
.controls { display: flex; gap: 0.75rem; }
.audio-btn, .next-btn {
  background: rgba(255, 140, 0, 0.15);
  border: 1.5px solid #FF8C00;
  color: #FF8C00;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}
.audio-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.item-progress { color: #666; font-size: 0.75rem; }
</style>
