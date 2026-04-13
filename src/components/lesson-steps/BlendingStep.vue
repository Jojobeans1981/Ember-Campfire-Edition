<template>
  <div class="blending-step">
    <div class="prompt-text">Tap each letter to sound it out!</div>

    <div class="letter-tiles" v-if="currentItem">
      <button
        v-for="(seg, idx) in currentItem.segments"
        :key="idx"
        class="tile"
        :class="{ tapped: tappedIndex > idx, current: tappedIndex === idx }"
        @click="tapTile(idx)"
      >
        {{ seg.toUpperCase() }}
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

  // Say the word slowly then normally
  showWord.value = true;
  phase.value = 'done';
  await ember.speak(item.word);
  await new Promise(r => setTimeout(r, 800));
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

.prompt-text {
  font-size: 1rem;
  color: #aaa;
}

.letter-tiles {
  display: flex;
  gap: 0.5rem;
}

.tile {
  width: 65px;
  height: 65px;
  font-size: 2rem;
  font-weight: bold;
  border: 2px solid rgba(255, 255, 255, 0.1);
  background: rgba(30, 41, 59, 0.7);
  color: #888;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.tile.current {
  border-color: #FF8C00;
  color: #FF8C00;
  animation: bounce 0.8s ease-in-out infinite;
}

.tile.tapped {
  background: rgba(255, 140, 0, 0.2);
  color: #FF8C00;
  border-color: rgba(255, 140, 0, 0.4);
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.word-reveal {
  font-size: 2.5rem;
  color: #64FFDA;
  font-weight: bold;
}

.blend-status {
  font-size: 1rem;
  color: #aaa;
}

.blend-status.success {
  color: #64FFDA;
  font-size: 1.2rem;
}

.item-progress {
  color: #666;
  font-size: 0.75rem;
}
</style>
