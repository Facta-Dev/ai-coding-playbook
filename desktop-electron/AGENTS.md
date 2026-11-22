# `<app>` — agent instructions

Operating instructions for any coding agent working in this repository
(Claude Code, Codex, Cursor, Gemini …). `<app>` is a cross-platform Electron
desktop client template: hexagonal architecture (ports & adapters) run across
Electron's process boundary, vertical slices, MVVM in a sandboxed React
renderer, a thin main process that enforces the IPC policy, a core
`utilityProcess` that owns the SDK and storage, TypeScript strict, Vite +
Forge with a pinned fuse set, and one typed IPC contract.

`CLAUDE.md` is a symlink to this file. Keep one source of truth.

## Hard rules

- **English only** in code, comments, UI copy, docs, test names and tool descriptions.
- **`make ci` green before you declare a change complete.** Plausibility is not correctness: read the output.
- **Never fabricate** paths, versions, symbols, test results or commit hashes. Read the file or run the command.
- **Never weaken a gate** to make a build pass — no deleted failing test, no blanket `eslint-disable`, no relaxed `dependency-cruiser` rule, no `@ts-expect-error` without a stated reason, no layering rule deleted.
- **Touch only what the request needs.** No drive-by refactors.
- This repository was instantiated from a template: the three substitution
  tokens documented in `scripts/rename.sh` are placeholders until that script
  runs. One surviving verbatim outside the frozen `scripts/`/`evals/` directories after instantiation is a bug, not a template artifact.

## Process model and trust zones — enforced by tsconfigs, depcruise and the PEP

Electron gives every app one privileged process by default. This template
spends that privilege on exactly two processes and treats everything else as
untrusted:

| Process | Trust | Lives in | Owns | Must not |
|---|---|---|---|---|
| **Main** (Node, privileged, thin) | Trusted anchor | `src/main/` | Window lifecycle, `app://` protocol, `src/platform/` adapters, the IPC **enforcement point**, `safeStorage`, updater host | Business logic, SDK, DB, long loops, blocking calls, remote content |
| **Core** (utility process, app brain) | Trusted, no UI | `src/core/` + domain, application, infrastructure | Use cases, generated SDK over `net.fetch`, realtime, `node:sqlite`, session (tokens in memory only) | The DOM, the `electron` module, unvetted senders |
| **Preload** (sandboxed bridge) | Semi-trusted | `src/preload/` | Only `window.hmd.rpc(type, payload)` and `window.hmd.platform.info()` | Expose `ipcRenderer`, `require`, `process`, a generic `invoke(channel, …)` |
| **Renderer** (React) | **Untrusted** | `src/renderer/`, slices' views | Views, view models, local UI state | Node, filesystem, network, secrets, cross-window access |

Rules that follow:

- `process.platform` appears **only** in `src/platform/` (and build files).
- The main process **never blocks**; core runs behind
  `src/main/core-supervisor.ts` (`utilityProcess.fork`, scrubbed env, restart
  with backoff, refuses to start outside the packaged app layout).
- Every `BrowserWindow` keeps `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false`. Never disable context isolation to fix a bug.
- Errors are values, not exceptions: `Result<T, AppError>` from `src/shared-kernel/` rides inside the envelope across every process boundary. Nothing throws across one.

## IPC rules — one typed contract, one channel

- The only channel is `rpc`, and every message is a typed envelope described
  in `src/contracts/ipc.ts`: `v: 1`, `id`, `type`, `correlationId`, `payload`,
  request schemas `.strict()`.
- New IPC type = contract table first, PEP test next (`src/main/ipc-policy.ts`
  is a pure function; `src/main/ipc-pep.ts` wires `ipcMain.handle('rpc')` to
  it). A type reaches a window only through its `windows: [...]` capability
  list.
- The preload bridge exposes **named functions only** — no channel strings,
  no passthrough. Its whole surface stays auditable in one sitting.
- Renderer network access of any kind is a design violation
  (`connect-src 'none'`): the renderer calls `CorePort.rpc`, core talks to the
  network.

