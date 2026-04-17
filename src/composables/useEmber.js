import { ref } from 'vue';
import { lookupTtsFile } from './useTts.js';
import { phonemeToAudioKey as sharedPhonemeToAudioKey } from '../utils/ttsSegments.js';

const isSpeaking = ref(false);
const currentText = ref('');

let activeAudio = null;
let activePlayback = null; // { id, type, priority }
let playbackIdSeed = 0;

const AUDIO_PRIORITY = {
  background: 10,
  instruction: 40,
  phoneme: 70,
  critical: 100,
};

function stopActiveAudio() {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}

function resolvePriority(priority, fallback) {
  if (typeof priority === 'number' && Number.isFinite(priority)) return priority;
  if (typeof priority === 'string' && AUDIO_PRIORITY[priority] !== undefined) {
    return AUDIO_PRIORITY[priority];
  }
  return fallback;
}

function isPlaybackCurrent(playbackId) {
  return Boolean(activePlayback && activePlayback.id === playbackId);
}

function releasePlayback(playbackId) {
  if (isPlaybackCurrent(playbackId)) {
    activePlayback = null;
  }
}

function stopAllPlaybackNow() {
  stopActiveAudio();
  activePlayback = null;
}

function claimPlayback(type, priority) {
  const current = activePlayback;
  if (current && priority < current.priority) {
    return null;
  }

  if (current) {
    stopAllPlaybackNow();
  }

  const id = ++playbackIdSeed;
  activePlayback = { id, type, priority };
  return id;
}

/**
 * Emergency fallback using browser SpeechSynthesis.
 * Matches the duration of the audio to the promise lifecycle.
 */
function speakWithBrowserFallback(text, playbackId) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      releasePlayback(playbackId);
      resolve(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;

    utterance.onend = () => {
      releasePlayback(playbackId);
      resolve(true);
    };
    utterance.onerror = () => {
      releasePlayback(playbackId);
      resolve(false);
    };

    window.speechSynthesis.speak(utterance);

    // If for some reason playback changes while speaking, cancel synthesis
    const checkInterval = setInterval(() => {
      if (!isPlaybackCurrent(playbackId)) {
        window.speechSynthesis.cancel();
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
}

function playAudioSources(sources, playbackId) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      releasePlayback(playbackId);
      resolve(ok);
    };

    const tryIndex = (index) => {
      if (!isPlaybackCurrent(playbackId)) {
        finish(false);
        return;
      }
      if (index >= sources.length) {
        activeAudio = null;
        finish(false);
        return;
      }

      const audio = new Audio(sources[index]);
      activeAudio = audio;

      audio.onended = () => {
        activeAudio = null;
        finish(true);
      };
      audio.onerror = () => {
        if (activeAudio === audio) activeAudio = null;
        tryIndex(index + 1);
      };
      audio.play().catch(() => {
        if (activeAudio === audio) activeAudio = null;
        tryIndex(index + 1);
      });
    };

    tryIndex(0);
  });
}

export async function preloadEmberVoice() {
  return false;
}

// Re-export the shared mapper so call sites that previously imported
// phonemeToAudioKey from useEmber.js keep working. The canonical
// implementation lives in utils/ttsSegments.js and covers both the
// breve notation used by lesson 1 and the bare IPA used by lessons 2–10.
export const phonemeToAudioKey = sharedPhonemeToAudioKey;

export function useEmber() {
  function speak(text, options = {}) {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      const priority = resolvePriority(options.priority, AUDIO_PRIORITY.instruction);
      const playbackId = claimPlayback('tts', priority);
      if (!playbackId) {
        resolve(false);
        return;
      }

      const cleaned = String(text || '')
        .replace(/\/[^/]*\//g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?])/g, '$1')
        .trim();

      if (!cleaned) {
        releasePlayback(playbackId);
        resolve(false);
        return;
      }

      const ttsFile = lookupTtsFile(cleaned);

      if (!ttsFile) {
        if (import.meta.env?.DEV) {
          console.warn(`[TTS] No manifest entry for: "${cleaned}". Falling back to browser SpeechSynthesis.`);
        }
        currentText.value = cleaned;
        isSpeaking.value = true;
        speakWithBrowserFallback(cleaned, playbackId).then(() => {
          isSpeaking.value = false;
          currentText.value = '';
          resolve(true);
        });
        return;
      }

      currentText.value = cleaned;
      isSpeaking.value = true;

      playAudioSources([ttsFile], playbackId).then((ok) => {
        isSpeaking.value = false;
        currentText.value = '';
        resolve(ok);
      });
    });
  }

  function playPhoneme(phoneme) {
    return new Promise((resolve) => {
      const playbackId = claimPlayback('clip', AUDIO_PRIORITY.phoneme);
      if (!playbackId) {
        resolve(false);
        return;
      }

      const key = phonemeToAudioKey(phoneme);
      if (!key) {
        releasePlayback(playbackId);
        resolve(false);
        return;
      }

      const sources = [`/audio/phonemes/context/${key}.mp3`];
      playAudioSources(sources, playbackId).then((ok) => resolve(ok));
    });
  }

  async function teachPhoneme(phoneme) {
    await speak(`This is the letter ${phoneme.toUpperCase()}.`);
    await speak('It says');
    await playPhoneme(phoneme);
    await speak(`Can you say ${phoneme.toUpperCase()}?`);
  }

  async function runNarration(steps, onPrompt) {
    for (let i = 0; i < steps.length; i += 1) {
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
        await new Promise((r) => setTimeout(r, step.duration || 1000));
      }
    }
  }

  function speakTeacher(text, options = {}) {
    return speak(text, {
      priority: 'instruction',
      ...options,
    });
  }

  function stopSpeaking() {
    stopAllPlaybackNow();
    isSpeaking.value = false;
    currentText.value = '';
  }

  return { isSpeaking, currentText, speak, speakTeacher, playPhoneme, teachPhoneme, runNarration, stopSpeaking };
}

export function stopAllAudio() {
  stopAllPlaybackNow();
  isSpeaking.value = false;
  currentText.value = '';
}
