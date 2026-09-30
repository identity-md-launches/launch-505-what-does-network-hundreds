import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static export lives at the repository root (../dist) and uses relative
// asset URLs so it works from an IPFS gateway subpath or an ENS name.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
