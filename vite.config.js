import { resolve } from 'node:path';
import { cpSync, existsSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sxstx_calculator/',
  plugins: [
    {
      name: 'copy-generated-data',
      closeBundle() {
        const source = resolve(__dirname, 'data/generated');
        if (existsSync(source)) {
          cpSync(source, resolve(__dirname, 'dist/data/generated'), { recursive: true });
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        submitTargetTime: resolve(__dirname, 'submit-target-time.html'),
      },
    },
  },
});
