<template>
  <div class="lesson-player">
    <div v-if="!lesson" class="loading">Loading lesson…</div>

    <template v-else>
      <div class="lesson-header">
        <h2>{{ headerTitle }}</h2>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="step-label">Step {{ currentStepIndex + 1 }} of {{ activeSteps.length }}</div>
      </div>

      <div class="lesson-content">
        <EmberMascot :speaking="ember.isSpeaking.value" :text="ember.currentText.value" />

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

/**
 * Skip a step when its content has nothing meaningful for the kid to do.
 * Single-letter "wordChain" entries in step 4/6 are not worth showing,
 * step 1 needs at least one blend item, etc.
 */
function hasAtLeastNLetters(lessonData, minimum) {
  const letters = new Set();
  for (const word of lessonData?.wordList ?? []) {
    for (const ch of String(word).toLowerCase()) {
      if (/[a-z]/.test(ch)) letters.add(ch);
    }
  }
  return letters.size >= minimum;
}

function isStepWorthShowing(key, data, lessonData) {
  if (!data) return false;
  switch (key) {
    case 'step1': {
      if (!hasAtLeastNLetters(lessonData, 2)) return false;
      const blend = data.blend ?? [];
      const segment = data.segment ?? [];
      const hasRealBlend = blend.some((item) => (item?.phonemes?.length ?? 0) >= 2);
      const hasRealSegment = segment.some((item) => String(item?.word ?? '').replace(/[^a-z]/gi, '').length >= 2);
      return hasRealBlend || hasRealSegment;
    }
    case 'step2':
    case 'step3': {
      return (data.items ?? []).length > 0;
    }
    case 'step4': {
      const chain = data.wordChain ?? [];
      // Only show if there's at least one multi-letter word to blend
      return chain.some((w) => typeof w === 'string' && w.length >= 2);
    }
    case 'step5': {
      const script = data.introductionScript ?? [];
      return script.length > 0;
    }
    case 'step6': {
      const chain = data.wordChain ?? [];
      // Only show word work if there's at least one multi-letter word
      return chain.some((w) => typeof w === 'string' && w.length >= 2);
    }
    case 'step7': {
      if (!hasAtLeastNLetters(lessonData, 3)) return false;
      const review = data.review ?? [];
      const teach = data.teach ?? [];
      return review.length > 0 || teach.length > 0;
    }
    case 'step8': {
      if (!hasAtLeastNLetters(lessonData, 3)) return false;
      const read = data.readSentences ?? [];
      const spell = data.spellSentences ?? [];
      // Skip step 8 if both lists are empty OR every entry is a single letter
      const hasReal = (arr) => arr.some((s) => typeof s === 'string' && s.replace(/[^a-zA-Z]/g, '').length >= 2);
      return hasReal(read) || hasReal(spell);
    }
    default:
      return true;
  }
}

const activeSteps = computed(() => {
  const l = lesson.value;
  if (!l) return [];
  return STEP_KEYS.filter((k) => isStepWorthShowing(k, l[k], l));
});

const currentStepKey = computed(() => activeSteps.value[currentStepIndex.value] ?? null);
const currentStepData = computed(() => (currentStepKey.value ? lesson.value?.[currentStepKey.value] : null));
const currentStepComponent = computed(() => (currentStepKey.value ? stepComponentByKey[currentStepKey.value] : null));

function stripIpa(text) {
  if (!text) return '';
  return String(text)
    .replace(/\/[^/]*\//g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

const headerTitle = computed(() => {
  const l = lesson.value;
  if (!l) return '';
  if (l.grapheme && /^[a-z]$/i.test(l.grapheme)) {
    return `Letter ${l.grapheme.toUpperCase()}`;
  }
  if (l.grapheme) return l.grapheme.toLowerCase();
  return stripIpa(l.title) || `Lesson ${l.lessonNumber}`;
});

const progressPercent = computed(() => {
  const total = activeSteps.value.length;
  if (total === 0) return 0;
  return Math.round((currentStepIndex.value / total) * 100);
});

function onStepComplete() {
  ember.stopSpeaking();
  if (currentStepIndex.value < activeSteps.value.length - 1) {
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
