import { ref } from 'vue';
import { ensureModel, createRecognizer } from '../services/voskService.js';
import { getGrammarForPhoneme, isPhonemeMatch, normalizePhonemeKey } from '../data/phonemeGrammars.js';
import { usePhonemeLogic } from './usePhonemeLogic.js';

// Shared mic stream — request once, reuse everywhere
let sharedStream = null;
let modelWarmupPromise = null;

function warmupVoskModel() {
  if (!modelWarmupPromise) {
    modelWarmupPromise = ensureModel().catch((err) => {
      // Allow subsequent attempts to retry model loading.
      modelWarmupPromise = null;
      throw err;
    });
  }
  return modelWarmupPromise;
}

async function ensureMicAccess() {
  if (sharedStream && sharedStream.active) return sharedStream;
  if (!navigator?.mediaDevices?.getUserMedia) {
    return null;
  }
  try {
    sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return sharedStream;
  } catch (err) {
    console.error('Microphone access denied:', err);
    return null;
  }
}

export async function requestMicPermission() {
  const stream = await ensureMicAccess();
  if (stream) {
    warmupVoskModel().catch((err) => {
      // Keep app usable with browser fallback while preserving retry behavior.
      console.warn('Vosk model warmup failed:', err);
    });
  }
  return stream;
}

// Sustain target: ~0.5 second at ~60fps = 30 frames
const SUSTAIN_FRAMES = 30;
// Plosive/short consonant target: very brief burst (~0.1-0.15s)
const PLOSIVE_FRAMES = 8;
// Minimum speech frames before we consider it "real speech" (not noise)
// ~0.5s at 60fps — filters out coughs, bumps, background spikes
const SPEECH_MIN_FRAMES = 30;
// Silence after real speech: ~1.2s of quiet means they stopped talking
const SILENCE_CUTOFF_FRAMES = 72;
// Grace period at start: ignore audio for first ~1s to avoid picking up
// the TTS "Your turn!" prompt through the speakers
const GRACE_PERIOD_FRAMES = 60;
const EARLY_PHONEME_FALLBACKS = new Set(['a', 'm', 's', 't']);

/**
 * Volume analysis with smart speech detection.
 *
 * Tracks three phases:
 *   idle → speaking → silence_after_speech → fires onSpeechEnded
 *
 * The child must produce at least SPEECH_MIN_FRAMES of sound before
 * the silence cutoff is armed. This prevents background noise from
 * triggering an early evaluation.
 */
