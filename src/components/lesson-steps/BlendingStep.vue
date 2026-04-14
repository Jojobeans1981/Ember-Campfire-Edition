<template>
  <div class="blending-step">
    <!-- UFLI mode: word chain + tile pools -->
    <div v-if="ufliMode" class="ufli-mode">
      <div class="prompt-text">Build each word with the tiles!</div>

      <div class="chain-display">
        <div class="current-word">{{ currentChainWord }}</div>
      </div>

      <div v-if="hasTiles" class="tile-pools">
        <div v-if="tiles.initial?.length" class="tile-row">
          <span class="tile-label">start</span>
          <button v-for="t in tiles.initial" :key="`i-${t}`" class="tile" @click="playTile(t)">{{ t }}</button>
        </div>
        <div v-if="tiles.medial?.length" class="tile-row">
          <span class="tile-label">middle</span>
          <button v-for="t in tiles.medial" :key="`m-${t}`" class="tile vowel" @click="playTile(t)">{{ t }}</button>
        </div>
        <div v-if="tiles.final?.length" class="tile-row">
          <span class="tile-label">end</span>
          <button v-for="t in tiles.final" :key="`f-${t}`" class="tile" @click="playTile(t)">{{ t }}</button>
        </div>
      </div>

      <button class="audio-btn" @click="speakCurrentWord">🔊 Hear the word</button>

      <div class="controls">
        <div class="progress">{{ chainIndex + 1 }} / {{ wordChain.length }}</div>
        <button class="next-btn" @click="nextChainWord">{{ isLastChain ? 'Done' : 'Next' }}</button>
      </div>
    </div>

    <!-- Legacy mode: items[] with audio loop (kept for backward compat) -->
    <div v-else>
      <div class="prompt-text">Tap each letter to sound it out!</div>

      <div class="letter-tiles" v-if="currentItem">
        <button
          v-for="(seg, idx) in currentItem.segments"
          :key="idx"
          class="tile"
          :class="{ tapped: tappedIndex > idx, current: tappedIndex === idx }"
          @click="tapTile(idx)"
        >
          {{ seg }}
        </button>
      </div>

      <div class="word-reveal" v-if="showWord">
        {{ currentItem?.word }}
      </div>

      <div class="blend-status" v-if="phase === 'blending'">
        Now blend them together!
      </div>
      <div class="blend-status success" v-else-if="phase === 'done'">
        {{ currentItem?.word }}!
      </div>

      <div class="item-progress">
        {{ currentIndex + 1 }} / {{ step.items?.length || 0 }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useEmber } from '../../composables/useEmber.js';

const props = defineProps({ step: Object, unitId: String });
const emit = defineEmits(['step-complete']);

const ufliMode = computed(() => Array.isArray(props.step?.wordChain));
const wordChain = computed(() => props.step?.wordChain ?? []);
const tiles = computed(() => props.step?.tiles ?? {});
const hasTiles = computed(() =>
  (tiles.value.initial?.length || 0) +
  (tiles.value.medial?.length || 0) +
  (tiles.value.final?.length || 0) > 0
);

const chainIndex = ref(0);
const currentChainWord = computed(() => wordChain.value[chainIndex.value] ?? '');
const isLastChain = computed(() => chainIndex.value >= wordChain.value.length - 1);

async function nextChainWord() {
  if (wordChain.value.length === 0 || isLastChain.value) {
    emit('step-complete');
    return;
  }
  chainIndex.value++;
  await speakCurrentWord();
}

async function speakCurrentWord() {
  const w = currentChainWord.value;
  if (!w) return;
  // Sound out: each letter, then the whole word
  for (const ch of w.toLowerCase()) {
    if (/[a-z]/.test(ch)) await ember.playPhoneme(ch);
  }
  await ember.speak(w);
}

async function playTile(letter) {
  await ember.playPhoneme(letter);
}

// --- legacy mode below ---
const ember = useEmber();
const currentIndex = ref(0);
const currentItem = ref(null);
const tappedIndex = ref(-1);
const showWord = ref(false);
const phase = ref('tapping');
let resolveTap = null;
let cancelled = false;

function tapTile(idx) {
  if (idx === tappedIndex.value && resolveTap) {
    resolveTap();
  }
}

async function runItem(item) {
  if (cancelled) return;
  currentItem.value = item;
  tappedIndex.value = 0;
  showWord.value = false;
  phase.value = 'tapping';

  await ember.speak('Tap each letter.');

  for (let i = 0; i < item.segments.length; i++) {
    if (cancelled) return;
    tappedIndex.value = i;
    await new Promise(r => { resolveTap = r; });
    resolveTap = null;
    await ember.playPhoneme(item.segments[i]);
  }
  tappedIndex.value = item.segments.length;

  if (cancelled) return;
  phase.value = 'blending';
  await ember.speak('Now blend them together.');
  await new Promise(r => setTimeout(r, 300));

  showWord.value = true;
  phase.value = 'done';
  await ember.speak(item.word);
  await new Promise(r => setTimeout(r, 800));
}

onMounted(async () => {
  if (ufliMode.value) {
    if (wordChain.value.length > 0) await speakCurrentWord();
    return;
  }
  if (!Array.isArray(props.step?.items)) return;
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
  resolveTap = null;
});
</script>

<style scoped>
.blending-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.ufli-mode { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.chain-display { display: flex; flex-direction: column; align-items: center; }
.current-word { font-size: 3rem; color: #64FFDA; font-weight: bold; letter-spacing: 0.1em; }
.tile-pools { display: flex; flex-direction: column; gap: 0.5rem; }
.tile-row { display: flex; align-items: center; gap: 0.4rem; }
.tile-label { font-size: 0.7rem; color: #888; min-width: 50px; }
.controls { display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; }
.progress { color: #666; font-size: 0.8rem; }
.next-btn {
  background: rgba(255, 140, 0, 0.15);
  border: 1.5px solid #FF8C00;
  color: #FF8C00;
  padding: 0.5rem 1.25rem;
  border-radius: 1.5rem;
  font-family: inherit;
  cursor: pointer;
}

.prompt-text { font-size: 1rem; color: #aaa; }
.letter-tiles { display: flex; gap: 0.5rem; }

.tile {
  width: 65px;
  height: 65px;
  font-size: 2rem;
  font-weight: bold;
  border: 2px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.7);
  color: #FF8C00;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.tile.vowel { color: #64FFDA; border-color: rgba(100, 255, 218, 0.3); }
.tile.current { border-color: #FF8C00; animation: bounce 0.8s ease-in-out infinite; }
.tile.tapped { background: rgba(255, 140, 0, 0.2); color: #FF8C00; border-color: rgba(255, 140, 0, 0.4); }

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.word-reveal { font-size: 2.5rem; color: #64FFDA; font-weight: bold; }
.blend-status { font-size: 1rem; color: #aaa; }
.blend-status.success { color: #64FFDA; font-size: 1.2rem; }
.item-progress { color: #666; font-size: 0.75rem; }
</style>
