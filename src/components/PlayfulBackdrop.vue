<template>
  <div class="playful-backdrop" :class="`variant-${variant}`" aria-hidden="true">
    <div class="color-halo halo-a"></div>
    <div class="color-halo halo-b"></div>
    <div class="color-halo halo-c"></div>

    <div v-if="variant === 'selection'" class="selection-party">
      <div class="marquee-arch">
        <span v-for="light in marqueeLights" :key="light" class="marquee-light"></span>
      </div>
      <span class="balloon balloon-left"></span>
      <span class="balloon balloon-right"></span>
      <span class="balloon balloon-center"></span>
      <span class="confetti-swirl swirl-left"></span>
      <span class="confetti-swirl swirl-right"></span>
    </div>

    <div v-if="variant === 'campground'" class="forest-magic">
      <div class="moon-halo"></div>
      <div class="moon-disc"></div>
      <span v-for="tree in pines" :key="tree.id" class="pine" :style="{ '--x': tree.x, '--scale': tree.scale }"></span>
      <span class="mist mist-a"></span>
      <span class="mist mist-b"></span>
    </div>

    <div v-if="variant === 'trail'" class="trail-treasure">
      <div class="treasure-path"></div>
      <span v-for="coin in rewardCoins" :key="coin.id" class="reward-coin" :style="{ '--x': coin.x, '--y': coin.y, '--delay': `${coin.delay}s` }"></span>
      <span class="compass compass-a"></span>
      <span class="compass compass-b"></span>
    </div>

    <div class="pennant-ribbon">
      <span v-for="flag in pennantFlags" :key="flag" class="pennant"></span>
    </div>

    <span
      v-for="cloud in clouds"
      :key="cloud.id"
      class="cloud"
      :style="{
        '--x': cloud.x,
        '--y': cloud.y,
        '--scale': cloud.scale,
        '--duration': `${cloud.duration}s`,
        '--delay': `${cloud.delay}s`,
      }"
    ></span>

    <span
      v-for="spark in fireflies"
      :key="spark.id"
      class="firefly"
      :style="{
        '--x': spark.x,
        '--y': spark.y,
        '--scale': spark.scale,
        '--duration': `${spark.duration}s`,
        '--delay': `${spark.delay}s`,
      }"
    ></span>

    <span
      v-for="orb in driftOrbs"
      :key="orb.id"
      class="drift-orb"
      :style="{
        '--x': orb.x,
        '--y': orb.y,
        '--size': `${orb.size}px`,
        '--duration': `${orb.duration}s`,
        '--delay': `${orb.delay}s`,
      }"
    ></span>

    <div class="lantern lantern-left"></div>
    <div class="lantern lantern-right"></div>

    <div class="meadow">
      <div class="meadow-rise rise-left"></div>
      <div class="meadow-rise rise-right"></div>

      <span
        v-for="reed in reeds"
        :key="reed.id"
        class="reed"
        :style="{
          '--x': reed.x,
          '--height': `${reed.height}px`,
          '--tilt': `${reed.tilt}deg`,
          '--duration': `${reed.duration}s`,
          '--delay': `${reed.delay}s`,
        }"
      ></span>

      <span
        v-for="flower in flowers"
        :key="flower.id"
        class="flower"
        :style="{
          '--x': flower.x,
          '--scale': flower.scale,
          '--delay': `${flower.delay}s`,
        }"
      ></span>

      <span
        v-for="mushroom in mushrooms"
        :key="mushroom.id"
        class="mushroom"
        :style="{
          '--x': mushroom.x,
          '--scale': mushroom.scale,
          '--delay': `${mushroom.delay}s`,
        }"
      ></span>

      <span
        v-for="stone in stones"
        :key="stone.id"
        class="stone"
        :style="{
          '--x': stone.x,
          '--width': `${stone.width}px`,
        }"
      ></span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'default',
  },
});

const pennantFlags = Array.from({ length: 16 }, (_, index) => index + 1);
const marqueeLights = Array.from({ length: 22 }, (_, index) => index + 1);

