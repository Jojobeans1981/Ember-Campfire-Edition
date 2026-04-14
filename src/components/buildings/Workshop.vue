<template>
  <div class="workshop">
    <h2>Match the phoneme</h2>
    <div class="target">
      <span class="target-letter">{{ currentTarget.toUpperCase() }}</span>
    </div>
    <div class="choices">
      <button v-for="rune in availableRunes" :key="rune" class="choice" @click="checkMatch(rune)">
        {{ rune.toUpperCase() }}
      </button>
    </div>
    <div v-if="forged" class="success">🔥 Correct!</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { store } from '../../store';
import { pushEvent } from '../../store/events';
import { skillState } from '../../store';

const currentTarget = ref('m');
const availableRunes = ['m', 's', 't', 'a', 'p', 'n', 'i', 'c'];
const forged = ref(false);

const checkMatch = (rune) => {
  if (rune === currentTarget.value) {
    forged.value = true;
    store.xp += 25;

    if (!skillState[currentTarget.value]) {
      skillState[currentTarget.value] = {
        conceptSlug: currentTarget.value,
        strand: 'foundational',
        taught: false,
        recognitionStatus: 'not_introduced',
        recallStatus: null,
        reviewPressure: 'none',
        lastPracticed: null,
        lastAssessed: null,
        currentSupportLevel: 'guided',
      };
    }

    pushEvent({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sessionId: 'session-001',
      lessonRunId: null,
      activityRunId: 'workshop',
      stepId: null,
      itemId: 'match-' + currentTarget.value,
      conceptSlugs: [currentTarget.value],
      modality: 'tap_select',
      response: { selected: currentTarget.value },
      correct: true,
      confidence: 1,
      supportLevel: skillState[currentTarget.value].currentSupportLevel,
      responseLatencyMs: null,
      attemptNumber: 1,
      wasRetryAfterPrompt: false,
    });

    setTimeout(() => {
      forged.value = false;
      currentTarget.value = availableRunes[Math.floor(Math.random() * availableRunes.length)];
    }, 1000);
  }
};
</script>

<style scoped>
.workshop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.5rem;
  max-width: 90vw;
}
.target {
  background: #1a1c23;
  border-radius: 1rem;
  padding: 1rem 2rem;
}
.target-letter {
  font-size: 3rem;
  color: #FF8C00;
}
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 1rem;
}
.choice {
  background: #222;
  border: none;
  color: #64FFDA;
  font-size: 1.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
}
.choice:hover {
  background: #333;
}
.success {
  font-size: 2rem;
  margin-top: 0.5rem;
}
</style>
