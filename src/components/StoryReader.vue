<template>
  <div class="story-reader">
    <h2 class="story-title">Connected Text</h2>
    <div v-if="!step8" class="loading">Loading…</div>
    <ConnectedTextStep v-else :step="step8" @step-complete="$emit('complete')" />
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits } from 'vue';
import { getUfliLesson } from '../data/ufli/ufliLessons.js';
import ConnectedTextStep from './lesson-steps/ConnectedTextStep.vue';

const props = defineProps({ unitId: { type: String, required: true } });
defineEmits(['complete']);

const step8 = ref(null);

onMounted(async () => {
  const lesson = await getUfliLesson(props.unitId);
  step8.value = lesson?.step8 ?? null;
});
</script>

<style scoped>
.story-reader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  width: 100%;
  max-width: 500px;
}

.story-title {
  color: #FF8C00;
  font-size: 1.4rem;
  margin: 0;
}

.loading { color: #888; }
</style>
