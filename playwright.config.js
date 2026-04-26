import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/functional',
    use: {
        baseURL: 'http://localhost:3001',
    },
    webServer: {
        command: 'npx serve . -l 3001',
        url: 'http://localhost:3001',
        reuseExistingServer: !process.env.CI,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
