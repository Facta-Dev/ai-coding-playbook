---
id: DESKTOP_QT_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [DESKTOP_QT]
---

# PLAYBOOK_DESKTOP_QT_PART2 — Cross-platform Qt desktop application playbook (part 2)

> Part 2 of 3. Main entry: [`PLAYBOOK_DESKTOP_QT.md`](PLAYBOOK_DESKTOP_QT.md). Covers: 8. Realtime: optional SSE and WebSocket … 19. Anti-patterns (reject in review).

## 8. Realtime: optional SSE and WebSocket

### 8.1 Principles

1. **Optional and degradable**: `RealtimeMode = auto | websocket | sse | polling | off` (managed policy
   > user setting > default `auto`). With `off` or on failure the app works via refresh/polling.
2. **Snapshot + stream**: state is obtained through normal API calls; the stream carries **change
   notifications** (and small payloads). After any gap, the app **resyncs** affected resources.
3. **At-least-once delivery**: events have monotonic IDs and are **deduplicated**; handlers are idempotent;
   ordering is guaranteed only per entity/topic.
4. **Tenant and permission scoped**: the server authorizes every subscription; the client never assumes
   a topic is allowed.
5. **Backpressure**: the client coalesces bursts and renders at a bounded rate.

### 8.2 Components

```text
RealtimePort (application)  ◄── RealtimeCoordinator (adapter)
                                   ├── TransportSelector (capabilities + policy + health)
                                   ├── SseTransport        (QNetworkAccessManager streaming)
                                   ├── WebSocketTransport  (QWebSocket)
                                   ├── PollingTransport    (ETag / long poll / since-cursor)
                                   └── NullTransport       (off / offline)
Event pipeline: transport → envelope parser (schema, size cap) → dedupe (LRU of ids)
                → topic router → slice handlers (adapters/in/realtime) → use cases → ViewModels
```

### 8.3 Connection state machine

```text
Disabled ─start→ Connecting ─ok→ Live ─error/timeout→ Reconnecting ─backoff→ Connecting
                         └─fail (policy/transport)→ Degraded(polling)
Live ─stop→ Disconnected;  any ─policy off/kill switch→ Disabled
```

* **Backoff** exponential with full jitter (for example 1 s → 60 s cap), reset after a healthy period;
  honor server `retry:` hints (SSE) and `Retry-After`.
* **Heartbeat**: server sends comments/pings every 15–25 s; client declares the connection dead after
  ~2 missed intervals and reconnects. Set explicit transfer timeouts longer than the heartbeat; Qt
  applies a default transfer timeout to requests **(verify)**, so streaming requests must override it,
  and newer Qt versions changed TCP keepalive defaults **(verify)** (a connection can be terminated
  after about two minutes of inactivity).
* **Resume**: SSE `Last-Event-ID` header; WebSocket `resumeToken` in the subscribe message. If the
  server answers `resync-required` (window exceeded), emit `resyncRequired(topics)` and refetch.
* **Network changes and sleep/wake**: observe reachability (`QNetworkInformation` **(verify)**), OS
  sleep/resume and network switches; drop and re-establish rather than trusting half-open sockets.
* **Visibility**: when the app is hidden/minimized (policy-configurable), pause the stream or lower
  the rate and reconcile on show.
* **Dedicated connection**: the stream uses its **own** `QNetworkAccessManager`/`QWebSocket` so it
  never consumes one of the six HTTP/1.1 slots used by API calls; prefer HTTP/2 where available.

### 8.4 SSE transport (client side)

Qt has no first-party SSE client class that this playbook relies on **(verify for your Qt version)**;
implement an adapter with a **spec-compliant parser**:

* Request: `GET` with `Accept: text/event-stream`, `Cache-Control: no-cache`, `Authorization: Bearer …`
  (desktop can set headers, unlike browser `EventSource`), `Last-Event-ID` when resuming, HTTP/2
  allowed, cache bypass, timeout overridden, no response buffering limit issues (consume `readyRead`
  incrementally).
* Parser: UTF-8, optional BOM, line terminators `\n`, `\r`, `\r\n`; fields `event`, `data` (multiple
  lines joined with `\n`), `id`, `retry`; comment lines (`:`) as heartbeat; dispatch on blank line;
  `id` persisted as last-event-id; unknown fields ignored; enforce **max event size** and **max line
  length**; reject invalid UTF-8.
