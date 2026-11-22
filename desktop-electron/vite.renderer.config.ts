// <app> — renderer bundle.
//
// React surface: the Vite root is src/renderer (the index.html lives there)
// and the output is a plain browser bundle. Relative base ("./") keeps the
// built assets loadable from the app:// protocol handler no matter where the
// package is unpacked (PLAYBOOK_DESKTOP_ELECTRON §6).
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const srcRoot = resolve(import.meta.dirname, "src");

export default defineConfig({
  root: "src/renderer",
  base: "./",
  resolve: {
    // Mirrors the "paths" of tsconfig.base.json.
    alias: [
      { find: /^@platform\//, replacement: `${resolve(srcRoot, "platform")}/` },
      { find: /^@features\//, replacement: `${resolve(srcRoot, "features")}/` },
      { find: /^@shared\//, replacement: `${resolve(srcRoot, "shared-kernel")}/` },
      { find: /^@contracts\//, replacement: `${resolve(srcRoot, "contracts")}/` },
    ],
  },
  plugins: [react()],
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
    target: "es2022",
  },
});
