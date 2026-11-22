---
id: DESKTOP_ELECTRON
version: 1.0.0
status: active
last_reviewed: 2026-11-19
review_cadence_days: 30
owner: desktop + security
depends_on: [MASTER, URLS, BACKEND, SECURITY, TESTS, AUDIT, FRONTEND, DESKTOP_QT]
---

# PLAYBOOK_DESKTOP_ELECTRON.md — Cross-platform Electron desktop application playbook (Windows · Linux · macOS)

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_DESKTOP_ELECTRON.md`](PLAYBOOK_DESKTOP_ELECTRON.md) | 1. Decisions up front (record each as an ADR) … 6. Backend integration: SDK and contracts |
| 2 | [`PLAYBOOK_DESKTOP_ELECTRON_PART2.md`](PLAYBOOK_DESKTOP_ELECTRON_PART2.md) | 7. Navigation, routes, deep links and windows … 20. Anti-patterns (reject in review) |
| 3 | [`PLAYBOOK_DESKTOP_ELECTRON_PART3.md`](PLAYBOOK_DESKTOP_ELECTRON_PART3.md) | 21. Definition of done and checklists … Appendix L — Support matrix template |


Architecture and engineering contract for building, shipping and operating an
**Electron desktop application** in TypeScript for **Windows, Linux and macOS**
that:

* shares **one TypeScript stack** with the web, extension, mobile and CLI clients
  (generated SDK, shared ViewModels, route table, permission catalog, design tokens);
* is **secure by construction** (sandboxed renderers, context isolation, Fuses,
  ASAR integrity, a narrow typed IPC surface, a core process that holds the
  session and the SDK);
* is **honest about performance** (Electron ships Chromium and Node.js, so the
  playbook defines budgets, a GPU-safe mode, a lean process model and the cases
  where `PLAYBOOK_DESKTOP_QT` is the better choice);
* connects to the backend through the shared **SDK** and optionally through
  **SSE and WebSocket** for live updates;
* follows the same **hexagonal + vertical-slice** architecture, MVVM presentation
  and spec/test-driven workflow as the rest of the product family;
* is packaged, signed, updated, administered and audited at enterprise grade.

It extends and must stay consistent with `PLAYBOOK_MASTER.md` (invariants, routing,
Claude Code operating model), `PLAYBOOK_DESKTOP_QT.md` (its twin: same product
contract, different runtime), `PLAYBOOK_FRONTEND.md` (MVVM + SDK),
`PLAYBOOK_URLS.md` (routes and permissions), `PLAYBOOK_BACKEND.md` (slices, realtime,
idempotency), `PLAYBOOK_SECURITY.md`, `PLAYBOOK_TESTS.md`, `PLAYBOOK_AUDIT.md`,
`PLAYBOOK_CHROME_EXTENSION.md` (IPC/permission/policy patterns reused here),
`PLAYBOOK_CLI.md` and `PLAYBOOK_CLAUDE_CODE.md`.

The rules that carry the whole file:

1. **Renderers are untrusted web pages.** Sandboxed, context-isolated, no Node, no
   network of their own, no secrets. A compromised renderer must not be able to
   reach the OS, the filesystem, tokens or other windows.
2. **Three trust zones, three jobs.** *Main* is the thin trust anchor (windows, OS
   adapters, policy enforcement point, updater host). *Core* (a utility process)
   is the application brain (use cases, SDK, realtime, storage). *Renderer* draws
   state and sends intents.
3. **One typed, validated, minimal IPC contract.** Channels are allowlisted,
   payloads are schema-validated on both sides, senders are verified, and the
   preload exposes functions, never `ipcRenderer`.
4. **The main process never blocks.** Anything slow, parsing-heavy, network-bound
   or crash-prone runs in the core/utility process or a worker.
5. **Domain and application know nothing about Electron.** They talk through
   ports; Electron, Node and DOM types are confined to adapters and entrypoints.
6. **The backend is the source of truth.** The desktop holds a projection cache and
   an outbox; authorization is always server-side; `{userType}` never authorizes.
7. **Realtime is optional and degradable.** Correct with polling or none.
8. **Supply chain is the main attack surface.** Electron bundles Chromium and
   Node.js, plus the npm tree: pin, verify, scan, upgrade on a fixed cadence.
9. **Ship signed, integrity-checked and reversible.** Fuses flipped and verified
   before signing; ASAR integrity where supported; signed updates with rollback.
10. **Administrators can govern it.** Managed policy, kill switch, update control,
    diagnostics, audit trail.

> Verification note (as of 2026-11-19). **Electron 45** is the latest stable major
> (Chromium 156, Node.js 24, released 2026-10-20); **Electron supports the latest three
> stable majors** (45, 44, 43 today), a new major ships **every 8 weeks**, and Electron 46
> is in alpha with Chromium 160 and Node 26. **Electron 44+ requires macOS 13 or later.**
> Electron 44 added `net.WebSocket` (a WHATWG-compatible client in the main process using
> Chromium's network stack), reduced idle main-process wakeups and starts the main process
> from an embedded Node startup snapshot on all platforms. Defaults: `nodeIntegration: false`
> since Electron 5, `contextIsolation: true` since 12, `sandbox: true` since 20. Items marked
> **(verify)** depend on exact Electron/Forge/OS versions and must be re-checked against the
> Electron documentation and release notes before adoption. Budgets are starting points to
> calibrate on your own hardware.

---

## 1. Decisions up front (record each as an ADR)

| # | Decision | Recommendation | Rationale / alternatives |
|---|---|---|---|
| D1 | Runtime choice | **Electron** when the team and the product are TypeScript/React, you need pixel-consistent rendering across OSes and the web ecosystem, and the **Floor profile (2.2) is met**. Otherwise **Qt** (`PLAYBOOK_DESKTOP_QT`) | Electron embeds a browser engine: larger install, higher RAM, strict Chromium OS requirements. Tauri-style system-webview shells are an alternative with their own trade-offs (webview differences per OS) and are out of scope here |
| D2 | Electron version policy | Pin **an exact supported major** (never a caret); stay on the **latest or latest-minus-one major**; upgrade at least every ~6 months; never run an unsupported major | Support covers only the latest three; a major lives ~6 months; Chromium/Node CVEs ship in your releases |
| D3 | Language | **TypeScript strict** everywhere, ESM for main/core/build tooling; **sandboxed preload is a CommonJS/IIFE bundle** **(verify current preload module support)** | Same language as other clients; ESM main supported by current Electron |
| D4 | Bundler/dev tool | **Vite** (via Electron Forge's Vite plugin or electron-vite) for main, preload, core and renderer; one build graph with separate targets | Fast dev loop, tree-shaking, small startup; Webpack only by ADR |
| D5 | Packaging | **Electron Forge** (official; Fuses plugin; makers for Squirrel/zip/MSI/pkg/deb/rpm/Flatpak; MSIX experimental) as the default; **electron-builder** is an accepted alternative when you want NSIS/AppImage + `electron-updater` differential updates | Forge 7.x is stable; Forge 8 is in alpha (ESM) **(verify)**; builder 27 changed publish/verification defaults |
| D6 | Process model | **Main (thin) + Core (utility process, application brain) + Renderers (React)**, plus short-lived utility/worker processes for heavy tasks | Section 3 |
| D7 | UI | **React 19 + TypeScript**, **MVVM** with ViewModels shared from `packages/viewmodels`, design tokens from `packages/tokens` | Same pattern as web/extension/mobile |
| D8 | IPC | **Brokered typed RPC** through the main process (policy enforcement point) plus **MessagePorts** for streams; zod schemas in `contracts/ipc` | Section 5 |
| D9 | Content loading | Custom privileged scheme **`app://`** served by `protocol.handle` from the packaged ASAR; strict CSP; never `file://`, never remote code | Section 12 |
| D10 | Backend API | Generated TypeScript **SDK** running in the **core process** over Chromium's network stack (`net.fetch`) | System proxy/PAC, enterprise certificates and auth schemes work out of the box |
| D11 | Realtime | **SSE** (streaming `net.fetch`) and **WebSocket** (`net.WebSocket` where available, otherwise `ws`) in the core process; polling fallback; optional by policy | Section 9 |
| D12 | Local storage | **SQLite** in the core process (better-sqlite3 or built-in `node:sqlite` per ADR **(verify availability/stability in Electron's Node)**), WAL, migrations in code | Section 10 |
| D13 | Secrets | **`safeStorage`** (OS keychain-backed) for refresh tokens and key material; refuse the Linux `basic_text` backend unless policy explicitly allows | Section 8 |
| D14 | Auth | OIDC Authorization Code + PKCE in the **system browser** (loopback or custom protocol), never an in-app login window | `PLAYBOOK_SECURITY` §4 |
| D15 | Updates | Signed updates through the platform updater (Squirrel for Windows/macOS via `autoUpdater`, or `electron-updater`) **plus** a signed manifest/channel layer we control; MSI/pkg/deb/rpm for managed fleets | Section 15 |
| D16 | Crash reporting | Electron `crashReporter` (Crashpad) + Sentry/Electron or equivalent; opt-in by policy | Section 14 |
| D17 | Architectures | x64 and arm64 on Windows, macOS and Linux; no 32-bit | Check the support matrix per Electron major |
| D18 | Native modules | **Avoid**; if unavoidable, N-API/prebuilt, rebuilt per Electron ABI with `@electron/rebuild`, unpacked from ASAR, signed, ADR with fallback | Supply-chain and signing surface |
| D19 | Embedded web content | **Never** load third-party/remote content in privileged windows; if required use a `WebContentsView` in a separate partition, no preload, no IPC | Section 12 |
| D20 | Fuses | Flip fuses in the packaging step **before signing** and verify them in CI | Section 12.3 |
| D21 | Testing | Vitest (unit/integration), **Playwright for Electron** (e2e against the *packaged* app), axe for accessibility | Section 16 |
| D22 | Policy | Managed configuration per OS with a schema; kill switch; diagnostics bundle | Section 13 |

---

## 2. Platform and performance model

### 2.1 Support matrix policy

* **OS support = intersection** of (a) the Electron major's supported OS list (Chromium sets the floor) and (b) vendor-supported OS versions plus contractual carve-outs. Re-derive at every Electron upgrade; do not hard-code.
* Known floors **(verify per major)**: Electron 44+ needs **macOS 13+**; Chromium needs a modern Windows 10/11 and a CPU with the baseline instruction sets Chromium requires; Linux needs a recent glibc, a working sandbox (section 12.5) and a desktop with GTK/Wayland or X11.
* Publish `docs/support-matrix.md`: OS and minimum build, architectures, display servers (X11/Wayland), minimum hardware, known limitations, Electron major and its end-of-support date.

### 2.2 Reference hardware ("the floor")

| Profile | CPU | RAM | Storage | Graphics | Display |
|---|---|---|---|---|---|
| **Floor** | 2 cores, ~2 GHz, SSE-capable baseline | **4 GB** | SATA SSD (HDD supported with relaxed startup budget) | Integrated/old GPU **or software rendering** | 1366×768, 100% DPI |
| **Typical** | 4 cores | 8 GB | SSD | Integrated | 1920×1080, 125% DPI |
| **High-DPI** | 4+ cores | 8+ GB | SSD | Integrated/discrete | 4K, 200%, multi-monitor |

**Be explicit**: Electron cannot meet the budgets of a native toolkit on machines below the Floor (2 GB RAM, HDD-only, pre-Windows 10 hardware). If the real fleet includes them, choose `PLAYBOOK_DESKTOP_QT`. Record the decision in D1.

### 2.3 Performance budgets (Floor profile; starting points)

| Metric | Budget |
|---|---|
| Cold start to first usable window (SSD) | ≤ 2.5 s; ≤ 4 s on HDD |
| Warm start | ≤ 1.2 s |
| Time to interactive with cached data | ≤ 1 s after first paint (stale-while-revalidate) |
| Main-process event-loop block | ≤ 16 ms typical, **≤ 50 ms hard limit** (watchdog) |
| Renderer main-thread long tasks | None > 50 ms in primary flows; lists virtualized |
| Idle CPU (app open, no activity) | ≈ 0% (no timers/animations/polling without need) |
| Idle RAM, single window, after warm-up | ≤ ~300 MB total across processes (main + core + GPU + renderer) |
| Additional window | ≤ ~100 MB each; windows are created lazily and destroyed, not hidden, when heavy |
| Memory growth over an 8 h soak | ≈ 0 |
| Realtime burst (1,000 events/s) | UI updates coalesced to ≤ 30 Hz; core CPU bounded; no UI stall |
| Installer size | Tracked per release (Chromium dominates); budget trend, strip unused locales |
| Update download | Delta where supported; otherwise compressed full package |

Enforced by an automated perf job on the Floor runner (section 16.4) with a regression threshold (for example +10%).

### 2.4 Performance engineering rules

**Process and threading**

* The main process only orchestrates: windows, OS adapters, policy checks, forwarding. **No SDK calls, parsing, crypto loops, DB access or file scanning in main.**
* Heavy and failure-prone work runs in the **core utility process** or short-lived utility processes; CPU work in renderers goes to Web Workers.
* **Never** `ipcRenderer.sendSync`/`ipcMain.on` synchronous replies; never block on `await` chains in `ready`.
* Add a **watchdog**: a timer in main/core that measures event-loop delay; stalls beyond the budget are logged and counted.

**Startup**

* Bundle everything (main, preload, core, renderer) so startup does not resolve a deep `require` tree; keep dependencies small and lazy-load features/windows.
* Create the `BrowserWindow` with `show: false`, paint a lightweight skeleton from cached state, show on `ready-to-show`; defer updater checks, telemetry flush, realtime connect, plugin/extension work until after first paint.
* Use Node's **compile cache** (`module.enableCompileCache()` in main/core) and **V8 code caching** for renderer bundles where supported; Electron's own embedded main-process startup snapshot is already used on all platforms in recent majors; app-level V8 snapshots (electron-link style) are an advanced option with strict language limits **(verify before adopting)**.
* Route-level and `{userType}`-level code splitting so admin code isn't loaded for employees (performance, not security).

**Renderer**

* Virtualized lists/tables, memoized selectors, small state stores, no giant context providers; avoid layout thrash; images downscaled and lazy; no heavy CSS filters/blur on large areas; honor `prefers-reduced-motion` and the OS "reduce transparency".
* Disable GPU-heavy features by default (WebGL, large canvases) unless a screen needs them.
* Throttle background windows (`backgroundThrottling` stays on); pause realtime fan-out to hidden windows.

**Memory**

* One renderer per window: keep window count low; destroy windows you don't need instead of hiding them; don't hold `BrowserWindow` references after `closed`.
* Bound every cache (LRU with size accounting); stream large payloads; release IPC listeners/ports on unmount; track `app.getAppMetrics()` and renderer heap in diagnostics.
* No unbounded logs, transcripts or event history in memory.

**Disk and size**

* Ship only the locales you support; prune unneeded files in the packaging hook; keep native modules to zero where possible; compress assets; avoid bundling both architectures into one universal macOS binary unless distribution requires it.

### 2.5 GPU safe mode (no-GPU guarantee)

Chromium's GPU process can fail on old drivers. Requirements:

1. A **Compatibility mode** (user setting and policy `HardwareAcceleration = auto|off`) that calls `app.disableHardwareAcceleration()` **before `app.ready`** and reduces animations/transparency.
2. **Automatic safe mode**: persist `startupInProgress` (small file read synchronously at boot); clear it after the first window renders; if the flag survives a launch, or a `child-process-gone` event reports repeated GPU crashes, start the next launch in software rendering and report it in diagnostics.
3. CLI flag `--disable-gpu`/`--software-rendering` and an environment override for support.
4. The UI must be fully usable in software rendering (CI runs the e2e smoke suite in that mode on all three OSes).
5. A GPU/driver **blocklist** driven by remote config/diagnostics.

### 2.6 Electron upgrade cadence (security-critical)

* A new major every 8 weeks; the latest three are supported; fixes land first on the latest. **Each major reaches end of life about six months after release**, so a pinned major *will* expire.
* Policy: **no more than one major behind the latest**; upgrade PR opened within **2 weeks** of a new major (graph in `PLAYBOOK_MASTER` §6.3 "dependency upgrade routine"); **security patch releases** adopted within a defined SLA (for example 7 days for high/critical Chromium/Node/Electron advisories) via a canary → stable rollout.
* Each upgrade runs the full matrix (3 OS × x64/arm64 × X11/Wayland × software/GPU) and a changelog review for breaking changes (preload/sandbox/fuses/APIs).
* Native modules and tooling (Forge, signing libs) are upgraded in lockstep; ABI breaks are rebuilt, not shimmed.

---

## 3. Architecture: hexagonal + vertical slices + MVVM across Electron's processes

### 3.1 Process model

```text
┌────────────────────────────── Electron app ──────────────────────────────────────────────────┐
│  MAIN (Node, privileged, thin)                    CORE (utility process, Node, no DOM)         │
│  windows · protocol app:// · menus/tray ·         use cases · SDK (net.fetch) · realtime ·     │
│  OS adapters host · policy enforcement point ·    SQLite · outbox/sync · policy resolver ·     │
│  safeStorage · updater host · crash/telemetry     session (tokens in memory)                   │
│        ▲  MessagePortMain / IPC (validated)  ▲            ▲                                    │
│        │                                      └────────────┘                                   │
│  PRELOAD (sandboxed, isolated world)  ──contextBridge──►  RENDERER (Chromium, sandboxed)       │
│  typed bridge, no raw ipcRenderer                         React Views + ViewModels (no Node,   │
│                                                           no network: CSP connect-src 'none')  │
│  Short-lived utility processes / workers: parsing, indexing, exports, hashing                  │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Process | Trust | Owns | Must not |
|---|---|---|---|
| **Main** | Trusted, privileged | `BrowserWindow`/`WebContentsView` lifecycle, `app://` protocol, menus, tray, dialogs, power/OS events, `safeStorage`, updater host, policy reader, **policy enforcement for IPC**, crash reporter init | Run business logic, SDK, DB, long loops; load remote content |
| **Core** (utility) | Trusted, no UI | Application layer, SDK, realtime, storage, sync/outbox, session, event bus to renderers | Touch the DOM; call privileged Electron UI APIs; accept messages from unvetted senders |
| **Preload** | Semi-trusted bridge | The narrow `contextBridge` API generated from `contracts/ipc` | Expose `ipcRenderer`, `require`, generic `invoke(channel, …)`, objects with prototypes |
| **Renderer** | **Untrusted** | Views, ViewModels, local UI state | Node, filesystem, network, secrets, cross-window access |
| **Utility/worker** | Trusted but disposable | One heavy task, then exit | Long-lived state; direct access to renderers |

Supervision: main starts the core with `utilityProcess.fork`, passes it a scrubbed environment, restarts it with backoff on crash (surfacing a "reconnecting" status), and refuses to run if the core binary/path isn't inside the packaged app.

### 3.2 Layers (same hexagon as `PLAYBOOK_DESKTOP_QT` §3, adapted)

```text
INBOUND ADAPTERS (drive the app)                       OUTBOUND ADAPTERS (driven by the app)
Renderer Views + ViewModels · IPC handlers ·           SDK/HTTP (net.fetch) · Realtime (SSE/WS/poll)
OS events (tray, deep links, power, network) ·         SQLite · safeStorage · Notifications · Updater
realtime events · timers · CLI flags                   Telemetry · Policy sources · Filesystem
              │                                                       ▲
              ▼                                                       │
        APPLICATION (use cases, ports, policy, sync, outbox) ─────────┘
              ▼
        DOMAIN (entities, value objects, rules, events)   ← pure TypeScript
```

| Layer | Contains | May depend on | Must not depend on |
|---|---|---|---|
| **domain** | Entities, value objects, rules, domain events | `shared-kernel` | `electron`, `node:*`, DOM, React, SDK, fs |
| **application** | Use cases, **ports**, policy resolver, sync/outbox, permission checks | domain, `contracts`, `shared-kernel` | Electron/Node/DOM APIs, adapters |
| **adapters/in** | IPC handlers, protocol/deep-link handlers, OS-event handlers, ViewModels | application, contracts | other slices' internals, SQL/HTTP |
| **adapters/out** | SDK client, realtime transports, SQLite, keystore, notifications, updater, telemetry, policy sources | application ports, `platform`, Node/Electron APIs | views |
| **views** | React components | ViewModel hooks, `ui-kit` | SDK, `electron`, IPC directly |
| **platform** | Per-OS code (`process.platform` lives only here and in build files) | Electron/Node APIs | domain/application |
| **contracts** | DTOs, IPC schemas, error codes, event envelopes, policy schema, route table | `shared-kernel` | everything else |

Enforcement:

* **Separate `tsconfig` per target** (`main`, `preload`, `core`, `renderer`) with distinct `lib`/`types`: the renderer cannot import `electron` or Node types; main/core cannot reference DOM types.
* ESLint `no-restricted-imports` + **dependency-cruiser** rules for the table above; `no-restricted-globals` for `process`/`require` in renderer and application code; violations fail CI.

### 3.3 Where each layer runs

| Layer / concern | Process |
|---|---|
| domain, application, SDK, realtime, storage, sync | **Core** |
| IPC handlers (renderer-facing) | **Main** (policy enforcement) → **Core** (use case) |
| Views, ViewModels | **Renderer** (ViewModels call a `CorePort` implemented over the preload bridge) |
| OS adapters (tray, notifications, protocol registration, autostart, power) | **Main** (`platform/`) |
| Updater host, policy reader, safeStorage | **Main** |
| Heavy parsing/exports/hashing | Short-lived utility process/worker |

### 3.4 Ports (examples)

```ts
// application/ports — owned by the slice, domain language, no Electron types
export interface LeadRepositoryPort { byId(id: LeadId): Promise<Result<Lead>>; list(q: LeadQuery): Promise<Result<LeadPage>>;
  updateStage(id: LeadId, to: Stage, expected: Version, key: IdempotencyKey): Promise<Result<Lead>>; }
export interface SessionPort     { current(): Promise<Session | null>; signIn(): Promise<void>; signOut(): Promise<void>; permissions(): ReadonlySet<Permission>; }
export interface SecretStorePort { get(key: string): Promise<Uint8Array | null>; set(key: string, v: Uint8Array): Promise<void>; remove(key: string): Promise<void>; }
export interface PolicyPort       { effective(): Promise<EffectivePolicy>; onChange(cb: () => void): Unsubscribe; }
export interface RealtimePort     { start(cfg: RtConfig): void; stop(): void; setTopics(t: ReadonlySet<string>): void; /* state, events, resync */ }
export interface NotifierPort     { notify(n: Notice): Promise<void>; }
export interface UpdaterPort      { check(ch: Channel): Promise<UpdateInfo | null>; apply(u: UpdateInfo): Promise<ApplyResult>; rollback(): Promise<void>; }
export interface TelemetryPort    { event(name: string, props?: Record<string, unknown>): void; flush(): Promise<void>; }
export interface ClockPort        { now(): number; }
```

Ports return `Promise<Result<T,E>>`; errors are values; **no `throw` across process boundaries** (serialize typed errors).

### 3.5 MVVM in the renderer

* **ViewModel** = a hook returning `{ status, data, commands }` with the shared status set (`loading | ready | empty | forbidden | not-found | offline | error | policy-blocked`); no Electron/DOM-specific imports beyond React; reuse `packages/viewmodels` where a screen exists on web/extension.
* **View** = React components; no business logic.
* The renderer's **`CorePort`** is an RPC client over the preload bridge (same pattern as the extension's RPC to its service worker). ViewModels depend on the port, so tests swap in a fake.
* **Navigation** via a `Navigator` port backed by the in-renderer router; routes follow `PLAYBOOK_URLS` (section 7).

### 3.6 Vertical slices and the backend mapping

Desktop slices mirror backend slices one-to-one (invariant I-1):

| Desktop slice | Backend slice | URL module | Permission prefix | Realtime topic prefix | Test folder |
|---|---|---|---|---|---|
| `funnels` | `funnels` | `funnels` | `funnels.*` | `funnels.` | `tests/funnels/desktop-electron/` |
| `projects` | `projects` | `projects` | `projects.*`, `campaigns.*` | `projects.` | `tests/projects/desktop-electron/` |
| `tenants` (admin) | `tenants` | `tenants` | `tenant.*` | `tenants.` | `tests/tenants/desktop-electron/` |
| `usage`, `billing` (admin) | same | same | `billing.*` | `usage.` | … |
| `identity` | `identity` | (session) | n/a | `session.` | … |

Each slice: `domain/ application/ adapters/{in,out}/ viewmodels/ views/ contracts/`. Cross-slice access only through `contracts/`.

### 3.7 Shared artifacts vs shared code

The desktop **reuses code** from web/extension (SDK, ViewModels, tokens, route builders) because it is TypeScript; parity is still enforced by tests:

| Shared artifact | Source of truth |
|---|---|
| OpenAPI → TS SDK/DTOs, error taxonomy | Backend repo; generated |
| Permission catalog (`module.resource.action`) | Backend; exported JSON → generated enum |
| Route table (`/{userType}/{module}/…`, deep links) | Shared JSON → generated route builders |
| Design tokens, i18n keys | `packages/tokens`, shared catalog |
| Acceptance criteria | Specs (SDD); tests cite AC IDs |

---

## 4. Repository layout

```text
apps/desktop-electron/
├── package.json  (type: module; exact Electron version)   forge.config.ts  vite.{main,preload,core,renderer}.config.ts
├── tsconfig.base.json  tsconfig.{main,preload,core,renderer}.json
├── src/
│   ├── main/                       # composition root (main): app lifecycle, windows, app:// protocol, PEP for IPC, OS adapters host, updater host
│   ├── preload/                    # typed contextBridge API (generated from contracts/ipc)
│   ├── core/                       # utility-process entry: composition root for application + adapters/out
│   ├── renderer/                   # React app: shells per userType (app/admin/partner), router, error boundaries
│   ├── platform/                   # ONLY place for process.platform branching (main-side adapters)
│   │   ├── common/  windows/  macos/  linux/   tray  notifications  autostart  protocol-registration  power  taskbar-dock  paths
│   ├── shared-kernel/              # Result, ids, errors, time, branded types
│   ├── contracts/                  # ipc schemas (zod), DTOs, error codes, event envelopes, policy schema, route table
│   ├── infrastructure/
│   │   ├── sdk/  realtime/ (sse, websocket, polling, selector, state machine)  storage/ (sqlite, migrations, outbox)
│   │   ├── crypto/ (safeStorage adapter)  telemetry/  updater/  policy/  logging/
│   ├── features/<slice>/{domain,application,adapters/{in,out},viewmodels,views,contracts}
│   └── ui-kit/                     # shared React components, themes, tables, dialogs
├── resources/                      # icons, locales, assets
├── packaging/
│   ├── windows/ (squirrel|msi|msix|nsis, signing config)  macos/ (entitlements.plist, dmg/pkg/zip)  linux/ (deb, rpm, flatpak, apparmor profile, appimage)
├── tools/                          # fuse verification, SBOM, license report, locale pruning, perf harness, symbol upload
packages/{sdk,core,viewmodels,tokens,ui-web}/      # shared with web/extension/mobile
tests/<slice>/desktop-electron/{unit,integration,contract,e2e,perf,security,a11y,visual}/
tests/_platform/{architecture,desktop-perf,installer,updater,policy,realtime,security,fuses}/
docs/{adr,support-matrix.md,admin-guide.md,runbooks/,permissions-register.md,data-flows.md}
```

---

## 5. IPC and process communication

### 5.1 Brokered RPC (default)

```text
Renderer → preload bridge → ipcRenderer.invoke('rpc', envelope) → MAIN (PEP: verify sender, window capability, schema)
        → MessagePortMain → CORE (use case) → result → MAIN → renderer
Events (CORE → renderers): MAIN fans out per subscription, coalesced
```

* **Envelope**: `{ v, id, type, correlationId, payload }`; `type` selects a schema in `contracts/ipc`; unknown `v`/`type` → typed rejection.
* **Sender verification** in main for every message: `event.senderFrame` URL/origin must be the `app://` origin, the frame must be the **top frame** of a window we created, and the `webContents.id` must map to a known window type. Reject anything else (child frames, navigated pages).
* **Capability table** per window type (`main`, `admin`, `settings`, `splash`): which message types it may send and which topics it may subscribe to. The `admin` window type being able to send `admin.*` messages is *UX routing only*; the core's use cases and the backend still authorize.
* **Validation both sides**: zod `strict()` schemas (renderer-side for early feedback, main-side as the gate, core-side as the final guard); size limits; no prototype-bearing objects.
* **Errors are values**: typed `RpcError` codes aligned with the shared taxonomy (invariant I-5); never leak stack traces or file paths to the renderer.

### 5.2 Direct MessagePorts (streams, high throughput)

After the PEP approves a window, main creates a `MessageChannelMain`, hands one end to the core (`child.postMessage(msg, [port])`) and the other to the renderer (`webContents.postMessage('hmd:port', …, [port])`). Use for **progress/streaming and realtime fan-out**; the port is **scoped to a capability** (topics, message types) and is closed on window close, navigation or policy change.

### 5.3 Preload bridge rules

* Expose **named functions** only (`hmd.rpc(type, payload)`, `hmd.subscribe(topic, cb)`, `hmd.platform.info()`), generated from `contracts/ipc`; **never** `ipcRenderer`, `require`, `process`, or generic `invoke(channel, …)`.
* Pass **only JSON-serializable data**; never expose complex or host objects (for example media frames) through `contextBridge`: a 2026 advisory showed that bridging such objects could let an attacker who already has script execution reach the isolated world.
* Keep the preload tiny (it runs before every page); no heavy imports; no secrets.
* The sandboxed preload is a self-contained bundle (CommonJS/IIFE) **(verify)**.

### 5.4 Disallowed

`remote` module, `ipcRenderer.sendSync`, `webContents.executeJavaScript` with dynamic strings, `nodeIntegration`, `<webview>`, `enableBlinkFeatures`, sending secrets over IPC (tokens never reach renderers).

---

## 6. Backend integration: SDK and contracts

### 6.1 SDK in the core process

* The generated TypeScript SDK (`sdk.app.funnels.leads.get(id)` ↔ `GET /api/v1/app/funnels/leads/{leadId}`) runs **only in the core process**; renderers never import it. Paths are built in one place; hand-written paths/DTOs are forbidden (invariant I-11).
* **Transport**: `net.fetch` (Chromium network stack) for HTTP/1.1/2/3 where available, so **system proxy settings/PAC, enterprise certificate stores, NTLM/Negotiate proxy auth and TLS policy** apply without extra code. Node's own `http`/`undici` ignore system proxies, so use them only for loopback or tests.
* **Interceptors** (order as in `PLAYBOOK_FRONTEND` §3.2): auth (Bearer from memory, single-flight refresh, replay once), tenant (`X-Tenant-Id` from the session), correlation (`X-Correlation-Id`), client info (`X-Client: desktop-electron/<version> (<os>; <arch>; electron/<ver>)`), idempotency (`Idempotency-Key`), retry (backoff + jitter for network/429/5xx on idempotent calls, honor `Retry-After`), error mapping (envelope → `SdkError`).
* **Errors**: `unauthenticated | forbidden(requiredPermission) | not-found | conflict | validation | rate-limited | network | server | upgrade-required` (I-5); `upgrade-required` triggers the updater flow.
* **Timeouts and cancellation** on every call (`AbortSignal`); response size caps; compression accepted; ETag/conditional requests for cacheable lists.
* **Host allowlist**: the SDK refuses origins outside the policy/tenant allowlist.

### 6.2 Authorization on the client

The session carries `permissions[]` (shared strings). `can("funnels.leads.update")` shapes UI only; **the backend decides** (I-3, I-4). `{userType}` selects the experience shell; multi-role users have an active role, and switching clears caches/subscriptions.

### 6.3 Long operations, offline and outbox

* `202 Accepted` operations are tracked as operation resources, polled with backoff or updated via realtime, and survive restarts.
* The local DB is a **projection cache**; offline mutations go to an **outbox** with `Idempotency-Key`, retry/backoff and per-entity ordering; conflicts return typed results the ViewModel presents (I-7, I-8).

### 6.4 Backend additions required

The same additions as `PLAYBOOK_DESKTOP_QT` §5.5 apply (realtime capabilities/stream/socket endpoints, device registration, signed update manifest, min-version gate, topic catalog); implement them once for all desktop clients.

---

---

> Continues in [`PLAYBOOK_DESKTOP_ELECTRON_PART2.md`](PLAYBOOK_DESKTOP_ELECTRON_PART2.md).