* Resilience: reconnect on EOF/error with the state machine above; detect proxies that buffer streams
  (no data despite heartbeats → fall back to WebSocket/polling and report in diagnostics).
* Security: TLS only; token in header, never in the URL; redact in logs.

### 8.5 WebSocket transport

* Qt WebSockets (`QWebSocket`): connect with a request carrying `Authorization`, subprotocol
  `app.v1`, origin/client headers; set maximum incoming frame/message sizes; use app-level
  heartbeat messages in addition to protocol pings.
* Messages: JSON envelope `{v, type, id, ts, topic, payload}` with a command set
  (`subscribe`, `unsubscribe`, `ack`, `ping`, `auth.refresh`) validated by schema; unknown types ignored
  and counted.
* Token refresh while connected: send `auth.refresh` or reconnect with the new token before expiry.
* Compression, fragmentation and per-message limits depend on the Qt version **(verify)**; keep payloads
  small (notifications + IDs), fetch details via REST.

### 8.6 Polling fallback

Cursor-based `GET …?since=<cursor>` or ETag conditional requests at an adaptive interval (faster while
the window is active and recent activity exists, slower when idle/hidden), with jitter and server-driven
`Retry-After`. It is the **correctness baseline**; streams are an optimization.

### 8.7 Applying events

* Events are **notifications first**: a handler invalidates/refreshes the affected cache entries and
  updates the model with minimal diffs; large state changes trigger a refetch.
* UI updates are **batched** on the GUI thread (timer at ≤ 30–60 Hz), coalescing by entity; row-level
  `dataChanged` over ranges; no per-event repaint storms.
* Ordering/gaps: keep a per-topic sequence if the server provides one; on a gap, resync.
* Permission changes arrive as events (`session.permissions.changed`) and trigger a permission refresh
  and a ViewModel re-evaluation.

### 8.8 Server contract summary (for the backend spec)

Envelope: `{ id, type, tenantId, topic, ts, v, correlationId, payload }` (payload minimal; PII avoided).
Delivery: at-least-once, resume window ≥ N minutes, per-tenant partitioning, per-connection rate and
size caps, authz per topic at subscribe **and** on each push for revocable permissions, immediate
termination on suspension/kill switch, connection limits per user/tenant, metrics on lag.

---

## 9. Local storage and data

* **SQLite** with migrations (`PRAGMA user_version`), forward-only, tested against fixtures of every
  released schema; backup before migrating; integrity check on startup after crash; **reset-and-resync**
  path when corruption is detected (the server holds truth).
* **Per-tenant/per-user databases** (or tenant-scoped tables with `tenant_id` first in indexes) so
  tenant switch and sign-out can purge cleanly.
* **Encryption**: OS disk encryption is baseline; for Restricted data use SQLCipher or application-level
  AES-GCM with keys in the OS keystore; never store secrets or tokens in `QSettings`/plain files.
* **Retention**: `DataRetentionDays` (policy) enforced by a background job; purge on sign-out and on
  tenant removal; temp files in the app-private directory with restrictive permissions.
* **Paths** via `QStandardPaths` (config, cache, data, logs); never write next to the executable;
  portable-mode is an explicit, documented build option.
* **Settings**: `QSettings` for non-sensitive preferences; policy-locked keys are read-only in the UI.
* **Concurrency**: one writer, multiple readers; WAL; no DB access from the GUI thread.

---

## 10. Platform integration (per OS, behind `platform/`)

| Capability | Windows | macOS | Linux |
|---|---|---|---|
| Secret store | Credential Manager / DPAPI | Keychain | Secret Service (libsecret) / KWallet |
| Notifications | Native toast (or tray message fallback) | `UNUserNotificationCenter` (requires proper bundle/signing) | freedesktop D-Bus notifications |
| Tray/menu bar | Notification area | Menu bar extra (+ global menu bar for the app menu) | StatusNotifier/AppIndicator (not guaranteed on all desktops; provide a fallback) |
| Autostart | Registry Run key / Task (per policy) | Login item / LaunchAgent | XDG autostart `.desktop` |
| Deep links/file assoc | Registry | `Info.plist` | `.desktop` + MIME |
| Single instance | Mutex/`QLockFile` + `QLocalServer` | same | same |
| High DPI | Per-monitor v2 | Retina | X11/Wayland scaling quirks, test fractional scaling |
| Dark mode/contrast | Follow OS color scheme and high contrast | Follow appearance | Follow desktop settings; test GNOME and KDE |
| Display server | n/a | n/a | **X11 and Wayland** (global shortcuts, window positioning and screen capture differ) |
| File dialogs | Native | Native | Desktop portal/native where available |
| Power/network events | WM messages/`QNetworkInformation` | NSWorkspace/`QNetworkInformation` | logind/NetworkManager via D-Bus (best-effort) |
| Accessibility | UI Automation | NSAccessibility | AT-SPI |

