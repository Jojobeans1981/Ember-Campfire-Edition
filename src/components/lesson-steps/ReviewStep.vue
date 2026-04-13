<template>
  <div class="review-step">
    <div class="review-header">Review Time!</div>

    <!-- Visual drill review -->
    <div v-if="currentItem?.type === 'visual_drill'" class="review-item">
      <div class="big-letter">{{ currentItem.grapheme.toUpperCase() }}</div>
      <div v-if="reviewPhase === 'prompt'" class="mic-area">
        <div class="mic-icon">🎤</div>
        <div>What sound does this make?</div>
      </div>
      <div v-if="reviewPhase === 'done'" class="success">Great!</div>
    </div>

    <!-- Auditory drill review -->
    <div v-if="currentItem?.type === 'auditory_drill'" class="review-item">
      <div v-if="reviewPhase === 'listen'" class="listen-text">Listen...</div>
      <div v-if="reviewPhase === 'pick'" class="choices">
        <button
          v-for="c in auditoryChoices"
          :key="c"
          class="choice-btn"
          @click="pickAuditory(c)"
        >{{ c.toUpperCase() }}</button>
      </div>
      <div v-if="reviewPhase === 'done'" class="success">Correct!</div>
    </div>

    <!-- Blending review -->
    <div v-if="currentItem?.type === 'blending'" class="review-item">
      <div class="blend-tiles">
        <span v-for="(seg, i) in currentItem.segments" :key="i" class="blend-tile">
          {{ seg.toUpperCase() }}
        </span>
      </div>
      <div v-if="reviewPhase === 'prompt'" class="prompt-text">Blend these sounds!</div>
      <div v-if="reviewPhase === 'done'" class="word-result">{{ currentItem.word }}</div>
    </div>

    <div class="item-progress">
      {{ currentIndex + 1 }} / {{ step.items.length }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';

const props = defineProps({ step: Object, unitId: String });
const emit = defineEmits(['step-complete']);

const ember = useEmber();
const { startListening } = useSpeechRecognition();

const currentIndex = ref(0);
const currentItem = ref(null);
const reviewPhase = ref('prompt');
const auditoryChoices = ref([]);
let resolveAuditory = null;
let cancelled = false;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickAuditory(choice) {
  if (resolveAuditory) resolveAuditory(choice);
}

async function runItem(item) {
  if (cancelled) return;
  currentItem.value = item;

  if (item.type === 'visual_drill') {
    reviewPhase.value = 'prompt';
    await ember.speak('What sound does this letter make?');
    await startListening(item.phonemeAudio || item.grapheme, 4000);
    if (cancelled) return;
    reviewPhase.value = 'done';
    await ember.speak('Great!');
  } else if (item.type === 'auditory_drill') {
    reviewPhase.value = 'listen';
    await ember.speak('Listen.');
    await ember.playPhoneme(item.targetPhoneme);
    if (cancelled) return;
    reviewPhase.value = 'pick';
    auditoryChoices.value = shuffle([item.targetPhoneme, ...item.distractors]);
    const chosen = await new Promise(r => { resolveAuditory = r; });
    resolveAuditory = null;
    reviewPhase.value = 'done';
    if (chosen === item.targetPhoneme) {
      await ember.speak('Yes!');
    } else {
      await ember.speak(`It was ${item.targetPhoneme.toUpperCase()}.`);
    }
  } else if (item.type === 'blending') {
    reviewPhase.value = 'prompt';
    await ember.speak('Blend these sounds.');
    for (const seg of item.segments) {
      await ember.playPhoneme(seg);
      await new Promise(r => setTimeout(r, 200));
    }
    if (cancelled) return;
    reviewPhase.value = 'done';
    await ember.speak(item.word);
  }

  await new Promise(r => setTimeout(r, 600));
}

onMounted(async () => {
  await ember.speak("Let's review what we learned!");
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
  resolveAuditory = null;
});
</script>

<style scoped>
.review-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.review-header {
  font-size: 1.2rem;
  color: #FF8C00;
}

.review-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.big-letter {
  font-size: 5rem;
  color: #FF8C00;
  font-weight: bold;
}

.mic-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  color: #aaa;
}

.mic-icon {
  font-size: 2rem;
}

.success {
  color: #64FFDA;
  font-size: 1.2rem;
}

.listen-text {
  font-size: 1.1rem;
  color: #aaa;
}

.choices {
  display: flex;
  gap: 0.5rem;
}

.choice-btn {
  width: 60px;
  height: 60px;
  font-size: 1.8rem;
  font-weight: bold;
  border: 2px solid rgba(255, 140, 0, 0.3);
  background: rgba(30, 41, 59, 0.7);
  color: #FF8C00;
  border-radius: 0.75rem;
  cursor: pointer;
  font-family: inherit;
}

.choice-btn:hover { border-color: #FF8C00; }

.blend-tiles {
  display: flex;
  gap: 0.4rem;
}

.blend-tile {
  font-size: 2rem;
  color: #FF8C00;
  background: rgba(255, 140, 0, 0.15);
  padding: 0.3rem 0.6rem;
  border-radius: 0.5rem;
}

.prompt-text { color: #aaa; }

.word-result {
  font-size: 2rem;
  color: #64FFDA;
  font-weight: bold;
}

.item-progress {
  color: #666;
  font-size: 0.75rem;
}
</style>