function setupVolumeAnalysis(stream, audioContext, sustainProgress, sustainTarget, onSustained, onSpeechEnded) {
  const micSource = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  micSource.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const timeDomainData = new Float32Array(analyser.fftSize);
  const VOICE_THRESHOLD = 35;

  let sustainedFrames = 0;
  let totalSpeechFrames = 0;  // total frames above threshold (doesn't decay)
  let silenceFrames = 0;      // consecutive quiet frames after real speech
  let elapsedFrames = 0;      // total frames since start (for grace period)
  let animationId = null;
  let stopped = false;
  let speechSampleCount = 0;
  let sumCentroid = 0;
  let sumHighEnergyRatio = 0;
  let sumLowEnergyRatio = 0;
  let sumZeroCrossingRate = 0;

  const loop = () => {
    if (stopped) return;
    elapsedFrames++;

    analyser.getByteFrequencyData(dataArray);
    analyser.getFloatTimeDomainData(timeDomainData);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const isSpeaking = rms > VOICE_THRESHOLD;

    let weightedSum = 0;
    let magnitudeSum = 0;
    let lowEnergy = 0;
    let highEnergy = 0;
    for (let i = 0; i < bufferLength; i++) {
      const magnitude = dataArray[i];
      const freq = (i * audioContext.sampleRate) / analyser.fftSize;
      weightedSum += freq * magnitude;
      magnitudeSum += magnitude;
      if (freq < 1000) lowEnergy += magnitude;
      if (freq > 2500) highEnergy += magnitude;
    }
    const centroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

    let zeroCrossings = 0;
    for (let i = 1; i < timeDomainData.length; i++) {
      const prev = timeDomainData[i - 1];
      const curr = timeDomainData[i];
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
        zeroCrossings++;
      }
    }
    const zeroCrossingRate = zeroCrossings / timeDomainData.length;

    // Grace period: ignore audio at the start so the mic doesn't
    // pick up the TTS prompt ("Your turn!") through the speakers
    if (elapsedFrames <= GRACE_PERIOD_FRAMES) {
      animationId = requestAnimationFrame(loop);
      return;
    }

    if (isSpeaking) {
      sustainedFrames++;
      totalSpeechFrames++;
      silenceFrames = 0;
      speechSampleCount++;
      sumCentroid += centroid;
      sumHighEnergyRatio += magnitudeSum > 0 ? highEnergy / magnitudeSum : 0;
      sumLowEnergyRatio += magnitudeSum > 0 ? lowEnergy / magnitudeSum : 0;
      sumZeroCrossingRate += zeroCrossingRate;
    } else {
      // Decay sustain progress slowly so brief pauses don't reset it
      sustainedFrames = Math.max(0, sustainedFrames - 1);

      // Only start counting silence once we've confirmed real speech
      if (totalSpeechFrames >= SPEECH_MIN_FRAMES) {
        silenceFrames++;
      }
    }

    sustainProgress.value = Math.min(100, Math.round((sustainedFrames / sustainTarget) * 100));

    // Sustained sound goal reached
    if (sustainedFrames >= sustainTarget && onSustained) {
      onSustained();
      return;
    }

    // Real speech happened and then stopped — cut to evaluation
    if (totalSpeechFrames >= SPEECH_MIN_FRAMES && silenceFrames >= SILENCE_CUTOFF_FRAMES && onSpeechEnded) {
      onSpeechEnded();
      return;
    }

    animationId = requestAnimationFrame(loop);
  };

  loop();

  return {
    micSource,
    get speechDetected() { return totalSpeechFrames >= SPEECH_MIN_FRAMES; },
    getSustainedFrames: () => sustainedFrames,
    getStats: () => ({
      speechSampleCount,
      avgCentroid: speechSampleCount > 0 ? sumCentroid / speechSampleCount : 0,
      avgHighEnergyRatio: speechSampleCount > 0 ? sumHighEnergyRatio / speechSampleCount : 0,
      avgLowEnergyRatio: speechSampleCount > 0 ? sumLowEnergyRatio / speechSampleCount : 0,
      avgZeroCrossingRate: speechSampleCount > 0 ? sumZeroCrossingRate / speechSampleCount : 0,
    }),
    stop() {
      stopped = true;
      if (animationId) cancelAnimationFrame(animationId);
      micSource.disconnect();
    },
  };
}

function matchesEarlyPhonemeByAudio(target, volumeHandle) {
  if (!volumeHandle?.speechDetected) return false;

  const stats = volumeHandle.getStats?.();
  if (!stats || stats.speechSampleCount < 12) return false;

  const {
    avgCentroid,
    avgHighEnergyRatio,
    avgLowEnergyRatio,
    avgZeroCrossingRate,
  } = stats;

  switch (target) {
    case 'a':
      return avgCentroid >= 450 && avgCentroid <= 2600
        && avgLowEnergyRatio >= 0.16
        && avgHighEnergyRatio <= 0.28
        && avgZeroCrossingRate <= 0.24;
    case 'm':
      return avgCentroid <= 1200
        && avgLowEnergyRatio >= 0.46
        && avgHighEnergyRatio <= 0.16
        && avgZeroCrossingRate <= 0.16;
    case 's':
      return avgCentroid >= 2200
        && avgHighEnergyRatio >= 0.22
        && avgLowEnergyRatio <= 0.42
        && avgZeroCrossingRate >= 0.12;
    case 't':
      return avgCentroid >= 1200
        && avgHighEnergyRatio >= 0.12
        && avgZeroCrossingRate >= 0.06
        && volumeHandle.getSustainedFrames() <= 45;
    default:
      return false;
  }
}