const clouds = [
  { id: 'cloud-1', x: 8, y: 8, scale: 1.08, duration: 24, delay: 0 },
  { id: 'cloud-2', x: 28, y: 14, scale: 0.92, duration: 28, delay: -10 },
  { id: 'cloud-3', x: 67, y: 10, scale: 1.2, duration: 31, delay: -16 },
  { id: 'cloud-4', x: 84, y: 18, scale: 0.82, duration: 26, delay: -8 },
];

const fireflies = [
  { id: 'spark-1', x: 12, y: 30, scale: 1.1, duration: 3.6, delay: 0.1 },
  { id: 'spark-2', x: 24, y: 48, scale: 0.95, duration: 4.1, delay: 1.3 },
  { id: 'spark-3', x: 35, y: 24, scale: 1.25, duration: 3.9, delay: 0.5 },
  { id: 'spark-4', x: 49, y: 40, scale: 0.88, duration: 4.6, delay: 1.8 },
  { id: 'spark-5', x: 61, y: 31, scale: 1.18, duration: 3.8, delay: 0.9 },
  { id: 'spark-6', x: 72, y: 50, scale: 0.92, duration: 4.2, delay: 1.1 },
  { id: 'spark-7', x: 83, y: 28, scale: 1.04, duration: 3.7, delay: 0.2 },
  { id: 'spark-8', x: 91, y: 45, scale: 1.14, duration: 4.4, delay: 1.6 },
];

const driftOrbs = [
  { id: 'orb-1', x: 14, y: 58, size: 18, duration: 8.5, delay: 0.4 },
  { id: 'orb-2', x: 42, y: 66, size: 14, duration: 7.6, delay: 1.2 },
  { id: 'orb-3', x: 68, y: 62, size: 20, duration: 9.4, delay: 0.7 },
  { id: 'orb-4', x: 88, y: 57, size: 12, duration: 6.9, delay: 1.5 },
];

const reeds = [
  { id: 'reed-1', x: 3, height: 74, tilt: -8, duration: 3.3, delay: 0.2 },
  { id: 'reed-2', x: 8, height: 92, tilt: 5, duration: 3.8, delay: 0.4 },
  { id: 'reed-3', x: 15, height: 68, tilt: -5, duration: 3.5, delay: 0.6 },
  { id: 'reed-4', x: 82, height: 64, tilt: -6, duration: 3.7, delay: 0.2 },
  { id: 'reed-5', x: 90, height: 88, tilt: 7, duration: 3.4, delay: 0.7 },
  { id: 'reed-6', x: 96, height: 72, tilt: -4, duration: 3.6, delay: 0.5 },
];

const flowers = [
  { id: 'flower-1', x: 7, scale: 1, delay: 0.2 },
  { id: 'flower-2', x: 18, scale: 0.88, delay: 0.6 },
  { id: 'flower-3', x: 30, scale: 1.08, delay: 0.4 },
  { id: 'flower-4', x: 58, scale: 0.96, delay: 0.8 },
  { id: 'flower-5', x: 74, scale: 0.9, delay: 0.3 },
  { id: 'flower-6', x: 93, scale: 1.05, delay: 0.7 },
];

const mushrooms = [
  { id: 'mushroom-1', x: 11, scale: 0.95, delay: 0.4 },
  { id: 'mushroom-2', x: 66, scale: 1.1, delay: 0.8 },
  { id: 'mushroom-3', x: 86, scale: 0.9, delay: 0.5 },
];

const stones = [
  { id: 'stone-1', x: 23, width: 42 },
  { id: 'stone-2', x: 49, width: 52 },
  { id: 'stone-3', x: 79, width: 36 },
];

const pines = [
  { id: 'pine-1', x: 18, scale: 0.9 },
  { id: 'pine-2', x: 28, scale: 1.1 },
  { id: 'pine-3', x: 40, scale: 0.82 },
  { id: 'pine-4', x: 60, scale: 1.02 },
  { id: 'pine-5', x: 72, scale: 0.88 },
  { id: 'pine-6', x: 84, scale: 1.06 },
];

const rewardCoins = [
  { id: 'coin-1', x: 18, y: 26, delay: 0.1 },
  { id: 'coin-2', x: 31, y: 22, delay: 0.4 },
  { id: 'coin-3', x: 44, y: 28, delay: 0.2 },
  { id: 'coin-4', x: 58, y: 21, delay: 0.5 },
  { id: 'coin-5', x: 72, y: 26, delay: 0.3 },
  { id: 'coin-6', x: 86, y: 23, delay: 0.6 },
];
</script>

