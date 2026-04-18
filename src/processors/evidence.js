import { eventQueue, clearQueue } from '../store/events';
import { skillState } from '../store';
import { useEventUpload } from '../composables/useEventUpload.js';
import { useProfileProgress } from '../composables/useProfileProgress.js';

export function processSessionEnd(sessionId) {
  const { flushPendingEvents } = useEventUpload();
  const { submitSkillStateUpdate } = useProfileProgress();

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

  void submitSkillStateUpdate((nextSkillState) => {
    Object.keys(counts).forEach((slug) => {
      const { correct, total } = counts[slug];
      const accuracy = correct / total;
      const state = nextSkillState[slug] ?? skillState[slug];

      if (!state) {
        return;
      }

      const nextState = {
        ...state,
        taught: state.taught,
        recognitionStatus: state.recognitionStatus,
      };

      if (!nextState.taught) {
        nextState.taught = true;
        nextState.recognitionStatus = 'introduced';
      }

      if (accuracy >= 0.8 && nextState.recognitionStatus === 'introduced') {
        nextState.recognitionStatus = 'developing';
      }

      nextSkillState[slug] = nextState;
    });
  }).catch(() => undefined);

  // Local evidence processing can inform local skillState, but the upload is
  // telemetry-only and does not author canonical progress on its own.
  clearQueue();
  void flushPendingEvents().catch(() => undefined);
}
