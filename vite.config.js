import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: 'localhost',
    port: 5188,
    strictPort: true,
  },
  resolve: {
    alias: {
      // Mock Node.js built-ins for the browser
      fs: path.resolve(__dirname, 'mock-fs'),
      util: path.resolve(__dirname, 'mock-util.js'),
      'kokoro-js': path.resolve(__dirname, 'node_modules/kokoro-js/dist/kokoro.web.js'),
      path: 'path-browserify', // You might need this too
    }
  },
  define: {
    'process.env': {},
    'global': 'globalThis',
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-layers',
      '@tensorflow/tfjs-data',
      'vue',
      'lucide-vue-next'
    ],
    exclude: ['@tensorflow-models/speech-commands']
  },
  // Note: COOP/COEP headers may be needed for SharedArrayBuffer (Vosk WASM).
  // vosk-browser 0.0.8 has a non-SAB fallback, so we skip them for now
  // to avoid breaking Vite HMR and cross-origin resources.
  // If Vosk errors about SharedArrayBuffer, re-enable:
  // server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } }
});
