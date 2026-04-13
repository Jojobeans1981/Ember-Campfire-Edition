import { ref } from 'vue';

const isSpeaking = ref(false);
const currentText = ref('');

export function useEmber() {
  function speak(text, options = {}) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }
      // Cancel any in-progress speech
      window.speechSynthesis.cancel();

      currentText.value = text;
      isSpeaking.value = true;

      const utterance = new SpeechSynthesisUtterance(text);
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
      const audio = new Audio(`/audio/phonemes/${phoneme}.mp3`);
      audio.onended = resolve;
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
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
    isSpeaking.value = false;
    currentText.value = '';
  }

  return { isSpeaking, currentText, speak, playPhoneme, teachPhoneme, runNarration, stopSpeaking };
}
