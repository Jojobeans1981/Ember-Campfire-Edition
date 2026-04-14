/**
 * Vosk speech recognition service — singleton that manages the WASM model
 * and provides recognizer instances for phoneme/word grading.
 *
 * Usage:
 *   import { ensureModel, createRecognizer } from './voskService.js';
 *   const model = await ensureModel();
 *   const rec = createRecognizer(model, 16000, '["sat", "mat", "[unk]"]');
 */

import * as Vosk from 'vosk-browser';
import { ref } from 'vue';

const LOCAL_MODEL_PATH = '/models/vosk-model-small-en-us-0.15.tar.gz';
const CDN_MODEL_PATH = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
const MODEL_CANDIDATES = [LOCAL_MODEL_PATH, CDN_MODEL_PATH];

let model = null;
let modelLoadPromise = null;

/** Reactive flag consumers can watch for loading state. */
export const modelLoading = ref(false);
export const modelUnavailable = ref(false);

/**
 * Load the Vosk model (lazy, cached). Safe to call multiple times —
 * concurrent calls share a single loading promise.
 */
export async function ensureModel() {
  if (model) return model;

  if (!modelLoadPromise) {
    modelLoading.value = true;
    modelLoadPromise = (async () => {
      let lastError = null;
      for (const path of MODEL_CANDIDATES) {
        try {
          const loadedModel = await Vosk.createModel(path);
          loadedModel.setLogLevel(-1); // suppress Vosk debug noise
          model = loadedModel;
          modelLoading.value = false;
          modelUnavailable.value = false;
          return loadedModel;
        } catch (err) {
          lastError = err;
          console.warn(`Vosk model load failed at: ${path}`, err);
        }
      }

      modelLoadPromise = null;
      modelLoading.value = false;
      modelUnavailable.value = true;
      throw lastError || new Error('Unable to load any Vosk model path');
    })();
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
