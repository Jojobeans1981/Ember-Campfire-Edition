<template>
  <div class="ember-wrapper">
    <svg viewBox="0 0 100 100" class="ember-svg" :style="{ filter: 'drop-shadow(0 0 ' + (volume/5) + 'px #FF8C00)' }">
      <path 
        d="M50 10C30 40 20 60 20 80C20 91 33 100 50 100C67 100 80 91 80 80C80 60 70 40 50 10Z" 
        :fill="isSustaining ? '#FF8C00' : '#A0522D'"
        class="ember-core"
        :style="{ transform: 'scale(' + (1 + volume/200) + ')', transformOrigin: 'center bottom' }"
      />
      <circle cx="50" cy="75" r="10" fill="yellow" opacity="0.6">
        <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  </div>
</template>

<script setup>
import { useMicAnalysis } from '../../composables/useMicAnalysis';
const { volume, isSustaining } = useMicAnalysis();
</script>

<style scoped>
.ember-wrapper { display: flex; justify-content: center; padding: 20px; height: 150px; }
.ember-svg { width: 100px; transition: filter 0.1s ease; }
.ember-core { transition: transform 0.1s ease, fill 0.3s ease; }
</style>