<style scoped>
.playful-backdrop {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  opacity: 0.96;
  --halo-a: rgba(255, 123, 169, 0.22);
  --halo-b: rgba(99, 215, 255, 0.24);
  --halo-c: rgba(255, 213, 101, 0.2);
  --sky-cloud: rgba(255, 251, 239, 0.72);
  --pennant-a: #ff7fa0;
  --pennant-b: #ffd05d;
  --pennant-c: #58d0ff;
  --firefly-core: rgba(255, 253, 208, 1);
  --firefly-glow: rgba(255, 212, 93, 0.95);
  --orb-color: rgba(255, 255, 255, 0.18);
  --lantern-shell: #ffb75a;
  --lantern-glow: rgba(255, 206, 104, 0.34);
  --meadow-a: #204d2f;
  --meadow-b: #2f6d3f;
  --flower-petal: #ffe7ff;
  --flower-center: #ffcf54;
  --mushroom-cap: #ff8b8b;
}

.variant-selection {
  --halo-a: rgba(255, 118, 172, 0.26);
  --halo-b: rgba(102, 224, 255, 0.24);
  --halo-c: rgba(255, 225, 112, 0.22);
  --orb-color: rgba(255, 227, 250, 0.18);
  --sky-cloud: rgba(255, 247, 231, 0.82);
}

.variant-profiles,
.variant-status {
  --halo-a: rgba(255, 156, 104, 0.2);
  --halo-b: rgba(112, 205, 255, 0.2);
  --halo-c: rgba(255, 214, 126, 0.18);
  --pennant-a: #ffad6f;
  --pennant-b: #ffe27c;
  --pennant-c: #72dbff;
}

.variant-campground {
  --halo-a: rgba(255, 129, 159, 0.18);
  --halo-b: rgba(82, 214, 250, 0.2);
  --halo-c: rgba(255, 193, 88, 0.18);
  --meadow-a: #1c4b2d;
  --meadow-b: #317648;
  --sky-cloud: rgba(224, 244, 255, 0.58);
}

.variant-trail {
  --halo-a: rgba(255, 146, 185, 0.2);
  --halo-b: rgba(90, 229, 233, 0.24);
  --halo-c: rgba(254, 218, 126, 0.18);
  --pennant-a: #ff8a75;
  --pennant-b: #ffd869;
  --pennant-c: #50e2c2;
  --orb-color: rgba(255, 238, 176, 0.22);
}

.variant-dashboard {
  --halo-a: rgba(163, 117, 255, 0.2);
  --halo-b: rgba(91, 226, 255, 0.18);
  --halo-c: rgba(255, 202, 94, 0.22);
  --pennant-a: #ff96c3;
  --pennant-b: #ffe16a;
  --pennant-c: #86ddff;
}

.color-halo {
  position: absolute;
  border-radius: 999px;
  filter: blur(22px);
  animation: pulseHalo 11s ease-in-out infinite alternate;
}

.selection-party,
.forest-magic,
.trail-treasure {
  position: absolute;
  inset: 0;
}

.marquee-arch {
  position: absolute;
  top: 6.2rem;
  left: 50%;
  width: min(62vw, 720px);
  transform: translateX(-50%);
  display: flex;
  justify-content: space-between;
}

.marquee-light {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #fffef4 0%, #ffe07d 48%, #ff8d62 100%);
  box-shadow:
    0 0 0 4px rgba(255, 235, 170, 0.08),
    0 0 12px rgba(255, 203, 102, 0.55);
  animation: twinkleBulb 1.4s ease-in-out infinite alternate;
}

.marquee-light:nth-child(2n) {
  animation-delay: 0.22s;
}

.marquee-light:nth-child(3n) {
  animation-delay: 0.45s;
}

.balloon {
  position: absolute;
  width: 58px;
  height: 74px;
  border-radius: 50% 50% 44% 44%;
  box-shadow: inset -6px -10px 0 rgba(255, 255, 255, 0.18);
  animation: balloonBob 3.6s ease-in-out infinite;
}

.balloon::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 100%;
  width: 2px;
  height: 76px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, rgba(255, 243, 196, 0.95), rgba(255, 243, 196, 0.05));
}

