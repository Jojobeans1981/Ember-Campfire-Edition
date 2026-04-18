<template>
  <div class="lesson-player">
    <div v-if="!lesson" class="loading">Loading lesson…</div>

    <template v-else>
      <nav class="step-trail" :aria-label="trailAriaLabel">
        <span
          v-for="dot in progressDots"
          :key="dot.key"
          class="step-dot"
          :class="{ active: dot.state === 'active', done: dot.state === 'done' }"
          :aria-current="dot.state === 'active' ? 'step' : undefined"
          :aria-label="dot.ariaLabel"
        ></span>
      </nav>

      <div class="lesson-content">
        <EmberMascot :speaking="ember.isSpeaking.value" />

        <component
          :is="currentStepComponent"
          v-if="currentStepData"
          :step="currentStepData"
          :lesson-id="props.unitId"
          :lesson-phoneme="lesson?.phoneme ?? ''"
          :key="currentStepKey"
          @step-complete="onStepComplete"
          @phase-change="onPhaseChange"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, defineProps, defineEmits } from 'vue';
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
// Per-step phase state, keyed by stepKey. Steps that don't emit
// phase-change default to a single dot.
const stepPhases = reactive({});

function onPhaseChange(payload) {
  const key = currentStepKey.value;
  if (!key || !payload) return;
  const phaseCount = Math.max(1, Number(payload.phaseCount) || 1);
  const phaseIndex = Math.max(0, Math.min(phaseCount - 1, Number(payload.phaseIndex) || 0));
  stepPhases[key] = { phaseCount, phaseIndex };
}

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

const progressDots = computed(() => {
  const steps = activeSteps.value;
  const dots = [];
  for (let i = 0; i < steps.length; i++) {
    const key = steps[i];
    const phase = stepPhases[key];
    const count = phase?.phaseCount ?? 1;
    const currentPhase = phase?.phaseIndex ?? 0;
    const label = stepLabelByKey[key] ?? `Step ${i + 1}`;
    for (let p = 0; p < count; p++) {
      let state = 'upcoming';
      if (i < currentStepIndex.value) state = 'done';
      else if (i === currentStepIndex.value) {
        if (p < currentPhase) state = 'done';
        else if (p === currentPhase) state = 'active';
      }
      dots.push({
        key: `${key}-${p}`,
        state,
        ariaLabel: count > 1 ? `${label} Part ${p + 1} of ${count}.` : `${label}`,
      });
    }
  }
  return dots;
});

const trailAriaLabel = computed(() => {
  const total = progressDots.value.length;
  const done = progressDots.value.filter((d) => d.state === 'done').length;
  return `Lesson progress: ${done + 1} of ${total}.`;
});

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
  gap: 10px;
  padding: 12px 6px 6px;
  width: 100%;
}

.step-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: transparent;
  border: 2px solid rgba(255, 209, 102, 0.3);
  transition:
    background 220ms ease,
    border-color 220ms ease,
    transform 220ms ease,
    box-shadow 220ms ease;
}

.step-dot.done {
  background: rgba(126, 232, 136, 0.85);
  border-color: rgba(126, 232, 136, 0.95);
}

.step-dot.active {
  background: #ffd166;
  border-color: #ffd166;
  transform: scale(1.35);
  box-shadow: 0 0 0 4px rgba(255, 209, 102, 0.22), 0 0 14px rgba(255, 209, 102, 0.45);
}

.lesson-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}
</style>
