// <app> — the Playwright config of the optional E2E package.
//
// The spec file is named `packaged.e2e.ts`, not `*.spec.ts`: the kit's
// vitest config includes `tests/**/*.spec.ts`, and the E2E is a Playwright
// package of its own — never part of the default vitest lane. `testMatch`
// pins the file for Playwright explicitly.
//
// Not installed by the default gate: `cd tests/e2e && pnpm install`, then
// `E2E=1 pnpm exec playwright test` (see README.md). The suite skips itself
// without E2E=1, a resolvable Electron binary or the packaged app.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "packaged.e2e.ts",
  workers: 1,
  retries: 0,
  // A packaged Electron launch plus a first window: bounded, not generous.
  timeout: 60_000,
  use: {
    // The trace shows the last run when a step has to be debugged by hand.
    trace: "retain-on-failure",
  },
});