.balloon::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -7px;
  width: 10px;
  height: 10px;
  transform: translateX(-50%) rotate(45deg);
  background: inherit;
}

.balloon-left {
  left: 6%;
  top: 18%;
  background: linear-gradient(180deg, #ff8fb6 0%, #ff6d7a 100%);
}

.balloon-right {
  right: 7%;
  top: 20%;
  background: linear-gradient(180deg, #79d9ff 0%, #49b5ff 100%);
  animation-delay: 0.6s;
}

.balloon-center {
  left: 22%;
  top: 12%;
  width: 46px;
  height: 60px;
  background: linear-gradient(180deg, #ffe07e 0%, #ffb255 100%);
  animation-delay: 0.3s;
}

.confetti-swirl {
  position: absolute;
  top: 16%;
  width: 110px;
  height: 80px;
  border-radius: 50%;
  border-top: 4px dashed rgba(255, 241, 183, 0.75);
  border-left: 4px dashed rgba(255, 153, 184, 0.72);
  border-right: 4px dashed rgba(98, 217, 255, 0.72);
  border-bottom: 0;
  opacity: 0.55;
  animation: confettiSpin 7s linear infinite;
}

.swirl-left {
  left: 12%;
}

.swirl-right {
  right: 12%;
  transform: scaleX(-1);
  animation-duration: 6.2s;
}

.moon-halo,
.moon-disc {
  position: absolute;
  right: 10%;
  top: 8.8rem;
  border-radius: 999px;
}

.moon-halo {
  width: 92px;
  height: 92px;
  background: rgba(170, 235, 255, 0.16);
  filter: blur(8px);
}

.moon-disc {
  width: 58px;
  height: 58px;
  right: calc(10% + 17px);
  top: calc(8.8rem + 16px);
  background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.98) 0%, rgba(214, 245, 255, 0.92) 60%, rgba(133, 195, 222, 0.86) 100%);
  box-shadow: 0 0 26px rgba(186, 234, 255, 0.34);
}

.pine {
  position: absolute;
  left: calc(var(--x) * 1%);
  bottom: 7.4rem;
  width: calc(56px * var(--scale));
  height: calc(92px * var(--scale));
  transform: translateX(-50%);
  opacity: 0.34;
}

.pine::before,
.pine::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.pine::before {
  bottom: 0;
  width: 10px;
  height: 18px;
  border-radius: 4px;
  background: #4a2b14;
}

.pine::after {
  bottom: 10px;
  width: 100%;
  height: 78px;
  clip-path: polygon(50% 0, 100% 46%, 74% 46%, 100% 72%, 68% 72%, 88% 100%, 12% 100%, 32% 72%, 0 72%, 26% 46%, 0 46%);
  background: linear-gradient(180deg, rgba(47, 100, 67, 0.86) 0%, rgba(15, 49, 34, 0.95) 100%);
}

.mist {
  position: absolute;
  height: 44px;
  border-radius: 999px;
  filter: blur(10px);
  background: rgba(210, 242, 255, 0.16);
  animation: driftMist 12s ease-in-out infinite;
}

.mist-a {
  left: 8%;
  right: 54%;
  bottom: 7.2rem;
}

.mist-b {
  left: 56%;
  right: 10%;
  bottom: 9rem;
  animation-delay: 1.5s;
}

.treasure-path {
  position: absolute;
  left: 9%;
  right: 10%;
  top: 10rem;
  height: 34%;
  border: 4px dashed rgba(255, 220, 122, 0.56);
  border-radius: 50% 44% 54% 40%;
  opacity: 0.38;
  transform: rotate(-6deg);
}

.reward-coin {
  position: absolute;
  left: calc(var(--x) * 1%);
  top: calc(var(--y) * 1%);
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #fff9bf 0%, #ffd961 52%, #f1a52a 100%);
  border: 2px solid rgba(167, 106, 8, 0.9);
  box-shadow: 0 0 14px rgba(255, 213, 94, 0.34);
  animation: coinBounce 2.2s ease-in-out infinite;
  animation-delay: var(--delay);
}

.reward-coin::after {
  content: '★';
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(140, 78, 0, 0.92);
  font-size: 0.8rem;
  font-weight: 900;
}

.compass {
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 999px;
  border: 2px solid rgba(255, 230, 158, 0.34);
  opacity: 0.26;
}

.compass::before,
.compass::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 80%;
  transform: translate(-50%, -50%);
  background: linear-gradient(180deg, transparent 0%, rgba(255, 238, 188, 0.78) 50%, transparent 100%);
}

