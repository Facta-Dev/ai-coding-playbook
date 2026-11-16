// <app> - unit test configuration. Tests run in the node environment (no DOM):
// ViewModel and SDK tests are hermetic, and the View test renders to a string
// with react-dom/server instead of a browser.
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
