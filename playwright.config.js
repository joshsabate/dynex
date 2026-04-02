const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./playwright",
  outputDir: "./test-results/playwright",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3000",
    viewport: {
      width: 1600,
      height: 1400,
    },
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      BROWSER: "none",
      PORT: "3000",
    },
  },
});
