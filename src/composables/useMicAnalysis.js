import { ref } from 'vue';

export const useMicAnalysis = () => {
  const volume = ref(0);
  const isSustaining = ref(false);

  let animationId = null;
  let audioContext = null;

  const startAnalysis = (stream) => {
    stopAnalysis(); // Clean up any previous session

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      volume.value = Math.sqrt(sum / bufferLength);
      isSustaining.value = volume.value > 50;

      animationId = requestAnimationFrame(update);
    };
    update();
  };

  const stopAnalysis = () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    volume.value = 0;
    isSustaining.value = false;
  };

  return { volume, isSustaining, startAnalysis, stopAnalysis };
};
