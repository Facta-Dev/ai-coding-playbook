// <app> — main process bundle.
//
// Vite bundles the main process as CommonJS (index.cjs): Electron's main
// entry stays CJS even though the package itself is `"type": "module"`.
// electron and the Node built-ins are external — they are runtime
// host APIs, not code to bundle (PLAYBOOK_DESKTOP_ELECTRON §5).
import { resolve } from "node:path";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const srcRoot = resolve(import.meta.dirname, "src");

export default defineConfig({
  build: {
    lib: {
      entry: resolve(srcRoot, "main/index.ts"),
      formats: ["cjs"],
    },
    rollupOptions: {
      output: { entryFileNames: "index.cjs" },
      external: ["electron", ...builtinModules.map((m) => `node:${m}`), /^node:/, ...builtinModules],
    },
    outDir: "dist/main",
    emptyOutDir: true,
    target: "es2022",
  },
});
