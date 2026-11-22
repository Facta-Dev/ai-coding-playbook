# 14 — Glossary

Every term this documentation set uses. Cross-references are
chapter-relative.

**ADR** — Architecture decision record, in `docs/adr/`. The kit records
process model, dependency walls and build tooling here; a decision here is
re-opened by a later ADR, not by chat.

**AppError** — the typed error value (`code`, `message`, optional
`requiredPermission`, `correlationId`) that rides the envelope; codes in
`src/shared-kernel/errors.ts`. Nothing throws across a process boundary.

**ASAR** — Electron's archive format for the application bundle. The kit
ships `OnlyLoadAppFromAsar` on and (on macOS/Windows) embedded integrity
validation; ASAR does not hide code, it detects tampering.

**Bridge (preload bridge)** — the `contextBridge`-exposed, named-function API
(`window.hmd.rpc`, `window.hmd.platform.info`) defined in
`src/preload/index.ts`; the only renderer→exit door, generated from the
contracts.

**Capability table** — per window kind, the IPC types it may send: the
`windows: ['main']` field of a contract entry, enforced by the PEP.

**Compatibility mode / safe mode** — software rendering (policy
`HardwareAcceleration = off` → `app.disableHardwareAcceleration()`) and the
automatic post-crash mode ([01](01-platform-support-and-budgets.md)).

**Core** — the utility process (`src/core/`, started via
`utilityProcess.fork`): use cases, SDK, realtime, SQLite, session (tokens in
memory), outbox. Trusted, no UI.

**CorePort** — the renderer-side interface ViewModels depend on
(`src/renderer/core-port.ts`); faked in tests by
`tests/_shared/fakes/fake-core-port.ts`.

**CSP `connect-src 'none'`** — the renderer-has-no-network rule, set by the
`app://` handler ([09](09-security-fuses-csp-and-secrets.md)).

**Envelope** — `{ v: 1, id, type, correlationId, payload }`
(`src/contracts/ipc.ts`); every IPC message, both directions.

**Fuses** — Electron binary flags flipped in packaging before signing
(`RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off,
`EnableNodeCliInspectArguments` off, `EnableCookieEncryption` on,
`EnableEmbeddedAsarIntegrityValidation` on/off per OS, `OnlyLoadAppFromAsar`
on, `GrantFileProtocolExtraPrivileges` off)
([09](09-security-fuses-csp-and-secrets.md)).

**Floor profile** — the minimum supported hardware (2 cores, 4 GB RAM, SSD)
on which budgets are measured ([01](01-platform-support-and-budgets.md)).

**IPC PEP** — the policy-enforcement point: pure `authorize()` in
`src/main/ipc-policy.ts`, wired by `src/main/ipc-pep.ts` to
`ipcMain.handle('rpc')`.

**Kill switch** — the policy that disables network features or forces
read-only ([11](11-enterprise-policy-and-observability.md)).

**Main** — the privileged main process (`src/main/`): windows, `app://`
protocol, PEP, OS adapters (`platform/`), `safeStorage`, updater host;
thin by design.

**MessagePort fan-out** — main-created `MessageChannelMain` pairs for
streams and realtime events; designed, **not implemented** in this kit
([06](06-ipc-and-preload.md) — a stated gap).

**MVVM** — View = React component; ViewModel = plain TS class with a
`Status` union, no DOM, tested without a window; view models identical to a
web screen's are shared from `packages/viewmodels`.

**Outbox** — offline mutations queue with `Idempotency-Key` and ordering;
specified, **not implemented** ([08](08-storage-outbox-and-offline.md) — a
stated gap).

**PEP** — see IPC PEP.

**Policy** — managed configuration (`managed > user > defaults`), schema in
`src/contracts/policy.ts`, resolver in `src/infrastructure/policy/`;
sources per OS in [§13.1 of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md).

**Projection cache** — the local SQLite: rebuildable from the backend; the
server holds truth ([08](08-storage-outbox-and-offline.md)).

**Result** — `{ ok: true, value } | { ok: false, error }`
(`src/shared-kernel/result.ts`); every port returns `Promise<Result<T, E>>`.

**Sandbox** — Chromium's per-renderer OS sandbox; `sandbox: true` default
since Electron 20; never disabled here, and `--no-sandbox` is never a fix
([09](09-security-fuses-csp-and-secrets.md)).

**SSE parser** — the incremental, spec-compliant
`text/event-stream` parser in `infrastructure/realtime/sse-parser.ts`
(UTF-8, CR/LF/CRLF, heartbeats, size caps), unit-tested.

**Trust zones** — main/preload/core/renderer and the trust each is granted
([02](02-processes-and-trust.md)).

**(verify)** — version- or platform-specific claims not yet confirmed
at the source (Electron/Forge/distro behavior); listed in the root
[`verify-register.md`](../../verify-register.md).
