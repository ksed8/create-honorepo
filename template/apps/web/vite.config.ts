/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Provide env defaults during tests so env.ts doesn't fail.
    // Real values come from .env in dev/build.
    env: {
      VITE_API_URL: 'http://localhost:3001',
    },
  },
});