## Security rules — the fuse set and the untrusted renderer

- The fuse set in `forge.config.ts` is the shipped posture: `RunAsNode` off,
  `EnableCookieEncryption` on, `NODE_OPTIONS` off, inspect args off,
  `EnableEmbeddedAsarIntegrityValidation` on, `OnlyLoadAppFromAsar` on,
  `GrantFileProtocolExtraPrivileges` off; packaged with `asar` on. Turning one
  off is an ADR, not an edit.
- Secrets live in core/main via `safeStorage` through
  `src/platform/secrets/`; the renderer never sees a token.
- Renderer content loads only from the `app://` origin; navigation off-origin
  is refused. Permission requests are denied by default.
- A `--no-sandbox` workaround, a widened bridge, a schema-less channel or a
  token in a renderer is rejected as an architecture break
  (`PLAYBOOK_SECURITY.md`, `PLAYBOOK_DESKTOP_ELECTRON.md`).

## Layer rules — enforced at typecheck, lint and test time

| Layer | Path | May depend on | Must not depend on |
|---|---|---|---|
| shared kernel | `src/shared-kernel/` | pure TS | contracts, platform, infrastructure, features |
| contracts | `src/contracts/` | shared kernel | platform, infrastructure, features |
| slice domain | `src/features/<slice>/domain/` | shared kernel | `electron`, `node:*`, DOM, React, adapters |
| slice application | `src/features/<slice>/application/` | domain, contracts | Electron/Node/DOM APIs, adapters |
| slice adapters | `src/features/<slice>/adapters/` | application ports, platform, SDK | views, viewmodels |
| slice views | `src/features/<slice>/views/` | ViewModel hooks, `ui-kit` | SDK, `electron`, direct IPC |
| platform | `src/platform/` | Electron/Node APIs | domain, application |
| core | `src/core/` | domain, application, adapters | `electron`, React, DOM |
| preload | `src/preload/` | contracts | renderer, core internals |
| main | `src/main/` | everything (composition root) | — (no business logic by rule) |
| sdk | `packages/sdk/` | TypeScript stdlib | `node:*`, `electron`, React |

`dependency-cruiser.config.cjs` encodes the walls (import-level copies in
`eslint.config.mjs`, type-surface splits in the per-target tsconfigs, plus
`tests/_platform/architecture/architecture.test.ts`). A new dependency rule
ships in depcruise **and** a test. Ports are consumer-defined
(`features/<slice>/application/ports.ts`), adapters implement them, and a
slice never imports another slice's internals.

## Playbooks — restrictions, loaded on demand

Seven local playbooks ship next to this file:

| File | Covers |
|---|---|
| `PLAYBOOK_DESKTOP_ELECTRON.md` | Platform model, three-process design, IPC, security, packaging, budgets |
| `PLAYBOOK_TESTS.md` | Test pyramid, environments, gates, audit evidence |
| `PLAYBOOK_SECURITY.md` | Threat model, secrets, TLS, supply chain |
| `PLAYBOOK_URLS.md` | Route naming, error envelope, realtime topics |
| `PLAYBOOK_AUDIT.md` | Self-hosting an audit program (SOC 2 / ISO 27001 / 9001) |
| `PLAYBOOK_CLAUDE_CODE.md` | The Claude Code kit, TDD loop, multi-session governance |
| `PLAYBOOK_FRONTEND.md` | UI copy, accessibility, shared design tokens |

They are **restrictions, not suggestions**: a change that contradicts one is
wrong until the playbook changes in the same pull request. They load **on
demand only**: adopt one by adding a rule under `.claude/rules/` whose
`paths:` frontmatter names the files it guards and whose body names the
playbook — then read that playbook before editing those files. **Never
`@`-import them** — the always-on set (this file plus the path-less rules)
must stay inside the harness budget, and `scripts/instruction-budget.sh`
enforces it: 40,000 chars per file, 120,000 chars for the whole always-on set.

## Gates

