<template>
  <div class="lesson-player">
    <div v-if="!lesson" class="loading">Loading lesson…</div>

    <template v-else>
      <nav class="step-trail" aria-label="Lesson progress">
        <span
          v-for="(key, i) in activeSteps"
          :key="key"
          class="step-cell"
        >
          <span
            class="step-box"
            :class="{ active: i === currentStepIndex, done: i < currentStepIndex }"
            :aria-current="i === currentStepIndex ? 'step' : undefined"
            :aria-label="stepAriaLabel(key, i)"
          >{{ i + 1 }}</span>
          <span v-if="i < activeSteps.length - 1" class="step-arrow" aria-hidden="true">→</span>
        </span>
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
import { ref, computed, onMounted, watch, defineProps, defineEmits } from 'vue';
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

// These labels are pre-generated as Jasmine clips in tts-manifest.json
// (see scripts/generate-tts-inventory.mjs). Changing a label here without
// regenerating the manifest will fall through to browser speechSynthesis.
const stepLabelByKey = {
  step1: 'Hear sounds.',
  step2: 'See the letter.',
  step3: 'Match the sound.',
  step4: 'Blend sounds.',
  step5: 'Learn the letter.',
  step6: 'Word work.',
  step7: 'Tricky words.',
  step8: 'Read sentences.',
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

function stepAriaLabel(key, i) {
  const label = stepLabelByKey[key] ?? `Step ${i + 1}`;
  return `${label} Step ${i + 1} of ${activeSteps.value.length}.`;
}

// Announce each step with Jasmine as it becomes active. Fires on initial
// lesson load and on each advance; the step component's own prompts queue
// after this via the priority-based speech queue in useEmber.
watch(currentStepKey, (newKey) => {
  if (!newKey) return;
  const label = stepLabelByKey[newKey];
  if (label) void ember.speak(label, { priority: 'instruction' });
});

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
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 10px 6px 4px;
  width: 100%;
}

.step-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.step-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  padding: 0 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 2px solid rgba(255, 209, 102, 0.25);
  color: rgba(255, 244, 220, 0.6);
  font-family: inherit;
  font-weight: 800;
  font-size: 1.2rem;
  line-height: 1;
  transition:
    background 220ms ease,
    border-color 220ms ease,
    color 220ms ease,
    transform 220ms ease,
    box-shadow 220ms ease;
}

.step-box.done {
  background: rgba(126, 232, 136, 0.28);
  border-color: rgba(126, 232, 136, 0.8);
  color: #e6fff0;
}

.step-box.active {
  background: rgba(255, 209, 102, 0.22);
  border-color: #ffd166;
  color: #fff4dc;
  transform: scale(1.15);
  box-shadow: 0 0 0 4px rgba(255, 209, 102, 0.22), 0 0 18px rgba(255, 209, 102, 0.35);
}

.step-arrow {
  color: rgba(255, 209, 102, 0.45);
  font-size: 1.1rem;
  font-weight: 700;
  padding: 0 2px;
  user-select: none;
}

.lesson-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}
</style>
