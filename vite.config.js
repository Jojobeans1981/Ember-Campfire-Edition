import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Mock Node.js built-ins for the browser
      fs: path.resolve(__dirname, 'mock-fs.js'),
      util: path.resolve(__dirname, 'mock-util.js'),
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
  }
});
