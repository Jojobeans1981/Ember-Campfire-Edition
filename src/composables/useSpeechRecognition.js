import { ref } from 'vue';

const PHONEME_VARIANTS = {
  'm': ['m', 'mm', 'em', 'um', 'muh', 'ma', 'am'],
  's': ['s', 'ss', 'es', 'us', 'sss', 'suh', 'sa', 'as'],
  'a': ['a', 'ah', 'aa', 'aah', 'uh', 'ay'],
  't': ['t', 'tt', 'te', 'tee', 'tuh', 'ta'],
  'p': ['p', 'pp', 'pe', 'pee', 'puh', 'pa'],
  'n': ['n', 'nn', 'en', 'un', 'nuh', 'na', 'an'],
  'i': ['i', 'ee', 'ih', 'ii', 'it'],
  'c': ['c', 'k', 'kk', 'kuh', 'cuh', 'ke', 'ka', 'see'],
  'b': ['b', 'bb', 'be', 'bee', 'buh', 'ba'],
  'f': ['f', 'ff', 'ef', 'fff', 'fuh', 'fa'],
  'l': ['l', 'll', 'el', 'luh', 'la', 'al'],
  'o': ['o', 'oh', 'oo', 'awe', 'aw'],
  'h': ['h', 'hh', 'huh', 'ha', 'hey'],
  'd': ['d', 'dd', 'de', 'dee', 'duh', 'da'],
  'g': ['g', 'gg', 'ge', 'gee', 'guh', 'ga'],
  'e': ['e', 'eh', 'ee', 'air'],
  'r': ['r', 'rr', 'er', 'are', 'ruh', 'ra', 'ar'],
  'u': ['u', 'uh', 'oo'],
  'k': ['k', 'kk', 'kay', 'kuh', 'ka'],
  'w': ['w', 'ww', 'wuh', 'wa', 'double u'],
  'j': ['j', 'jj', 'jay', 'juh', 'ja'],
  'y': ['y', 'yy', 'yuh', 'ya', 'yee'],
  'x': ['x', 'xx', 'ex', 'ks', 'eks'],
  'q': ['q', 'qq', 'kw', 'cue', 'queue', 'ku'],
  'z': ['z', 'zz', 'zee', 'zuh', 'za'],
  'v': ['v', 'vv', 'vee', 'vuh', 'va'],
};

export function getPhonemeVariants(phoneme) {
  return PHONEME_VARIANTS[phoneme] || [phoneme];
}

// Shared mic stream — request once, reuse everywhere
let sharedStream = null;
let micPermissionGranted = false;

async function ensureMicAccess() {
  if (sharedStream && sharedStream.active) return sharedStream;
  try {
    sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micPermissionGranted = true;
    return sharedStream;
  } catch (err) {
    console.error('Microphone access denied:', err);
    micPermissionGranted = false;
    return null;
  }
}

// Call this early (e.g. on app load after user interaction) to prompt permission
export async function requestMicPermission() {
  return ensureMicAccess();
}

