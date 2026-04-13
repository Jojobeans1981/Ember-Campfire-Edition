<template>
  <div class="activity-player">
    <component
      :is="activityComponent"
      :unitId="unitId"
      :activityType="activityType"
      @complete="$emit('complete')"
    />
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from 'vue';
import SpeechPractice from './activities/SpeechPractice.vue';
import LetterMatch from './activities/LetterMatch.vue';
import BlendingGame from './activities/BlendingGame.vue';
import WordBuilder from './activities/WordBuilder.vue';
import SentenceReader from './activities/SentenceReader.vue';

const props = defineProps({
  unitId: { type: String, required: true },
  activityType: { type: String, required: true },
});

defineEmits(['complete']);

const activityComponents = {
  speech: SpeechPractice,
  match: LetterMatch,
  blend: BlendingGame,
  build: WordBuilder,
  sentence: SentenceReader,
};

const activityComponent = computed(() => activityComponents[props.activityType]);
</script>

<style scoped>
.activity-player {
  width: 100%;
  max-width: 500px;
  display: flex;
  justify-content: center;
}
</style>
