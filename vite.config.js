import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        app: resolve(__dirname, 'src/app.html'),
        'sign-in': resolve(__dirname, 'src/sign-in.html'),
        'sign-up': resolve(__dirname, 'src/sign-up.html'),
      },
    },
  },
  publicDir: 'public',
});
