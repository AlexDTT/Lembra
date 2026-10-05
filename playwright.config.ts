import { defineConfig } from '@playwright/test';
import { testSupabaseUrl } from './e2e/config';
export default defineConfig({
  testDir: './e2e',
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:5174', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'small-mobile', use: { viewport: { width: 320, height: 740 } } },
  ],
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: testSupabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      VITE_SUPABASE_ANON_KEY: '',
      // Public fixture only; no private VAPID key or push service is used.
      VITE_VAPID_PUBLIC_KEY:
        'BGsX0fLhLEJH-Lzm5WOkQPJ3A32BLeszoPShOUXYmMKWT-NC4v4af5uO5-tKfA-eFivOM1drMV7Oy7ZAaDe_UfU',
    },
  },
});
