<template>
  <div class="lesson-player">
    <div v-if="!lesson" class="loading">Loading lesson…</div>

    <template v-else>
      <nav class="step-trail" aria-label="Lesson progress">
        <span
          v-for="(key, i) in activeSteps"
          :key="key"
          class="step-dot"
          :class="{ active: i === currentStepIndex, done: i < currentStepIndex }"
          :aria-current="i === currentStepIndex ? 'step' : undefined"
          :aria-label="`Step ${i + 1} of ${activeSteps.length}`"
        />
      </nav>

      <div class="lesson-content">
        <EmberMascot :speaking="ember.isSpeaking.value" />

        <component
          :is="currentStepComponent"
          v-if="currentStepData"
          :step="currentStepData"
          :lesson-id="props.unitId"
          :key="currentStepKey"
          @step-complete="onStepComplete"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineProps, defineEmits } from 'vue';
import { getUfliLesson } from '../data/ufli/ufliLessons.js';
import { getRenderableUfliStepKeys } from '../data/ufli/lessonFlow.js';
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
const isAdvancing = ref(false);

onMounted(async () => {
  lesson.value = await getUfliLesson(props.unitId);
  if (!lesson.value || getRenderableUfliStepKeys(lesson.value).length === 0) {
    emit('complete');
  }
});

const activeSteps = computed(() => {
  const l = lesson.value;
  if (!l) return [];
  return getRenderableUfliStepKeys(l);
});

const currentStepKey = computed(() => activeSteps.value[currentStepIndex.value] ?? null);
const currentStepData = computed(() => (currentStepKey.value ? lesson.value?.[currentStepKey.value] : null));
const currentStepComponent = computed(() => (currentStepKey.value ? stepComponentByKey[currentStepKey.value] : null));

function onStepComplete() {
  if (isAdvancing.value) return;
  isAdvancing.value = true;
  ember.stopSpeaking();
  if (currentStepIndex.value < activeSteps.value.length - 1) {
    currentStepIndex.value++;
    setTimeout(() => { isAdvancing.value = false; }, 0);
  } else {
    void ember.speak('You finished the lesson! Great learning.', { priority: 'feedback' });
    emit('complete');
    setTimeout(() => { isAdvancing.value = false; }, 0);
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

.step-trail {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding: 6px 0 2px;
}

.step-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 2px solid rgba(255, 209, 102, 0.25);
  transition: background 180ms ease, transform 180ms ease, border-color 180ms ease;
}

.step-dot.done {
  background: rgba(126, 232, 136, 0.7);
  border-color: rgba(126, 232, 136, 0.8);
}

.step-dot.active {
  background: #ffd166;
  border-color: #ffd166;
  transform: scale(1.25);
  box-shadow: 0 0 0 4px rgba(255, 209, 102, 0.25);
}

.lesson-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}
</style>