/**
 * Connect the mic stream to a Vosk recognizer via ScriptProcessorNode.
 * Returns a cleanup function.
 */
function pipeAudioToVosk(audioContext, stream, recognizer) {
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);
    recognizer.acceptWaveformFloat(new Float32Array(inputData), audioContext.sampleRate);
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  return () => {
    processor.onaudioprocess = null;
    source.disconnect();
    processor.disconnect();
  };
}

function startBrowserPhonemeRecognition(targetPhoneme, onMatch, onText) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 5;

  const handleResults = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      for (let j = 0; j < result.length; j++) {
        const text = result[j].transcript?.toLowerCase().trim();
        if (!text) continue;
        onText(text);
        if (isPhonemeMatch(targetPhoneme, text)) {
          onMatch(text);
          return;
        }
      }
    }
  };

  recognition.onresult = handleResults;
  recognition.onerror = () => {};

  try {
    recognition.start();
  } catch {
    return null;
  }

  return () => {
    recognition.onresult = null;
    recognition.onerror = null;
    try { recognition.stop(); } catch (_) {}
  };
}

function startBrowserWordRecognition(targetWord, onMatch, onText) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 5;

  const normalizedTarget = String(targetWord || '').toLowerCase().replace(/[^a-z]/g, '');

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      for (let j = 0; j < result.length; j++) {
        const text = result[j].transcript?.toLowerCase().trim();
        if (!text) continue;
        onText(text);

        const words = text
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .map((word) => word.trim())
          .filter(Boolean);

        if (words.some((word) => word === normalizedTarget)) {
          onMatch(text);
          return;
        }
      }
    }
  };

  recognition.onerror = () => {};

  try {
    recognition.start();
  } catch {
    return null;
  }

  return () => {
    recognition.onresult = null;
    recognition.onerror = null;
    try { recognition.stop(); } catch (_) {}
  };
}

