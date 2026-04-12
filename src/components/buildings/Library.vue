<template>
  <div class="library-shell" :class="{ 'locked': !store.libraryUnlocked }">
    <div v-if="!store.libraryUnlocked" class="lock-screen">
      <div class="lock-icon">í´’</div>
      <h2>Library Locked</h2>
      <p>Gather 200 Sparks to enter. You have: {{ store.xp }}</p>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: (store.xp / 2) + '%' }"></div>
      </div>
    </div>
    <div v-else class="unlocked-content">
      <h2>Welcome to the Archive</h2>
      <p>Choose a story to read aloud.</p>
    </div>
  </div>
</template>

<script setup>
import { store } from '../../store';
</script>

<style scoped>
.library-shell { padding: 40px; color: white; text-align: center; }
.locked { filter: grayscale(1) blur(2px); }
.progress-track { width: 200px; height: 10px; background: #1a1c23; margin: 20px auto; border-radius: 5px; }
.progress-fill { height: 100%; background: #64ffda; border-radius: 5px; transition: width 0.5s ease; }
</style>
