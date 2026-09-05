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
    /*
     * Pinned here rather than inherited from a .env file.
     *
     * src/api/client.ts throws at module load when VITE_API_BASE_URL is unset -
     * deliberately, because unset it resolved every path against the string
     * "undefined" and looked like a total backend outage. That made the suite
     * depend on the developer having a .env: it passed locally and failed in CI,
     * which has none, with an error about configuration rather than about the
     * code under test.
     *
     * These values are obviously fake. Nothing here should reach a real
     * service, and a test that needs a particular value should set it itself.
     */
    env: {
      VITE_API_BASE_URL: 'http://localhost:8000/api/v1',
      VITE_STRIPE_BYPASS: 'true',
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_unused_in_unit_tests',
      VITE_COGNITO_USER_POOL_ID: 'us-east-2_test',
      VITE_COGNITO_USER_POOL_CLIENT_ID: 'test-app-client-id',
      VITE_COGNITO_DOMAIN: 'test.auth.us-east-2.amazoncognito.com',
      VITE_COGNITO_REDIRECT_SIGN_IN: 'http://localhost:5174/auth/callback',
      VITE_COGNITO_REDIRECT_SIGN_OUT: 'http://localhost:5174/auth/callback',
    },
  },
})