Rules:

* Platform adapters implement ports (`NotifierPort`, `SecretStorePort`, `AutostartPort`…) and are
  selected at the composition root.
* Every platform feature has a **graceful fallback** and is covered by a capability probe (for example
  tray unavailable on a Wayland desktop → in-app notification center).
* Use the native style for each OS by default; custom theming goes through tokens and must keep
  contrast/accessibility; test dark/light/high-contrast.
* Window state restoration (geometry, screen) must handle monitors that disappeared.
* Keyboard shortcuts use `QKeySequence::StandardKey` and platform conventions (`Ctrl` vs `Cmd`).
* Internationalization with Qt Linguist (`tr`), ICU-backed formatting, RTL layouts, pseudo-locale
  tests; no string concatenation for sentences.
* **Accessibility is mandatory:** roles, names, focus order, keyboard-only operation, screen-reader
  checks on all three OSes, high-contrast, respect for reduced motion.

---

## 11. Security

Aligned with `PLAYBOOK_SECURITY.md`; desktop-specific additions below.

### 11.1 Threat model (desktop)

| Threat | Controls |
|---|---|
| Local malware reading files/memory | OS keystore for secrets, no secrets on disk, minimal in-memory lifetime, no tokens in logs/crash dumps |
| Binary/library tampering, DLL/plugin hijacking | Load libraries/plugins only from the app directory (`QCoreApplication::setLibraryPaths` restricted; Windows safe DLL search order and `SetDefaultDllDirectories`), signed binaries, hardened runtime on macOS |
| Malicious or tampered update | Signed manifests and binaries, HTTPS, rollback protection (monotonic versions), staged rollout, key custody |
| Malicious deep link / IPC | Strict parser, route allowlist, UI confirmation, authenticated session, local IPC with OS-level permissions |
| Credential theft / phishing | System browser + PKCE, no embedded login, MFA via IdP |
| MITM / TLS interception | TLS validation on, no `ignoreSslErrors`, enterprise CA via OS store or policy, optional pinning for the update channel only |
| Hostile server content | Schema validation, size limits, escape on render (rich text in `QLabel`/`QTextBrowser` can render HTML; use plain text or sanitized subsets), no remote code or plugins |
| Insecure realtime | Header-based auth, short tokens, per-topic authz server-side, schema-validated messages, max sizes |
| Supply chain (Qt, vcpkg/Conan deps) | Pinned baseline, SBOM, cooldown for new versions, review, signed artifacts, provenance |
| Information leak via diagnostics | Redaction, user-initiated export, `TelemetryLevel` |
| Memory-safety bugs in C++ | Section 11.3 profile |

### 11.2 Controls

* TLS 1.2+ (prefer 1.3), certificate validation always on; never connect to unexpected hosts: the SDK
  restricts hosts to the policy/tenant allowlist.
* Secrets never in the binary, resources, QSettings, logs or crash dumps; tenant provider keys never
  reach the desktop (same rule as the extension).
* Restrict file permissions on app data directories; wipe temp files; clear clipboard-held secrets
  where the app copies them (with timeout).
* Disable debugging aids in release builds (no `QT_QPA` debug env honoring beyond a documented support
  flag; no QML debugger port; no remote inspector).
* **No Qt WebEngine in the main app** (attack surface and size), or isolate it.
* Local IPC (`QLocalServer`) is restricted to the current user; messages are schema-validated and
  authenticated by a per-session secret when sensitive.
* Command-line arguments and environment variables are untrusted when launched via protocol handlers.
* Auto-update trust root is separate from the code-signing identity where possible.

### 11.3 C++ secure coding profile (complements `PLAYBOOK_SECURITY_PART2.md` §16)

* **Language discipline:** C++20, RAII, `std::unique_ptr`/`QObject` parent ownership (no naked `new`
  without an owner), `std::span`/views over raw pointers, no manual `malloc/free`, no `strcpy`-family,
  bounds-checked access in hot paths via `at()`/asserts in debug, `[[nodiscard]]` on results, no
  C-style casts.
