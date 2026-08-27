import { defineConfig } from 'vite';

export default defineConfig({
  root: 'apps/web',
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
});
