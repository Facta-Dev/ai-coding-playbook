---
id: DESKTOP_ELECTRON_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-19
review_cadence_days: 30
owner: desktop + security
depends_on: [DESKTOP_ELECTRON]
---

# PLAYBOOK_DESKTOP_ELECTRON_PART2.md — PLAYBOOK_DESKTOP_ELECTRON.md — Cross-platform Electron desktop application playbook (Windows · Linux · macOS) (part 2)

> Part 2 of 3. Main entry: [`PLAYBOOK_DESKTOP_ELECTRON.md`](PLAYBOOK_DESKTOP_ELECTRON.md). Covers: 7. Navigation, routes, deep links and windows … 20. Anti-patterns (reject in review).

## 7. Navigation, routes, deep links and windows

* **Routes** use the same grammar as every client: `/{userType}/{module}/{resource}[/{resourceId}[/{subresource}]]` (`/app/funnels/leads/:leadId`, `/admin/tenants/:tenantId/users`); route builders are generated from the shared route table.
* **In-window routing** with a client router inside the renderer; guards (`RequireAuth`, `RequireUserType`, `RequirePermission`) shape UX only. Unknown routes render not-found; the router never guesses.
* **Shells per `{userType}`** (`app`, `admin`, `partner`) are code-split modules; the admin shell is not loaded for non-admins (performance, not security).
* **Windows**: a main window plus optional settings/admin/auxiliary windows; each window type has its own capability set (5.1), partition and size/position persistence that handles disappeared monitors. Prefer **one window with routed views** over many windows.
* **Deep links**: custom protocol `heimdall://app/funnels/leads/{leadId}` registered per OS (`app.setAsDefaultProtocolClient`), received via `open-url` (macOS) and the `second-instance` event (Windows/Linux, with `app.requestSingleInstanceLock()`); handled by a strict parser in main (route allowlist, ID validation, size limits, no actions), mapped to a route and forwarded through the PEP. Links are **untrusted input**; state-changing actions need UI confirmation and an authenticated session.
* **File associations/drag-drop** (if any) parsed in a utility process; never executed.
* **Navigation lockdown**: `will-navigate` allows only `app://` origin; `setWindowOpenHandler` denies; external `https` links go through `shell.openExternal` with a scheme/host allowlist.

---

## 8. Authentication and session

* **OIDC Authorization Code + PKCE in the system browser** (`shell.openExternal`): loopback redirect (`http://127.0.0.1:<random port>`, single-use `state`, short timeout, served by the core) or the registered custom protocol; **never** an in-app `BrowserWindow` login for a third-party IdP (phishing, shared-process exposure). Device-code flow as a fallback for restricted environments.
* **Token handling**: access token in the core's memory only; **refresh token encrypted with `safeStorage`** and stored as an opaque blob in the user data dir; renderers never see tokens (I-15).
* **`safeStorage` rules**: check `isEncryptionAvailable()`; on Linux inspect `getSelectedStorageBackend()` and **refuse the `basic_text` fallback** (plaintext-equivalent) unless policy explicitly allows it, falling back to "sign in each session"; encryption depends on the app being signed on macOS.
* Refresh rotation with reuse detection (server), single-flight refresh, immediate wipe on sign-out/suspension, optional lock-on-idle (`powerMonitor` idle/lock events) that clears the in-memory access token.
* Enterprise SSO: issuer/client ID from managed policy; conditional-access signals come from the IdP.
* Session expiry, policy changes and revocation surface as ViewModel statuses (`signed-out`, `policy-blocked`).

---

## 9. Realtime: optional SSE and WebSocket

Contract, state machine, envelope and server requirements are the same as `PLAYBOOK_DESKTOP_QT` §8 (and `PLAYBOOK_BACKEND` §7); Electron specifics:

