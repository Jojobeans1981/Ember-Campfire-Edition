<template>
  <div class="dashboard">
    <h2>Teacher Dashboard</h2>
    <table>
      <thead>
        <tr><th>Phoneme</th><th>Taught?</th><th>Status</th><th>Support Level</th></tr>
      </thead>
      <tbody>
        <tr v-for="(state, phoneme) in skillState" :key="phoneme">
          <td>{{ phoneme }}</td>
          <td>{{ state.taught ? 'Yes' : 'No' }}</td>
          <td>{{ state.recognitionStatus }}</td>
          <td>{{ state.currentSupportLevel }}</td>
        </tr>
      </tbody>
    </table>
    <button @click="goBack">Back to Camp</button>
  </div>
</template>

<script setup>
import { skillState, store } from '../store';

function goBack() {
  store.currentPage = 'campground';
}
</script>

<style scoped>
.dashboard {
  padding: 20px;
  background: #1a1c23;
  color: #E0E0E0;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border: 1px solid #333;
  padding: 8px;
  text-align: left;
}
</style>
