// <app> — unit test configuration. Vitest reads this file instead of any
// vite.*.config.ts (whose roots point at the Electron build surfaces), so
// the test tree stays at the repository root and runs in plain Node. The
// architecture suite reads the source tree as text; no browser environment
// is involved — view-model tests use fakes, never the DOM.
//
// The "paths" of tsconfig.base.json resolve only inside the programs, so the
// aliases are mirrored here and in vite.renderer.config.ts: a test that
// imports the feature slices (or the contracts they use) must resolve the
// same way the source does.
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const srcRoot = resolve(import.meta.dirname, "src");
const aliases = [
  { find: /^@platform\//, replacement: `${resolve(srcRoot, "platform")}/` },
  { find: /^@features\//, replacement: `${resolve(srcRoot, "features")}/` },
  { find: /^@shared\//, replacement: `${resolve(srcRoot, "shared-kernel")}/` },
  { find: /^@contracts\//, replacement: `${resolve(srcRoot, "contracts")}/` },
];

export default defineConfig({
  resolve: { alias: aliases },
  test: {
    include: [
      "tests/**/*.{test,spec}.{ts,tsx,mts}",
      "src/**/*.{test,spec}.{ts,tsx}",
    ],
    environment: "node",
  },
});