* **Qt hygiene:** define `QT_NO_CAST_FROM_ASCII`, `QT_NO_CAST_TO_ASCII`, `QT_NO_URL_CAST_FROM_STRING`,
  `QT_NO_FOREACH`, `QT_DISABLE_DEPRECATED_UP_TO` (to the minimum Qt you target); use new-style
  `connect` with explicit connection types; document thread affinity; avoid `deleteLater` races by
  parenting; disconnect/guard lifetimes with context objects.
* **Compiler/linker hardening:** stack protector, `_FORTIFY_SOURCE`, PIE/ASLR, RELRO + BIND_NOW,
  CET/CFI where available (Linux/clang), MSVC `/GS /guard:cf /DYNAMICBASE /NXCOMPAT /HIGHENTROPYVA
  /sdl`, macOS hardened runtime; warnings as errors (`/W4`, `-Wall -Wextra -Wconversion` selectively).
* **Analysis:** clang-tidy (bugprone, cert, cppcoreguidelines subsets), cppcheck, CodeQL/Semgrep,
  compiler analyzers (`/analyze`), Coverity/commercial if available.
* **Dynamic:** ASan/UBSan (Linux/macOS, MSVC ASan), TSan for threading, **fuzzing** (libFuzzer/AFL) of
  every parser: SSE, JSON envelope, deep-link parser, update manifest, SQLite migration inputs, file
  imports.
* **Memory/ownership of secrets:** zero secret buffers when done (`explicit_bzero`/`SecureZeroMemory`),
  avoid copying secrets into `QString` where avoidable.
* **Banned:** `system()`/`popen` with interpolated input, `QProcess::startDetached` with a shell string,
  `ignoreSslErrors`, `QLibrary` loading from user-controlled paths, `eval`-like facilities in QML
  (`Qt.createQmlObject` with remote strings, `Qt.include`), loading QML/JS from the network.

### 11.4 Code signing and trust

| OS | Requirement |
|---|---|
| Windows | Authenticode signing of all executables, DLLs and installers with a timestamp; signing keys in an HSM/cloud signing service (private keys for publicly trusted code-signing certificates must be hardware-protected); SmartScreen reputation planning; sign MSI/MSIX |
| macOS | Developer ID signing with **hardened runtime**, minimal entitlements, **notarization** and stapling, correct `Info.plist` privacy strings |
| Linux | Signed repositories (apt/rpm) with GPG; detached signatures for AppImage/tarballs; Flatpak via signed remote |

Signing happens in a **dedicated CI job** with isolated credentials and manual approval for releases;
signing keys are never on developer machines.

### 11.5 Privacy

Data minimization, purpose limitation, user-visible disclosure of what leaves the machine, telemetry
governed by policy, retention limits, purge on sign-out, data-subject requests handled by the backend
(`PLAYBOOK_AUDIT.md` §13). Crash dumps are opt-in and scrubbed.

### 11.6 TLS backend ADR

Qt uses platform TLS backends (for example Schannel on Windows, Secure Transport on Apple platforms,
OpenSSL on Linux) **(verify per Qt version)**. On older Windows builds the native stack may not offer TLS
1.3. Choose explicitly:

| Option | Pros | Cons |
|---|---|---|
| Native backends everywhere | Uses OS certificate store and enterprise trust, smaller footprint | Possible TLS 1.2-only on older Windows |
| Bundle OpenSSL backend on Windows | Uniform TLS 1.3 behavior | Bigger package, you own OpenSSL patching, verify enterprise CA handling |

Whatever the choice: keep TLS 1.2 acceptable on the server for the support window, track OpenSSL/CVE updates,
and document enterprise CA and TLS-inspection behavior.

---

## 12. Enterprise capabilities

### 12.1 Managed configuration (policy)

Policies override user settings; the UI shows locked controls as "managed by your organization".

| Source | Windows | macOS | Linux |
|---|---|---|---|
| Admin-set | Registry `HKLM\Software\Policies\<Vendor>\<Product>` (with **ADMX/ADML** templates; Intune/GPO) | Configuration profile / managed preferences (`/Library/Managed Preferences`) via `QSettings` native format **(verify)** | `/etc/<product>/policy.json` (+ optional dconf) |
| User-level | `HKCU` / app config | app preferences | `~/.config/<product>` |

