import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        submitTargetTime: resolve(__dirname, 'submit-target-time.html'),
      },
    },
  },
});
