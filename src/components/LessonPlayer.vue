<template>
  <div class="lesson-player">
    <div class="lesson-header">
      <h2>{{ lesson.phonemes.map(p => p.toUpperCase()).join(' & ') }}</h2>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div class="step-label">Step {{ currentStepIndex + 1 }} of {{ lesson.steps.length }}</div>
    </div>

    <div class="lesson-content">
      <EmberMascot :speaking="ember.isSpeaking.value" :text="ember.currentText.value" />

      <component
        :is="currentStepComponent"
        v-if="currentStep"
        :step="currentStep"
        :unitId="unitId"
        @step-complete="onStepComplete"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits } from 'vue';
import { getLessonForUnit } from '../data/lessons.js';
import { useEmber } from '../composables/useEmber.js';
import EmberMascot from './ui/EmberMascot.vue';
import IntroStep from './lesson-steps/IntroStep.vue';
import VisualDrillStep from './lesson-steps/VisualDrillStep.vue';
import AuditoryDrillStep from './lesson-steps/AuditoryDrillStep.vue';
import BlendingStep from './lesson-steps/BlendingStep.vue';
import WordReadingStep from './lesson-steps/WordReadingStep.vue';
import ReviewStep from './lesson-steps/ReviewStep.vue';

const props = defineProps({ unitId: { type: String, required: true } });
const emit = defineEmits(['complete']);

const ember = useEmber();
const lesson = getLessonForUnit(props.unitId);
const currentStepIndex = ref(0);

const stepComponents = {
  intro: IntroStep,
  visual_drill: VisualDrillStep,
  auditory_drill: AuditoryDrillStep,
  blending: BlendingStep,
  word_reading: WordReadingStep,
  review: ReviewStep,
};

const currentStep = computed(() => lesson?.steps[currentStepIndex.value] || null);
const currentStepComponent = computed(() => {
  if (!currentStep.value) return null;
  return stepComponents[currentStep.value.type] || null;
});

const progressPercent = computed(() => {
  if (!lesson) return 0;
  return Math.round((currentStepIndex.value / lesson.steps.length) * 100);
});

function onStepComplete() {
  ember.stopSpeaking();
  if (currentStepIndex.value < lesson.steps.length - 1) {
    currentStepIndex.value++;
  } else {
    emit('complete');
  }
}
</script>

<style scoped>
.lesson-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 500px;
  padding: 1rem;
}

.lesson-header {
  width: 100%;
  text-align: center;
}

.lesson-header h2 {
  color: #FF8C00;
  margin: 0 0 0.5rem;
  font-size: 1.3rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #FF8C00;
  transition: width 0.3s ease;
}

.step-label {
  font-size: 0.75rem;
  color: #888;
  margin-top: 0.25rem;
}

.lesson-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}
</style>