* **Where it runs**: the **core process** owns connections; renderers subscribe to topics through the PEP and receive **coalesced** events (≤ 30–60 Hz) over ports.
* **Modes**: `RealtimeMode = auto | websocket | sse | polling | off` (policy > user > default); the app is fully correct with polling or none.
* **SSE**: streaming `net.fetch` with `Accept: text/event-stream`, `Authorization` header, `Last-Event-ID` on resume; read the body with a stream reader and a **spec-compliant parser** (UTF-8, CR/LF/CRLF, comments as heartbeat, `retry`, max line/event size); a dedicated request path so API calls aren't starved; timeouts longer than the server heartbeat.
* **WebSocket**: `net.WebSocket` (Chromium stack: proxy, certificates) where available in your Electron major **(verify)**, otherwise the `ws` library for non-proxied environments; subprotocol `heimdall.v1`, message-size caps, schema-validated envelopes, app-level heartbeat.
* **Lifecycle**: Electron `powerMonitor` (`suspend`, `resume`, `lock-screen`, `unlock-screen`) and `net.online`/connectivity changes trigger reconnect; drop half-open sockets rather than trusting them; pause fan-out for hidden/minimized windows per policy; reconcile on show.
* **Snapshot + stream**, at-least-once with dedupe by event ID, resume tokens, `resyncRequired(topics)` after gaps, backoff with jitter (1 s → 60 s cap), per-topic authorization server-side (I-10).
* **Applying events**: events are notifications first (invalidate/refresh cache entries, minimal diffs); renderer updates are batched and coalesced per entity to avoid repaint storms.

---

## 10. Local storage and data

