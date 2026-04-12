<template>
  <div class="campfire-module">
    <div class="guardian-presence" v-if="store.selectedFriend">
      <img :src="'/assets/friends/' + store.selectedFriend.file" class="helper-img" />
      <div class="controls">
        <button @click="teachSound" class="teacher-btn">í´Š Hear '{{ currentPhoneme }}'</button>
      </div>
    </div>

    <div class="cloud-focus">
      <div class="cloud-body" :class="{ 'is-hearing': isHearing }">
        <span class="letter">{{ currentPhoneme }}</span>
      </div>
      <p class="sub-label">Listening for your sound...</p>
      <div class="meter-container">
        <div class="meter-fill" :style="{ width: sustainProgress + '%' }"></div>
      </div>
    </div>

    <div class="training-switcher">
       <button @click="setPhoneme('m')" :class="{active: currentPhoneme === 'm'}">Phoneme M</button>
       <button @click="setPhoneme('s')" :class="{active: currentPhoneme === 's'}">Phoneme S</button>
    </div>

    <div class="hearth">
      <div v-if="!campfireLit" class="logs">íºµ</div>
      <div v-else class="flame">í´¥</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { store } from '../../store';

const currentPhoneme = ref('m');
const campfireLit = ref(false);
const isHearing = ref(false);
const sustainProgress = ref(0);
let recognizer = null;

const setPhoneme = (p) => {
  currentPhoneme.value = p;
  sustainProgress.value = 0;
  campfireLit.value = false;
};

const teachSound = () => {
  const audio = new Audio(`/audio/phonemes/${currentPhoneme.value}.mp3`);
  audio.play();
};

onMounted(async () => {
  await setupTFJS();
});

onUnmounted(() => {
  if (recognizer) recognizer.stopListening();
});

const setupTFJS = async () => {
  try {
    recognizer = speechCommands.create("BROWSER_FFT");
    await recognizer.ensureModelLoaded();

    recognizer.listen(result => {
      const isM = currentPhoneme.value === 'm' && checkM(result.spectrogram);
      const isS = currentPhoneme.value === 's' && checkS(result.spectrogram);

      if ((isM || isS) && !campfireLit.value) {
        isHearing.value = true;
        sustainProgress.value += 2.5;
        if (sustainProgress.value >= 100) triggerCelebration();
      } else {
        isHearing.value = false;
        sustainProgress.value = Math.max(0, sustainProgress.value - 1.0);
      }
    }, {
      includeSpectrogram: true,
      probabilityThreshold: 0.75,
      overlapFactor: 0.5
    });
  } catch (err) {
    console.error("TFJS failed to start:", err);
  }
};

const checkM = (spec) => {
  // Low-frequency nasal energy
  return spec.data[0] > 0.45 || spec.data[1] > 0.45;
};

const checkS = (spec) => {
  // High-frequency sibilant energy
  const highStart = spec.data.length - 10;
  let sum = 0;
  for(let i = highStart; i < spec.data.length; i++) sum += spec.data[i];
  return (sum / 10) > 0.35;
};

const triggerCelebration = () => {
  if (campfireLit.value) return;
  campfireLit.value = true;
  store.xp += 50;
  if (window.confetti) window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
};
</script>

<style scoped>
.campfire-module { display: flex; flex-direction: column; align-items: center; width: 100%; text-align: center; }
.teacher-btn { margin: 10px; background: rgba(100, 255, 218, 0.1); border: 2px solid #64FFDA; color: #64FFDA; border-radius: 50px; padding: 12px 24px; cursor: pointer; font-weight: bold; }
.cloud-body { width: 240px; height: 140px; background: #1a1c23; border-radius: 100px; display: flex; align-items: center; justify-content: center; border: 4px solid #333; transition: 0.3s; }
.is-hearing { border-color: #FF8C00; box-shadow: 0 0 50px rgba(255, 140, 0, 0.4); }
.letter { font-size: 90px; font-weight: bold; color: #FF8C00; }
.meter-container { width: 320px; height: 16px; background: #111; border-radius: 20px; margin-top: 25px; border: 1px solid #333; overflow: hidden; }
.meter-fill { height: 100%; background: #FF8C00; }
.training-switcher { margin-top: 30px; display: flex; gap: 15px; }
.training-switcher button { background: #1a1c23; border: 1px solid #333; color: white; padding: 10px 20px; border-radius: 12px; cursor: pointer; }
.training-switcher button.active { border-color: #64FFDA; color: #64FFDA; }
.hearth { font-size: 100px; margin-top: 40px; }
.sub-label { margin-top: 10px; opacity: 0.6; font-size: 0.9rem; letter-spacing: 0.05em; }
</style>
