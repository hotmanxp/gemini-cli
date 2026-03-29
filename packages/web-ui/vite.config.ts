import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: ['node:fs', 'node:path', 'node:crypto', 'node:os'],
    },
  },
  resolve: {
    alias: {
      '@google/gemini-cli-sdk': '/src/lib/sdk-shim.ts',
    },
  },
});
