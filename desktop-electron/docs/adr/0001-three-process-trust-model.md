# ADR 0001 — Three-process trust model

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-22 |
| **Scope** | The process architecture of the kit |
| **Supersedes** | — |

## Context

An Electron app starts with one privileged Node process that owns windows,
menus, the filesystem and the network. The default temptation is to put
everything in it: it is simpler, there are fewer IPC hops, and it demonstrably
works — until the day a renderer is compromised by a hostile string that got
rendered as HTML, and the compromising code's process has `require()` and the
user's disk.

The costs of the default are not hypothetical; they are structural:

* a renderer that shares a process with your secrets is a renderer you can
  never treat as untrusted, however careful the CSP;
* a main process that runs use cases and SDK calls behind the UI means the
  security-critical window manager shares its event loop with everything
  else — one slow DB call freezes every window;
* `nodeIntegration: true` renderers are why Electron's own checklist begins
  where it begins.

The kit's product contract requires the opposite posture: sandboxed,
context-isolated renderers, tokens that never reach a renderer, and a main
process that "never blocks"
([§3.1 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Decision

**Three processes with named jobs, plus the sandboxed bridge:**

| Process | Job | Trust |
| --- | --- | --- |
| **Main** (`src/main/`) | Thin trust anchor: windows, `app://` protocol, the IPC policy-enforcement point, `safeStorage`, updater host, OS adapters | trusted, privileged — and thin |
| **Core** (`src/core/`) | The application brain: use cases, SDK, realtime, SQLite, session | trusted, no UI, restartable |
| **Renderer** (`src/renderer/`) | Draw state, send intents | **untrusted** |
| **Preload** (`src/preload/`) | The named-function bridge | semi-trusted, tiny |

Rules that follow, enforced rather than declared:

* Main starts core with `utilityProcess.fork`, restarts it with backoff on
  crash, and holds no business logic ([02](../02-processes-and-trust.md));
* every renderer→anything path is the typed envelope through the PEP
  ([06](../06-ipc-and-preload.md));
* tokens live in core memory plus `safeStorage` ciphertext; the IPC contract
  shape-checks payloads so a token never has a route into a renderer.
* The single **known gap** in the model as shipped: realtime/streaming
  fan-out over direct MessagePorts is designed but not implemented — all
  traffic rides the envelope RPC, which is the *more* restrictive path.

## Consequences

**Accepted:** one IPC hop more than the naive design; a second process to
boot and supervise; typed contracts to maintain; a reconnecting status to
implement and test. All four are the price of "untrusted" meaning
"untrusted".

**Bought:** a compromised renderer reaches neither the filesystem, nor
tokens, nor other windows; a slow or crashing core degrades instead of
freezing; main's 50 ms event-loop budget is protected by structure; the core
restarts without user-visible data loss.

**Not bought by this ADR:** memory — the additional utility process is part
of the ~300 MB idle budget ([01](../01-platform-support-and-budgets.md)); if
the budget is ever exceeded, the fix is pruning main/core work, not merging
the processes back.

**Rejected:** `nodeIntegration` renderers; a fat main process (all logic
in main, "one process is simpler"); a second UI-privileged process. Each
re-opens the threat this ADR closes.

## See also

[02 — Processes & Trust](../02-processes-and-trust.md) ·
[§3.1 of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md) ·
[ADR 0002](0002-per-target-tsconfigs-and-dependency-walls.md) for how the
trusting is machine-checked.
