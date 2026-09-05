import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The package is ESM, so there is no __dirname.
const here = path.dirname(fileURLToPath(import.meta.url));

/*
 * Credentials come from .env.e2e, which is gitignored. Read here rather than
 * with dotenv so the suite adds one dependency instead of two, and so a missing
 * file is not silently equivalent to a missing password.
 */
const envFile = path.join(here, ".env.e2e");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

export const STORAGE_STATE = path.join(here, "e2e/.auth/user.json");

export default defineConfig({
  testDir: "./e2e",

  // These drive a real browser against a real backend, so they are slower and
  // more order-sensitive than the unit tests. Serial locally; CI can raise it.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    /*
     * The system Chrome rather than Playwright's bundled Chromium, whose
     * download fails on this machine. Same engine; it just skips the 150MB
     * fetch. CI on Linux can drop this line and use `playwright install`.
     */
    channel: "chrome",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      // Signed out. The catalogue is public and most of it must work without an
      // account, so these deliberately carry no stored session.
      name: "public",
      testMatch: /.*\.public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "authed",
      testMatch: /.*\.authed\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        storageState: STORAGE_STATE,
      },
    },
  ],
});
