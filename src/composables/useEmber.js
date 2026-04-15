import { ref } from 'vue';

const isSpeaking = ref(false);
const currentText = ref('');

// Track all active audio elements so we can stop them on navigation
let activeAudio = null;
let preferredVoice = null;
let voiceBootstrapDone = false;
let activePlayback = null; // { id, type, priority }
let playbackIdSeed = 0;
let kokoroModel = null;
let kokoroModelPromise = null;
let kokoroLastErrorAt = 0;
const kokoroAudioCache = new Map();
const kokoroAudioInFlight = new Map();
const KOKORO_CACHE_LIMIT = 40;
const ENABLE_KOKORO = false;
const KOKORO_LOAD_COOLDOWN_MS = 1500;
const KOKORO_LOAD_TIMEOUT_MS = 3500;
const KOKORO_GENERATE_TIMEOUT_MS = 4500;
const ALLOW_ROBOT_FALLBACK = true;
const ENABLE_PIPER = false;
const PIPER_TIMEOUT_MS = 4500;
const PIPER_ERROR_COOLDOWN_MS = 1500;
const PIPER_DEFAULT_ENDPOINT = 'http://127.0.0.1:5055/speak';
const PIPER_ENDPOINT =
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_PIPER_ENDPOINT) ||
  PIPER_DEFAULT_ENDPOINT;
const IS_TEST_ENV =
  (typeof import.meta !== 'undefined' && import.meta?.env?.MODE === 'test') ||
  (typeof process !== 'undefined' && process?.env?.VITEST === 'true');
let piperLastErrorAt = 0;
const piperAudioCache = new Map();
const PIPER_CACHE_LIMIT = 60;

const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const KOKORO_DEFAULT_VOICE = 'af_heart';

const AUDIO_PRIORITY = {
  background: 10,
  instruction: 40,
  phoneme: 70,
  critical: 100,
};

const VOICE_NAME_PREFERENCES = [
  'aria online',
  'jenny online',
  'guy online',
  'ava online',
  'sara online',
  'alloy',
  'nova',
  'shimmer',
  'aria',
  'jenny',
  'samantha',
  'allison',
  'ava',
  'google us english',
  'google uk english female',
  'zira',
  'sara',
  'libby',
];

const VOICE_NAME_AVOID = [
  'espeak',
  'rhvoice',
  'festival',
  'microsoft david',
  'microsoft mark',
  'compact',
  'robot',
];

function scoreVoice(voice) {
  const name = String(voice?.name || '').toLowerCase();
  const lang = String(voice?.lang || '').toLowerCase();
  let score = 0;

  if (voice?.localService) score += 40;
  if (lang === 'en-us') score += 25;
  else if (lang.startsWith('en-')) score += 15;
  else if (lang.startsWith('en')) score += 10;

  for (let i = 0; i < VOICE_NAME_PREFERENCES.length; i++) {
    if (name.includes(VOICE_NAME_PREFERENCES[i])) {
      score += 120 - i;
      break;
    }
  }

  for (let i = 0; i < VOICE_NAME_AVOID.length; i++) {
    if (name.includes(VOICE_NAME_AVOID[i])) {
      score -= 160;
      break;
    }
  }

  if (name.includes('natural')) score += 8;
  if (name.includes('neural')) score += 8;
  if (name.includes('online')) score += 10;
  if (name.includes('enhanced')) score += 5;
  if (name.includes('female')) score += 4;

  return score;
}

function pickPreferredVoice(voiceName) {
  if (!window.speechSynthesis?.getVoices) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

  if (voiceName) {
    const requested = String(voiceName).toLowerCase();
    const exact = voices.find((v) => String(v.name).toLowerCase() === requested);
    if (exact) return exact;
    const partial = voices.find((v) => String(v.name).toLowerCase().includes(requested));
    if (partial) return partial;
  }

  const englishVoices = voices.filter((v) => String(v.lang || '').toLowerCase().startsWith('en'));
  const pool = englishVoices.length ? englishVoices : voices;
  return pool.reduce((best, voice) => {
    if (!best) return voice;
    return scoreVoice(voice) > scoreVoice(best) ? voice : best;
  }, null);
}

function bootstrapPreferredVoice() {
  if (!window.speechSynthesis || voiceBootstrapDone) return;
  voiceBootstrapDone = true;

  const updatePreferredVoice = () => {
    preferredVoice = pickPreferredVoice();
  };

  updatePreferredVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', updatePreferredVoice);
}

