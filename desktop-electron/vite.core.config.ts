// <app> — core worker bundle.
//
// The core process is launched with utilityProcess.fork pointing at
// dist/core/index.cjs (PLAYBOOK_DESKTOP_ELECTRON §2): the code runs as a Node
// child process, so it bundles as CommonJS with electron (unused here but
// kept external by contract) and the Node built-ins external.
import { resolve } from "node:path";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const srcRoot = resolve(import.meta.dirname, "src");

export default defineConfig({
  build: {
    lib: {
      entry: resolve(srcRoot, "core/index.ts"),
      formats: ["cjs"],
    },
    rollupOptions: {
      output: { entryFileNames: "index.cjs" },
      external: ["electron", ...builtinModules.map((m) => `node:${m}`), /^node:/, ...builtinModules],
    },
    outDir: "dist/core",
    emptyOutDir: true,
    target: "es2022",
  },
});
