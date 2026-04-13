<template>
  <div class="lesson-player">
    <h2>{{ lesson.title }}</h2>
    <div v-for="(step, idx) in lesson.steps" :key="step.stepId">
      <div v-if="idx === currentStep">
        <h3>Step {{ idx + 1 }}: {{ step.type }}</h3>
        <div v-if="step.type === 'visual_drill'">
          <div class="visual-drill">
            <div class="letter">{{ step.items[0].grapheme }}</div>
          </div>
        </div>
        <div v-else-if="step.type === 'word_work'">
          <div class="word-work">
            <p>Word: {{ step.items[0].word }}</p>
          </div>
        </div>
        <button @click="nextStep">Next</button>
      </div>
    </div>
    <button v-if="currentStep >= lesson.steps.length" @click="finishLesson">Finish</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { LESSONS } from '../data/lessons';
import { skillState, store } from '../store';

const props = defineProps(['lessonId']);
const lesson = LESSONS[props.lessonId];
const currentStep = ref(0);

function nextStep() {
  currentStep.value++;
}

function finishLesson() {
  const phoneme = lesson.phoneme;
  skillState[phoneme].taught = true;
  skillState[phoneme].recognitionStatus = 'introduced';
  alert('Lesson complete! ' + phoneme + ' is now taught.');
  store.currentLesson = null;
}
</script>

<style scoped>
.lesson-player {
  padding: 20px;
  background: #111;
  border-radius: 10px;
}
.letter {
  font-size: 90px;
  color: #FF8C00;
}
</style>
