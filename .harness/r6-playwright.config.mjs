import { defineConfig, devices } from '../apps/web/node_modules/@playwright/test/index.mjs';
import { fileURLToPath } from 'node:url';
export default defineConfig({
 testDir: '../tests/e2e', testMatch: 'r6-plan.spec.ts', workers: 1,
 use: { baseURL: 'http://127.0.0.1:3106', trace: 'on-first-retry' },
 webServer: { command: 'node .harness/r6-local-run.mjs server', cwd: fileURLToPath(new URL('..', import.meta.url)), url: 'http://127.0.0.1:3106', reuseExistingServer: false, timeout: 120000 },
 projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
 outputDir: '../apps/web/test-results/r6',
});
