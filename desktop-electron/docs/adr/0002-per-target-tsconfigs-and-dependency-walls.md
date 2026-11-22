# ADR 0002 — Per-target tsconfigs and dependency walls

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-22 |
| **Scope** | How layer and process rules are enforced in the kit |
| **Supersedes** | — |

## Context

The layer table (domain must not import `electron`, `node:*`, DOM or the
SDK; renderer must not import `electron`, `node:*` or `@/sdk`; platform is
the only home of `process.platform`) is worth exactly what enforces it. In
Electron the rule has a sharper edge than in a plain TypeScript app, because
the same codebase compiles for **four runtimes with different globals**:

* **main/core** see Node but no DOM;
* **renderer** sees the DOM but no Node and must not see `electron` types;
* **preload** sees a sandboxed Node surface and nothing of the renderer.

One shared `tsconfig.json` cannot express that: with `lib` =
`["DOM", "ES2023", "Node"]`, the type checker is happy to let a ViewModel
touch `process`, and nothing points at the bug until a runtime the ViewModel
will never run in misbehaves.

## Decision

**One `tsconfig` per target, plus two machine-checked walls:**
`tsconfig.base.json` + `tsconfig.{main,core,preload,renderer,test}.json`,
each with the `lib`/`types` its runtime actually has
([03](../03-layers-and-mvvm.md)). The consequence is deliberate: source the
renderer compiles has no `NodeJS` namespace at all, so `process.env` in a
ViewModel is a typecheck failure, not a code smell.

Walls on top of the compiler:

| Wall | Mechanism | Enforces |
| --- | --- | --- |
| Import graph | `dependency-cruiser.config.cjs` | the layer table: domain/application never import `electron`/`node:*`; renderer never imports the SDK; preload never imports the renderer or core internals; the SDK imports no Electron |
| Globals and APIs | `eslint.config.mjs` | `no-restricted-globals` for `process`/`require` in renderer and application; `no-restricted-imports`; floating/misused promises |
| Source assertions | `tests/_platform/architecture/architecture.test.ts` | the same rules as test evidence, run in `pnpm test` |
| Contract shape | `evals/contracts.test.mjs` | the IPC/policy contract register |

The gates are redundant **on purpose**: depcruise and the architecture test
disagreeing is itself a finding. All of them run inside `pnpm lint` and
`pnpm test`, which `make ci` and `scripts/verify-template.sh` run — a
violation fails the pipeline, not a review
([12](../12-testing-and-ci.md)).

## Consequences

**Accepted:** five tsconfigs to keep consistent (they share
`tsconfig.base.json` so the surface is small); a new directory in `src/`
means touching depcruise and possibly the architecture test; occasionally
fighting `lib` mismatches when Electron types lag Node's
(`utilityProcess`'s `parentPort` is typed through a narrow local interface,
no `any` — the kit's own workaround for exactly this class of gap).

**Bought:** the layer table is a property of the build, not of a reviewer's
memory; renderer code fails to compile when it reaches for Node; the
SDK import from a view is a lint error before it is a security review
comment.

**Rejected:** one shared tsconfig with path-based `restrictions` only (the
`lib` leak survives); enforcing solely in CI scripts (no compiler-level
honesty about the four runtimes); relaxing `lib` for "convenience" in any
target — that is the wall, being taken down one flag at a time.

## See also

[03 — Layers & MVVM](../03-layers-and-mvvm.md) ·
[12 — Testing & CI](../12-testing-and-ci.md) ·
[ADR 0003](0003-vite-multi-config-forge-fuses-and-node-sqlite.md) for what
each target builds into.
