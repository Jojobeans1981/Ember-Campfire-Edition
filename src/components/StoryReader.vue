<template>
  <div class="story-reader">
    <h2 class="story-title">{{ story.title }}</h2>

    <div class="page" v-if="currentPage">
      <div class="page-text">
        <span
          v-for="(word, idx) in pageWords"
          :key="idx"
          class="story-word"
          :class="{ highlighted: highlightIdx === idx }"
          @click="tapWord(idx)"
        >{{ word }} </span>
      </div>
    </div>

    <div class="page-nav">
      <button class="page-btn" :disabled="pageIndex === 0" @click="prevPage">Back</button>
      <span class="page-num">{{ pageIndex + 1 }} / {{ story.pages.length }}</span>
      <button v-if="pageIndex < story.pages.length - 1" class="page-btn" @click="nextPage">Next</button>
      <button v-else class="page-btn finish-btn" @click="finish">Done!</button>
    </div>

    <div class="story-controls">
      <button class="control-btn" @click="readToMe">🔊 Read to me</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { STORIES } from '../data/stories.js';
import { UNITS } from '../data/curriculum.js';
import { useEmber } from '../composables/useEmber.js';

const props = defineProps({ unitId: { type: String, required: true } });
const emit = defineEmits(['complete']);

const ember = useEmber();

const unit = UNITS.find(u => u.unitId === props.unitId);
const story = STORIES[unit.storyId];
const pageIndex = ref(0);
const highlightIdx = ref(-1);
let cancelled = false;

const currentPage = computed(() => story.pages[pageIndex.value]);
const pageWords = computed(() => {
  if (!currentPage.value) return [];
  return currentPage.value.text.split(/\s+/);
});

function prevPage() {
  if (pageIndex.value > 0) pageIndex.value--;
}

function nextPage() {
  if (pageIndex.value < story.pages.length - 1) pageIndex.value++;
}

async function tapWord(idx) {
  highlightIdx.value = idx;
  const word = pageWords.value[idx].replace(/[^a-zA-Z]/g, '');
  await ember.speak(word);
  highlightIdx.value = -1;
}

async function readToMe() {
  for (let i = 0; i < pageWords.value.length; i++) {
    if (cancelled) return;
    highlightIdx.value = i;
    const word = pageWords.value[i].replace(/[^a-zA-Z]/g, '');
    await ember.speak(word);
    await new Promise(r => setTimeout(r, 150));
  }
  highlightIdx.value = -1;
}

function finish() {
  emit('complete');
}

onBeforeUnmount(() => {
  cancelled = true;
  ember.stopSpeaking();
});
</script>

<style scoped>
.story-reader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 500px;
  width: 100%;
}

.story-title {
  color: #FF8C00;
  margin: 0;
  font-size: 1.5rem;
}

.page {
  background: rgba(30, 41, 59, 0.7);
  border-radius: 1rem;
  padding: 2rem;
  width: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-text {
  font-size: 2rem;
  line-height: 1.8;
  text-align: center;
}

.story-word {
  cursor: pointer;
  padding: 0.1rem 0.2rem;
  border-radius: 0.25rem;
  transition: background 0.2s, color 0.2s;
}

.story-word:hover {
  background: rgba(255, 140, 0, 0.15);
}

.story-word.highlighted {
  background: rgba(255, 140, 0, 0.3);
  color: #FF8C00;
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.page-btn {
  background: rgba(100, 255, 218, 0.1);
  border: 2px solid rgba(100, 255, 218, 0.3);
  color: #64FFDA;
  padding: 0.5rem 1.5rem;
  border-radius: 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  font-family: inherit;
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.finish-btn {
  background: rgba(255, 140, 0, 0.2);
  border-color: #FF8C00;
  color: #FF8C00;
}

.page-num {
  color: #888;
  font-size: 0.85rem;
}

.story-controls {
  display: flex;
  gap: 0.75rem;
}

.control-btn {
  background: rgba(255, 140, 0, 0.15);
  border: 2px solid rgba(255, 140, 0, 0.3);
  color: #FF8C00;
  padding: 0.5rem 1rem;
  border-radius: 1.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  font-family: inherit;
}
</style>