.compass::after {
  width: 80%;
  height: 2px;
}

.compass-a {
  left: 8%;
  top: 16%;
}

.compass-b {
  right: 9%;
  bottom: 17%;
}

.halo-a {
  width: 32vw;
  height: 32vw;
  min-width: 280px;
  min-height: 280px;
  left: -8vw;
  top: 2vh;
  background: var(--halo-a);
}

.halo-b {
  width: 28vw;
  height: 28vw;
  min-width: 260px;
  min-height: 260px;
  right: -6vw;
  top: 8vh;
  background: var(--halo-b);
  animation-delay: 1.2s;
}

.halo-c {
  width: 36vw;
  height: 36vw;
  min-width: 320px;
  min-height: 320px;
  left: 30vw;
  bottom: -18vh;
  background: var(--halo-c);
  animation-delay: 2.4s;
}

.pennant-ribbon {
  position: absolute;
  top: 3.4rem;
  left: -4%;
  width: 108%;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  opacity: 0.9;
  transform: rotate(-1.5deg);
}

.pennant-ribbon::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0.25rem;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.18), rgba(255, 248, 227, 0.48), rgba(255, 255, 255, 0.18));
}

.pennant {
  position: relative;
  width: 24px;
  height: 30px;
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  transform-origin: top center;
  background: linear-gradient(180deg, var(--pennant-a) 0%, var(--pennant-b) 100%);
  box-shadow: 0 5px 10px rgba(8, 16, 30, 0.16);
  animation: swayPennant 2.9s ease-in-out infinite;
}

.pennant:nth-child(3n) {
  background: linear-gradient(180deg, var(--pennant-b) 0%, var(--pennant-c) 100%);
}

.pennant:nth-child(3n + 1) {
  background: linear-gradient(180deg, var(--pennant-c) 0%, var(--pennant-a) 100%);
}

.pennant:nth-child(2n) {
  animation-delay: 0.25s;
}

.cloud {
  position: absolute;
  left: calc(var(--x) * 1%);
  top: calc(var(--y) * 1%);
  width: calc(112px * var(--scale));
  height: calc(40px * var(--scale));
  border-radius: 999px;
  background: var(--sky-cloud);
  opacity: 0.7;
  filter: drop-shadow(0 8px 14px rgba(3, 14, 34, 0.12));
  animation: driftCloud var(--duration) linear infinite;
  animation-delay: var(--delay);
}

.cloud::before,
.cloud::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  background: inherit;
}

.cloud::before {
  width: 44%;
  height: 120%;
  left: 12%;
  bottom: 24%;
}

.cloud::after {
  width: 34%;
  height: 90%;
  right: 16%;
  bottom: 26%;
}

.firefly {
  position: absolute;
  left: calc(var(--x) * 1%);
  top: calc(var(--y) * 1%);
  width: calc(10px * var(--scale));
  height: calc(10px * var(--scale));
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, var(--firefly-core) 0%, var(--firefly-glow) 55%, rgba(255, 171, 76, 0.12) 100%);
  box-shadow:
    0 0 0 6px rgba(255, 214, 112, 0.06),
    0 0 18px rgba(255, 214, 112, 0.42);
  animation: floatSpark var(--duration) ease-in-out infinite;
  animation-delay: var(--delay);
}

.firefly::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 1px solid rgba(255, 240, 186, 0.2);
  opacity: 0.7;
}

.drift-orb {
  position: absolute;
  left: calc(var(--x) * 1%);
  top: calc(var(--y) * 1%);
  width: var(--size);
  height: var(--size);
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.52), var(--orb-color) 62%, transparent 100%);
  animation: driftOrb var(--duration) ease-in-out infinite;
  animation-delay: var(--delay);
}

