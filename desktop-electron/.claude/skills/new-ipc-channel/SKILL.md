---
name: "new-ipc-channel"
description: "Adds one typed IPC channel to the <app> app: the contract-map entry with strict schemas and a windows allowlist, the PEP guarantees, the preload surface, the core handler and the contract tests."
division: core
---

# `<app>` new-ipc-channel skill

> Reusable workflow for adding one typed request/response channel to the
> `<app>` brokered RPC surface. An agent invokes this skill; the requester
> supplies the operation, the skill supplies the contract, the guards and the
> tests.

## When to Activate

Activate this skill when the renderer needs a new synchronous-shaped
request/response operation from the core: a new query, a new command, a new
platform read that the existing `ipc` map does not declare.

Do NOT activate this skill when:

- The renderer needs a **stream** (progress events, server push) — that is the
  direct-MessagePorts path, an ADR with its own review, not a new `rpc` entry.
- The change is inside an existing channel's handler and needs no contract
  change.
- The request needs a **new policy key** — add the policy first
  (`new-policy-key`), then return to this skill.

## Core Principles

- **One channel, one contract entry.** Every operation is declared in the
  `ipc` map in `src/contracts/ipc.ts` with `IpcType`, request schema, response
  schema and `windows`. A channel the map does not know does not exist.
- **Strict in, typed out.** Request schemas are `.strict()` so unknown payload
  keys reject; response envelopes carry `v:1`, `id`, `correlationId` and a
  `Result` payload.
- **The renderer is untrusted.** `authorize()` in `src/main/ipc-policy.ts`
  checks sender origin, the main frame, the channel type and the window
  allowlist in main, before anything reaches the core.
- **No preload drift.** The bridge keeps exposing only `window.hmd.rpc` and
  `window.hmd.platform.info()`; a new channel is data in the contract, not a
  new preload method.
- **The test is the proof.** `tests/contracts/ipc.test.ts` and
  `tests/main/ipc-policy.test.ts` cover the new entry: valid, unknown type,
  wrong window, strict-schema reject.

## Rules

- The request schema validates every field it needs and rejects everything it
  does not (`.strict()`); the response type matches the schema exactly.
- The `windows` allowlist names the smallest set of windows that may call the
  channel.
- Unknown type, bad origin, child frame, window not allowlisted, and schema
  failure all reject — never fall through to the core.
- The handler in core returns `Result<T>`/`Result<void>` with an `AppError`
  code; it never throws across the bridge.
- The policy gate runs before the handler when the operation touches a
  policy-guarded capability.
- No step is "done" until the contract and policy tests plus `pnpm typecheck`,
  `pnpm lint` and `pnpm test` are green; run them and report the real output.

## Research References

| Claim | Source | Year | Link |
|-------|--------|------|------|
| Brokered RPC is the default transport; MessagePorts only for streams | `PLAYBOOK_DESKTOP_ELECTRON.md` §5 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The typed IPC contract, envelope and PEP sketch | `PLAYBOOK_DESKTOP_ELECTRON.md` Appendix B | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| Disallowed IPC patterns | `PLAYBOOK_DESKTOP_ELECTRON.md` §5.4 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The existing map to extend | `src/contracts/ipc.ts` | - | `src/contracts/ipc.ts` |
| The enforcement point to keep intact | `src/main/ipc-policy.ts` | - | `src/main/ipc-policy.ts` |

## Output Format

```
Channel: <type> — windows: [<kinds>]
Contract: src/contracts/ipc.ts — request schema <strict>, response <schema>
PEP: authorize() covers <origin | main-frame | window | schema> — <delta>
Preload: <unchanged | delta>
Core handler: src/core/... — <use case called>
Tests: tests/contracts/ipc.test.ts (<N new cases>), tests/main/ipc-policy.test.ts (<N new cases>)
Gates: pnpm test → <result>
Open: <streams, MessagePorts or policy work intentionally left out>
```
