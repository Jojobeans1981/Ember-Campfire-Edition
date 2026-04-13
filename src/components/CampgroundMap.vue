<template>
  <div class="campground-map">
    <h2 class="map-title">Ember Campground</h2>
    <div class="map-grid">
      <MapStation
        v-for="unit in UNITS"
        :key="unit.unitId"
        :unit="unit"
        :status="getStatus(unit.unitId)"
        @select="selectUnit"
      />
    </div>
  </div>
</template>

<script setup>
import { UNITS } from '../data/curriculum.js';
import { useProgression } from '../composables/useProgression.js';
import { store } from '../store';
import MapStation from './MapStation.vue';

const { getUnitStatus } = useProgression();

function getStatus(unitId) {
  return getUnitStatus(unitId);
}

function selectUnit(unit) {
  store.activeUnitId = unit.unitId;
  store.currentPage = 'unit-hub';
}
</script>

<style scoped>
.campground-map {
  width: 100%;
  max-width: 500px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  overflow-y: auto;
  max-height: 100%;
}

.map-title {
  font-size: 1.4rem;
  color: #FF8C00;
  margin: 0;
}

.map-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  width: 100%;
}
</style>
