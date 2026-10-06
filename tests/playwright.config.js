import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:8080',
        serviceWorkers: 'block',
    },
    webServer: {
        command: 'node server.cjs',
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
