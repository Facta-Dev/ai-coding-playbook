# 11 — Enterprise Policy & Observability

## Policy: managed > user > defaults

Managed configuration is the enterprise gate
([§13](../PLAYBOOK_DESKTOP_ELECTRON.md)). The schema
(`src/contracts/policy.ts`, zod) defines the keys; the resolver
(`src/infrastructure/policy/resolver.ts`) is pure and validated against the
schema; `reader.ts` reads the per-OS sources. Precedence is
**managed > user > defaults**; the UI shows locked controls as
"managed by your organization".

Policy keys in the shipped schema: `TenantUrl`, `RealtimeMode`
(`auto|websocket|sse|polling|off`), `HardwareAcceleration` (`auto|off`),
`TelemetryLevel` (`off|errors|full`), `KillSwitch`, `DataRetentionDays`,
`DevToolsEnabled`, `FeatureFlags` — `additionalProperties: false`, so an
unknown key is a validation failure, not a silent ignore
([§13.1 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Where policies live per OS

| Source | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Admin-set | Registry `HKLM\Software\Policies\<Vendor>\<Product>` (ADMX/ADML via GPO/Intune) or machine JSON under `%PROGRAMDATA%` | managed preferences (`/Library/Managed Preferences/<bundle-id>.plist`) | `/etc/<product>/policy.json` |
| User-level | `%APPDATA%` | `~/Library/Application Support` | `~/.config` |

Policies are read in **main** with no shell interpolation, validated by the
resolver, and handed to core; changes are watched and applied live. The
resolver is pure and tested (`tests/infrastructure/policy-resolver.test.ts`)
— invalid values are ignored, never guessed.

## Kill switch, flags, diagnostics, audit

([§13.3](../PLAYBOOK_DESKTOP_ELECTRON.md))

* **Kill switch**: the `KillSwitch` policy (plus, later, signed remote
  config) disables network features or forces read-only; min-version
  enforcement surfaces as `upgrade-required`.
* **Diagnostics bundle** (user-initiated, redacted): app/Electron/Chromium/Node
  versions, OS, GPU info (`app.getGPUInfo`), renderer mode (GPU/software),
  policy snapshot with secrets removed, realtime state, queue counts, DB
  sizes, `app.getAppMetrics()`, recent logs with correlation IDs.
* **Audit events** (if policy allows): sign-in/out, policy applied, update
  applied, export, kill-switch state — redacted and rate-limited.

## Observability

([§14](../PLAYBOOK_DESKTOP_ELECTRON.md))

| Signal | Implementation |
| --- | --- |
| Logging | Structured JSON lines in main/core (renderer forwarded), redaction filter, rotating files, ring buffer for diagnostics |
| Crash reporting | `crashReporter` (Crashpad) + a SaaS or self-hosted backend, opt-in by policy (`TelemetryLevel`) |
| Process health | `render-process-gone`, `child-process-gone`, `unresponsive` handlers; core restart with backoff; crash-loop → safe mode |
| Metrics | Startup phases, event-loop delay, IPC latency per type, SDK latency/errors, realtime lag, memory per process |
| Tracing | `correlationId` created at the user action, propagated IPC → SDK headers → logs |
| Privacy | `TelemetryLevel`: off/errors/full; no content, no tokens, hosts hashed or truncated |

Server-side alerts watch error rates per Electron version, `upgrade-required`
rates, update failures and reconnect storms.

> **Known gap: no telemetry backend wired.** The logging module ships; the
> crash-reporter destination, the metrics pipeline and the diagnostics
> export are seams — product decisions with an ADR (and, for a SaaS, a
> privacy review).

## The admin view

The policy keys, per-OS sources and the enterprise workflow live in
[`admin-guide.md`](admin-guide.md); the flows in
[`data-flows.md`](data-flows.md); OS permission usage in
[`permissions-register.md`](permissions-register.md).

## See also

- [09 — Security](09-security-fuses-csp-and-secrets.md)
- [§13 and §14 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)