export function useSpeechRecognition() {
  const isListening = ref(false);
  const matched = ref(false);
  const transcript = ref('');
  const volume = ref(0);          // 0-100, live mic volume for UI feedback
  const sustainProgress = ref(0); // 0-100, how much sustained sound detected

  /**
   * Listen for a phoneme using dual-layer detection:
   * Layer 1: Mic volume analysis via getUserMedia + AudioContext (always works)
   * Layer 2: Web Speech Recognition API for actual phoneme matching (when available)
   *
   * Success = sustained sound above threshold for enough frames,
   *           OR speech recognition matches the target phoneme.
   */
  function startListening(targetPhoneme, duration = 4000) {
    return new Promise(async (resolve) => {
      let resolved = false;
      let speechRecognitionMatch = false;
      let recognition = null;
      let audioContext = null;
      let animationId = null;
      let micSource = null;

      isListening.value = true;
      matched.value = false;
      transcript.value = '';
      volume.value = 0;
      sustainProgress.value = 0;

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        isListening.value = false;
        matched.value = result;
        volume.value = 0;

        // Cleanup audio analysis
        if (animationId) cancelAnimationFrame(animationId);
        if (micSource) micSource.disconnect();
        if (audioContext) audioContext.close().catch(() => {});

        // Cleanup speech recognition
        if (recognition) {
          try { recognition.stop(); } catch (_) {}
        }

        resolve({ matched: result, transcript: transcript.value });
      };

      // --- Layer 1: Mic volume analysis ---
      const stream = await ensureMicAccess();
      if (!stream) {
        // No mic access — can't listen at all
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

        // Volume threshold: child needs to produce sound louder than ambient
        const VOLUME_THRESHOLD = 30;
        // How many frames of sustained sound = success (at ~60fps, 40 frames ≈ 0.7s of sound)
        const SUSTAIN_TARGET = 40;
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

          if (rms > VOLUME_THRESHOLD) {
            sustainedFrames++;
            sustainProgress.value = Math.min(100, Math.round((sustainedFrames / SUSTAIN_TARGET) * 100));

            if (sustainedFrames >= SUSTAIN_TARGET) {
              // Enough sustained sound detected — count as success
              finish(true);
              return;
            }
          }

          animationId = requestAnimationFrame(analyzeVolume);
        };

        analyzeVolume();
      } catch (err) {
        console.error('Audio analysis setup failed:', err);
        // Continue with speech recognition only if available
      }

      // --- Layer 2: Speech Recognition (bonus layer) ---
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        try {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = 'en-US';
          recognition.maxAlternatives = 5;

          recognition.onresult = (event) => {
            const variants = getPhonemeVariants(targetPhoneme);
            for (let i = 0; i < event.results.length; i++) {
              for (let j = 0; j < event.results[i].length; j++) {
                const text = event.results[i][j].transcript.toLowerCase().trim();
                transcript.value = text;
                if (variants.some(v => text.includes(v))) {
                  speechRecognitionMatch = true;
                }
              }
            }
            if (speechRecognitionMatch) {
              finish(true);
            }
          };

          recognition.onerror = (e) => {
            // 'no-speech' and 'aborted' are expected — don't treat as failure
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
              console.warn('Speech recognition error:', e.error);
            }
          };

          recognition.onend = () => {
            // Speech recognition ended on its own — don't resolve yet,
            // let volume analysis continue until timeout
          };

          recognition.start();
        } catch (err) {
          console.warn('Speech recognition failed to start:', err);
        }
      }

      // Timeout — if neither layer succeeded
      setTimeout(() => {
        finish(speechRecognitionMatch || sustainProgress.value >= 80);
      }, duration);
    });
  }

  /**
   * Listen for a word. Same dual-layer approach but with word matching.
   */
  function startWordListening(targetWord, duration = 5000) {
    return new Promise(async (resolve) => {
      let resolved = false;
      let wordMatch = false;
      let recognition = null;
      let audioContext = null;
      let animationId = null;
      let micSource = null;

      isListening.value = true;
      matched.value = false;
      transcript.value = '';
      volume.value = 0;
      sustainProgress.value = 0;

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        isListening.value = false;
        matched.value = result;
        volume.value = 0;

        if (animationId) cancelAnimationFrame(animationId);
        if (micSource) micSource.disconnect();
        if (audioContext) audioContext.close().catch(() => {});
        if (recognition) {
          try { recognition.stop(); } catch (_) {}
        }

        resolve({ matched: result, transcript: transcript.value });
      };

      // --- Layer 1: Mic volume analysis ---
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
        const VOLUME_THRESHOLD = 30;
        const SUSTAIN_TARGET = 50; // Words need more sustained sound
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

          if (rms > VOLUME_THRESHOLD) {
            sustainedFrames++;
            sustainProgress.value = Math.min(100, Math.round((sustainedFrames / SUSTAIN_TARGET) * 100));

            if (sustainedFrames >= SUSTAIN_TARGET) {
              finish(true);
              return;
            }
          }

          animationId = requestAnimationFrame(analyzeVolume);
        };

        analyzeVolume();
      } catch (err) {
        console.error('Audio analysis setup failed:', err);
      }

      // --- Layer 2: Speech Recognition ---
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        try {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = 'en-US';
          recognition.maxAlternatives = 5;

          recognition.onresult = (event) => {
            const target = targetWord.toLowerCase();
            for (let i = 0; i < event.results.length; i++) {
              for (let j = 0; j < event.results[i].length; j++) {
                const text = event.results[i][j].transcript.toLowerCase().trim();
                transcript.value = text;
                if (text.includes(target) || target.includes(text)) {
                  wordMatch = true;
                }
              }
            }
            if (wordMatch) {
              finish(true);
            }
          };

          recognition.onerror = (e) => {
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
              console.warn('Speech recognition error:', e.error);
            }
          };

          recognition.onend = () => {};

          recognition.start();
        } catch (err) {
          console.warn('Speech recognition failed to start:', err);
        }
      }

      setTimeout(() => {
        finish(wordMatch || sustainProgress.value >= 80);
      }, duration);
    });
  }

  return {
    isListening,
    matched,
    transcript,
    volume,           // Live mic volume 0-100 for UI feedback
    sustainProgress,  // Progress toward sustained sound goal 0-100
    startListening,
    startWordListening,
    requestMicPermission,
  };
}
