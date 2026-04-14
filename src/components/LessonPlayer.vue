<template>
  <div class="lesson-player">
    <div v-if="!lesson" class="loading">Loading lesson…</div>

    <template v-else>
      <div class="lesson-header">
        <h2>{{ headerTitle }}</h2>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="step-label">Step {{ currentStepIndex + 1 }} of {{ STEP_KEYS.length }}</div>
      </div>

      <div class="lesson-content">
        <EmberMascot :speaking="ember.isSpeaking.value" :text="ember.currentText.value" />

        <component
          :is="currentStepComponent"
          v-if="currentStepData"
          :step="currentStepData"
          :key="currentStepIndex"
          @step-complete="onStepComplete"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineProps, defineEmits } from 'vue';
import { getUfliLesson } from '../data/ufli/ufliLessons.js';
import { useEmber } from '../composables/useEmber.js';
import EmberMascot from './ui/EmberMascot.vue';
import PhonemicAwarenessStep from './lesson-steps/PhonemicAwarenessStep.vue';
import VisualDrillStep from './lesson-steps/VisualDrillStep.vue';
import AuditoryDrillStep from './lesson-steps/AuditoryDrillStep.vue';
import BlendingStep from './lesson-steps/BlendingStep.vue';
import NewConceptStep from './lesson-steps/NewConceptStep.vue';
import WordWorkStep from './lesson-steps/WordWorkStep.vue';
import IrregularWordsStep from './lesson-steps/IrregularWordsStep.vue';
import ConnectedTextStep from './lesson-steps/ConnectedTextStep.vue';

const props = defineProps({ unitId: { type: String, required: true } });
const emit = defineEmits(['complete']);

const ember = useEmber();

const STEP_KEYS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8'];

const stepComponentByKey = {
  step1: PhonemicAwarenessStep,
  step2: VisualDrillStep,
  step3: AuditoryDrillStep,
  step4: BlendingStep,
  step5: NewConceptStep,
  step6: WordWorkStep,
  step7: IrregularWordsStep,
  step8: ConnectedTextStep,
};

const lesson = ref(null);
const currentStepIndex = ref(0);

onMounted(async () => {
  lesson.value = await getUfliLesson(props.unitId);
  if (!lesson.value) {
    emit('complete');
  }
});

const currentStepKey = computed(() => STEP_KEYS[currentStepIndex.value]);
const currentStepData = computed(() => lesson.value?.[currentStepKey.value] ?? null);
const currentStepComponent = computed(() => stepComponentByKey[currentStepKey.value]);

const headerTitle = computed(() => {
  const l = lesson.value;
  if (!l) return '';
  if (l.grapheme) return l.grapheme;
  return l.title || `Lesson ${l.lessonNumber}`;
});

const progressPercent = computed(() =>
  Math.round((currentStepIndex.value / STEP_KEYS.length) * 100)
);

function onStepComplete() {
  ember.stopSpeaking();
  if (currentStepIndex.value < STEP_KEYS.length - 1) {
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

.loading { color: #888; padding: 2rem; }

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
