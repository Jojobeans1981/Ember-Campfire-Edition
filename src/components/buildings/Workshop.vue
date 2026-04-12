<template>
  <div class="workshop-forge">
    <div class="forge-container">
      <div 
        class="rune-slot" 
        :class="{ 'is-active': isOver, 'is-forged': forged }"
        @dragover.prevent="isOver = true"
        @dragleave="isOver = false"
        @drop="handleDrop"
      >
        <span v-if="!forged" class="placeholder-rune">?</span>
        <span v-else class="active-rune">{{ currentTarget }}</span>
      </div>

      <div class="inventory">
        <div 
          v-for="rune in availableRunes" 
          :key="rune"
          class="rune-stone"
          draggable="true"
          @dragstart="onDragStart($event, rune)"
        >
          {{ rune }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { store } from '../../store';

const currentTarget = ref('m');
const availableRunes = ['m', 's', 't', 'a'];
const forged = ref(false);
const isOver = ref(false);

const onDragStart = (event, rune) => {
  event.dataTransfer.setData('rune', rune);
};

const handleDrop = (event) => {
  const droppedRune = event.dataTransfer.getData('rune');
  isOver.value = false;
  
  if (droppedRune === currentTarget.value) {
    forged.value = true;
    store.xp += 25; // Directly updates your store
  }
};
</script>

<style scoped>
.workshop-forge {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.rune-slot {
  width: 220px;
  height: 220px;
  border: 4px dashed rgba(255, 255, 255, 0.1);
  border-radius: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 60px;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.is-active {
  border-color: #4facfe;
  background: rgba(79, 172, 254, 0.05);
  transform: scale(1.05);
}

.is-forged {
  border: 4px solid #00f2fe;
  box-shadow: 0 0 40px rgba(0, 242, 254, 0.2);
}

.inventory {
  display: flex;
  gap: 25px;
}

.rune-stone {
  width: 85px;
  height: 85px;
  background: #1e293b;
  border: 2px solid #334155;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  color: #f0f4f8;
  cursor: grab;
  transition: transform 0.2s;
}

.rune-stone:active { transform: scale(0.9); cursor: grabbing; }
.placeholder-rune { font-size: 3rem; opacity: 0.1; }
.active-rune { font-size: 5rem; color: #00f2fe; text-shadow: 0 0 15px #00f2fe; }
</style>
