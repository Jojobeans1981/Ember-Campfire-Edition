import { ref } from 'vue';

const isSpeaking = ref(false);
const currentText = ref('');

// Track all active audio elements so we can stop them on navigation
let activeAudio = null;

/**
 * Map a phoneme (in any common notation) to the audio file key under
 * /audio/phonemes/. Accepts UFLI-style notation like "/ă/", "/sh/", or
 * bare letters like "a", "sh".
 */
export function phonemeToAudioKey(phoneme) {
  if (!phoneme) return '';
  // Strip slashes and lowercase
  let p = String(phoneme).replace(/\//g, '').trim().toLowerCase();
  // UFLI uses combining diacritics for short vowels; strip them
  // ă ĕ ĭ ŏ ŭ → a e i o u
  const map = {
    'ă': 'a', 'ĕ': 'e', 'ĭ': 'i', 'ŏ': 'o', 'ŭ': 'u',
    'ā': 'long_a', 'ē': 'long_e', 'ī': 'long_i', 'ō': 'long_o', 'ū': 'long_u',
    'ɹ': 'r', 'ŋ': 'ng', 'ə': 'u', 'ɔ': 'o',
  };
  if (map[p]) return map[p];
  // Strip any remaining combining marks
  p = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Common multi-char phonemes
  const aliases = { 'kw': 'q', 'ks': 'x', 'thv': 'th_v' };
  if (aliases[p]) return aliases[p];
  return p;
}

export function useEmber() {
  function speak(text, options = {}) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();

      // Strip IPA notation (/.../) from anything we speak — TTS would
      // otherwise read "slash a slash" or skip entirely.
      const cleaned = String(text || '')
        .replace(/\/[^/]*\//g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?])/g, '$1')
        .trim();

      currentText.value = cleaned;
      isSpeaking.value = true;

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = options.rate || 0.85;
      utterance.pitch = options.pitch || 1.1;
      utterance.lang = 'en-US';

      utterance.onend = () => {
        isSpeaking.value = false;
        currentText.value = '';
        resolve();
      };
      utterance.onerror = () => {
        isSpeaking.value = false;
        currentText.value = '';
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  function playPhoneme(phoneme) {
    return new Promise((resolve) => {
      // Stop any currently playing audio
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
      }

      const key = phonemeToAudioKey(phoneme);
      if (!key) {
        resolve();
        return;
      }
      const audio = new Audio(`/audio/phonemes/${key}.mp3`);
      activeAudio = audio;

      audio.onended = () => {
        activeAudio = null;
        resolve();
      };
      audio.onerror = () => {
        activeAudio = null;
        resolve();
      };
      audio.play().catch(() => {
        activeAudio = null;
        resolve();
      });
    });
  }

  async function teachPhoneme(phoneme) {
    await speak(`This is the letter ${phoneme.toUpperCase()}.`);
    await speak('It says');
    await playPhoneme(phoneme);
    await speak(`Can you say ${phoneme.toUpperCase()}?`);
  }

  async function runNarration(steps, onPrompt) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.action === 'speak') {
        await speak(step.text);
      } else if (step.action === 'play_phoneme') {
        await playPhoneme(step.phoneme);
      } else if (step.action === 'prompt_speech') {
        await speak(step.text || `Can you say ${step.phoneme}?`);
        if (onPrompt) {
          await onPrompt(step.phoneme);
        }
      } else if (step.action === 'pause') {
        await new Promise(r => setTimeout(r, step.duration || 1000));
      }
    }
  }

  function stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }
    isSpeaking.value = false;
    currentText.value = '';
  }

  return { isSpeaking, currentText, speak, playPhoneme, teachPhoneme, runNarration, stopSpeaking };
}

/**
 * Global kill switch — stops ALL audio (TTS + phoneme playback + mic).
 * Call this on every page navigation to prevent audio bleeding between pages.
 */
export function stopAllAudio() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  isSpeaking.value = false;
  currentText.value = '';
}