Precedence: **managed > user > defaults**. A pure `PolicyResolver` (application layer) validates
values against a schema and exposes the effective configuration.

Recommended policy surface (mirrors the extension):

| Policy | Type | Effect |
|---|---|---|
| `TenantUrl` / `ApiBaseUrl` | string | Backend endpoint (validated against allowlisted patterns) |
| `SsoMode`, `IdpIssuer`, `ClientId` | string | SSO configuration |
| `UpdatesEnabled`, `UpdateChannel`, `UpdateWindow` | bool/enum/object | Update control, deferral |
| `UpdateMirrorUrl` | string | Internal update mirror |
| `RealtimeMode` | `auto\|websocket\|sse\|polling\|off` | Realtime transport control |
| `ProxyMode`, `ProxyUrl`, `CustomCaBundle` | enum/string/path | Network environment |
| `TelemetryLevel` | `off\|errors\|full` | Diagnostics governance |
| `CrashReportingEnabled` | bool | Crash dumps |
| `KillSwitch` | bool | Disable network features / force read-only |
| `FeatureFlags` | map | Central feature toggles |
| `DataRetentionDays` | int | Local retention |
| `AutostartMode` | enum | Start at login |
| `ForceSignInOnStartup`, `LockOnIdleMinutes` | bool/int | Session policy |
| `CompatibilityMode` | enum | Force software rendering/reduced effects |
| `LogLevel` | enum | Local log verbosity |
| `AllowUserSettings` | bool | Lock preferences |
| `SupportContact` | string | Shown in diagnostics UI |

### 12.2 Deployment

| Need | Mechanism |
|---|---|
| Silent install/uninstall | MSI properties (Windows), `.pkg` via MDM (macOS), `.deb/.rpm` via package managers/config management (Linux) |
| Per-machine vs per-user | Per-machine default for managed fleets; per-user installer optional |
| Update control | Policy-driven channel/window; internal mirror; ability to pin a version |
| Fleet visibility | Version, channel, OS, policy hash reported with sessions (subject to `TelemetryLevel`) |
| Store channels (optional) | Microsoft Store/MSIX, Mac App Store (sandbox constraints), Flathub/Snap, with separate test passes |
| Offline/air-gapped | Offline installers and update bundles with signature verification |
| Proxy/TLS inspection | System proxy by default, PAC/authenticated proxies (Negotiate/NTLM) tested **(verify per OS)**, enterprise CA support |

### 12.3 Kill switch, flags and remote config

Same model as the extension: policy `KillSwitch` plus signed remote config (data only, schema-validated, with
bundled safe defaults) can disable features or force read-only; minimum-version enforcement uses the
`upgrade-required` error and the updater. Rollback = ship a higher version with the fix + kill switch for
containment.

### 12.4 Support and audit

* **Diagnostics bundle** (user-initiated, redacted): app/Qt/OS/GPU/driver info, renderer in use,
  compatibility mode state, policy snapshot, effective config, realtime state and recent transitions,
  queue/outbox counts, storage sizes, recent logs and error events with correlation IDs, GUI-stall stats.
* **Audit events** to the backend (if policy allows): sign-in/out, policy applied, update applied,
  data export, kill-switch state. Redacted and rate-limited.
* **Runbooks** (section 15.6) and an admin guide are release artifacts.

---

## 13. Observability

| Signal | Implementation |
|---|---|
| Logging | `QLoggingCategory` per slice/layer, structured JSON lines via a custom message handler, redaction filter, rotating files with size caps, ring buffer for diagnostics |
| Crash reporting | Out-of-process crash handler (Crashpad/Breakpad/Sentry Native class), minidumps with symbols uploaded privately, PII scrubbing, opt-in by policy, release/channel tags |
| Metrics | Startup phases, time-to-interactive, GUI stalls (count, p95), frame/paint times, model update latency, SDK latency/error rates, realtime state/uptime/reconnects/lag, queue depth, memory, DB timings, update outcomes |
| Tracing | `correlationId` created at the user action, sent in API/realtime headers and logs |
| Health | Internal health projection (policy valid, session valid, API reachable, realtime state, storage OK) shown in diagnostics |
| Privacy | Telemetry level from policy; hosts hashed/truncated; no content in telemetry unless essential and allowed |

Server-side alerts watch error rates per client version, `upgrade-required` rates, update failures and
realtime reconnect storms.

---

## 14. Packaging, signing and updates

### 14.1 Build and packaging matrix

