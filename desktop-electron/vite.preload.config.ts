// <app> — sandboxed preload bundle.
//
// The preload script is CommonJS and stays dependency-free: everything it
// exposes is the typed bridge (window.hmd.rpc / window.hmd.platform), so the
// only externals are electron and the Node built-ins. A sandboxed preload
// cannot import bundled npm packages at all — keep it that way.
import { resolve } from "node:path";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const srcRoot = resolve(import.meta.dirname, "src");

export default defineConfig({
  build: {
    lib: {
      entry: resolve(srcRoot, "preload/index.ts"),
      formats: ["cjs"],
    },
    rollupOptions: {
      output: { entryFileNames: "index.cjs" },
      external: ["electron", ...builtinModules.map((m) => `node:${m}`), /^node:/, ...builtinModules],
    },
    outDir: "dist/preload",
    emptyOutDir: true,
    target: "es2022",
  },
});
