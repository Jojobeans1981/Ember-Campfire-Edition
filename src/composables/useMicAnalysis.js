import { ref } from 'vue';

export const useMicAnalysis = () => {
  const volume = ref(0);
  const isSustaining = ref(false);

  const startAnalysis = (stream) => {
    const audioContext = new AudioContext();
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
      volume.value = Math.sqrt(sum / bufferLength); // RMS Calculation
      
      // Sustain logic (threshold of 50 for example)
      isSustaining.value = volume.value > 50;
      
      requestAnimationFrame(update);
    };
    update();
  };

  return { volume, isSustaining, startAnalysis };
};