| OS | Artifacts | Notes |
|---|---|---|
| Windows | `windeployqt`-assembled folder → **MSI (WiX)** for enterprise, EXE or MSIX for consumers, ZIP portable (optional) | x64 and ARM64; bundle the MSVC runtime; sign everything; winget manifest optional |
| macOS | `.app` (universal2 or per-arch), `macdeployqt`, **notarized** `.dmg` and `.pkg` (MDM) | Hardened runtime, minimal entitlements, Sparkle-class updater or custom |
| Linux | AppImage, `.deb`, `.rpm`, Flatpak, tarball | Build on the oldest supported distro; bundle only what is needed; desktop file + AppStream metainfo; x86-64 and ARM64 |

### 14.2 Build rules

* CMake Presets per OS/arch/config; Ninja; compiler cache (ccache/sccache); locked dependency baseline
  (vcpkg manifest baseline or Conan lockfile); Qt installed from a pinned, verified source.
* **Reproducible builds** as far as practical (fixed toolchains in containers/images, `SOURCE_DATE_EPOCH`,
  deterministic archives); record hashes.
* Release builds: `-O2`, LTO, stripped binaries with **separate symbol files** archived and uploaded to the
  crash service; no debug code or development environment variable hooks.
* Generate the **third-party license report** and **SBOM** (CycloneDX/SPDX) in CI; include Qt notices and
  LGPL obligations (dynamic linking, relinking ability, license texts, source offer where required).
  Check each Qt module's license; some add-on modules are GPL/commercial only **(verify)**.

### 14.3 Update system

* **Channels:** `canary` (internal), `beta` (pilot), `stable`. Staged rollout by percentage/cohort with
  automatic halt on health regression.
* **Manifest:** signed (for example Ed25519) JSON listing version, channel, platform/arch, URL, hashes,
  size, minimum OS, release notes, `minSupportedVersion`, rollout cohort. Clients verify signature, hash and
  **monotonic version** before applying; HTTPS only.
* **Mechanism:** a vetted framework (Qt Installer Framework maintenance tool, Sparkle/WinSparkle-class,
  MSIX/Store updates) or a minimal custom updater with a separate **updater helper process**; apply on
  restart/idle; keep the previous version for **rollback**; verify OS signatures after download.
* **Delta updates** optional; full-package fallback always available.
* **Admin control:** policy to disable, defer, pin or point to an internal mirror.
* **Failure handling:** interrupted downloads resume; failed apply rolls back; telemetry reports outcomes.
* **No update without trust:** unsigned or downgrade manifests are rejected and reported.

### 14.4 Release channels and cadence

Align with the Qt LTS window and OS release cycles: test against new OS betas, schedule Qt patch upgrades
regularly (security), and maintain a documented end-of-support policy per app version.

---

## 15. Testing strategy

Follows `PLAYBOOK_TESTS.md`; adds a `desktop` side next to `backend` and `frontend`:

```text
tests/<slice>/desktop/{unit,integration,contract,e2e,perf,security,a11y,visual}/
tests/_platform/{architecture,desktop-perf,installer,updater,policy,realtime,security}/
```

### 15.1 Levels

| Level | Scope | Tooling (examples) |
|---|---|---|
| **Unit** | domain, application use cases with fake ports; pure helpers | Qt Test, GoogleTest or Catch2 |
| **ViewModel** | states/commands with fake ports, all statuses; `QSignalSpy`; no GUI | Qt Test |
| **Adapter integration** | SQLite (migrations from every released schema), SDK against a mock server, SSE/WebSocket transports against a test server (reconnect, resume, duplicates, out-of-order, heartbeat loss, proxy buffering, slow consumer), keystore adapters per OS | Qt Test + local test servers/containers, network fault injection |
| **Contract** | C++ SDK vs OpenAPI; realtime envelope vs schema; policy schema; route table parity; permission catalog parity | schema tests, shared fixtures |
| **Parity** | Same scenario fixtures across clients (status handling, error mapping, permission gating) | shared fixtures |
| **Component/View** | Views per ViewModel status | `QTest` GUI events, `QT_QPA_PLATFORM=offscreen`, screenshot compare |
| **E2E** | Critical journeys on real OS builds (sign-in, list/detail, edit, offline→online, realtime update, kill switch, update) | Qt Test GUI, OS accessibility-driven automation, Squish-class tools |
| **Accessibility** | Roles, names, focus order, keyboard-only, contrast on each OS | Accessibility Insights (Windows), Accessibility Inspector (macOS), Orca/Accerciser (Linux) |
| **Visual** | Layout per DPI (100/125/150/200%), themes (light/dark/high-contrast), locales/RTL, pseudo-locale | screenshot baselines |
| **Performance** | Section 2.5 budgets on the Floor profile | `QBENCHMARK`, startup harness, memory soak, GUI-stall counters |
| **Security** | Fuzzing (SSE/JSON/deep-link/manifest), IDOR and tenant isolation through SDK, authz matrix parity, TLS validation, DLL/plugin path tests, IPC tests, secrets-in-logs/dumps scans | libFuzzer, custom |
| **Installer/Updater** | Clean install, upgrade from N-1/N-2, uninstall, repair, silent install flags, rollback, signature/notarization verification, tamper and downgrade attempts | VM images per OS |
| **Policy** | Registry/plist/JSON policies applied; locked UI; invalid values ignored; kill switch; `RealtimeMode` behavior | scripted per OS |
| **Resilience** | Offline, flaky network, API outage, realtime storms, sleep/wake, disk full, DB corruption, clock skew | fault injection |
| **Architecture** | Layer targets, `#ifdef` only in `platform/`, forbidden APIs, include rules | scripts/clang-tidy |

