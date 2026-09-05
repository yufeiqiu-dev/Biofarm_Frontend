/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    globals: true,
    css: false,
    passWithNoTests: true,
    // Unit tests only. e2e/ holds Playwright specs, which import from
    // @playwright/test and cannot run under vitest - without this they are
    // collected and fail before a single unit test runs.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
