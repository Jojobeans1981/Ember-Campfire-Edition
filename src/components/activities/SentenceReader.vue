<template>
  <div class="sentence-reader">
    <h3>Read the Sentence!</h3>

    <div class="sentence" v-if="currentSentence">
      <span
        v-for="(word, idx) in currentWords"
        :key="idx"
        class="word"
        :class="{ highlighted: highlightIdx === idx }"
        @click="tapWord(idx)"
      >{{ word }} </span>
    </div>

    <div v-if="phase === 'read'" class="instruction">
      Tap each word to hear it, then read the whole sentence!
    </div>

    <div v-if="phase === 'listen'" class="mic-area">
      <div class="mic-icon">🎤</div>
      <div>Now read it aloud!</div>
      <div class="sustain-meter">
        <div class="sustain-fill" :style="{ width: micProgress + '%' }"></div>
      </div>
    </div>

    <div v-if="phase === 'success'" class="success">Great reading!</div>

    <button v-if="phase === 'read'" class="read-btn" @click="attemptRead">
      I can read it!
    </button>

    <button v-if="phase === 'read'" class="hear-btn" @click="readToMe">
      🔊 Read to me
    </button>

    <div class="progress-info">{{ completed }} / {{ targetCount }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useProgression } from '../../composables/useProgression.js';
import { getDecodableWords } from '../../data/wordLists.js';
import { useEmber } from '../../composables/useEmber.js';
import { useSpeechRecognition } from '../../composables/useSpeechRecognition.js';

const props = defineProps({ unitId: String, activityType: String });
const emit = defineEmits(['complete']);

const { getPhonemesForUnit } = useProgression();
const ember = useEmber();
const { startWordListening, sustainProgress: micProgress, requestMicPermission, cancelListening } = useSpeechRecognition();

const allPhonemes = getPhonemesForUnit(props.unitId);
const words = getDecodableWords(allPhonemes);

const currentSentence = ref('');
const currentWords = ref([]);
const highlightIdx = ref(-1);
const phase = ref('read');
const completed = ref(0);
const targetCount = 3;
let cancelled = false;

function buildSentence() {
  if (words.length < 2) {
    currentSentence.value = words[0]?.word || 'a';
    currentWords.value = [currentSentence.value];
    return;
  }
  const count = 2 + Math.floor(Math.random() * 3);
  const picked = [];
  for (let i = 0; i < count && i < words.length; i++) {
    picked.push(words[Math.floor(Math.random() * words.length)].word);
  }
  currentWords.value = picked;
  currentSentence.value = picked.join(' ');
  highlightIdx.value = -1;
  phase.value = 'read';
}

async function tapWord(idx) {
  highlightIdx.value = idx;
  const word = currentWords.value[idx].replace(/[^a-zA-Z]/g, '');
  await ember.speak(word);
  highlightIdx.value = -1;
}

async function readToMe() {
  for (let i = 0; i < currentWords.value.length; i++) {
    if (cancelled) return;
    highlightIdx.value = i;
    const word = currentWords.value[i].replace(/[^a-zA-Z]/g, '');
    await ember.speak(word);
    await new Promise(r => setTimeout(r, 200));
  }
  highlightIdx.value = -1;
}

async function attemptRead() {
  phase.value = 'listen';
  const result = await startWordListening(currentSentence.value, 10000);

  if (cancelled) return;
  phase.value = 'success';
  completed.value++;
  await ember.speak('Great reading!');
  await new Promise(r => setTimeout(r, 800));

  if (completed.value >= targetCount) {
    emit('complete');
  } else {
    buildSentence();
  }
}

onMounted(async () => {
  await requestMicPermission();
  buildSentence();
});

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
  cancelListening();
});
</script>

<style scoped>
.sentence-reader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

h3 { color: #FF8C00; margin: 0; }

.sentence {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  padding: 1rem;
}

.word {
  font-size: 2rem;
  color: #E0E0E0;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 0.3rem;
  transition: background 0.2s, color 0.2s;
}

.word:hover { background: rgba(255,140,0,0.15); }
.word.highlighted { background: rgba(255,140,0,0.3); color: #FF8C00; }

.instruction { color: #aaa; font-size: 0.9rem; text-align: center; }

.mic-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  color: #64FFDA;
}

.mic-icon { font-size: 2.5rem; }

.sustain-meter {
  width: 200px;
  height: 10px;
  background: #333;
  border-radius: 5px;
  overflow: hidden;
}

.sustain-fill {
  height: 100%;
  background: #FF8C00;
  transition: width 0.1s;
}

.success { color: #64FFDA; font-size: 1.2rem; }

.read-btn, .hear-btn {
  padding: 0.6rem 1.5rem;
  border-radius: 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  font-family: inherit;
}

.read-btn {
  background: rgba(100,255,218,0.15);
  border: 2px solid #64FFDA;
  color: #64FFDA;
}

.hear-btn {
  background: rgba(255,140,0,0.15);
  border: 2px solid rgba(255,140,0,0.3);
  color: #FF8C00;
}

.progress-info { color: #888; font-size: 0.85rem; }
</style>
