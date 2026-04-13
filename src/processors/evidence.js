import { eventQueue, clearQueue } from '../store/events';
import { skillState } from '../store';

export function processSessionEnd(sessionId) {
  /** @type {Record<string, {correct: number, total: number}>} */
  const counts = {};

  eventQueue.forEach(ev => {
    if (ev.sessionId !== sessionId) return;
    ev.conceptSlugs.forEach(slug => {
      if (!counts[slug]) counts[slug] = { correct: 0, total: 0 };
      counts[slug].total++;
      if (ev.correct) counts[slug].correct++;
    });
  });

  Object.keys(counts).forEach(slug => {
    const { correct, total } = counts[slug];
    const accuracy = correct / total;
    const state = skillState[slug];
    if (!state.taught) {
      state.taught = true;
      state.recognitionStatus = 'introduced';
    }
    if (accuracy >= 0.8 && state.recognitionStatus === 'introduced') {
      state.recognitionStatus = 'developing';
    }
  });

  clearQueue();
}
