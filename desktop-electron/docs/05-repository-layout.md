# 05 — Repository Layout

## The tree

```text
desktop-electron/
├── package.json              v tsconfig.base.json + tsconfig.{main,core,preload,renderer,test}.json
├── vite.{main,preload,core,renderer}.config.ts       forge.config.ts  eslint.config.mjs
├── dependency-cruiser.config.cjs  prettier.config.mjs  vitest.config.ts  Makefile
├── README.md  AGENTS.md  CLAUDE.md  MEMORY.md  + PLAYBOOK_*.md (local copies)
├── src/
│   ├── main/          index.ts  windows.ts  window-registry.ts  app-protocol.ts
│   │                  core-supervisor.ts  ipc-pep.ts  ipc-policy.ts        (composition root, main)
│   ├── preload/       index.ts — exposes only window.hmd.rpc / window.hmd.platform.info
│   ├── core/          index.ts  rpc-server.ts  container.ts                  (utility process)
│   ├── renderer/      index.html  main.tsx  App.tsx  core-port.ts  env.d.ts
│   ├── shared-kernel/ result.ts  errors.ts  ids.ts  time.ts
│   ├── contracts/     ipc.ts  notes.ts  policy.ts          (zod, shared by all processes)
│   ├── platform/      system-info.ts  paths.ts  secrets/safe-storage.ts
│   ├── infrastructure/ sdk/  storage/  realtime/  policy/  logging/
│   ├── features/notes/
│   │   ├── domain/   application/   adapters/   viewmodels/   views/
│   └── ui-kit/       Button.tsx  StatusView.tsx  theme.css
├── packages/sdk/             generated client placeholder (README explains the source of truth)
├── tests/                    unit, contract, architecture, e2e (separate Playwright package)
├── evals/                    contracts.test.mjs + run-live.sh (no-op without EVALS=1)
├── docs/                     this documentation set + ADRs
├── .claude/                  agents, commands, skills, schemas, manifest, settings, rules
└── scripts/                  rename.sh, verify-template.sh, linters, guards
```

The full contract is the kit tree in the series spec; the playbook's layout
([§4](../PLAYBOOK_DESKTOP_ELECTRON.md)) is the target shape for a product
built from this template (it adds `packaging/`, `tools/`, `resources/` when
those exist).

## Reading order

| To learn about… | Read |
| --- | --- |
| Where a rule lives | [03 — Layers & MVVM](03-layers-and-mvvm.md) |
| How `rpc('notes.add', …)` travels | [06 — IPC & Preload](06-ipc-and-preload.md) |
| Where data is stored | [08 — Storage, Outbox & Offline](08-storage-outbox-and-offline.md) |
| What the gates run | [12 — Testing & CI](12-testing-and-ci.md) |

## One build graph, four targets

[Vite](https://vitejs.dev) multi-config ([ADR 0003](adr/0003-vite-multi-config-forge-fuses-and-node-sqlite.md)):

| Config | Entry | Output |
| --- | --- | --- |
| `vite.main.config.ts` | `src/main/index.ts` | CJS `dist/main/index.cjs`, externals: `electron` + node builtins |
| `vite.core.config.ts` | `src/core/index.ts` | CJS `dist/core/index.cjs` |
| `vite.preload.config.ts` | `src/preload/index.ts` | CJS `dist/preload/index.cjs` (sandboxed preload is a self-contained bundle — (verify current preload ESM support)) |
| `vite.renderer.config.ts` | `src/renderer/` | React app, `base: './'`, `dist/renderer/` |

Why CJS for main/preload/core: the sandboxed preload must load without a
module loader above it, and `forge.config.ts` points Forge at the built
paths. Forge exists in the same graph (`forge.config.ts`) with the Fuses
plugin ([10](10-packaging-signing-and-updates.md)).

## Placeholders and instantiating

The kit is a template: `<app>`, `<APP>` and `<scope>` are substitution
tokens documented in `scripts/rename.sh`. Verify the whole kit in a staged,
renamed copy without touching this tree:

```sh
git clone <kit-url>            # or copy the tree
cd desktop-electron && pnpm install           # ELECTRON_SKIP_BINARY_DOWNLOAD=1 is set by verify
make verify                    # stages a renamed copy, runs typecheck + lint + test + build + evals
```

`make verify` = `bash scripts/verify-template.sh`; the real tree is never
mutated ([12](12-testing-and-ci.md)).

## Where the code is

| Topic | File |
| --- | --- |
| The window factory (hardening defaults) | `src/main/windows.ts` |
| The IPC policy-enforcement point (pure) | `src/main/ipc-policy.ts` |
| The core supervisor | `src/main/core-supervisor.ts` |
| The typed bridge | `src/preload/index.ts` |
| The shared IPC contract | `src/contracts/ipc.ts` |
| The example slice | `src/features/notes/` |
| The dependency walls | `dependency-cruiser.config.cjs`, `tsconfig.*.json`, `eslint.config.mjs` |
| The architecture test | `tests/_platform/architecture/architecture.test.ts` |
| The packaged-e2e package | `tests/e2e/` (own `package.json`, `@playwright/test`) |

## See also

- [13 — Playbooks](13-playbooks.md) — which local playbook answers which question
- [`NEW_UPDATE_PLAYBOOK.md`](../NEW_UPDATE_PLAYBOOK.md) — the delta-first
  runbook for playbook and kit changes
