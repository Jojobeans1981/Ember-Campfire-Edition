<template>
  <div class="campfire">
    <img v-if="store.selectedFriend" :src="'/assets/friends/' + store.selectedFriend.file" class="guardian-img" />
    <h2>Phoneme: {{ currentPhoneme.toUpperCase() }}</h2>
    <button class="listen-btn" @click="playAndListen">🎤 Hear & Say '{{ currentPhoneme }}'</button>
    <div class="meter">
      <div class="meter-fill" :style="{ width: progress + '%' }"></div>
    </div>
    <p v-if="isListening">Listening...</p>
    <div v-if="campfireLit" class="success">🔥 Great job!</div>
    <div class="phoneme-picker">
      <button v-for="p in phonemes" :key="p" :class="{ active: currentPhoneme === p }" @click="setPhoneme(p)">
        {{ p.toUpperCase() }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { store } from '../../store';
import { pushEvent } from '../../store/events';
import { skillState } from '../../store';

const phonemes = ['m', 's', 't', 'a', 'p', 'n', 'i', 'c'];
const currentPhoneme = ref('m');
const campfireLit = ref(false);
const isListening = ref(false);
const progress = ref(0);

let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let animationId = null;

const setPhoneme = (p) => {
  currentPhoneme.value = p;
  progress.value = 0;
  campfireLit.value = false;
};

const playAndListen = async () => {
  if (isListening.value) return;

  // Play the phoneme sound and wait for it to finish
  const audio = new Audio(`/audio/phonemes/${currentPhoneme.value}.mp3`);
  try {
    await audio.play();
  } catch (err) {
    console.error('Audio playback failed:', err);
    alert('Could not play audio. Please interact with the page first (browser autoplay policy).');
    return;
  }

  // Wait for playback to finish before listening
  await new Promise((resolve) => {
    audio.addEventListener('ended', resolve);
    // Fallback in case 'ended' doesn't fire
    setTimeout(resolve, (audio.duration || 2) * 1000 + 500);
  });

  // Now start listening for the user's attempt
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    microphone.connect(analyser);

    dataArray = new Uint8Array(analyser.frequencyBinCount);
    isListening.value = true;
    progress.value = 0;

    // Also set up speech recognition for actual phoneme evaluation
    let speechMatch = false;
    let recognition = null;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 5;

      recognition.onresult = (event) => {
        for (let i = 0; i < event.results.length; i++) {
          for (let j = 0; j < event.results[i].length; j++) {
            const transcript = event.results[i][j].transcript.toLowerCase().trim();
            // Check if the spoken sound matches the target phoneme
            // Phonemes are single letters, so check if the transcript contains
            // the phoneme sound or its common pronunciations
            const phonemeSounds = getPhonemeVariants(currentPhoneme.value);
            if (phonemeSounds.some(sound => transcript.includes(sound))) {
              speechMatch = true;
            }
          }
        }
      };

      recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err.error);
      };

      recognition.start();
    }

    const startTime = Date.now();
    const duration = 4000;

    const checkSound = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

      // Only advance progress if both volume and speech match criteria are met
      if (average > 25) {
        // If speech recognition is available, require a match for full progress
        // Otherwise fall back to volume-based detection with stricter threshold
        if (speechMatch) {
          progress.value = Math.min(100, progress.value + 8);
        } else if (!recognition) {
          // No speech recognition available — use stricter volume-only fallback
          if (average > 40) {
            progress.value = Math.min(100, progress.value + 2);
          }
        } else {
          // Speech recognition is running but no match yet — show partial progress
          progress.value = Math.min(50, progress.value + 1);
        }
      }

      if (progress.value >= 100) {
        if (recognition) {
          try { recognition.stop(); } catch (_) {}
        }
        success();
      } else if (Date.now() - startTime < duration) {
        animationId = requestAnimationFrame(checkSound);
      } else {
        if (recognition) {
          try { recognition.stop(); } catch (_) {}
        }
        stopListening();
      }
    };

    checkSound();
  } catch (err) {
    console.error('Microphone error:', err);
    alert('Could not access microphone. Please allow microphone permissions.');
  }
};

// Map each phoneme to variants that speech recognition might return
const getPhonemeVariants = (phoneme) => {
  const variants = {
    'm': ['m', 'mm', 'em', 'um', 'muh'],
    's': ['s', 'ss', 'es', 'us', 'sss', 'suh'],
    't': ['t', 'tt', 'te', 'tee', 'tuh'],
    'a': ['a', 'ah', 'aa', 'aah', 'uh'],
    'p': ['p', 'pp', 'pe', 'pee', 'puh'],
    'n': ['n', 'nn', 'en', 'un', 'nuh'],
    'i': ['i', 'ee', 'ih', 'ii'],
    'c': ['c', 'k', 'kk', 'kuh', 'cuh', 'ke'],
  };
  return variants[phoneme] || [phoneme];
};

const success = () => {
  stopListening();
  campfireLit.value = true;
  store.xp += 50;

  pushEvent({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    sessionId: 'session-001',
    lessonRunId: null,
    activityRunId: 'campfire',
    stepId: null,
    itemId: 'say-' + currentPhoneme.value,
    conceptSlugs: [currentPhoneme.value],
    modality: 'speech_single_word',
    response: { said: currentPhoneme.value },
    correct: true,
    confidence: 1,
    supportLevel: skillState[currentPhoneme.value].currentSupportLevel,
    responseLatencyMs: null,
    attemptNumber: 1,
    wasRetryAfterPrompt: false,
  });
};

const stopListening = () => {
  isListening.value = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (microphone) {
    microphone.disconnect();
    // Stop all tracks on the underlying stream to release the mic
    if (microphone.mediaStream) {
      microphone.mediaStream.getTracks().forEach(track => track.stop());
    }
    microphone = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
};
</script>

<style scoped>
.campfire {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.5rem;
  max-width: 90vw;
}
.guardian-img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 0.5rem;
}
.listen-btn {
  background: rgba(100, 255, 218, 0.1);
  border: 2px solid #64FFDA;
  color: #64FFDA;
  padding: 0.5rem 1rem;
  border-radius: 2rem;
  cursor: pointer;
}
.meter {
  width: 100%;
  max-width: 300px;
  height: 10px;
  background: #333;
  border-radius: 5px;
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  background: #FF8C00;
  transition: width 0.1s;
}
.phoneme-picker {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.5rem;
}
.phoneme-picker button {
  background: #222;
  border: none;
  color: #888;
  padding: 0.3rem 0.6rem;
  border-radius: 0.3rem;
  cursor: pointer;
}
.phoneme-picker button.active {
  background: #64FFDA;
  color: #05070A;
}
.success {
  font-size: 2rem;
  margin-top: 0.5rem;
}
</style>
