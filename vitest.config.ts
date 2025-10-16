/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    include: [
      'src/tests/**/*.test.{ts,tsx,js,jsx}',
      'src/tests/**/*.spec.{ts,tsx,js,jsx}',
    ],
    exclude: ['node_modules/**', 'e2e/**', '**/e2e/**'],
  },
});
