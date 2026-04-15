import { ref } from 'vue';

const isSpeaking = ref(false);
const currentText = ref('');

let activeAudio = null;
let preferredVoice = null;
let voiceBootstrapDone = false;
let activePlayback = null; // { id, type, priority }
let playbackIdSeed = 0;

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

  for (let i = 0; i < VOICE_NAME_PREFERENCES.length; i += 1) {
    if (name.includes(VOICE_NAME_PREFERENCES[i])) {
      score += 120 - i;
      break;
    }
  }

  for (let i = 0; i < VOICE_NAME_AVOID.length; i += 1) {
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

export async function preloadEmberVoice() {
  return false;
}

export function phonemeToAudioKey(phoneme) {
  if (!phoneme) return '';

  let p = String(phoneme).replace(/\//g, '').trim().toLowerCase();
  const map = {
    'a': 'a', 'e': 'e', 'i': 'i', 'o': 'o', 'u': 'u',
    'long_a': 'long_a', 'long_e': 'long_e', 'long_i': 'long_i', 'long_o': 'long_o', 'long_u': 'long_u',
    'r': 'r', 'ng': 'ng',
  };
  if (map[p]) return map[p];

  p = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aliases = { kw: 'q', ks: 'x', thv: 'th_v' };
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

      const speakBrowser = async () => {
        if (!window.speechSynthesis) {
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

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      };

      void speakBrowser();
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

  function stopSpeaking() {
    stopAllPlaybackNow();
    isSpeaking.value = false;
    currentText.value = '';
  }

  return { isSpeaking, currentText, speak, playPhoneme, teachPhoneme, runNarration, stopSpeaking };
}

export function stopAllAudio() {
  stopAllPlaybackNow();
  isSpeaking.value = false;
  currentText.value = '';
}