async function waitForVoices(timeoutMs = 1500) {
  if (!window.speechSynthesis?.getVoices) return;
  const existing = window.speechSynthesis.getVoices() || [];
  if (existing.length) return;
  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timeoutId);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', onVoicesChanged);
      resolve();
    };
    const onVoicesChanged = () => {
      const voices = window.speechSynthesis?.getVoices?.() || [];
      if (voices.length) finish();
    };
    const timeoutId = window.setTimeout(finish, timeoutMs);
    window.speechSynthesis?.addEventListener?.('voiceschanged', onVoicesChanged);
  });
}

function stopActiveAudio() {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}

async function withTimeout(task, timeoutMs, label) {
  let timeoutId = null;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`${label} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

async function loadKokoroModel() {
  if (!ENABLE_KOKORO) return null;
  if (kokoroModel) return kokoroModel;
  if (kokoroModelPromise) return kokoroModelPromise;
  if (typeof window === 'undefined') return null;
  if (Date.now() - kokoroLastErrorAt < KOKORO_LOAD_COOLDOWN_MS) return null;

  kokoroModelPromise = (async () => {
    try {
      const { env } = await import('@huggingface/transformers');
      // Force local bundled model files to avoid flaky remote fetch fallback.
      env.useBrowserCache = false;
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.localModelPath = '/models/';
      const { KokoroTTS } = await withTimeout(
        import('kokoro-js'),
        KOKORO_LOAD_TIMEOUT_MS,
        'Kokoro import'
      );
      // Let runtime auto-pick the best available backend (webgpu/wasm/cpu).
      kokoroModel = await withTimeout(
        KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
          dtype: 'q4',
        }),
        KOKORO_LOAD_TIMEOUT_MS,
        'Kokoro model load'
      );
      return kokoroModel;
    } catch (error) {
      kokoroLastErrorAt = Date.now();
      console.warn('Kokoro TTS unavailable, falling back to browser voice.', error);
      return null;
    } finally {
      kokoroModelPromise = null;
    }
  })();

  return kokoroModelPromise;
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
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  stopActiveAudio();
  activePlayback = null;
}

function claimPlayback(type, priority) {
  const current = activePlayback;
  if (current && priority < current.priority) {
    return null;
  }

  if (current) {
    // New playback takes priority, so preempt current playback first.
    stopAllPlaybackNow();
  }

  const id = ++playbackIdSeed;
  activePlayback = { id, type, priority };
  return id;
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

function tokenizeForClipSpeech(text) {
  const normalized = String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  const tokens = [];
  const digraphs = ['th', 'sh', 'ch', 'ng', 'wh'];

  for (let w = 0; w < words.length; w += 1) {
    const word = words[w];
    let i = 0;
    while (i < word.length) {
      const maybeDigraph = word.slice(i, i + 2);
      if (digraphs.includes(maybeDigraph)) {
        tokens.push(maybeDigraph);
        i += 2;
      } else {
        tokens.push(word[i]);
        i += 1;
      }
    }
  }
  return tokens;
}

function playAudioSequence(sources, playbackId) {
  return new Promise((resolve) => {
    let index = 0;
    const next = () => {
      if (!isPlaybackCurrent(playbackId)) {
        releasePlayback(playbackId);
        resolve(false);
        return;
      }
      if (index >= sources.length) {
        releasePlayback(playbackId);
        resolve(true);
        return;
      }
      const audio = new Audio(sources[index]);
      activeAudio = audio;
      audio.onended = () => {
        activeAudio = null;
        index += 1;
        next();
      };
      audio.onerror = () => {
        if (activeAudio === audio) activeAudio = null;
        index += 1;
        next();
      };
      audio.play().catch(() => {
        if (activeAudio === audio) activeAudio = null;
        index += 1;
        next();
      });
    };
    next();
  });
}

function playBlobAudio(blob, playbackId) {
  return new Promise((resolve) => {
    let settled = false;
    const audioUrl = URL.createObjectURL(blob);

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (activeAudio) {
        activeAudio.onended = null;
        activeAudio.onerror = null;
      }
      activeAudio = null;
      URL.revokeObjectURL(audioUrl);
      releasePlayback(playbackId);
      resolve(ok);
    };

    if (!isPlaybackCurrent(playbackId)) {
      finish(false);
      return;
    }

    const audio = new Audio(audioUrl);
    activeAudio = audio;
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio.play().catch(() => finish(false));
  });
}

function getKokoroCacheKey(text, voiceId, speed) {
  return `${voiceId || KOKORO_DEFAULT_VOICE}|${speed || 1}|${text}`;
}

function getCachedKokoroBlob(text, voiceId, speed) {
  const key = getKokoroCacheKey(text, voiceId, speed);
  if (!kokoroAudioCache.has(key)) return null;
  const cached = kokoroAudioCache.get(key);
  // Refresh LRU order.
  kokoroAudioCache.delete(key);
  kokoroAudioCache.set(key, cached);
  return cached;
}

function setCachedKokoroBlob(text, voiceId, speed, blob) {
  const key = getKokoroCacheKey(text, voiceId, speed);
  if (kokoroAudioCache.has(key)) {
    kokoroAudioCache.delete(key);
  }
  kokoroAudioCache.set(key, blob);
  while (kokoroAudioCache.size > KOKORO_CACHE_LIMIT) {
    const oldest = kokoroAudioCache.keys().next().value;
    kokoroAudioCache.delete(oldest);
  }
}

function getPiperCacheKey(text, speed) {
  return `${speed || 1}|${text}`;
}

function getCachedPiperBlob(text, speed) {
  const key = getPiperCacheKey(text, speed);
  if (!piperAudioCache.has(key)) return null;
  const cached = piperAudioCache.get(key);
  piperAudioCache.delete(key);
  piperAudioCache.set(key, cached);
  return cached;
}

function setCachedPiperBlob(text, speed, blob) {
  const key = getPiperCacheKey(text, speed);
  if (piperAudioCache.has(key)) {
    piperAudioCache.delete(key);
  }
  piperAudioCache.set(key, blob);
  while (piperAudioCache.size > PIPER_CACHE_LIMIT) {
    const oldest = piperAudioCache.keys().next().value;
    piperAudioCache.delete(oldest);
  }
}

async function synthesizeWithPiper(text, speed = 1) {
  if (!ENABLE_PIPER) return null;
  if (IS_TEST_ENV) return null;
  if (typeof fetch !== 'function') return null;
  if (Date.now() - piperLastErrorAt < PIPER_ERROR_COOLDOWN_MS) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PIPER_TIMEOUT_MS);
  try {
    const response = await fetch(PIPER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speed }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Piper HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob || !blob.size) throw new Error('Empty Piper audio response');
    return blob;
  } catch (error) {
    piperLastErrorAt = Date.now();
    console.warn('Piper TTS unavailable, trying Kokoro.', error);
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function preloadEmberVoice() {
  if (!ENABLE_KOKORO) return false;
  const kokoro = await loadKokoroModel();
  if (!kokoro) return false;
  return true;
}

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
  bootstrapPreferredVoice();

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

      // Strip IPA notation (/.../) from anything we speak — TTS would
      // otherwise read "slash a slash" or skip entirely.
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

      currentText.value = cleaned;
      isSpeaking.value = true;

      const fallbackToBrowserTTS = async () => {
        if (!window.speechSynthesis) {
          releasePlayback(playbackId);
          isSpeaking.value = false;
          currentText.value = '';
          resolve(false);
          return;
        }
        if (!ALLOW_ROBOT_FALLBACK) {
          releasePlayback(playbackId);
          isSpeaking.value = false;
          currentText.value = '';
          resolve(false);
          return;
        }
        await waitForVoices(1400);
        const utterance = new SpeechSynthesisUtterance(cleaned);
        preferredVoice = pickPreferredVoice(options.voiceName) || preferredVoice || pickPreferredVoice();
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          utterance.voiceURI = preferredVoice.voiceURI || '';
        }
        // Slightly warmer defaults for early readers: calmer pace and brighter tone.
        utterance.rate = options.rate ?? 0.88;
        utterance.pitch = options.pitch ?? 1.08;
        utterance.volume = options.volume ?? 1.0;
        utterance.lang = 'en-US';

        utterance.onend = () => {
          releasePlayback(playbackId);
          isSpeaking.value = false;
          currentText.value = '';
          resolve(true);
        };
        utterance.onerror = () => {
          releasePlayback(playbackId);
          isSpeaking.value = false;
          currentText.value = '';
          resolve(false);
        };

        // Cancel stale queued utterances so this line starts immediately.
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      };

      fallbackToBrowserTTS();
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
    stopAllPlaybackNow();
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
  stopAllPlaybackNow();
  isSpeaking.value = false;
  currentText.value = '';
}
