import { ref } from 'vue';
import { ensureModel, createRecognizer } from '../services/voskService.js';
import { getGrammarForPhoneme, isPhonemeMatch } from '../data/phonemeGrammars.js';
import { usePhonemeLogic } from './usePhonemeLogic.js';

// Shared mic stream — request once, reuse everywhere
let sharedStream = null;

async function ensureMicAccess() {
  if (sharedStream && sharedStream.active) return sharedStream;
  try {
    sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return sharedStream;
  } catch (err) {
    console.error('Microphone access denied:', err);
    return null;
  }
}

export async function requestMicPermission() {
  return ensureMicAccess();
}

// Sustain target: 1.5 seconds at ~60fps = 90 frames
const SUSTAIN_FRAMES = 90;
// Plosive: just need a brief burst detected
const PLOSIVE_FRAMES = 15;
// Minimum speech frames before we consider it "real speech" (not noise)
// ~0.5s at 60fps — filters out coughs, bumps, background spikes
const SPEECH_MIN_FRAMES = 30;
// Silence after real speech: ~1.2s of quiet means they stopped talking
const SILENCE_CUTOFF_FRAMES = 72;
// Grace period at start: ignore audio for first ~1s to avoid picking up
// the TTS "Your turn!" prompt through the speakers
const GRACE_PERIOD_FRAMES = 60;

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
  const VOICE_THRESHOLD = 35;

  let sustainedFrames = 0;
  let totalSpeechFrames = 0;  // total frames above threshold (doesn't decay)
  let silenceFrames = 0;      // consecutive quiet frames after real speech
  let elapsedFrames = 0;      // total frames since start (for grace period)
  let animationId = null;
  let stopped = false;

  const loop = () => {
    if (stopped) return;
    elapsedFrames++;

    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const isSpeaking = rms > VOICE_THRESHOLD;

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
    stop() {
      stopped = true;
      if (animationId) cancelAnimationFrame(animationId);
      micSource.disconnect();
    },
  };
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

export function useSpeechRecognition() {
  const isListening = ref(false);
  const matched = ref(false);
  const transcript = ref('');
  const volume = ref(0);
  const sustainProgress = ref(0);

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
  function startListening(targetPhoneme, duration = 10000) {
    return new Promise(async (resolve) => {
      let resolved = false;
      let audioContext = null;
      let volumeHandle = null;
      let voskCleanup = null;
      let recognizer = null;

      isListening.value = true;
      matched.value = false;
      transcript.value = '';
      volume.value = 0;
      sustainProgress.value = 0;

      const cleanup = () => {
        if (volumeHandle) volumeHandle.stop();
        if (voskCleanup) voskCleanup();
        if (recognizer) { try { recognizer.remove(); } catch (_) {} }
        if (audioContext) audioContext.close().catch(() => {});
        volumeHandle = null;
        voskCleanup = null;
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
        cleanup();
        resolve({ matched: result, transcript: transcript.value });
      };

      activeCleanup = () => finish(false);

      const stream = await ensureMicAccess();
      if (!stream) { finish(false); return; }

      const params = getPhonemeParams(targetPhoneme);
      const isPlosive = params.type === 'plosive';
      const sustainTarget = isPlosive ? PLOSIVE_FRAMES : SUSTAIN_FRAMES;
      let voskMatched = false;
      let voskReady = false;

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        volumeHandle = setupVolumeAnalysis(
          stream, audioContext, sustainProgress, sustainTarget,
          // onSustained: sustained sound goal reached — only pass if Vosk confirmed
          () => {
            if (voskMatched) {
              finish(true);
            }
            // If Vosk hasn't matched yet, keep listening — don't pass on volume alone
          },
          // onSpeechEnded: child spoke then went silent — evaluate based on Vosk
          () => {
            // Give Vosk a brief moment to finalize recognition after speech stops
            setTimeout(() => { if (!resolved) finish(voskMatched); }, 300);
          },
        );

        // Load Vosk model and start recognition
        try {
          const model = await ensureModel();
          if (resolved) return;

          const grammar = getGrammarForPhoneme(targetPhoneme);
          recognizer = createRecognizer(model, audioContext.sampleRate, grammar);
          voskReady = true;

          const handleVoskText = (text) => {
            if (resolved || !text || text === '[unk]') return;
            transcript.value = text;
            if (isPhonemeMatch(targetPhoneme, text)) {
              voskMatched = true;
              // Plosives: Vosk match alone is enough (can't sustain them)
              // Sustain: Vosk match + sustained volume will trigger via onSustained
              if (isPlosive) finish(true);
            }
          };

          recognizer.on('result', (message) => handleVoskText(message.result?.text));
          recognizer.on('partialresult', (message) => handleVoskText(message.result?.partial));

          voskCleanup = pipeAudioToVosk(audioContext, stream, recognizer);
        } catch (err) {
          console.warn('Vosk setup failed, using volume-only fallback:', err);
          voskReady = false;
        }
      } catch (err) {
        console.error('Audio analysis setup failed:', err);
        finish(false);
        return;
      }

      // Hard timeout — if Vosk never loaded, fall back to volume-only
      setTimeout(() => {
        if (!voskReady) {
          // Vosk completely failed — accept any sustained effort
          finish(volumeHandle?.getSustainedFrames() >= sustainTarget);
        } else {
          finish(voskMatched);
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
      let recognizer = null;

      isListening.value = true;
      matched.value = false;
      transcript.value = '';
      volume.value = 0;
      sustainProgress.value = 0;

      const cleanup = () => {
        if (volumeHandle) volumeHandle.stop();
        if (voskCleanup) voskCleanup();
        if (recognizer) { try { recognizer.remove(); } catch (_) {} }
        if (audioContext) audioContext.close().catch(() => {});
        volumeHandle = null;
        voskCleanup = null;
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
        cleanup();
        resolve({ matched: result, transcript: transcript.value });
      };

      activeCleanup = () => finish(false);

      const stream = await ensureMicAccess();
      if (!stream) { finish(false); return; }

      let voskReady = false;
      const WORD_SUSTAIN = 60; // ~1s for word reading progress bar

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        volumeHandle = setupVolumeAnalysis(
          stream, audioContext, sustainProgress, WORD_SUSTAIN,
          // onSustained: only pass if Vosk confirmed the word
          () => { if (wordMatch) finish(true); },
          // onSpeechEnded: child stopped talking — give Vosk a moment then evaluate
          () => { setTimeout(() => { if (!resolved) finish(wordMatch); }, 300); },
        );

        const target = targetWord.toLowerCase().trim();
        const grammarWords = [...new Set([
          target,
          ...target.split(/\s+/),
        ])];

        try {
          const model = await ensureModel();
          if (resolved) return;

          recognizer = createRecognizer(model, audioContext.sampleRate, grammarWords);
          voskReady = true;

          const checkMatch = (text) => {
            if (!text || text === '[unk]') return;
            transcript.value = text;

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

            if (wordMatch) finish(true);
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
        } catch (err) {
          console.warn('Vosk setup failed, using volume-only fallback:', err);
          voskReady = false;
        }
      } catch (err) {
        console.error('Audio analysis setup failed:', err);
        finish(false);
        return;
      }

      setTimeout(() => {
        if (voskReady) {
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
    startListening,
    startWordListening,
    cancelListening,
    requestMicPermission,
  };
}
