# ADR 0001 - TypeScript + Node stdlib, no bundler

- **Status**: Accepted
- **Date**: 2026
- **Scope**: the build of the CLI template

## Context

A cross-platform terminal CLI ships as a compiled JavaScript entry point that
the Node runtime runs directly. The template needed a build that:

1. compiles strict TypeScript into plain ESM under `dist/`, runnable with
   `node dist/bin/main.js`;
2. keeps the runtime dependency set at zero - the Node stdlib only - so the
   renamed copy installs nothing but the dev toolchain;
3. leaves the layer walls (core pure, adapters own the process) checkable by
   the static architecture test against the same source the build reads.

The client kits in this repository use Vite because they target a browser; the
CLI targets Node, where `tsc` alone is the build.

## Decision

**Use plain TypeScript (`tsc -p tsconfig.json`) with `module: nodenext` and
`rootDir: src`, emitting to `dist/`. No bundler.**

```jsonc
// tsconfig.json (abridged)
{
  "compilerOptions": {
    "target": "es2024",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

The consequences that matter:

- **`src/` is the only build input.** `dist/` is a mirror of `src/` with the
  same relative paths, so `src/bin/main.ts` becomes `dist/bin/main.js`.
- **The typecheck is the build.** There is no separate typecheck script: `npm
  run build` runs `tsc`, which typechecks and emits in one pass; the test
  program (`tsconfig.test.json`) is typechecked by the same compiler over
  `src` + `tests`.
- **Zero runtime dependencies.** The `package.json` carries only
  devDependencies (typescript, eslint, vitest, prettier). A Node builtin is
  imported with `node:` and needs no install.

## Alternatives considered

| Option                          | Why not                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Vite (as the extension kit)      | Vite targets a browser bundle; a Node CLI gains nothing from a bundler and loses the one-to-one `src`→`dist` mirror |
| esbuild                         | Faster, but it would bundle the entry and hide the module boundaries the architecture test reads |
| tsup / other bundlers           | An extra dependency for a build `tsc` already does correctly                                       |
| No compile step (TS on the fly)  | Node cannot run `.ts` directly; a loader would be a runtime dependency                            |

## Consequences

- The build output is `dist/core/`, `dist/adapters/` and `dist/bin/` - the
  same tree as `src/`, one level down.
- The layer walls are read from `src/` by `tests/architecture.test.ts` and by
  `eslint.config.mjs`, so the source of truth is the source, not the build.
- Adding a file under `src/` needs no config change; the directory-scoped
  rules in `eslint.config.mjs` pick it up automatically.
- A new builtin import must use the `node:` prefix and live in `src/adapters/`
  or `src/bin/`, or the architecture test fails.

## See also

- [ADR 0002 - Core over ports, adapters own the process](0002-core-over-ports-adapters-own-process.md)
- [Directory Structure & Project Skeleton](../05-directory-structure.md)
- [Testing & CI](../12-testing-and-ci.md)
