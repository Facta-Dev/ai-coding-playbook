# tests/e2e — optional packaged App E2E

Playwright smoke suite against the **Forge-packaged** app. It is a package of
its own so it never enters the default gates — no install, no run, no
typecheck (both tsconfig.test.json and eslint ignore this directory), no
vitest lane (the spec is named `packaged.e2e.ts`, which Playwright matches by
explicit `testMatch` and vitest does not match at all).

## Install (one-time, on the renamed copy only)

```bash
cd tests/e2e && pnpm install
```

This adds two test-only dev dependencies to this package's own lockfile:
`@playwright/test` and `electron` (the binary `electron.launch` uses).

## Package the app

The suite launches the Forge output, not a dev run:

```bash
cd .. && pnpm run build && npx electron-forge package
```

`findPackagedApp()` picks the first directory under `out/` that carries a
`package.json`; set `E2E_APP_DIR=/path/to/packaged` to point at one directly.

## Run

```bash
E2E=1 pnpm exec playwright test
```

## Skip rules (always a deliberate no-op, never a failure)

The suite skips itself unless **all** hold:

- `E2E=1` is set — the E2E is never part of `make ci` or `verify`;
- the `electron` package resolves from this package's `node_modules`;
- a packaged app dir is found (or `E2E_APP_DIR` is set).

The `make e2e` target in the kit root prints the same skip reasons.

## What it asserts

1. The packaged app opens its main window on the `app://bundle` origin (never
   `file://`).
2. The notes view renders (`h1` "Notes") inside that window.

Deeper flows (IPC add/list over the real core process, policy denial paths)
are exercised by the unit suites with fakes; this packaged smoke lane stays
thin on purpose — it proves the packaging and the bridge come up, nothing
more.
