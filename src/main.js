import { createApp } from 'vue';
import App from './App.vue';
import './index.css';

createApp(App).mount('#app');

const appRoot = document.getElementById('app');

if (appRoot) {
  appRoot.classList.add('is-mounted');
}

// Boot-splash is dismissed from App.vue once entryPageResolved is true
// (or the launch splash is about to play). Hiding it here would reveal
// Vue's "Waking the Campground" card for a frame, causing a visible
// card-to-card flash before bootstrap completes.
