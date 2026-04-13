<template>
  <div class="auditory-drill-step">
    <div class="prompt-text" v-if="phase === 'listen'">
      Listen to the sound...
    </div>
    <div class="prompt-text" v-else-if="phase === 'pick'">
      Which letter makes that sound?
    </div>
    <div class="prompt-text success" v-else-if="phase === 'correct'">
      Correct!
    </div>
    <div class="prompt-text wrong" v-else-if="phase === 'wrong'">
      Try again! It was {{ currentItem?.targetPhoneme.toUpperCase() }}
    </div>

    <div class="choices" v-if="phase === 'pick'">
      <button
        v-for="choice in choices"
        :key="choice"
        class="choice-btn"
        @click="pickChoice(choice)"
      >
        {{ choice.toUpperCase() }}
      </button>
    </div>

    <div class="item-progress">
      {{ currentIndex + 1 }} / {{ step.items.length }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';

const props = defineProps({ step: Object, unitId: String });
const emit = defineEmits(['step-complete']);

const ember = useEmber();

const currentIndex = ref(0);
const currentItem = ref(null);
const choices = ref([]);
const phase = ref('listen');
let resolveChoice = null;
let cancelled = false;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickChoice(choice) {
  if (resolveChoice) resolveChoice(choice);
}

async function runItem(item) {
  if (cancelled) return;
  currentItem.value = item;
  phase.value = 'listen';

  await ember.speak('Listen carefully.');
  await ember.playPhoneme(item.targetPhoneme);
  await new Promise(r => setTimeout(r, 300));

  if (cancelled) return;
  phase.value = 'pick';
  choices.value = shuffle([item.targetPhoneme, ...item.distractors]);

  const chosen = await new Promise(r => { resolveChoice = r; });
  resolveChoice = null;

  if (chosen === item.targetPhoneme) {
    phase.value = 'correct';
    await ember.speak('Yes!');
  } else {
    phase.value = 'wrong';
    await ember.speak(`That was ${item.targetPhoneme.toUpperCase()}.`);
    await ember.playPhoneme(item.targetPhoneme);
  }

  await new Promise(r => setTimeout(r, 600));
}

onMounted(async () => {
  for (let i = 0; i < props.step.items.length; i++) {
    if (cancelled) return;
    currentIndex.value = i;
    await runItem(props.step.items[i]);
  }
  if (!cancelled) emit('step-complete');
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
  resolveChoice = null;
});
</script>

<style scoped>
.auditory-drill-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.prompt-text {
  font-size: 1.1rem;
  color: #E0E0E0;
  text-align: center;
}

.prompt-text.success { color: #64FFDA; }
.prompt-text.wrong { color: #FF6B6B; }

.choices {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

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

.choice-btn:hover {
  transform: scale(1.1);
  border-color: #FF8C00;
}

.item-progress {
  color: #666;
  font-size: 0.75rem;
}
</style>
