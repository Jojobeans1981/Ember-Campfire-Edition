import { createApp } from 'vue';
import App from './App.vue';
import './index.css';

createApp(App).mount('#app');

const appRoot = document.getElementById('app');
const bootSplash = document.getElementById('boot-splash');

if (appRoot) {
  appRoot.classList.add('is-mounted');
}

if (bootSplash) {
  bootSplash.classList.add('is-hidden');
  window.setTimeout(() => bootSplash.remove(), 450);
}