* **SQLite** in the core process: WAL, prepared statements, batched transactions, forward-only migrations in code tested from every released schema, backup before migrating, integrity check after a crash, **reset-and-resync** on corruption (the server holds truth).
* **Driver ADR**: `better-sqlite3` (native, fastest, must be rebuilt per Electron ABI and unpacked from ASAR) vs built-in `node:sqlite` (no native module; confirm availability/stability in Electron's Node) vs WASM SQLite (no native, slower). Prefer the option with **no native module** if it meets the budget **(verify)**.
* **Per-tenant/per-user databases** (or `tenant_id`-first indexes) so tenant switch and sign-out purge cleanly.
* **Encryption**: OS disk encryption is the baseline; for Restricted data use field-level AES-GCM with a key wrapped by `safeStorage`, or an encrypted SQLite build by ADR.
* **Retention**: `DataRetentionDays` policy enforced by a background job; purge on sign-out; temp files in a private dir with restrictive permissions.
* **Paths** via `app.getPath('userData'|'logs'|'temp')` (never next to the executable); per-user data separate from machine-wide config.
* **Settings**: small JSON with schema validation and atomic writes; policy-locked keys are read-only in the UI; no secrets.
* **Renderer storage**: don't rely on `localStorage`/IndexedDB for authoritative data; clear partitions on sign-out; disable persistent caches that could hold sensitive data.

---

## 11. Platform integration (per OS, behind `platform/`)

| Capability | Windows | macOS | Linux |
|---|---|---|---|
| Secret store | `safeStorage` (DPAPI) | `safeStorage` (Keychain; needs signed app) | `safeStorage` (libsecret/kwallet; reject `basic_text`) |
| Notifications | Toast (needs `app.setAppUserModelId`) | Notification Center (permission) | freedesktop D-Bus notifications |
| Tray/menu bar | Notification area | Menu bar extra + app menu | StatusNotifier/AppIndicator (not guaranteed; provide fallback) |
| Autostart | `app.setLoginItemSettings` | Login item | XDG autostart `.desktop` |
| Protocol/file assoc. | Registry (installer-assisted) | `Info.plist` via packager | `.desktop` MIME handler |
| Single instance | `requestSingleInstanceLock` | same | same |
| Window chrome | Native or `titleBarOverlay` (Mica/snap layouts) | `titleBarStyle` (hiddenInset), traffic lights | Native/GTK or frameless; CSD differences |
| High DPI | Per-monitor | Retina | X11/Wayland scaling differences; test fractional scaling |
| Display server | n/a | n/a | **X11 and Wayland** (`--ozone-platform-hint=auto`): global shortcuts, window positioning and screen capture differ **(verify per Electron major)** |
| Dark mode/contrast | `nativeTheme`, high contrast | `nativeTheme` | desktop settings; test GNOME and KDE |
| Power/network | `powerMonitor`, `net` | same | same (D-Bus availability varies) |
| Proxy/certs | Chromium stack uses system settings | same | system/PAC support varies by desktop; document |
| Updates | Squirrel/MSI/MSIX/NSIS | Squirrel.Mac (zip) / pkg | deb/rpm repos, Flatpak, Snap, AppImage |
| Accessibility | UIA through Chromium | NSAccessibility | AT-SPI |

Rules: platform adapters implement ports and are selected in the composition root; each capability has a **graceful fallback** (no tray → in-app notification center); native menus follow OS conventions (macOS app menu, standard shortcuts via `accelerator`); keyboard shortcuts use platform modifiers (`CmdOrCtrl`); i18n via message keys; **accessibility is mandatory** (semantic HTML, ARIA, focus management, keyboard-only operation, reduced motion, high contrast; test with screen readers on all three OSes).

---

## 12. Security

Aligned with `PLAYBOOK_SECURITY.md` and Electron's own security checklist; desktop-specific additions below.

### 12.1 Threat model

| Threat | Controls |
|---|---|
| **XSS/compromised renderer** | Sandbox, context isolation, no Node, CSP `connect-src 'none'` (renderer has no network), sanitize third-party content, narrow bridge; main/core re-authorize everything |
| **IPC abuse** | Allowlisted channels, sender verification (`senderFrame`), per-window capabilities, schema validation, size limits, no generic invoke |
| **Malicious/unsafe navigation** | `will-navigate` lock, `setWindowOpenHandler` deny, no `<webview>`, `shell.openExternal` allowlist, separate partition/no preload for any embedded content |
| **Local tampering** (edit `app.asar`, flip runtime flags) | **Fuses** (RunAsNode off, NODE_OPTIONS off, inspect flags off, cookie encryption on), **ASAR integrity + `OnlyLoadAppFromAsar`**, code signing, signed updates |
| **Token/secret theft** | `safeStorage`, tokens only in core memory, no tokens in logs/crash dumps, `basic_text` refused |
| **Supply chain** (huge npm tree, native modules, Chromium/Node bundled) | Lockfile, frozen installs, `--ignore-scripts` by default, release-age cooldown, SCA/SBOM including Electron/Chromium/Node versions, provenance, pinned CI actions |
| **Chromium/Node/Electron CVEs** | Upgrade cadence and security SLA (2.6), advisory monitoring, canary → stable rollouts |
| **Update hijack/downgrade** | Signed manifest (separate trust root), HTTPS, monotonic versions, platform signature checks, rollback protection |
| **DLL/library hijacking, native modules** | Install in protected paths, avoid native modules, sign `.node`, safe DLL search settings, unpack only what's required |
| **Malicious deep links / file opens** | Strict parser, allowlist, no actions without confirmation, authenticated session |
| **Remote debugging / inspection** | Fuses disable inspect args and `NODE_OPTIONS`; DevTools off in production by policy; no remote debugging port |
| **Hostile server content** | Schema validation, size limits, escape-on-render, no HTML injection (lead names, bios), no remote code |
| **Information leak via diagnostics** | Redaction, user-initiated export, `TelemetryLevel` |

### 12.2 Window and session hardening (mandatory defaults)

```ts
webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInWorker: false,
  webviewTag: false, webSecurity: true, allowRunningInsecureContent: false, experimentalFeatures: false,
  safeDialogs: true, spellcheck: false, devTools: !app.isPackaged }
```

* **Never disable context isolation to fix a bug**: it also removes process sandboxing for that renderer.
* **Permissions**: `session.setPermissionRequestHandler` and `setPermissionCheckHandler` **deny by default**; allow only what a window type needs (clipboard-write, notifications) and nothing like geolocation/camera unless a slice requires it.
* **TLS**: never relax certificate verification; no `ignore-certificate-errors`; enterprise CAs come from the OS store via Chromium.
* **CSP** (set by the `app://` handler as a response header): `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://<cdn>; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`; consider Trusted Types.
* **No remote code with Node**; no `eval`/`new Function`; no remote `<script>`.

### 12.3 Fuses and ASAR integrity (packaging step, before signing)

| Fuse | Value |
|---|---|
| `RunAsNode` | **off** |
| `EnableNodeOptionsEnvironmentVariable` | **off** |
| `EnableNodeCliInspectArguments` | **off** |
| `EnableCookieEncryption` | **on** |
| `EnableEmbeddedAsarIntegrityValidation` | **on** (macOS and Windows; not available on Linux, so don't claim it there) |
| `OnlyLoadAppFromAsar` | **on** |
| `GrantFileProtocolExtraPrivileges` | **off** |

CI **reads the fuses from the packaged output** (`@electron/fuses read`) and fails on drift; then signs; then re-verifies the signed artifact. ASAR integrity is documented as stable for recent majors with macOS support since Electron 16 and Windows since 30 **(verify per version)**; it detects tampering with the archive, it does not hide code.

### 12.4 Secrets, keys and signing material

| Item | Handling |
|---|---|
| Refresh tokens, local-DB keys | `safeStorage`; never plaintext files; never in renderer |
| Tenant provider keys | Never on the desktop (invariant I-15) |
| Update signing key (manifest) | KMS/HSM; separate from the code-signing identity; rotation plan |
| Windows code-signing key | Hardware-protected (FIPS 140 L2 / Common Criteria EAL4+ per Electron's guidance): cloud signing (e.g., Azure Artifact Signing, formerly Trusted Signing) or HSM; never copied to CI runners |
| Apple Developer ID / notarization credentials | CI secret store, isolated signing job, approval gate |

### 12.5 Linux sandbox reality

Chromium's sandbox relies on user namespaces or a setuid helper. Some distributions restrict unprivileged user namespaces by default (for example recent Ubuntu releases via AppArmor), which breaks naive AppImage/tarball installs. **Never ship or document `--no-sandbox` as a fix.** Ship `.deb`/`.rpm` with the sandbox helper correctly set up (and an AppArmor profile where the distro requires it), or distribute Flatpak/Snap; test on current Ubuntu LTS, Fedora and a Wayland session **(verify distro behavior per release)**.

### 12.6 Language profile (TypeScript/Node/Chromium)

Follow `PLAYBOOK_SECURITY.md` §16 for Node/TypeScript (no `eval`, `execFile` with argument arrays, prototype-pollution-safe parsing, path containment with `realpath`, no secrets in argv/env) plus: validate every IPC payload; escape or sanitize every string from the server before rendering (lead data is untrusted); avoid `dangerouslySetInnerHTML`; keep dependencies minimal and review install scripts; fuzz parsers (SSE, deep links, update manifest, IPC envelopes).

---

## 13. Enterprise capabilities

### 13.1 Managed configuration (policy)

Policies override user settings; the UI shows locked controls as "managed by your organization". Precedence **managed > user > defaults**; a pure `PolicyResolver` (application layer) validates against a schema.

| Source | Windows | macOS | Linux |
|---|---|---|---|
| Admin-set | Registry `HKLM\Software\Policies\<Vendor>\<Product>` with **ADMX/ADML** (Intune/GPO) or a machine-wide JSON under `%PROGRAMDATA%` | Configuration profile / managed preferences (`/Library/Managed Preferences/<bundle-id>.plist`) | `/etc/<product>/policy.json` |
| User-level | `%APPDATA%` config | `~/Library/Application Support` | `~/.config` |

Read policies in **main** (no shell interpolation: use `execFile` with argument arrays or a vetted parser), validate, and hand the resolved result to core; changes are watched and applied live.

| Policy | Type | Effect |
|---|---|---|
| `TenantUrl` / `ApiBaseUrl` | string | Backend endpoint (validated against allowlisted patterns) |
| `SsoMode`, `IdpIssuer`, `ClientId` | string | SSO configuration |
| `UpdatesEnabled`, `UpdateChannel`, `UpdateWindow`, `UpdateMirrorUrl` | bool/enum/object/string | Update control, deferral, internal mirror |
| `RealtimeMode` | `auto\|websocket\|sse\|polling\|off` | Realtime transport control |
| `ProxyMode`, `ProxyUrl`, `CustomCaBundle` | enum/string/path | Network environment (Chromium honors system settings by default) |
| `TelemetryLevel`, `CrashReportingEnabled` | enum/bool | Diagnostics governance |
| `HardwareAcceleration` | `auto\|off` | Forces software rendering |
| `DevToolsEnabled` | bool (default false) | Production inspection |
| `KillSwitch` | bool | Disable network features / force read-only |
| `FeatureFlags` | map | Central toggles |
| `DataRetentionDays` | int | Local retention |
| `AutostartMode`, `ForceSignInOnStartup`, `LockOnIdleMinutes` | enum/bool/int | Session behavior |
| `AllowUserSettings`, `SupportContact`, `LogLevel` | bool/string/enum | UI locking, support info, verbosity |

### 13.2 Deployment

| Need | Mechanism |
|---|---|
| Silent install/uninstall | **MSI** (per-machine, updates managed by the fleet tool) or Squirrel/NSIS silent flags (Windows), `.pkg`/MDM (macOS), `.deb/.rpm` via package managers (Linux) |
| Per-machine vs per-user | Per-machine for managed fleets; per-user installers for consumers (Squirrel installs per user) |
| Update control | Policy-driven channel/window/mirror; pin a version; disable self-update when the fleet tool owns updates |
| Fleet visibility | Version, channel, Electron/Chromium version, OS, policy hash reported with sessions (subject to `TelemetryLevel`) |
| Stores (optional) | Microsoft Store/MSIX, Mac App Store (sandbox constraints, separate build), Flathub/Snap; separate test passes |
| Offline/air-gapped | Offline installers/update bundles with signature verification |
| Proxy/TLS inspection | Chromium stack inherits system proxy/PAC/certs; test authenticated proxies and TLS inspection |

### 13.3 Kill switch, flags, diagnostics, audit

* **Kill switch**: policy `KillSwitch` plus signed remote config (data only, schema-validated, bundled safe defaults) can disable features or force read-only; minimum-version enforcement uses `upgrade-required`.
* **Diagnostics bundle** (user-initiated, redacted): app/Electron/Chromium/Node versions, OS, GPU info (`app.getGPUInfo`), renderer mode (GPU/software), policy snapshot (secrets removed), effective config, realtime state history, queue/outbox counts, DB sizes, `app.getAppMetrics()`, recent logs and errors with correlation IDs, watchdog stats.
* **Audit events** (if policy allows): sign-in/out, policy applied, update applied, export, kill-switch state; redacted and rate-limited.

---

## 14. Observability

| Signal | Implementation |
|---|---|
| Logging | Structured JSON lines (pino or similar) in main, core, renderer (forwarded), per-slice categories, redaction filter, rotating files with size caps, ring buffer for diagnostics |
| Crash reporting | `crashReporter` (Crashpad) for main/renderer/utility + Sentry Electron (or equivalent); symbols for the **Electron binary** and the app uploaded privately; minidumps opt-in by policy; PII scrubbing |
| Process health | `render-process-gone`, `child-process-gone`, `unresponsive` handlers: reload the window to the last route, restart the core with backoff, **crash-loop detection → safe mode** (GPU off, plugins off) |
| Metrics | Startup phases, time-to-interactive, main/core event-loop delay, renderer long tasks, IPC latency per message type, SDK latency/errors, realtime state/uptime/reconnects/lag, memory per process, update outcomes |
| Tracing | `correlationId` created at the user action, propagated through IPC → SDK headers → realtime/logs |
| Privacy | Telemetry level from policy; hosts hashed/truncated; no content in telemetry unless essential and allowed |

Server-side alerts watch error rates per app/Electron version, `upgrade-required` rates, update failures and realtime reconnect storms.

---

## 15. Packaging, signing and updates

### 15.1 Packaging matrix

| OS | Artifacts | Notes |
|---|---|---|
| **Windows** | Squirrel.Windows (consumer, per-user auto-update), **MSI** (managed/per-machine), MSIX (experimental in Forge; Store/enterprise) **(verify)**, NSIS (electron-builder), portable zip | x64 + arm64; sign every `.exe/.dll/.node` and the installer |
| **macOS** | `.app` in **zip** (required by Squirrel.Mac) and **DMG**; **pkg** for MDM | Developer ID, hardened runtime, notarization + stapling; per-arch builds (universal only if needed) |
| **Linux** | `.deb`, `.rpm` (repos), **Flatpak**, Snap, AppImage, zip | x64 + arm64; sandbox helper/AppArmor (12.5); desktop file + icons + AppStream metadata |

### 15.2 Build rules

* Forge config (or builder) checked in; **Fuses plugin** enabled; ASAR packaging with integrity metadata (Forge/Packager versions that emit it **(verify)**); locale/asset pruning hook; reproducible environment (pinned Node, lockfile, containerized Linux builds).
* Pipeline order: **build → package → flip fuses → verify fuses → sign → notarize → verify signature/notarization → generate SBOM/license report → publish**.
* **SBOM** includes npm dependencies **and** the bundled Chromium/Node/Electron versions (CVE feeds key off them); license report covers Chromium/ffmpeg notices.
* Native modules rebuilt per target ABI, hashed, signed, unpacked from ASAR only when required.

### 15.3 Signing

| OS | Requirement |
|---|---|
| Windows | Authenticode with timestamp; key on hardware/cloud HSM (Azure Artifact Signing or HSM-backed service); signed MSI/installers; SmartScreen reputation planning |
| macOS | Developer ID (`@electron/osx-sign`), **hardened runtime** with minimal entitlements (those Electron's V8 needs, per its docs), **notarization** (`@electron/notarize`), staple; `safeStorage` and the macOS updater depend on a signed app |
| Linux | GPG-signed repos; signed Flatpak remote; detached signatures/checksums for AppImage/tarballs |

Signing runs in a **dedicated CI job** with isolated credentials and manual approval; keys never on developer machines.

### 15.4 Updates

* **Channels**: `canary` (internal), `beta` (pilot), `stable`; staged rollout by cohort/percentage with auto-halt on regression.
* **Mechanism (ADR)**: Squirrel through Electron's `autoUpdater` (Windows/macOS) with a feed we host, or `electron-updater` (differential updates; verifies the publisher certificate on Windows via `verifyUpdateCodeSignature`); Linux relies on package repos/Flatpak/Snap. The **platform signature is necessary but not sufficient**: add our own **signed manifest** (Ed25519; version, channel, platform/arch, URL, hash, size, min OS, `minSupportedVersion`, cohort) verified before the updater is allowed to fetch; reject non-monotonic versions.
* **Behavior**: background check (throttled, policy-controlled), download, verify, apply on restart or idle; keep the previous version for **rollback**; never update mid-critical operation without consent; Windows can't replace a running exe, so rely on the updater's staged swap.
* **Admin control**: disable/defer/pin/mirror via policy; MSI-managed fleets disable self-update.
* **Failure handling**: resumable downloads, rollback on failed launch, telemetry on outcomes; unsigned/mismatched/downgrade manifests rejected and reported.

---

## 16. Testing strategy

Follows `PLAYBOOK_TESTS.md`; adds a `desktop-electron` side:

```text
tests/<slice>/desktop-electron/{unit,integration,contract,e2e,perf,security,a11y,visual}/
tests/_platform/{architecture,desktop-perf,installer,updater,policy,realtime,security,fuses}/
```

### 16.1 Levels

| Level | Scope | Tooling |
|---|---|---|
| **Unit** | domain, application use cases with fake ports; pure helpers | Vitest |
| **ViewModel** | States/commands with a fake `CorePort`, all statuses | Vitest + `renderHook` |
| **Adapter integration** | SDK vs mock server, SSE/WebSocket transports (reconnect, resume, duplicates, out-of-order, heartbeat loss, proxy buffering, slow consumer), SQLite migrations from every released schema, safeStorage adapter, policy readers per OS | Vitest + local servers; real Electron where an API is required |
| **Contract** | SDK vs OpenAPI; IPC schemas (both sides); realtime envelope; policy schema; route-table parity; permission catalog | schema tests, shared fixtures |
| **Parity** | Same scenario fixtures across clients (status handling, error mapping, permission gating) | shared fixtures |
| **Component** | Views per status, a11y roles | Testing Library |
| **E2E (packaged app)** | Critical journeys on the **packaged, fused, signed-in-CI** app: sign-in, list/detail/edit, offline→online, realtime update, kill switch, update flow | **Playwright for Electron** (`_electron.launch`) on Windows, macOS, Linux (X11 and Wayland) |
| **Safe-mode** | GPU-off launch, crash-loop recovery, core-process restart | Playwright + fault injection |
| **Accessibility** | Axe on every route, keyboard-only flows, high contrast, reduced motion, screen readers per OS | axe + manual |
| **Visual** | Layouts per DPI (100/125/150/200%), themes, locales/RTL | screenshot baselines |
| **Performance** | Section 2.3 budgets on the Floor runner: startup, idle RAM/CPU, soak, realtime burst | Playwright traces, `app.getAppMetrics()`, custom harness |
| **Security** | **Fuse verification**, CSP violations, IPC fuzzing and sender spoofing, navigation/new-window attempts, permission probes, `app://` path traversal, XSS corpus, deep-link fuzz, secrets-in-logs/crash-dump scans, update tamper/downgrade, no-`--no-sandbox` check | custom + fuzzers |
| **Installer/Updater** | Clean install, upgrade N-1/N-2, uninstall, repair, silent flags, rollback, signature/notarization verification | VM images per OS |
| **Policy** | Registry/plist/JSON policies applied; locked UI; invalid values ignored; kill switch; `RealtimeMode`, `HardwareAcceleration` behavior | scripted per OS |
| **Resilience** | Offline, flaky network, API outage, realtime storms, sleep/wake, disk full, DB corruption, clock skew | fault injection |
| **Architecture** | Target tsconfig isolation, dependency rules, `process.platform` only in `platform/`, forbidden APIs (`remote`, `sendSync`, `nodeIntegration`) | dependency-cruiser, ESLint, scripts |

### 16.2 CI matrix

* OS/arch: Windows 10/11 (x64; arm64), macOS current and N-1 supported (Apple silicon and Intel), Ubuntu LTS releases and one RPM distro (x64; arm64).
* Display: Windows native, macOS, Linux X11 **and** Wayland; software rendering mode on all.
* Electron: current pinned major plus the **next-major canary** job.
* **Floor-profile runner**: constrained VM (2 vCPU, 4 GB, throttled IO, software GL) running perf and e2e smoke.

### 16.3 Test rules

No test touches production services or real tenant data; e2e runs against the **packaged** app (unpackaged dev builds hide fuse/ASAR/CSP problems); no fixed sleeps; flaky tests are quarantined with owner/expiry; every IPC message type has a contract test and a sender-class permission test; every realtime transport passes the same conformance suite.

### 16.4 Performance gates and evidence

The perf job records startup phases, idle RAM/CPU, event-loop delay, soak memory and realtime-burst CPU; compares with the last release; fails on regression; stores results as release evidence with test reports, fuse verification, SBOM, signing/notarization logs and approvals (`PLAYBOOK_TESTS` §10, `PLAYBOOK_AUDIT` §8).

---

## 17. CI/CD and release governance

| Stage | Gate |
|---|---|
| Pre-commit | Format, lint, typecheck (all targets), secrets scan |
| Pull request | Build all targets, unit/ViewModel/contract/architecture, SAST, dependency/SCA scan, IPC-surface diff (new channels need a schema + capability entry), perf smoke |
| Main | Full OS matrix build, integration, packaged e2e smoke, fuse verification, SBOM |
| Nightly | Full e2e (GPU and software, X11/Wayland), Floor perf + soak, installer/upgrade, realtime conformance, fuzzing, next-Electron canary |
| Release candidate | All above + signing (isolated job, approval), notarization, update-manifest dry run, accessibility audit, evidence bundle |
| Release | Staged rollout (canary → beta → stable), health gates, auto-halt |
| Post-release | Crash/hang/update metrics, rollback plan (higher version + kill switch) |

Runbooks (required): broken release/rollback, update failure wave, signing key compromise, **Electron/Chromium security advisory** (emergency upgrade path), notarization/SmartScreen issues, crash spike (GPU/driver regression → blocklist + software mode), realtime outage (force polling), core-process crash loop, policy misconfiguration, IdP outage, vulnerability response.

### 17.1 Vulnerability handling and CRA

A desktop app distributed to customers is a **product with digital elements** for EU purposes (confirm with counsel): manufacturer reporting obligations apply from 2026-09-11 and most other obligations from 2027-12-11. Requirements: coordinated vulnerability disclosure policy, SBOM **including the bundled Chromium/Node/Electron components**, security updates for the declared support period (note the ~6-month life of each Electron major: plan continuous upgrades), process to report actively exploited vulnerabilities within required timelines, secure-by-default configuration and conformity documentation (invariant I-22).

---

## 18. Governance and compliance

* **Ownership**: CODEOWNERS for `forge.config.ts`/builder config, fuses, entitlements, `src/main/**`, `src/preload/**`, `src/contracts/ipc/**`, `src/infrastructure/{updater,policy,crypto}/**`, `packaging/**`, signing workflows, `docs/permissions-register.md`; security review on any new IPC channel, bridge function, permission, fuse change or Electron major bump.
* **Documents**: ADRs (D1–D22…), support matrix, threat model, data-flow diagrams, IPC capability register, privacy review, admin guide, runbooks, SBOM/license reports.
* **Compliance mapping** (`PLAYBOOK_AUDIT` §4): secure SDLC (CI gates, reviews, analysis, fuzzing), change management (release approvals, staged rollout), cryptography/key custody (signing + update keys), vulnerability management (SBOM incl. Chromium, SLAs), logging (telemetry/audit), vendor management (Electron, npm, crash service), availability (kill switch, rollback, offline mode), privacy (telemetry policy, retention, purge).
* **Quality KPIs**: crash-free sessions, renderer/core crash rates, startup p50/p95 on Floor, idle RAM, update success rate, realtime uptime, time-to-adopt Electron security releases, support tickets per release, defect escape rate.
* **Periodic**: monthly Electron/Chromium advisory review and upgrade planning; quarterly review of the support matrix, GPU blocklist and dependency baseline; annual pen test of the desktop client, IPC surface and updater.

---

## 19. Working with Claude Code on this project

Per `PLAYBOOK_MASTER` §4–§5 and `PLAYBOOK_CLAUDE`:

* A path-scoped rule for `apps/desktop-electron/**` carrying the layer rules, "renderer = untrusted", "no `process.platform` outside `platform/`", the IPC rules (5.1–5.4) and links to this playbook (not `@`-imported).
* **Role policy**: the **integrator** owns `forge.config.ts`, fuses, entitlements, packaging, signing workflows, dependency baselines and generated contracts; the **security reviewer** checks every IPC/preload/permission/fuse/Electron-version change; hooks and settings stay human-owned.
* **Skills**: `new-electron-feature` (slice scaffold: ports, ViewModel, View, IPC contract, tests), `new-ipc-channel` (schema + capability entry + preload binding + contract and sender-spoofing tests), `new-policy-key` (schema + per-OS delivery + UI lock + test), `electron-security-check` (fuses, CSP, navigation, permissions, bridge surface), `electron-upgrade` (major-bump runbook + canary matrix), `perf-regression` (Floor harness).
* **Graphs**: use the feature-delivery graph (`PLAYBOOK_MASTER` §6.1) with the security fan-out (§6.2) mandatory for IPC/preload/updater changes; the dependency-upgrade routine runs on a schedule for Electron majors with the cooldown/admission rules.
* **Specs** list: processes touched, IPC messages added, windows/capabilities, policy keys, realtime topics, performance impact against budgets, accessibility notes, per-OS considerations, and test levels per AC.

---

## 20. Anti-patterns (reject in review)

| Anti-pattern | Why it fails |
|---|---|
| `nodeIntegration: true`, disabled `contextIsolation`/`sandbox`, `webSecurity: false` | Any XSS becomes remote code execution |
| Exposing `ipcRenderer` or a generic `invoke(channel, …)` through the preload | Defeats the isolation boundary |
| Bridging complex/host objects through `contextBridge` | Historical isolation-bypass vector |
| Tokens or secrets in renderers, `localStorage` or plain files | Local and XSS theft |
| SDK/network calls from renderers; renderer with open `connect-src` | Larger attack surface, token exposure |
| Business logic or blocking work in the main process | UI freezes, privileged code bloat |
| Loading remote URLs/third-party content in privileged windows; `file://` for app content | Remote code execution, path abuse |
| Shipping `--no-sandbox` or `ELECTRON_RUN_AS_NODE`/unfused binaries | Defeats Chromium's sandbox; trivial tampering |
| In-app `BrowserWindow` login for third-party IdPs | Phishing and credential exposure |
| Unpinned or unsupported Electron major; caret ranges | Unpatched Chromium/Node CVEs |
| `process.platform` branching in business code | Platform drift, untestable |
| Native modules without ADR, unsigned `.node`, install scripts enabled | Supply-chain and signing risk |
| Hand-written API paths/DTOs; hand-edited IPC types | Contract drift |
| Testing only the unpackaged dev build | Misses fuse/ASAR/CSP/protocol failures |
| Update path that accepts unsigned/downgrade manifests | Takeover |
| Many hidden windows/renderers kept alive | Memory bloat on the Floor profile |
| Ignoring Wayland/HiDPI/GPU-off/accessibility | Field failures |
| Disabling DevTools as the only protection | Not a security control |

---


---

> Continues in [`PLAYBOOK_DESKTOP_ELECTRON_PART3.md`](PLAYBOOK_DESKTOP_ELECTRON_PART3.md).
