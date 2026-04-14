/**
 * Vosk speech recognition service — singleton that manages the WASM model
 * and provides recognizer instances for phoneme/word grading.
 *
 * Usage:
 *   import { ensureModel, createRecognizer } from './voskService.js';
 *   const model = await ensureModel();
 *   const rec = createRecognizer(model, 16000, '["sat", "mat", "[unk]"]');
 */

import Vosk from 'vosk-browser';
import { ref } from 'vue';

const MODEL_PATH = '/models/vosk-model-small-en-us-0.15';

let model = null;
let modelLoadPromise = null;

/** Reactive flag consumers can watch for loading state. */
export const modelLoading = ref(false);

/**
 * Load the Vosk model (lazy, cached). Safe to call multiple times —
 * concurrent calls share a single loading promise.
 */
export async function ensureModel() {
  if (model) return model;

  if (!modelLoadPromise) {
    modelLoading.value = true;
    modelLoadPromise = Vosk.createModel(MODEL_PATH)
      .then((m) => {
        model = m;
        m.setLogLevel(-1); // suppress Vosk debug noise
        modelLoading.value = false;
        return m;
      })
      .catch((err) => {
        modelLoadPromise = null;
        modelLoading.value = false;
        throw err;
      });
  }

  return modelLoadPromise;
}

/**
 * Create a KaldiRecognizer with an optional grammar constraint.
 *
 * @param {Model} voskModel - The loaded Vosk model
 * @param {number} sampleRate - Audio sample rate (usually 16000)
 * @param {string[]} [grammarWords] - Array of words to constrain recognition.
 *   If provided, Vosk will only output words from this list.
 *   Always include "[unk]" to handle unrecognized sounds gracefully.
 * @returns {KaldiRecognizer}
 */
export function createRecognizer(voskModel, sampleRate, grammarWords) {
  let grammar;
  if (grammarWords) {
    const words = [...new Set([...grammarWords, '[unk]'])];
    grammar = JSON.stringify(words);
  }
  const rec = new voskModel.KaldiRecognizer(sampleRate, grammar);
  rec.setWords(true);
  return rec;
}