export function useSpeechRecognition() {
  const isListening = ref(false);
  const matched = ref(false);
  const transcript = ref('');
  const volume = ref(0);
  const sustainProgress = ref(0);
  const debugState = ref({
    mode: '',
    target: '',
    transcript: '',
    speechDetected: false,
    sustainFrames: 0,
    avgCentroid: 0,
    avgHighEnergyRatio: 0,
    avgLowEnergyRatio: 0,
    avgZeroCrossingRate: 0,
    recognizer: 'none',
    matchedBy: 'none',
    fallbackUsed: false,
    voskError: '',
    result: 'idle',
  });

  let activeCleanup = null;
  const { getPhonemeParams } = usePhonemeLogic();

  /**
   * Listen for a PHONEME using Vosk + smart volume detection.
   *
   * - 10s max window, but cuts off early once speech is detected and stops
   * - Vosk verifies the correct phoneme sound
   * - Sustain bar shows progress (1.5s for sustain, instant for plosive)
   * - Falls back to volume-only if Vosk fails to load
   */
  function startListening(targetPhoneme, duration = 9000) {
    return new Promise(async (resolve) => {
      let resolved = false;
      let audioContext = null;
      let volumeHandle = null;
      let voskCleanup = null;
      let browserCleanup = null;
      let recognizer = null;

      isListening.value = true;
      matched.value = false;
      transcript.value = '';
      volume.value = 0;
      sustainProgress.value = 0;

      const cleanup = () => {
        if (volumeHandle) volumeHandle.stop();
        if (voskCleanup) voskCleanup();
        if (browserCleanup) browserCleanup();
        if (recognizer) { try { recognizer.remove(); } catch (_) {} }
        if (audioContext) audioContext.close().catch(() => {});
        volumeHandle = null;
        voskCleanup = null;
        browserCleanup = null;
        recognizer = null;
        audioContext = null;
        activeCleanup = null;
      };

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        isListening.value = false;
        matched.value = result;
        debugState.value = {
          ...debugState.value,
          transcript: transcript.value,
          speechDetected: volumeHandle?.speechDetected ?? false,
          sustainFrames: volumeHandle?.getSustainedFrames?.() ?? 0,
          avgCentroid: Math.round(volumeHandle?.getStats?.().avgCentroid ?? 0),
          avgHighEnergyRatio: Number((volumeHandle?.getStats?.().avgHighEnergyRatio ?? 0).toFixed(3)),
          avgLowEnergyRatio: Number((volumeHandle?.getStats?.().avgLowEnergyRatio ?? 0).toFixed(3)),
          avgZeroCrossingRate: Number((volumeHandle?.getStats?.().avgZeroCrossingRate ?? 0).toFixed(3)),
          result: result ? 'matched' : 'missed',
        };
        volume.value = 0;
        cleanup();
        resolve({ matched: result, transcript: transcript.value });
      };

      activeCleanup = () => finish(false);

      const stream = await ensureMicAccess();
      if (!stream) { finish(false); return; }
      // Start model loading as early as possible so first attempts don't run browser-only.
      warmupVoskModel().catch((err) => {
        console.warn('Vosk model warmup failed:', err);
      });

      const normalizedTarget = normalizePhonemeKey(targetPhoneme);
      const params = getPhonemeParams(normalizedTarget);
      const isPlosive = params.type === 'plosive';
      const sustainTarget = isPlosive ? PLOSIVE_FRAMES : SUSTAIN_FRAMES;
      const allowEarlyFallback = EARLY_PHONEME_FALLBACKS.has(normalizedTarget);
      let voskMatched = false;
      let browserMatched = false;
      let voskReady = false;
      let browserReady = false;

      debugState.value = {
        mode: 'phoneme',
        target: normalizedTarget,
        transcript: '',
        speechDetected: false,
        sustainFrames: 0,
        avgCentroid: 0,
        avgHighEnergyRatio: 0,
        avgLowEnergyRatio: 0,
        avgZeroCrossingRate: 0,
        recognizer: 'starting',
        matchedBy: 'none',
        fallbackUsed: false,
        voskError: '',
        result: 'listening',
      };

      const shouldAllowEarlySpeechFallback = () => {
        if (!allowEarlyFallback || !volumeHandle) return false;
        // Only allow audio-shape fallback when no recognizer is available.
        // If Vosk/browser is running, require an actual recognition match.
        const noRecognizerAvailable = !voskReady && !browserReady;
        if (!noRecognizerAvailable) return false;
        const enoughSpeech = volumeHandle.speechDetected;
        const enoughSustain = volumeHandle.getSustainedFrames() >= Math.max(12, Math.floor(sustainTarget * 0.7));
        const noTranscript = !transcript.value || transcript.value === '[unk]';
        return enoughSpeech
          && enoughSustain
          && noTranscript
          && matchesEarlyPhonemeByAudio(normalizedTarget, volumeHandle);
      };

      const useEarlySpeechFallback = () => {
        if (!shouldAllowEarlySpeechFallback()) return false;
        transcript.value = '(volume fallback)';
        debugState.value = {
          ...debugState.value,
          transcript: '(volume fallback)',
          speechDetected: volumeHandle?.speechDetected ?? false,
          sustainFrames: volumeHandle?.getSustainedFrames?.() ?? 0,
          avgCentroid: Math.round(volumeHandle?.getStats?.().avgCentroid ?? 0),
          avgHighEnergyRatio: Number((volumeHandle?.getStats?.().avgHighEnergyRatio ?? 0).toFixed(3)),
          avgLowEnergyRatio: Number((volumeHandle?.getStats?.().avgLowEnergyRatio ?? 0).toFixed(3)),
          avgZeroCrossingRate: Number((volumeHandle?.getStats?.().avgZeroCrossingRate ?? 0).toFixed(3)),
          matchedBy: 'volume-fallback',
          fallbackUsed: true,
          result: 'matched',
        };
        finish(true);
        return true;
      };

      let preloadedModel = null;
      try {
        preloadedModel = await warmupVoskModel();
      } catch (err) {
        console.warn('Vosk setup failed before listening, using browser speech fallback if available:', err);
        debugState.value = {
          ...debugState.value,
          voskError: String(err?.message || err || 'unknown Vosk error'),
        };
      }

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        volumeHandle = setupVolumeAnalysis(
          stream, audioContext, sustainProgress, sustainTarget,
          // onSustained: sustained sound goal reached — only pass if Vosk confirmed
          () => {
            debugState.value = {
              ...debugState.value,
              speechDetected: volumeHandle?.speechDetected ?? false,
              sustainFrames: volumeHandle?.getSustainedFrames?.() ?? 0,
              avgCentroid: Math.round(volumeHandle?.getStats?.().avgCentroid ?? 0),
              avgHighEnergyRatio: Number((volumeHandle?.getStats?.().avgHighEnergyRatio ?? 0).toFixed(3)),
              avgLowEnergyRatio: Number((volumeHandle?.getStats?.().avgLowEnergyRatio ?? 0).toFixed(3)),
              avgZeroCrossingRate: Number((volumeHandle?.getStats?.().avgZeroCrossingRate ?? 0).toFixed(3)),
            };
            if (voskMatched || browserMatched) {
              finish(true);
              return;
            }
            if (useEarlySpeechFallback()) {
              return;
            }
            // If recognizer hasn't matched yet, keep listening — don't pass on volume alone
          },
          // onSpeechEnded: child spoke then went silent — evaluate based on Vosk
          () => {
            // Give recognizers a brief moment to finalize after speech stops
            setTimeout(() => {
              debugState.value = {
                ...debugState.value,
                speechDetected: volumeHandle?.speechDetected ?? false,
                sustainFrames: volumeHandle?.getSustainedFrames?.() ?? 0,
                avgCentroid: Math.round(volumeHandle?.getStats?.().avgCentroid ?? 0),
                avgHighEnergyRatio: Number((volumeHandle?.getStats?.().avgHighEnergyRatio ?? 0).toFixed(3)),
                avgLowEnergyRatio: Number((volumeHandle?.getStats?.().avgLowEnergyRatio ?? 0).toFixed(3)),
                avgZeroCrossingRate: Number((volumeHandle?.getStats?.().avgZeroCrossingRate ?? 0).toFixed(3)),
              };
              if (resolved) return;
              if (voskMatched || browserMatched) {
                finish(true);
                return;
              }
              if (useEarlySpeechFallback()) {
                return;
              }
              finish(false);
            }, 300);
          },
        );

        browserCleanup = startBrowserPhonemeRecognition(
          normalizedTarget,
          (text) => {
            browserMatched = true;
            transcript.value = text;
            debugState.value = {
              ...debugState.value,
              transcript: text,
              recognizer: voskReady ? 'vosk+browser' : 'browser',
              matchedBy: 'browser',
            };
            if (isPlosive && !resolved) finish(true);
          },
          (text) => {
            transcript.value = text;
            debugState.value = {
              ...debugState.value,
              transcript: text,
              recognizer: voskReady ? 'vosk+browser' : 'browser',
            };
          },
        );
        browserReady = Boolean(browserCleanup);
        debugState.value = {
          ...debugState.value,
          recognizer: browserReady ? 'browser' : 'none',
        };

        if (preloadedModel) {
          const grammar = getGrammarForPhoneme(targetPhoneme);
          recognizer = createRecognizer(preloadedModel, audioContext.sampleRate, grammar);
          voskReady = true;
          debugState.value = {
            ...debugState.value,
            recognizer: browserReady ? 'vosk+browser' : 'vosk',
          };

          const handleVoskText = (text) => {
            if (resolved || !text || text === '[unk]') return;
            transcript.value = text;
            debugState.value = {
              ...debugState.value,
              transcript: text,
            };
            if (isPhonemeMatch(normalizedTarget, text)) {
              voskMatched = true;
              debugState.value = {
                ...debugState.value,
                matchedBy: 'vosk',
              };
              // Plosives: Vosk match alone is enough (can't sustain them)
              // Sustain: Vosk match + sustained volume will trigger via onSustained
              if (isPlosive) finish(true);
            }
          };

          recognizer.on('result', (message) => handleVoskText(message.result?.text));
          recognizer.on('partialresult', (message) => handleVoskText(message.result?.partial));
          voskCleanup = pipeAudioToVosk(audioContext, stream, recognizer);
        } else {
          voskReady = false;
          debugState.value = {
            ...debugState.value,
            recognizer: browserReady ? 'browser' : 'none',
            fallbackUsed: browserReady,
          };
        }
      } catch (err) {
        console.error('Audio analysis setup failed:', err);
        debugState.value = {
          ...debugState.value,
          result: 'audio-error',
        };
        finish(false);
        return;
      }

      // Hard timeout — if Vosk never loaded, fall back to volume-only
      setTimeout(() => {
        if (resolved) return;
        if (voskReady || browserReady) {
          if (voskMatched || browserMatched) {
            finish(true);
            return;
          }
          if (useEarlySpeechFallback()) {
            return;
          }
          finish(false);
        } else {
          // No recognizer available at all — accept sustained effort as a last resort
          finish(volumeHandle?.getSustainedFrames() >= sustainTarget);
        }
      }, duration);
    });
  }

  /**
   * Listen for a WORD using Vosk + smart volume detection.
   *
   * - 10s max window, cuts off when speech stops
   * - Vosk grammar-constrained to target word(s)
   * - Falls back to volume detection if Vosk unavailable
   */
  function startWordListening(targetWord, duration = 10000) {
    return new Promise(async (resolve) => {
      let resolved = false;
      let wordMatch = false;
      let audioContext = null;
      let volumeHandle = null;
      let voskCleanup = null;
      let browserCleanup = null;
      let recognizer = null;

      isListening.value = true;
      matched.value = false;
      transcript.value = '';
      volume.value = 0;
      sustainProgress.value = 0;

      const cleanup = () => {
        if (volumeHandle) volumeHandle.stop();
        if (voskCleanup) voskCleanup();
        if (browserCleanup) browserCleanup();
        if (recognizer) { try { recognizer.remove(); } catch (_) {} }
        if (audioContext) audioContext.close().catch(() => {});
        volumeHandle = null;
        voskCleanup = null;
        browserCleanup = null;
        recognizer = null;
        audioContext = null;
        activeCleanup = null;
      };

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        isListening.value = false;
        matched.value = result;
        volume.value = 0;
        debugState.value = {
          ...debugState.value,
          transcript: transcript.value,
          speechDetected: volumeHandle?.speechDetected ?? false,
          sustainFrames: volumeHandle?.getSustainedFrames?.() ?? 0,
          result: result ? 'matched' : 'missed',
        };
        cleanup();
        resolve({ matched: result, transcript: transcript.value });
      };

      activeCleanup = () => finish(false);

      const stream = await ensureMicAccess();
      if (!stream) { finish(false); return; }
      warmupVoskModel().catch((err) => {
        console.warn('Vosk model warmup failed:', err);
      });

      let voskReady = false;
      let browserReady = false;
      const WORD_SUSTAIN = 60; // ~1s for word reading progress bar

      debugState.value = {
        mode: 'word',
        target: targetWord,
        transcript: '',
        speechDetected: false,
        sustainFrames: 0,
        recognizer: 'starting',
        matchedBy: 'none',
        fallbackUsed: false,
        voskError: '',
        result: 'listening',
      };

      let preloadedModel = null;
      try {
        preloadedModel = await warmupVoskModel();
      } catch (err) {
        console.warn('Vosk setup failed before listening, using browser speech fallback if available:', err);
        debugState.value = {
          ...debugState.value,
          voskError: String(err?.message || err || 'unknown Vosk error'),
        };
      }

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        volumeHandle = setupVolumeAnalysis(
          stream, audioContext, sustainProgress, WORD_SUSTAIN,
          // onSustained: only pass if Vosk confirmed the word
          () => { if (wordMatch) finish(true); },
          // onSpeechEnded: child stopped talking — give Vosk a moment then evaluate
          () => {
            setTimeout(() => {
              debugState.value = {
                ...debugState.value,
                speechDetected: volumeHandle?.speechDetected ?? false,
                sustainFrames: volumeHandle?.getSustainedFrames?.() ?? 0,
              };
              if (!resolved) finish(wordMatch);
            }, 300);
          },
        );

        const target = targetWord.toLowerCase().trim();
        const grammarWords = [...new Set([
          target,
          ...target.split(/\s+/),
        ])];

        browserCleanup = startBrowserWordRecognition(
          target,
          (text) => {
            wordMatch = true;
            transcript.value = text;
            debugState.value = {
              ...debugState.value,
              transcript: text,
              recognizer: voskReady ? 'vosk+browser' : 'browser',
              matchedBy: 'browser-word',
            };
            if (!resolved) finish(true);
          },
          (text) => {
            transcript.value = text;
            debugState.value = {
              ...debugState.value,
              transcript: text,
              recognizer: voskReady ? 'vosk+browser' : 'browser',
            };
          },
        );
        browserReady = Boolean(browserCleanup);
        debugState.value = {
          ...debugState.value,
          recognizer: browserReady ? 'browser' : 'none',
        };

        if (preloadedModel) {
          recognizer = createRecognizer(preloadedModel, audioContext.sampleRate, grammarWords);
          voskReady = true;
          debugState.value = {
            ...debugState.value,
            recognizer: browserReady ? 'vosk+browser' : 'vosk',
          };

          const checkMatch = (text) => {
            if (!text || text === '[unk]') return;
            transcript.value = text;
            debugState.value = {
              ...debugState.value,
              transcript: text,
            };

            const spokenWords = text.toLowerCase().split(/\s+/);
            for (const spoken of spokenWords) {
              const clean = spoken.replace(/[^a-z]/g, '');
              if (clean === target) {
                wordMatch = true;
                break;
              }
            }

            const cleanFull = text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
            if (cleanFull === target) {
              wordMatch = true;
            }

            if (wordMatch) {
              debugState.value = {
                ...debugState.value,
                matchedBy: 'vosk-word',
              };
              finish(true);
            }
          };

          recognizer.on('result', (message) => {
            if (resolved) return;
            checkMatch(message.result?.text);
          });

          recognizer.on('partialresult', (message) => {
            if (resolved) return;
            checkMatch(message.result?.partial);
          });

          voskCleanup = pipeAudioToVosk(audioContext, stream, recognizer);
        } else {
          voskReady = false;
          debugState.value = {
            ...debugState.value,
            recognizer: browserReady ? 'browser' : 'none',
            fallbackUsed: browserReady,
          };
        }
      } catch (err) {
        console.error('Audio analysis setup failed:', err);
        debugState.value = {
          ...debugState.value,
          result: 'audio-error',
        };
        finish(false);
        return;
      }

      setTimeout(() => {
        if (voskReady || browserReady) {
          finish(wordMatch);
        } else {
          finish(volumeHandle?.getSustainedFrames() >= WORD_SUSTAIN);
        }
      }, duration);
    });
  }

  function cancelListening() {
    if (activeCleanup) {
      activeCleanup();
    }
    isListening.value = false;
    volume.value = 0;
    sustainProgress.value = 0;
  }

  return {
    isListening,
    matched,
    transcript,
    volume,
    sustainProgress,
    debugState,
    startListening,
    startWordListening,
    cancelListening,
    requestMicPermission,
  };
}