```sh
pnpm typecheck                    # five surfaces: main, core, preload, renderer, tests
pnpm lint                         # eslint . && depcruise --config dependency-cruiser.config.cjs src
pnpm test                         # vitest run
pnpm build                        # four vite bundles: main, preload, core, renderer
pnpm evals                        # node --test: .claude contract register, offline
pnpm package                      # electron-forge package (needs the Electron binary)
make package                      # same through the Makefile
make fuses APP=out/<name>         # read the fuse table from a packaged app
make ci                           # typecheck + lint + test + build + evals
bash scripts/verify-template.sh   # template factory: stages a renamed copy,
                                  # installs (ELECTRON_SKIP_BINARY_DOWNLOAD=1),
                                  # runs every gate on it
bash evals/run-live.sh            # must be a no-op without EVALS=1
make e2e                          # optional: Playwright for Electron on the
                                  # packaged app; SKIPs without a display/binary
```

`bash scripts/verify-template.sh` is the authoritative gate: it validates the
`.claude` layer (linters, instruction budget, leak guard) and the rename state
of the tree on a staged copy, never mutating the working tree. `make package`,
`make fuses`, `make e2e` and the packaging makers are explicit, not part of the
default gate.

## TDD loop

Red → green → refactor, one behaviour at a time:

1. Write the failing test first, in the layer that owns the behaviour.
   Suites are vitest files next to or mirroring the layer; ports are exercised
   against the fakes in `tests/_shared/fakes/`, never against a real adapter.
2. Watch it fail for the right reason (missing implementation, not a typo).
3. Implement the minimum that makes it pass.
4. Refactor with the whole suite green — `pnpm test` over the whole tree, not
   only the new test.

Test rules: hermetic (no network, no live services, no real tenant data),
Node-environment (no DOM in unit tests; view models are plain classes tested
with a fake `CorePort`), waits on observable conditions instead of fixed
sleeps.

## Who edits what

| Area | Owner |
|---|---|
| `docs/plans/`, specs | `planner`, `architect` |
| `src/features/<slice>/**` | implementers (`build-resolver`, `tdd-guide`) |
| `tests/**`, slice `*.test.ts` | `test-author` |
| `src/ui-kit/**`, `src/renderer/**` | `client` division (`renderer-ui-reviewer`) |
| `src/main/**`, `src/preload/**`, `src/contracts/**` | `client` division (`ipc-surface-reviewer`) |
| `src/platform/**`, fuses, `forge.config.ts` | `security` division (`electron-security-reviewer`) |
| packaging, sign/update wiring, `src/main/core-supervisor.ts` | `client` division (`packaging-updater-reviewer`) |
| `packages/sdk/**` | shared — integrator role |
| `.claude/settings.json`, `.claude/manifest.json`, `.claude/schemas/**`, `scripts/**` | human only; an agent writes a proposal under `.claude/proposals/` |

Multi-session rules: one worktree per (slice, spec); never edit a slice
another session owns — message its owner instead; message dependents before
changing a published contract (`src/contracts/**`); never force-push a shared
branch.

## Never

- **No `contextIsolation: false`, no `sandbox: false`, no
  `nodeIntegration: true`** on any window, ever — even "temporarily".
- **No `ipcRenderer` or `process` in the renderer**, no generic
  `invoke(channel, …)` passthrough in the bridge, no second untyped channel.
- **No SDK, network, filesystem or direct IPC call** from a view or a view
  model; the renderer talks to a `CorePort` over the bridge and nothing else.
- **No OS adapters outside `src/platform/`** (`process.platform` included).
- **No secrets** in the repository, the logs, the renderer, a crash dump or
  a plain-text file: tokens live in core/main via `safeStorage`, `.env` is
  gitignored, `.env.example` holds placeholders only.
- **No fuse turned off** and no hardening default relaxed without an ADR.
- No third-party dependency without an ADR, a license check and an SBOM entry.
- **No blocking call on the main process** (sync IPC, long loops, sync fs);
  the main thread runs windows, the PEP and trivial orchestration only.
- No `@`-import of a playbook.
