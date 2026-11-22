# 12 — Testing & CI

## The point of the suite

Electron hides failures that a web app cannot have (fuse drift, sender
spoofing, a CSP the packaged app silently relaxes). The suite is built to
catch those in **CI, on the packaged artifact**, not in a review
([§16](../PLAYBOOK_DESKTOP_ELECTRON.md), [PLAYBOOK_TESTS.md](../PLAYBOOK_TESTS.md)).

## Levels

| Level | Scope | Tooling |
| --- | --- | --- |
| **Unit** | domain, use cases against fake ports, ViewModels against a fake `CorePort` (no DOM), the SSE parser, the policy resolver | Vitest (`vitest run`) |
| **Contract** | IPC schemas both sides, policy schema, permission strings | `tests/contracts/ipc.test.ts`, `evals/contracts.test.mjs` |
| **Main/IPC** | The PEP: every rejection class (origin, child frame, unknown type, window capability, schema) | `tests/main/ipc-policy.test.ts` |
| **Adapter** | SQLite repository and migrations from every released schema (with the in-memory fallback) | `tests/infrastructure/` |
| **Architecture** | Layer walls: imports, `process.platform` placement, forbidden APIs | `tests/_platform/architecture/architecture.test.ts` + dependency-cruiser + ESLint |
| **E2E** | The **packaged, fused** app: sign-in, list, add, offline, realtime, update flow | Playwright for Electron (`_electron.launch`) — `tests/e2e/`, own package |
| **Perf / Security / a11y / visual** | Budgets on the Floor runner, fuse verification, CSP violations, IPC fuzzing, axe | scripted per the levels above |

## The kit's actual gates

The authoritative gate stages a **renamed copy** of the tree (placeholders
substituted via `scripts/rename.sh`), never mutating this tree, and runs
everything inside it:

```sh
bash scripts/verify-template.sh   # ELECTRON_SKIP_BINARY_DOWNLOAD=1; staged + renamed + all gates
make ci                           # typecheck (5 tsconfigs) + lint + test + build + evals
make verify                       # the same as verify-template.sh
bash evals/run-live.sh            # must be a no-op without EVALS=1
```

Inside the staged copy:

| Gate | Command | Catches |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` (all 5 tsconfigs) | The tsconfig walls ([ADR 0002](adr/0002-per-target-tsconfigs-and-dependency-walls.md)) |
| Lint | `pnpm lint` = `eslint . && depcruise --config dependency-cruiser.config.cjs src` | Restricted imports/globals, layer table |
| Test | `pnpm test` = `vitest run` | Everything the suite asserts |
| Build | `pnpm build` (4 vite configs) | CJS/preload/renderer output shape ([ADR 0003](adr/0003-vite-multi-config-forge-fuses-and-node-sqlite.md)) |
| Evals | `pnpm evals` = `node --test evals/contracts.test.mjs` | The `.claude`/contract register |

`make e2e` documents the Playwright install and **skips** without a display
or an Electron binary; it is a separate package (`tests/e2e/package.json`)
so the default gate stays fast and hermetic.

## TDD loop

Red → green → refactor, one behavior at a time
([PLAYBOOK_CLAUDE_CODE.md](../PLAYBOOK_CLAUDE_CODE.md)):

1. Write the failing test in the layer that owns the behavior (the PEP test
   before the PEP; the ViewModel test before the hook).
2. Watch it fail for the right reason.
3. Implement the minimum.
4. Run the **whole** `pnpm test`, not just the new file.

Rules: hermetic (no network, no live tenants), no fixed sleeps, flaky tests
are quarantined with an owner and an expiry, every IPC type has a contract
test ([§16.3](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## CI matrix

* Windows (x64, arm64), macOS current and N-1 (both arches; both silicon
  generations where relevant), Ubuntu LTS + one RPM distro; Linux runs X11
  **and** Wayland, with a software-rendering pass
  ([§16.2](../PLAYBOOK_DESKTOP_ELECTRON.md)).
* A **next-major canary job** runs against the Electron major after the
  pinned one.
* The Floor-profile runner (2 vCPU, 4 GB, throttled IO, software GL) runs
  the perf suite and the e2e smoke ([01](01-platform-support-and-budgets.md)).
* The perf job compares with the last release and fails on regression;
  results, fuse verification, SBOM and signing logs are stored as release
  evidence ([§16.4](../PLAYBOOK_DESKTOP_ELECTRON.md), [PLAYBOOK_AUDIT.md](../PLAYBOOK_AUDIT.md)).

**Not tested here, stated plainly**: packaged/e2e/signing runs need OS
runners and a real Electron binary — they are documented and skip, not faked.

## See also

- [16 — Testing strategy of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)
- [13 — Playbooks](13-playbooks.md)
- [05 — Repository Layout](05-repository-layout.md)
