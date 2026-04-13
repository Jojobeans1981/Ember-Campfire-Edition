<template>
  <div class="library-sanctuary">
    <div class="book-shelf" v-if="store.xp >= 200">
      <h2 class="area-title">Ancient Archive</h2>
      <div class="books-grid">
        <div v-for="book in books" :key="book.id" class="book-item">
          <div class="book-cover" :style="{ background: book.color }">
            <span class="book-title">{{ book.title }}</span>
          </div>
          <button class="read-btn">Read</button>
        </div>
      </div>
    </div>
    
    <div v-else class="locked-state">
      <div class="lock-icon">🔒</div>
      <h3 class="lock-title">Archive Locked</h3>
      <p class="lock-desc">Earn 200 Sparks to enter!</p>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (store.xp / 200) * 100 + '%' }"></div>
        </div>
        <p class="progress-text">{{ store.xp }} / 200 Sparks</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { store } from '../../store';

const books = ref([
  { id: 1, title: 'The Fox', color: '#e67e22' },
  { id: 2, title: 'Moonlight', color: '#3498db' },
  { id: 3, title: 'Magic', color: '#9b59b6' }
]);
</script>

<style scoped>
.library-sanctuary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.area-title { font-size: 1.5rem; color: #fbbf24; margin-bottom: 1rem; }

.books-grid {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.book-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.book-cover {
  width: 80px;
  height: 110px;
  border-radius: 4px 10px 10px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  text-align: center;
  box-shadow: 4px 4px 10px rgba(0,0,0,0.3);
  border-left: 6px solid rgba(0,0,0,0.2);
}

.book-title { font-size: 0.75rem; color: white; font-weight: bold; }

.read-btn {
  background: var(--nature-green);
  border: none;
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 1rem;
  font-size: 0.75rem;
}

.locked-state {
  text-align: center;
  background: rgba(15, 23, 42, 0.4);
  padding: 1.5rem;
  border-radius: 1.5rem;
  border: 2px dashed #334155;
  width: 100%;
  max-width: 300px;
}

.lock-icon { font-size: 3rem; margin-bottom: 0.5rem; }
.lock-title { font-size: 1.25rem; color: #cbd5e1; }
.lock-desc { font-size: 0.85rem; color: #64748b; margin-bottom: 1rem; }

.progress-container { width: 100%; }
.progress-bar {
  height: 12px;
  background: #0f172a;
  border-radius: 6px;
  border: 1px solid #334155;
  overflow: hidden;
  margin-bottom: 0.5rem;
}
.progress-fill { height: 100%; background: #fbbf24; transition: width 0.5s; }
.progress-text { font-size: 0.75rem; color: #94a3b8; }
</style>
