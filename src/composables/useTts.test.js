import { describe, it, expect } from 'vitest';
import { lookupTtsFile } from './useTts.js';

/**
 * Safety rail: every string that the UI speaks via `ember.speak(...)` must
 * resolve to a manifest entry, otherwise the line plays silently in
 * production. Keep this list in sync with STATIC_UI_PROMPTS in
 * scripts/generate-tts-inventory.mjs — anything that became audio-only
 * during the lesson-1 UI cleanup belongs here.
 */
const REQUIRED_PROMPTS = [
  'Listen and blend.',
  'Listen to the word.',
  'Listening. Say the sound.',
  'Great! You said it!',
  'Try again. Tap the microphone and say the sound.',
  'Listen to the sound.',
  'Tap the letter that matches.',
  'Correct!',
  'Tap the sound tiles, then blend it out loud.',
  'Say the sound when you are ready.',
  'Listening.',
  'Nice job! You said it.',
  'Try again, then tap my turn.',
  'Tap each word to read it.',
  'Tap each word to practice it.',
  'Listen closely to the sound, then try it too.',
  'Tap my turn and say the sound.',
  'This is a tricky word. The tricky part is underlined.',
  'Tap the speaker to hear me read, then tap the microphone for your turn.',
  'Try again. Tap the microphone and read it out loud.',
];

describe('TTS manifest coverage', () => {
  it.each(REQUIRED_PROMPTS)('has a manifest entry for %j', (prompt) => {
    const file = lookupTtsFile(prompt);
    expect(file, `missing TTS manifest entry for: "${prompt}". Re-run scripts/generate-tts-inventory.mjs && scripts/generate-tts.mjs --run.`).toBeTruthy();
  });

  it('returns null for text that was never generated', () => {
    expect(lookupTtsFile('garbled nonsense that is definitely not in the manifest XYZ123')).toBeNull();
  });
});