.lantern {
  position: absolute;
  top: 7.5rem;
  width: 34px;
  height: 50px;
  border-radius: 12px 12px 10px 10px;
  background: linear-gradient(180deg, rgba(255, 244, 176, 0.96) 0%, var(--lantern-shell) 66%, #a95c22 100%);
  border: 3px solid rgba(122, 65, 19, 0.85);
  box-shadow:
    0 0 22px var(--lantern-glow),
    0 10px 18px rgba(0, 0, 0, 0.12);
  transform-origin: top center;
  animation: swingLantern 4.1s ease-in-out infinite;
}

.lantern::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 18px;
  height: 18px;
  transform: translateX(-50%);
  border-radius: 999px 999px 0 0;
  border: 3px solid rgba(122, 65, 19, 0.85);
  border-bottom: 0;
}

.lantern::after {
  content: '';
  position: absolute;
  inset: 10px 8px;
  border-radius: 8px;
  background: radial-gradient(circle, rgba(255, 248, 213, 0.92) 0%, rgba(255, 210, 107, 0.72) 58%, rgba(255, 181, 83, 0.18) 100%);
}

.lantern-left {
  left: clamp(0.7rem, 1.8vw, 1.5rem);
}

.lantern-right {
  right: clamp(0.7rem, 1.8vw, 1.5rem);
  animation-delay: 0.8s;
}

.meadow {
  position: absolute;
  inset: auto 0 0;
  height: clamp(118px, 18vh, 190px);
}

.meadow-rise {
  position: absolute;
  bottom: -18%;
  width: 56%;
  height: 120%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 24%, rgba(86, 176, 106, 0.95) 0%, var(--meadow-b) 55%, var(--meadow-a) 100%);
}

.rise-left {
  left: -8%;
}

.rise-right {
  right: -10%;
}

.reed {
  position: absolute;
  left: calc(var(--x) * 1%);
  bottom: 0.5rem;
  width: 5px;
  height: var(--height);
  border-radius: 999px 999px 0 0;
  background: linear-gradient(180deg, rgba(132, 230, 131, 0.2) 0%, rgba(78, 165, 89, 0.95) 100%);
  transform-origin: bottom center;
  transform: rotate(var(--tilt));
  animation: swayReed var(--duration) ease-in-out infinite;
  animation-delay: var(--delay);
}

.reed::after {
  content: '';
  position: absolute;
  left: -6px;
  top: 30%;
  width: 12px;
  height: 28px;
  border-radius: 99px 99px 0 99px;
  background: rgba(92, 190, 104, 0.7);
  transform: rotate(-34deg);
}

.flower,
.mushroom,
.stone {
  position: absolute;
  left: calc(var(--x) * 1%);
  transform: translateX(-50%);
}

.flower {
  bottom: 0.8rem;
  width: 24px;
  height: 54px;
  transform: translateX(-50%) scale(var(--scale));
  animation: bobFlower 2.8s ease-in-out infinite;
  animation-delay: var(--delay);
}

.flower::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 18px;
  width: 24px;
  height: 24px;
  transform: translateX(-50%);
  border-radius: 999px;
  background:
    radial-gradient(circle at center, var(--flower-center) 0 22%, transparent 25%),
    radial-gradient(circle at 50% 2px, var(--flower-petal) 0 34%, transparent 37%),
    radial-gradient(circle at calc(100% - 2px) 50%, var(--flower-petal) 0 34%, transparent 37%),
    radial-gradient(circle at 50% calc(100% - 2px), var(--flower-petal) 0 34%, transparent 37%),
    radial-gradient(circle at 2px 50%, var(--flower-petal) 0 34%, transparent 37%),
    radial-gradient(circle at 18% 18%, rgba(255, 181, 217, 0.9) 0 24%, transparent 27%),
    radial-gradient(circle at 82% 18%, rgba(178, 238, 255, 0.92) 0 24%, transparent 27%);
}

.flower::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 4px;
  height: 26px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: linear-gradient(180deg, #7ad87c 0%, #2b8e47 100%);
}

.mushroom {
  bottom: 0.75rem;
  width: 28px;
  height: 40px;
  transform: translateX(-50%) scale(var(--scale));
  animation: bobFlower 3.1s ease-in-out infinite;
  animation-delay: var(--delay);
}

