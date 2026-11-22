# Admin Guide

For enterprise administrators deploying and governing a product built from
this kit. The canonical policy chapter is
[§13 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md); this
guide is the operational view.

## Precedence

**managed > user > defaults.** A managed key is locked in the UI and shown
as "managed by your organization". Invalid or unknown policy values are
ignored, never guessed (the resolver is schema-validating with
`additionalProperties: false`; `tests/infrastructure/policy-resolver.test.ts`
pins this).

## Policy keys shipped in the kit schema

`src/contracts/policy.ts`:

| Key | Type | Effect |
| --- | --- | --- |
| `TenantUrl` | string | Backend endpoint, validated against the allowlist patterns |
| `RealtimeMode` | `auto\|websocket\|sse\|polling\|off` | Realtime transport; `off` and `polling` are always safe |
| `HardwareAcceleration` | `auto\|off` | Forces software rendering (Compatibility Mode) |
| `TelemetryLevel` | `off\|errors\|full` | Diagnostics governance |
| `KillSwitch` | bool | Disable network features / force read-only |
| `DataRetentionDays` | int | Local retention; purge on sign-out |
| `DevToolsEnabled` | bool (default false) | Production inspection — leave false |
| `FeatureFlags` | map | Central toggles |

A product added on top of the kit extends the schema and this table in the
same change ([§13.1 of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md)
includes the product-level keys: update control, SSO, proxy, autostart,
lock-on-idle).

## Where policy lives per OS

| Source | Windows | macOS | Linux |
| --- | --- | --- | --- |
| **Admin-set** | `HKLM\Software\Policies\<Vendor>\<Product>` (ADMX/ADML through GPO or Intune), or a machine-wide JSON under `%PROGRAMDATA%` | configuration profile / managed preferences (`/Library/Managed Preferences/<bundle-id>.plist` — a **managed** plist, not `defaults`) | `/etc/<product>/policy.json` |
| **User-level** | `%APPDATA%` | `~/Library/Application Support` | `~/.config` |

Policies are read in **main** with no shell interpolation, validated, and
handed to core; changes are watched and applied live. A registry/plist
deployment does not need the app restarted to take effect for policy-driven
behavior the app re-resolves live; startup-only behavior follows the next
launch.

## Deployment

| Need | Mechanism |
| --- | --- |
| Silent install, per-user | Squirrel (Windows consumer), drag-install |
| Silent install, per-machine (managed) | **MSI** on Windows; **pkg**/MDM on macOS; `.deb`/`.rpm` on Linux |
| Self-update control | the update policy keys (channel, window, mirror, disable) — wired **when the updater gap is closed** ([10](10-packaging-signing-and-updates.md)) |
| Pin a version | deploy the exact artifact; disable self-update when the fleet tool owns updates |
| Fleet visibility | version, channel, Electron/Chromium/Node versions, OS and policy hash reported with sessions, subject to `TelemetryLevel` |
| Air-gapped | offline installers with detached signatures/checksums |

Artifacts and signing per OS: [10 — Packaging, Signing & Updates](10-packaging-signing-and-updates.md).

## Publishing policy, step by step

1. Choose the source for your estate (registry/plist/JSON above).
2. Publish only keys defined in the app's schema version; anything else is
   rejected by the resolver.
3. Verify what the app actually resolved — the diagnostics bundle shows the
   effective policy snapshot with secrets removed
   ([11](11-enterprise-policy-and-observability.md)).
4. Set `HardwareAcceleration = off` for VDI/VM fleets **before** rollout;
   e2e is tested in software rendering, and the safe-mode path exists
   ([01](01-platform-support-and-budgets.md)).
5. Use `KillSwitch = true` to force read-only during an incident; the flag
   surfaces as `policy-blocked`, not as silent breakage.
6. Record the policy hash and app version of affected clients with the audit
   events ([PLAYBOOK_AUDIT.md](../PLAYBOOK_AUDIT.md)).

## Support and diagnostics

The user-initiated diagnostics bundle contains: app/Electron/Chromium/Node
versions, OS, GPU info, renderer mode (GPU/software), policy snapshot
(secrets removed), realtime state, queue counts, DB sizes and recent logs
with correlation IDs. Have the user export it before contacting support;
redaction is applied at export, and `TelemetryLevel` governs anything sent
beyond the user's own action.

## What the administrator cannot (yet) do with the kit as shipped

Stated gaps, not hidden ones: self-update control (no updater wiring),
central kill-switch **remote** config (only the local policy exists), and
crash telemetry routing (no backend wired). Local policy, the registry/plist
sources, the kill-switch state and diagnostics export are implemented
([10](10-packaging-signing-and-updates.md), [11](11-enterprise-policy-and-observability.md)).
