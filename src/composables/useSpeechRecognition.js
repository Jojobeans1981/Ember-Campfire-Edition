import { ref } from 'vue';

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

export function useSpeechRecognition() {
  const isListening = ref(false);
  const matched = ref(false);
  const transcript = ref('');
  const volume = ref(0);           // 0-100 live mic volume for UI
  const sustainProgress = ref(0);  // 0-100 progress toward sustained sound goal

  let activeCleanup = null;

  /**
   * Listen for a PHONEME.
   *
   * Phonemes are single sounds that the Web Speech API cannot reliably
   * distinguish (e.g. /m/ vs /s/ vs /t/). Instead, we verify the child
   * is making a deliberate, sustained vocal effort:
   *
   * - Mic must detect sound above the volume threshold
   * - Sound must be sustained for ~2 seconds (120 frames at 60fps)
   * - Progress bar fills as they hold the sound
   * - Brief noises, coughs, or background sounds won't fill the bar
   *   because frames below threshold don't count and the bar decays
   *
   * This approach is used by most children's reading apps for phoneme
   * practice — it verifies effort without false-positive recognition.
   */
  function startListening(targetPhoneme, duration = 6000) {
    return new Promise(async (resolve) => {
      let resolved = false;
      let audioContext = null;
      let animationId = null;
      let micSource = null;

      isListening.value = true;
      matched.value = false;
      transcript.value = '';
      volume.value = 0;
      sustainProgress.value = 0;

      const cleanup = () => {
        if (animationId) cancelAnimationFrame(animationId);
        if (micSource) micSource.disconnect();
        if (audioContext) audioContext.close().catch(() => {});
        animationId = null;
        micSource = null;
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
      if (!stream) {
        finish(false);
        return;
      }

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        micSource = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        micSource.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Thresholds tuned for child speech:
        // - VOICE_THRESHOLD: must be actual voice, not ambient noise
        // - SUSTAIN_TARGET: ~2 seconds of sustained sound at 60fps
        // - DECAY_RATE: progress decays when child stops making sound,
        //   preventing brief noises from accumulating to a pass
        const VOICE_THRESHOLD = 35;
        const SUSTAIN_TARGET = 120;
        const DECAY_RATE = 2;
        let sustainedFrames = 0;

        const analyzeVolume = () => {
          if (resolved) return;

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength);
          volume.value = Math.min(100, Math.round(rms));

          if (rms > VOICE_THRESHOLD) {
            // Sound detected — accumulate progress
            sustainedFrames++;
          } else {
            // Silence — decay progress so brief noises don't accumulate
            sustainedFrames = Math.max(0, sustainedFrames - DECAY_RATE);
          }

          sustainProgress.value = Math.min(100, Math.round((sustainedFrames / SUSTAIN_TARGET) * 100));

          if (sustainedFrames >= SUSTAIN_TARGET) {
            finish(true);
            return;
          }

          animationId = requestAnimationFrame(analyzeVolume);
        };

        analyzeVolume();
      } catch (err) {
        console.error('Audio analysis setup failed:', err);
        finish(false);
        return;
      }

      // Timeout — if they didn't sustain long enough, fail
      setTimeout(() => finish(false), duration);
    });
  }

  /**
   * Listen for a WORD.
   *
   * Words CAN be recognized by the Web Speech API, so we use a strict
   * matching approach:
   * - Speech recognition must return a transcript that closely matches
   *   the target word (exact match or very close)
   * - Volume detection runs for visual feedback
   * - Falls back to sustained volume if Speech API unavailable
   */
  function startWordListening(targetWord, duration = 6000) {
    return new Promise(async (resolve) => {
      let resolved = false;
      let wordMatch = false;
      let speechRecognitionAvailable = false;
      let recognition = null;
      let audioContext = null;
      let animationId = null;
      let micSource = null;

      isListening.value = true;
      matched.value = false;
      transcript.value = '';
      volume.value = 0;
      sustainProgress.value = 0;

      const cleanup = () => {
        if (animationId) cancelAnimationFrame(animationId);
        if (micSource) micSource.disconnect();
        if (audioContext) audioContext.close().catch(() => {});
        if (recognition) {
          try { recognition.abort(); } catch (_) {}
        }
        animationId = null;
        micSource = null;
        audioContext = null;
        recognition = null;
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
      if (!stream) {
        finish(false);
        return;
      }

      // --- Volume analysis for visual feedback + fallback ---
      let sustainedFrames = 0;
      const VOICE_THRESHOLD = 35;
      const SUSTAIN_TARGET = 80;
      const DECAY_RATE = 2;

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        micSource = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        micSource.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const analyzeVolume = () => {
          if (resolved) return;

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength);
          volume.value = Math.min(100, Math.round(rms));

          if (rms > VOICE_THRESHOLD) {
            sustainedFrames++;
          } else {
            sustainedFrames = Math.max(0, sustainedFrames - DECAY_RATE);
          }

          sustainProgress.value = Math.min(100, Math.round((sustainedFrames / SUSTAIN_TARGET) * 100));

          // Only use volume-based pass when speech recognition is NOT available
          if (!speechRecognitionAvailable && sustainedFrames >= SUSTAIN_TARGET) {
            finish(true);
            return;
          }

          animationId = requestAnimationFrame(analyzeVolume);
        };

        analyzeVolume();
      } catch (err) {
        console.error('Audio analysis setup failed:', err);
      }

      // --- Speech Recognition for word matching ---
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        try {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';
          recognition.maxAlternatives = 5;
          speechRecognitionAvailable = true;

          recognition.onresult = (event) => {
            const target = targetWord.toLowerCase().trim();
            for (let i = 0; i < event.results.length; i++) {
              for (let j = 0; j < event.results[i].length; j++) {
                const text = event.results[i][j].transcript.toLowerCase().trim();
                transcript.value = text;

                // Strict word matching:
                // Split transcript into words and check if any word matches target
                const spokenWords = text.split(/\s+/);
                for (const spoken of spokenWords) {
                  // Clean punctuation
                  const clean = spoken.replace(/[^a-z]/g, '');
                  if (clean === target) {
                    wordMatch = true;
                    break;
                  }
                }

                // Also accept if the entire short transcript IS the target
                const cleanFull = text.replace(/[^a-z\s]/g, '').trim();
                if (cleanFull === target) {
                  wordMatch = true;
                }
              }
              if (wordMatch) break;
            }
            if (wordMatch) {
              finish(true);
            }
          };

          recognition.onerror = (e) => {
            if (e.error === 'not-allowed') {
              console.error('Mic permission denied for speech recognition');
            }
          };

          recognition.onend = () => {
            if (!resolved && recognition) {
              try { recognition.start(); } catch (_) {}
            }
          };

          recognition.start();
        } catch (err) {
          console.warn('Speech recognition failed to start:', err);
          speechRecognitionAvailable = false;
        }
      }

      // Timeout
      setTimeout(() => {
        if (speechRecognitionAvailable) {
          // With speech recognition: only pass on actual word match
          finish(wordMatch);
        } else {
          // Without speech recognition: pass if sustained sound detected
          finish(sustainedFrames >= SUSTAIN_TARGET);
        }
      }, duration);
    });
  }

  /**
   * Force-cancel any active listening session.
   */
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