### 15.2 CI matrix

* OS/arch: Windows 10 and 11 (x64; ARM64 if supported), Ubuntu LTS releases and one RPM-based distro
  (x64; ARM64), macOS current and N-1 (Apple Silicon and Intel).
* Display: Windows native, Linux X11 **and** Wayland, macOS; software rendering mode on all.
* Compilers: MSVC, GCC, Clang; Qt: pinned LTS plus an upcoming-version canary job.
* **Floor-profile runner:** constrained VM/container (2 vCPU, 4 GB, throttled IO, software GL) running the
  performance suite and the UI smoke suite.

### 15.3 Test rules

* No test touches production services or real tenant data; synthetic fixtures only.
* UI tests wait on observable conditions, never fixed sleeps; flaky tests are quarantined with an owner and
  expiry (see tests playbook).
* Every realtime transport has the **same conformance suite** (a transport that fails it cannot ship).
* Every parser has a fuzz target and a corpus of past bugs.

### 15.4 Performance gates

The perf job records startup phases, GUI stalls, memory after soak, and realtime burst CPU; compares with the
last release baseline; fails the build on regression thresholds; stores results as release evidence.

### 15.5 Evidence

Test reports, perf results, fuzz run summaries, SBOM, signing/notarization logs, installer test logs and
approvals feed the **release evidence bundle** (`PLAYBOOK_TESTS.md` §10, `PLAYBOOK_AUDIT.md` §8).

---

## 16. CI/CD and release governance

| Stage | Gate |
|---|---|
| Pre-commit | format, clang-tidy on changed files, secrets scan |
| PR | build all OS/arch (matrix subset), unit/ViewModel/contract/architecture, SAST, dependency scan, perf smoke |
| Main | full matrix, integration, e2e smoke, sanitizer builds, fuzz (time-boxed), SBOM, license report |
| Nightly | full e2e, Floor-profile perf, soak, installer/upgrade, realtime conformance, extended fuzz, Qt canary |
| Release candidate | all above + signing (isolated job, approval), notarization, update manifest dry run, accessibility audit, evidence bundle |
| Release | staged rollout (canary → beta → stable), health gates, automatic halt |
| Post-release | monitoring of crash/stall/update metrics, rollback plan (higher version + kill switch) |

Runbooks (required): broken release/rollback, update failure wave, signing key compromise, notarization/SmartScreen
issues, crash spike, GPU/driver regression (blocklist + Compatibility Mode), realtime outage (force polling), policy
misconfiguration, IdP outage, vulnerability response (below).

### 16.1 Vulnerability handling and CRA

A desktop app distributed to customers is a **product with digital elements** for EU purposes: plan
accordingly **(confirm applicability with counsel)**. Reporting obligations for manufacturers apply from
11 September 2026 and most other obligations from 11 December 2027. Required capabilities:

* coordinated vulnerability disclosure policy and contact (`security.txt`-style page);
* SBOM and dependency monitoring (Qt, third-party libs) with fix SLAs;
* ability to ship **security updates** for the declared support period (align with Qt LTS maintenance);
* internal process to report actively exploited vulnerabilities and severe incidents within the
  required timelines;
