// <app> — dependency-cruiser architecture rules.
//
// The rules encode the trust zones of PLAYBOOK_DESKTOP_ELECTRON §2–§3:
//
//   main      -> owns electron + utilityProcess (composition root)
//   core      -> ships the SDK, the storage and the realtime stack;
//                no electron, no React, no DOM
//   preload   -> the typed bridge only; no renderer, no core internals
//   renderer  -> no electron, no node:* (global use is ESLint's job)
//   sdk       -> no electron, no React (it ships to the core)
//   feature   -> domain (pure) <- application <- adapters; features sealed
//
// Import-level copies of these walls live in eslint.config.mjs; the graph
// rules live here, because ESLint sees single files, depcruise sees edges.
module.exports = {
  forbidden: [
    {
      // electron belongs to src/main (the composition root) and the preload
      // bridge. The core worker and the SDK are plain Node and pure TS.
      name: "no-electron-outside-main-and-preload",
      severity: "error",
      from: { pathNot: "^src/(main|preload)(/|$)" },
      to: { path: "(^|/)electron(/|$)" },
    },
    {
      name: "no-node-builtins-in-sdk",
      severity: "error",
      from: { path: "^packages/sdk/" },
      to: { path: "^node:" },
    },
    {
      name: "no-sdk-electron-or-react",
      severity: "error",
      from: { path: "^packages/sdk/" },
      to: { path: "(^|/)(electron|react|react-dom)(/|$)" },
    },
    {
      name: "no-react-outside-renderer-and-features",
      severity: "error",
      from: { pathNot: "^(src/renderer|src/ui-kit|src/features)(/|$)" },
      to: { path: "(^|/)(react|react-dom)(/|$)" },
    },
    {
      name: "no-preload-to-renderer",
      severity: "error",
      from: { path: "^src/preload/" },
      to: { path: "^src/(renderer|ui-kit)/" },
    },
    {
      name: "no-preload-to-core-internals",
      severity: "error",
      from: { path: "^src/preload/" },
      to: { path: "^src/(core|infrastructure)/" },
    },
    {
      name: "no-feature-domain-to-electron-or-node",
      severity: "error",
      from: { path: "^src/features/[^/]+/(domain|application)(/|$)" },
      to: { path: "((^|/)electron(/|$))|^node:" },
    },
    {
      name: "no-domain-to-application",
      severity: "error",
      from: { path: "^src/features/[^/]+/domain(/|$)" },
      to: { path: "^src/features/[^/]+/application(/|$)" },
    },
    {
      name: "no-application-to-adapters",
      severity: "error",
      from: { path: "^src/features/[^/]+/application(/|$)" },
      to: { path: "^src/features/[^/]+/adapters(/|$)" },
    },
    {
      name: "no-cross-feature-imports",
      severity: "error",
      from: { path: "^src/features/([^/]+)/" },
      to: { path: "^src/features/([^/]+)/", pathNot: "^src/features/$1/" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
  },
};
