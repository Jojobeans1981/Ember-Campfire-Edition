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

/**
 * Set up the volume analysis loop (shared between phoneme and word listening).
 * Returns { analyser, cleanup, sustainedFrames getter }.
 */
function setupVolumeAnalysis(stream, audioContext, volume, sustainProgress, voiceThreshold, sustainTarget, decayRate, onSustained) {
  const micSource = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  micSource.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  let sustainedFrames = 0;
  let animationId = null;
  let stopped = false;

  const loop = () => {
    if (stopped) return;

    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    volume.value = Math.min(100, Math.round(rms));

    if (rms > voiceThreshold) {
      sustainedFrames++;
    } else {
      sustainedFrames = Math.max(0, sustainedFrames - decayRate);
    }

    sustainProgress.value = Math.min(100, Math.round((sustainedFrames / sustainTarget) * 100));

    if (sustainedFrames >= sustainTarget && onSustained) {
      onSustained();
    }

    animationId = requestAnimationFrame(loop);
  };

  loop();

  return {
    micSource,
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
  // ScriptProcessorNode is deprecated but works everywhere and avoids
  // needing a separate AudioWorklet file. Pragmatic choice for now.
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);
    // Copy the buffer — Vosk processes asynchronously
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
   * Listen for a PHONEME using Vosk + volume analysis.
   *
   * Vosk is grammar-constrained to words matching the target phoneme.
   * Volume analysis runs in parallel for the UI meters and as a fallback.
   * For plosive phonemes the sustain threshold is lowered since they're brief.
   */
  function startListening(targetPhoneme, duration = 6000) {
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

      // Determine sustain thresholds based on phoneme type
      const params = getPhonemeParams(targetPhoneme);
      const isPlosive = params.type === 'plosive';
      const VOICE_THRESHOLD = 35;
      const SUSTAIN_TARGET = isPlosive ? 30 : 120;
      const DECAY_RATE = 2;
      let voskMatched = false;

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Start volume analysis (UI meters + fallback)
        volumeHandle = setupVolumeAnalysis(
          stream, audioContext, volume, sustainProgress,
          VOICE_THRESHOLD, SUSTAIN_TARGET, DECAY_RATE,
          () => {
            // Sustained volume reached — pass if Vosk also matched,
            // or pass anyway as fallback for unclear speech
            if (voskMatched || !voskReady) {
              finish(true);
            }
          },
        );

        // Start Vosk recognition
        let voskReady = false;
        try {
          const model = await ensureModel();
          if (resolved) return; // cancelled during model load

          const grammar = getGrammarForPhoneme(targetPhoneme);
          recognizer = createRecognizer(model, audioContext.sampleRate, grammar);
          voskReady = true;

          recognizer.on('result', (message) => {
            if (resolved) return;
            const text = message.result?.text || '';
            if (text && text !== '[unk]') {
              transcript.value = text;
              if (isPhonemeMatch(targetPhoneme, text)) {
                voskMatched = true;
                // For plosives, Vosk match alone is sufficient
                if (isPlosive) {
                  finish(true);
                }
                // For sustain phonemes, wait for volume to also confirm
              }
            }
          });

          recognizer.on('partialresult', (message) => {
            if (resolved) return;
            const partial = message.result?.partial || '';
            if (partial && partial !== '[unk]') {
              transcript.value = partial;
              if (isPhonemeMatch(targetPhoneme, partial)) {
                voskMatched = true;
                if (isPlosive) {
                  finish(true);
                }
              }
            }
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

      setTimeout(() => finish(voskMatched), duration);
    });
  }

  /**
   * Listen for a WORD using Vosk + volume analysis.
   *
   * Vosk is grammar-constrained to the target word(s).
   * Volume analysis runs for UI feedback.
   */
  function startWordListening(targetWord, duration = 6000) {
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

      const VOICE_THRESHOLD = 35;
      const SUSTAIN_TARGET = 80;
      const DECAY_RATE = 2;
      let voskReady = false;

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Volume analysis for UI + fallback
        volumeHandle = setupVolumeAnalysis(
          stream, audioContext, volume, sustainProgress,
          VOICE_THRESHOLD, SUSTAIN_TARGET, DECAY_RATE,
          () => {
            // Volume-based fallback only when Vosk isn't available
            if (!voskReady) finish(true);
          },
        );

        // Build grammar from target word(s)
        const target = targetWord.toLowerCase().trim();
        const grammarWords = [...new Set([
          target,
          ...target.split(/\s+/), // individual words for sentences
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

            // Also check full transcript match
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
          finish(volumeHandle?.getSustainedFrames() >= SUSTAIN_TARGET);
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