.mushroom::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 28px;
  height: 18px;
  transform: translateX(-50%);
  border-radius: 18px 18px 10px 10px;
  background:
    radial-gradient(circle at 35% 40%, rgba(255, 248, 236, 0.92) 0 10%, transparent 11%),
    radial-gradient(circle at 70% 48%, rgba(255, 248, 236, 0.92) 0 10%, transparent 11%),
    linear-gradient(180deg, var(--mushroom-cap) 0%, #f45d7a 100%);
  box-shadow: inset 0 -2px 0 rgba(136, 26, 53, 0.18);
}

.mushroom::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 12px;
  height: 22px;
  transform: translateX(-50%);
  border-radius: 8px;
  background: linear-gradient(180deg, #fff9ea 0%, #f4ddbe 100%);
}

.stone {
  bottom: 0.5rem;
  width: var(--width);
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(217, 224, 231, 0.75) 0%, rgba(117, 134, 144, 0.82) 100%);
  opacity: 0.58;
}

@keyframes pulseHalo {
  from {
    transform: scale(0.96);
    filter: blur(22px) saturate(0.95);
  }

  to {
    transform: scale(1.04);
    filter: blur(28px) saturate(1.06);
  }
}

@keyframes twinkleBulb {
  from {
    transform: translateY(0) scale(0.96);
    box-shadow:
      0 0 0 4px rgba(255, 235, 170, 0.06),
      0 0 8px rgba(255, 203, 102, 0.42);
  }

  to {
    transform: translateY(-2px) scale(1.08);
    box-shadow:
      0 0 0 6px rgba(255, 235, 170, 0.1),
      0 0 16px rgba(255, 203, 102, 0.64);
  }
}

@keyframes balloonBob {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }

  50% {
    transform: translateY(-10px) rotate(2deg);
  }
}

@keyframes confettiSpin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes swayPennant {
  0%,
  100% {
    transform: rotate(5deg);
  }

  50% {
    transform: rotate(-6deg);
  }
}

@keyframes driftCloud {
  0% {
    transform: translateX(-4vw);
  }

  50% {
    transform: translateX(0.9vw);
  }

  100% {
    transform: translateX(-4vw);
  }
}

@keyframes floatSpark {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(0.96);
    opacity: 0.72;
  }

  50% {
    transform: translate3d(8px, -14px, 0) scale(1.12);
    opacity: 1;
  }
}

@keyframes driftOrb {
  0%,
  100% {
    transform: translateY(0) scale(0.92);
    opacity: 0.16;
  }

  50% {
    transform: translateY(-16px) scale(1.05);
    opacity: 0.34;
  }
}

@keyframes driftMist {
  0%,
  100% {
    transform: translateX(0) scaleX(0.98);
    opacity: 0.18;
  }

  50% {
    transform: translateX(18px) scaleX(1.04);
    opacity: 0.3;
  }
}

@keyframes coinBounce {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(-8px) rotate(10deg);
  }
}

@keyframes swingLantern {
  0%,
  100% {
    transform: rotate(5deg);
  }

  50% {
    transform: rotate(-6deg);
  }
}

@keyframes swayReed {
  0%,
  100% {
    transform: rotate(var(--tilt));
  }

  50% {
    transform: rotate(calc(var(--tilt) * -1));
  }
}

@keyframes bobFlower {
  0%,
  100% {
    transform: translateX(-50%) scale(var(--scale));
  }

  50% {
    transform: translateX(-50%) translateY(-4px) scale(calc(var(--scale) + 0.02));
  }
}

@media (max-width: 680px) {
  .marquee-arch {
    width: min(80vw, 460px);
  }

  .marquee-light {
    width: 10px;
    height: 10px;
  }

  .balloon {
    width: 42px;
    height: 56px;
  }

  .pennant-ribbon {
    top: 4.2rem;
  }

  .pennant {
    width: 18px;
    height: 22px;
  }

  .lantern {
    width: 28px;
    height: 42px;
  }

  .cloud {
    opacity: 0.54;
  }

  .meadow {
    height: clamp(100px, 15vh, 140px);
  }

  .treasure-path,
  .compass {
    opacity: 0.18;
  }
}

@media (prefers-reduced-motion: reduce) {
  .playful-backdrop *,
  .playful-backdrop *::before,
  .playful-backdrop *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