* secure-by-default configuration, documented hardening, and conformity documentation;
* Qt 6.12's CRA readiness covers Qt's part; your application still needs its own compliance work.

---

## 17. Governance and compliance

* **Ownership:** CODEOWNERS for `cmake/**`, `src/platform/**`, `src/infrastructure/{updater,policy,crypto}/**`,
  `packaging/**`, signing workflows, `docs/permissions-register.md`; security review for those paths.
* **Documents:** ADRs (D1–D15 and later), support matrix, threat model, data-flow diagrams, privacy review,
  admin guide, runbooks, license/SBOM reports.
* **Mapping to SOC 2 / ISO 27001 / ISO 9001** (`PLAYBOOK_AUDIT.md` §4): secure SDLC (CI gates, reviews,
  analysis, fuzzing), change management (release approvals, staged rollout), cryptography/key custody
  (signing keys in HSM, update trust root), vulnerability management (SBOM, scanning, SLAs), logging
  (telemetry, audit events), vendor management (Qt, dependencies, crash service), availability (kill switch,
  rollback, offline mode), privacy (telemetry policy, retention), quality (KPIs below).
* **Quality KPIs:** crash-free sessions, GUI-stall rate, startup time p50/p95 on Floor, update success rate,
  realtime uptime, ANR-like freeze reports, support tickets per release, defect escape rate.
* **Periodic:** quarterly review of the support matrix, GPU blocklist and dependency baseline; annual pen test
  of the desktop client and updater; after each OS major release a compatibility pass.

---

## 18. Working with Claude Code on this project

Per `PLAYBOOK_CLAUDE_CODE.md`:

* A path-scoped rule for `apps/desktop/**` with the layer rules, "no `#ifdef` outside `platform/`", "GUI thread
  never blocks", "no embedded browser", realtime rules, and links to this playbook (not `@`-imported).
* **Role policy:** the integrator edits `cmake/**`, `packaging/**`, signing workflows, dependency baselines and
  generated contracts; security reviewer checks permission/policy/updater/crypto changes; hooks and settings stay
  human-owned.
* **Skills:** `new-desktop-feature` (slice scaffold: ports, ViewModel, View, tests), `new-realtime-topic`
  (schema, handler, resync rule, conformance test), `new-policy-key` (schema, ADMX/plist/JSON, UI lock, test),
  `perf-regression` (run Floor harness, diff budgets).
* **Specs** include: contexts/threads touched, ports added, permissions, policy keys, realtime topics, performance
  impact against budgets, accessibility notes, per-OS considerations, and test levels per AC.

---

## 19. Anti-patterns (reject in review)

| Anti-pattern | Why it fails |
|---|---|
| Blocking calls on the GUI thread | Freezes on old machines |
| `processEvents()` loops, `sleep`, `QFuture::result()` on GUI thread | Re-entrancy bugs and stalls |
| Embedded Chromium/WebEngine for "easy" screens | Memory/startup/attack-surface blowout |
| Qt Quick effects (`ShaderEffect`, heavy layers, blur) without fallback | Broken or slow on old GPUs |
| GPU-only features without a software path | App unusable on weak/old graphics |
| One `QNetworkAccessManager` shared by API calls and a long-lived stream | Starves HTTP/1.1 slots |
| Realtime as the only data path | Stale/incorrect when the stream fails |
| Treating events as the state | Missed events corrupt the cache; use snapshot + stream |
| Unbounded caches/queues/log files | Memory/disk growth on small machines |
| `#ifdef Q_OS_*` scattered through business code | Untestable, platform drift |
| Business logic in widgets/QML | Duplicated, untested |
| Secrets in `QSettings`, files, logs, dumps | Local theft |
| `ignoreSslErrors`, unsigned updates, update over HTTP | Takeover |
| Tokens in URLs (SSE/WS query strings) | Leaks in logs/proxies |
| Loading plugins/DLLs from user-writable or CWD paths | Hijacking |
| Hand-written API paths/DTOs | Contract drift |
| Ignoring Wayland/HiDPI/RTL/accessibility | Field failures |
| No Floor-profile testing | Performance claims unproven |
| Installer without silent mode/policies | Not enterprise-deployable |
| Static Qt linking under LGPL without legal review | License violation |

---


---

> Continues in [`PLAYBOOK_DESKTOP_QT_PART3.md`](PLAYBOOK_DESKTOP_QT_PART3.md).
