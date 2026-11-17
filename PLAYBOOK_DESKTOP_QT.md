---
id: DESKTOP_QT
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [FRONTEND, SECURITY]
---


# PLAYBOOK_DESKTOP_QT.md — Cross-platform Qt desktop application playbook

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_DESKTOP_QT.md`](PLAYBOOK_DESKTOP_QT.md) | 1. Decisions up front (record each as an ADR) … 7. Authentication and session |
| 2 | [`PLAYBOOK_DESKTOP_QT_PART2.md`](PLAYBOOK_DESKTOP_QT_PART2.md) | 8. Realtime: optional SSE and WebSocket … 19. Anti-patterns (reject in review) |
| 3 | [`PLAYBOOK_DESKTOP_QT_PART3.md`](PLAYBOOK_DESKTOP_QT_PART3.md) | 20. Definition of done and checklists … Appendix H — Support matrix document template |

Architecture and engineering contract for building, shipping and operating a
**Qt desktop application for Windows, Linux and macOS** that:

* runs **fast on old hardware** (low-end CPUs, little RAM, slow disks, weak or
  broken GPUs) while running on **current operating systems**;
* connects to the platform backend through the shared **SDK** and optionally
  through **Server-Sent Events (SSE)** and/or **WebSocket** for live updates;
* is built with the same **hexagonal + vertical-slice** architecture, **MVVM**
  presentation and spec/test-driven workflow as the rest of the product family;
* is packaged, signed, updated, administered and audited at enterprise grade.

It builds on and must stay consistent with:

| Playbook | What this file takes from it |
|---|---|
| `PLAYBOOK_URLS.md` | Route/permission model; `{userType}` never authorizes; `module.resource.action` permissions; deep-link paths |
| `PLAYBOOK_BACKEND.md` | Slices, ports/adapters, tenant isolation, idempotency, outbox events, deployment modes (§3–§8) |
| `PLAYBOOK_FRONTEND.md` | MVVM + SDK, error taxonomy, `202` long operations, deep links (§3–§6) |
| `PLAYBOOK_SECURITY.md` | Authentication, authorization, crypto, supply chain, logging (§4–§14) |
| `PLAYBOOK_TESTS.md` | Test pyramid, authz matrix, tenant isolation, evidence (§1–§10) |
| `PLAYBOOK_AUDIT.md` | Control library, evidence, CRA/SOC 2/ISO mapping (§4–§14) |
| `PLAYBOOK_CHROME_EXTENSION.md` | Enterprise policy, kill switch, diagnostics bundle, release governance patterns reused here |
| `PLAYBOOK_CLAUDE_CODE.md` | SDD + TDD workflow, roles and kit for AI-assisted development |

The runnable, machine-checkable companion is the **companion Qt skill pack**:
three Agent Skills (write, review, port), a drop-in clang-tidy/clang-format
config and a compiled example.

The rules that carry the whole file:

1. **Keep the GUI thread sacred.** Nothing that can block (network, disk, parsing,
   crypto, big loops) runs on it. Responsiveness on a 10-year-old dual-core is the
   acceptance test.
2. **Budget first, features second.** Every release is measured against a
   low-end reference machine; regressions fail CI.
3. **No GPU assumption.** The UI must work with software rendering. GPU paths are
   an optimization with a tested fallback.
4. **Domain and application know nothing about widgets, QML, sockets or the OS.**
   They talk through ports.
5. **The backend is the source of truth.** The desktop holds a cache (projection)
   and an outbox; it never invents authority.
6. **Realtime is optional and degradable.** The app is fully correct with
   polling or no streaming at all; SSE/WebSocket only make it fresher.
7. **Slices mirror the backend.** Same names, same permissions, same contracts.
8. **The local machine is untrusted.** Secrets live in the OS keystore, updates
   are signed, plugins and DLLs load only from trusted locations.
9. **Administrators can control it.** Managed policy, kill switch, update
   channels, diagnostics, audit trail.
10. **Everything ships signed, reproducible and with evidence.**

> Verification note: this playbook reflects the Qt and platform landscape as of
> November 2026. Qt 6.12 was released on 30 September 2026 as an LTS with five
> years of maintenance; 6.8 LTS remains supported until October 2029. Items
> marked **(verify)** depend on exact Qt/OS versions and must be re-checked in
> the Qt documentation and the platform vendors' documentation before relying
> on them. Treat numeric budgets as starting points to calibrate on your own
> reference hardware.

---
## 1. Decisions up front (record each as an ADR)

| # | Decision | Recommendation | Rationale / alternatives |
|---|---|---|---|
| D1 | Qt version | **Qt 6.12 LTS** for new projects; Qt 6.8 LTS acceptable for conservative fleets | Five-year maintenance; align with the product's own support window. Qt 6.12 states it was prepared for EU CRA requirements for its part (apps still need their own compliance) |
| D2 | Language | **C++20** (C++17 minimum) for domain, application, adapters | Predictable performance and memory on old machines. PySide6/Python and QML-only JS logic increase startup, memory and CPU; not recommended under this performance target |
| D3 | UI technology | **Qt Widgets** as the default for data-dense/enterprise screens; **Qt Quick** only for isolated, motion-heavy surfaces, restricted to a software-safe subset (see 2.2) | Widgets render on the CPU (raster) with no GPU dependency and behave predictably on old drivers |
| D4 | Presentation pattern | **MVVM** with C++ ViewModels (`QObject` + `Q_PROPERTY`/bindable properties, `QAbstractItemModel` for lists) usable from Widgets **and** QML | Same ViewModel contract regardless of View technology |
| D5 | Build system | **CMake** (Presets, Ninja), dependency manager with locked baseline (**vcpkg** manifest or **Conan** lockfile) | Reproducible builds, SBOM source |
| D6 | Linking | **Dynamic** Qt (LGPL-compatible) unless a commercial license allows static linking | Licensing; smaller updates for shared runtimes; verify module licenses |
| D7 | Backend API | REST/JSON via the generated **C++ SDK** that mirrors `PLAYBOOK_URLS.md`; optional streaming over SSE/WebSocket | Same contract as web/mobile/extension; gRPC only if measurements justify it, behind the same SDK port |
| D8 | Local storage | **SQLite** (WAL) via a single storage adapter; optional **SQLCipher**/field encryption for Restricted data | Embedded, fast on old disks |
| D9 | Auth | OIDC Authorization Code + PKCE in the **system browser** with loopback or custom-scheme redirect; tokens in OS keystore | No embedded password UI; matches `PLAYBOOK_SECURITY.md` §4 |
| D10 | Updates | Signed updates with channels and staged rollout; admin can disable/defer | Section 14 |
| D11 | Crash reporting | Crashpad/Breakpad-class minidumps via a crash handler process, opt-in by policy | Section 13 |
| D12 | Embedded web content | **Avoid Qt WebEngine** in the main app; if unavoidable, isolate it in a separate optional component | WebEngine adds a Chromium-sized footprint and memory, which breaks low-end budgets |
| D13 | Architectures | x86-64 and ARM64 on Windows, macOS (universal) and Linux | Windows on Arm and Apple Silicon are mainstream; no 32-bit |
| D14 | CPU baseline | Compile for baseline x86-64 (no AVX/AVX2 requirement); use runtime dispatch for SIMD libraries | Old CPUs |
| D15 | TLS backend | Decide explicitly per OS (see 11.6) | Windows 10's native TLS stack lacks TLS 1.3 **(verify)** |

---

## 2. Platform and performance model

### 2.1 Support matrix policy

* **OS support = intersection** of (a) the platforms the chosen Qt version supports and
  (b) OS versions still receiving vendor security updates, plus any contractual
  extended-support carve-outs. Re-derive it at every Qt upgrade from the Qt "supported
  platforms" page **(verify)**; do not hard-code it in this playbook.
* "Old computers with new operating systems" is the target profile:
  modern OS builds on legacy hardware.
* Publish the matrix in `docs/support-matrix.md` with: OS and minimum build,
  architectures, display servers (X11/Wayland), minimum hardware, known
  limitations, end-of-support dates.

### 2.2 Reference hardware ("the floor")

Define and keep real or virtual machines for these profiles (adjust to your fleet data):

| Profile | CPU | RAM | Storage | Graphics | Display |
|---|---|---|---|---|---|
| **Floor** | 2 cores, ~2 GHz, no AVX assumption | 4 GB | 5400 rpm HDD (or throttled IO) | Old integrated GPU / **software rendering** | 1366×768, 100% DPI |
| **Typical** | 4 cores | 8 GB | SATA SSD | Integrated GPU | 1920×1080, 125% DPI |
| **High-DPI** | 4+ cores | 8+ GB | SSD | Integrated/discrete | 4K, 200% DPI, multi-monitor |

Every performance budget below is measured on the **Floor** profile. If the app is
smooth there, it is smooth everywhere.

### 2.3 UI technology choice: Widgets vs Qt Quick

| Criterion | Qt Widgets | Qt Quick (QML) |
|---|---|---|
| Rendering | CPU raster; no GPU required | Scene graph on RHI: Direct3D on Windows, Metal on macOS, OpenGL on Linux by default; a software backend exists with limitations |
| Old GPU/driver risk | None | Real (driver bugs, missing features); needs fallback logic (2.4) |
| Dense tables/trees/forms | Excellent, mature model/view | Possible, more tuning needed |
| Animation/fluid effects | Limited | Excellent on capable GPUs |
| Startup/memory | Low | Higher (QML engine, scene graph) |
| Native look | Native styles | Native-like styles, more theming work |
| Accessibility | Mature on all three OSes | Good, requires care |

**Policy:** Widgets-first. Use Qt Quick only where motion/custom drawing is core
value, keep its effects within the software-safe subset (no `ShaderEffect`, minimal
`layer.enabled`, no blur/shadow effects, simple clipping), and ship the Compatibility
Mode (2.4). A single window may mix both, but avoid per-frame GPU work on lists.

**Qt Canvas Painter** (production-ready in Qt 6.12) and **QRhiWidget** are GPU-accelerated
paths: use them only for optional visualizations and keep a CPU path (**verify** support
and behavior on your floor GPUs).

### 2.4 Rendering fallback (no-GPU guarantee)

Requirements:

1. A **Compatibility Mode** setting (user and managed policy) that forces CPU rendering
   and disables non-essential animation and transparency.
2. **Automatic safe mode**: on startup record `startup_in_progress=true`; clear it after
   the first window is shown and a frame is rendered. If the flag is still set at the next
   launch (crash/hang during init), start in Compatibility Mode and report it.
3. **Renderer selection** happens before the first window is created (Qt Quick: the
   graphics API must be chosen before the first `QQuickWindow`). Chain, per OS:
   Windows: D3D11 → OpenGL → software; macOS: Metal → software; Linux: OpenGL → software
   (Vulkan optional **(verify)**). Honor the override environment variables for support
   (`QSG_RHI_BACKEND`, `QT_QUICK_BACKEND=software`) and a CLI flag `--software-rendering`.
4. **Block-list** by GPU vendor/driver string, persisted from field telemetry/diagnostics.
5. Widgets-only windows need no switch, which is why Widgets is the default.
6. CI runs the full UI suite under software rendering (see 15).

### 2.5 Performance budgets (Floor profile; starting points)

| Metric | Budget |
|---|---|
| Cold start to first usable window (HDD) | ≤ 3 s; ≤ 1.5 s on SSD |
| Warm start | ≤ 1 s |
| Time to interactive with cached data (stale-while-revalidate) | ≤ 1 s after window |
| GUI thread block (any single task) | ≤ 16 ms typical, **≤ 50 ms hard limit**; watchdog logs violations |
| Scroll/resize of main list/table | Smooth (≥ 30 fps on Floor, 60 fps on Typical) with 100k rows (virtualized) |
| Input latency (click→visual response) | ≤ 100 ms |
| Idle CPU | ≈ 0% (no timers firing without need; < 0.5% sample average) |
| Idle RAM after warm-up | ≤ 150 MB (Widgets) / ≤ 250 MB (with Quick) |
| Memory growth over 8 h soak | ≈ 0 (no unbounded caches/leaks) |
| Realtime burst (1,000 events/s) | UI updates coalesced to ≤ 30 Hz; CPU stays bounded; no UI stall |
| Installer size / install footprint | Tracked per release; prune unused Qt modules and plugins |
| Battery impact (laptops) | No background polling when hidden beyond policy; timers coalesced |

Budgets are enforced by an automated benchmark job (see 15.4) with a regression
threshold (for example +10% fails).

### 2.6 Engineering rules for performance

**Threading and the event loop**

* The GUI thread runs Views, ViewModels and trivial orchestration only.
* I/O and CPU-bound work runs through `QtConcurrent`/`QThreadPool`/`QFuture` or
  dedicated worker threads; results return to the GUI thread via queued signals
  or `QFuture::then(context, …)`.
* One `QNetworkAccessManager` per thread that uses it (it is reentrant but tied to
  its thread's event loop); one SQLite connection per thread; long-lived realtime
  connections get their **own** manager (see 8.3).
* Never call `processEvents()` to "keep the UI alive"; never use blocking waits
  (`waitForReadyRead`, `QThread::sleep`, `QFuture::result()` on the GUI thread).
* Add a **GUI-thread watchdog**: a heartbeat timer on the GUI thread and a monitor
  thread; stalls over the budget are logged with a stack/metadata (and counted in
  telemetry).

**Models and views**

* Large data uses custom `QAbstractItemModel`s with **lazy fetching**
  (`canFetchMore/fetchMore`), stable row identity, batched change signals
  (`beginInsertRows` ranges, one `dataChanged` per range), and uniform row heights
  (`setUniformItemSizes`) where possible.
* Filtering/sorting of large sets happens in the application/data layer (SQL or
  indexed in-memory) and returns pages; avoid `QSortFilterProxyModel` on very large
  datasets, or run it incrementally/asynchronously.
* Custom delegates paint with cached `QPixmap`/pre-laid-out text; no layout
  computation in `paint()`; no per-paint allocations.
* Prefer `QStringView`/`QByteArrayView`, `reserve()`, move semantics and implicit
  sharing; avoid copying big containers; use `std::span`.

**Rendering and assets**

* Vector icons (SVG) cached to pixmaps per scale; no runtime-scaled huge images;
  decode images on worker threads at display size.
* Avoid `QGraphicsEffect`, translucent top-level windows and per-pixel alpha, large
  stylesheets (QSS) on hot widgets, and frequent palette/style changes.
* Minimize repaint regions (`update(rect)`), disable updates during bulk changes,
  throttle progress/animation to what is visible.
* Limit fonts and font fallback chains; avoid text elision recomputation per frame.

**Startup**

* Do the minimum before the first window: create the composition root, show UI from
  the **local cache**, then connect to the network and refresh in the background.
* Lazy-load features/plugins; initialize slices on first navigation; defer crash-handler
  upload, update checks, telemetry and realtime connect until after first paint.
* Keep the binary lean: only needed Qt modules and platform/image-format/style plugins;
  strip symbols (keep separate debug files), enable LTO; avoid static initializers with
  I/O; compile QML ahead of time (`qt_add_qml_module`, QML caching/compiler) if QML is
  used.

**Data and IO**

* SQLite: WAL mode, `synchronous=NORMAL`, prepared statements, batch writes in
  transactions, appropriate indexes, bounded page cache, writes on one writer thread;
  avoid random IO patterns on HDDs.
* Streaming JSON for big payloads or a fast parser with runtime SIMD dispatch; never
  parse megabytes of JSON on the GUI thread.
* Bounded caches (`QCache`/LRU) with size accounting; disk cache with quota and
  eviction; compress cold data if CPU permits.

**Power and background behavior**

* Pause or slow non-essential work when the window is hidden/minimized or the OS
  signals low power; resume and reconcile on show.
* Use coarse timers (`Qt::CoarseTimer`) where precision isn't needed; coalesce wakeups.

### 2.7 Compatibility hygiene for old machines

* Test on the Floor profile every release, including **first-run on a cold disk cache**.
* Do not require instruction sets beyond the baseline in your own code; verify third-party
  libraries dispatch at runtime.
* Ship needed runtimes (MSVC redistributable, etc.) in the installer; support older
  graphics drivers by never relying on features without a fallback.
* Linux: build on the **oldest supported distribution** (glibc baseline) to run on newer
  ones; test X11 and Wayland, and a software-rendering Mesa configuration.
* Respect OS accessibility, reduced-motion and high-contrast settings.

---

## 3. Architecture: hexagonal + vertical slices + MVVM

### 3.1 Layers

```text
┌──────────────────────────────── desktop app (one process) ─────────────────────────────────┐
│ INBOUND ADAPTERS (drive the app)                   OUTBOUND ADAPTERS (driven by the app)   │
│ Views (Widgets/QML) + ViewModels                   SDK/HTTP · Realtime (SSE/WS/poll)       │
│ Realtime events · OS events (tray, deep links,     SQLite storage · OS keystore            │
│ single-instance IPC, power/network) · timers       Notifications · Updater · Telemetry     │
│ CLI flags                                           Policy reader · File system            │
│                 │                                              ▲                           │
│                 ▼                                              │                           │
│           APPLICATION (use cases, ports, policy, sync, outbox) ─┘                           │
│                 │                                                                          │
│                 ▼                                                                          │
│           DOMAIN (entities, value objects, rules, domain events)                           │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Contains | May depend on | Must not depend on |
|---|---|---|---|
| **domain** | Entities, value objects, invariants, domain events, pure services | `shared-kernel`, C++ std; QtCore **value types** only (`QString`, `QDateTime`, `QUuid`, `QList`, …) if the ADR allows | `QObject`, signals/slots, QtGui/Widgets/Quick/Network/Sql, OS APIs |
| **application** | Use cases, **ports**, policy resolver, sync engine, outbox, permission checks | domain, `shared-kernel`, `contracts`, **QtCore** (`QObject`, `QFuture`, `QTimer`) | QtGui/Widgets/Quick/Network/Sql/WebSockets, platform adapters |
| **adapters/out** | SDK client, realtime transports, SQLite, keystore, notifications, updater, telemetry, policy sources | application ports, `platform`, Qt Network/Sql/WebSockets/etc. | views, viewmodels |
| **adapters/in** | ViewModels (as presentation adapters), realtime event handlers, OS event handlers | application, contracts | other slices' internals, SQL/HTTP |
| **presentation/views** | Widgets or QML | ViewModel types, `ui-kit` | SDK, storage, network, application directly |
| **platform** | Per-OS code behind interfaces (`#ifdef` lives only here) | OS APIs, Qt Core/GUI | domain/application |
| **contracts** | DTOs, error codes, event envelope, policy schema, route table | `shared-kernel` | everything else |

Rules:

* **`#ifdef Q_OS_*` appears only under `platform/`** (and build files).
* ViewModels are the only presentation code that talks to use cases.
* Enforce with a dependency checker (include-graph rules via CMake target link
  rules + `include-what-you-use`/custom script or clang-tidy checks): each layer is a
  separate CMake target and **links only to allowed targets**, so violations fail at link
  time, not just in review.

### 3.2 Ports (examples)

```cpp
// application/ports/lead_repository.h  — owned by the slice, domain language
template <class T> using Result = tl::expected<T, AppError>;   // or std::expected (C++23) per ADR

class LeadRepositoryPort {
public:
  virtual ~LeadRepositoryPort() = default;
  virtual QFuture<Result<Lead>>     byId(LeadId id) = 0;
  virtual QFuture<Result<LeadPage>> list(LeadQuery q) = 0;
  virtual QFuture<Result<Lead>>     updateStage(LeadId id, Stage s, Version expected, IdempotencyKey key) = 0;
};

class SessionPort    { /* current(), signIn(), signOut(), permissions() */ };
class PolicyPort     { /* effective(), onChanged(cb) */ };
class RealtimePort   { /* start(config), stop(), setTopics(set), signals: stateChanged, eventReceived, resyncRequired */ };
class NotifierPort   { /* notify(Notice) */ };
class ClockPort      { /* now() */ };
class SecretStorePort{ /* get(key), set(key,value), remove(key) */ };
```

Ports return `QFuture<Result<T>>` (errors as values, never exceptions across layers).
Exceptions are not used for control flow; build with exceptions enabled only if Qt/deps
require it, and never let them cross a `QObject` slot boundary.

### 3.3 MVVM in Qt

* **ViewModel** = `QObject` with `Q_PROPERTY` (preferably bindable properties via
  `Q_OBJECT_BINDABLE_PROPERTY`), invokable commands (`Q_INVOKABLE`/slots) and a
  `status` enum: `Loading | Ready | Empty | Forbidden | NotFound | Offline | Error |
  PolicyBlocked`. Lists expose `QAbstractItemModel`.
* **View** = Widgets or QML binding to the ViewModel. Widgets Views connect signals
  explicitly (or via small binding helpers); QML Views bind declaratively. Views contain
  no business conditions beyond "show this status".
* ViewModels depend on use cases/ports, a `Navigator` port and a `Notifier` port, never on
  widgets or windows. Navigation is by **route** (section 6.2), not by window pointers.
* One ViewModel per screen or significant component; no global mutable singletons;
  construction through the composition root.
* ViewModels are tested without any GUI (`QSignalSpy`, fake ports).

### 3.4 Vertical slices and the backend mapping

Desktop slices mirror backend slices one-to-one:

| Desktop slice | Backend slice | URL module | Permission prefix | Realtime topic prefix | Test folder |
|---|---|---|---|---|---|
| `funnels` | `funnels` | `funnels` | `funnels.*` | `funnels.` | `tests/funnels/desktop/` |
| `projects` | `projects` | `projects` | `projects.*` / `campaigns.*` | `projects.` | `tests/projects/desktop/` |
| `tenants` (admin) | `tenants` | `tenants` | `tenant.*` | `tenants.` | `tests/tenants/desktop/` |
| `usage`, `billing` (admin) | same | same | `billing.*` | `usage.` | … |
| `identity` | `identity` | (session) | (n/a) | `session.` | … |

Each slice contains `domain/ application/ adapters/{in,out}/ presentation/{viewmodels,views}/ contracts/`.
Cross-slice access goes only through the other slice's `contracts/` (same rule as the backend).

### 3.5 Shared artifacts vs shared code

The web/mobile/extension clients share TypeScript ViewModels and SDK; a C++ client cannot.
What is shared across all clients is the **contract**, and parity is enforced by tests:

| Shared artifact | Source of truth |
|---|---|
| OpenAPI / JSON Schemas (DTOs, errors, realtime envelope) | Backend repo; **generate** the C++ DTOs and SDK stubs from them |
| Permission catalog (`module.resource.action`) | Backend; exported as JSON; compile-time/enum generated |
| Route table (`/{userType}/{module}/…`, deep links) | Shared JSON route table → generated route builders in each client |
| Design tokens | `packages/tokens` → generated QSS/palette/QML constants |
| i18n message keys | Shared key catalog; per-client translations |
| Acceptance criteria | Specs (SDD) → each client's tests cite the same AC IDs |

A **parity suite** runs the same scenario fixtures against each client's SDK/ViewModel
layer to catch divergence in status handling, error mapping and permission gating.

### 3.5.1 Embedded browser temptation

Do not reuse the web app via an embedded browser to "save work" in this client: it breaks the
Floor-profile budgets and the security model. If a screen must be web-based, open it in the
system browser.

---

## 4. Repository layout

```text
apps/desktop/
├── CMakeLists.txt  CMakePresets.json  vcpkg.json (or conanfile.py + lockfile)
├── cmake/                        # hardening.cmake, qt.cmake, versioning.cmake, deploy.cmake, sanitizers.cmake
├── src/
│   ├── app/                      # composition root: main.cpp, bootstrap, DI container, lifecycle, single-instance
│   ├── shared-kernel/            # Result, ids, errors, strong types, time, span helpers
│   ├── contracts/                # generated DTOs, error codes, realtime envelope, policy schema, route table
│   ├── platform/                 # ONLY place for OS-specific code
│   │   ├── common/  windows/  macos/  linux/
│   │   │   keystore  notifications  autostart  tray  paths  power  network_info  protocol_handler  file_assoc
│   ├── infrastructure/
│   │   ├── http/                 # QNAM transport, retry, proxy, TLS config
│   │   ├── realtime/             # sse_client, websocket_client, polling_client, selector, state machine
│   │   ├── storage/              # sqlite connection pool, migrations, outbox, cache
│   │   ├── crypto/               # AES-GCM helpers, key mgmt (via OS keystore)
│   │   ├── telemetry/            # logging, redaction, ring buffer, crash, metrics, watchdog
│   │   ├── updater/              # manifest verify, download, apply, rollback
│   │   └── policy/               # registry/plist/etc/ policy sources + resolver
│   ├── features/<slice>/
│   │   ├── domain/ application/ adapters/{in,out}/ presentation/{viewmodels,views}/ contracts/
│   └── ui-kit/                   # shared widgets, styles/themes, icons, delegates, dialogs
├── resources/                    # icons (SVG), themes, translations (.ts), fonts (subset)
├── packaging/
│   ├── windows/ (WiX/MSI, MSIX, NSIS/IFW)  macos/ (app bundle, dmg, pkg, entitlements)
│   └── linux/ (AppImage, deb, rpm, flatpak, desktop file, appstream metainfo)
├── tools/                        # codegen (OpenAPI→C++), license report, symbol upload, perf harness
packages/
├── sdk-cpp/                      # generated + thin hand-written C++ SDK (no GUI deps)
├── tokens/  contracts/           # shared with other clients
tests/<slice>/desktop/{unit,integration,contract,e2e,perf,security,a11y,visual}/
tests/_platform/{architecture,desktop-perf,installer,updater,policy,realtime,security}/
docs/{adr,support-matrix.md,admin-guide.md,runbooks/,permissions-register.md,data-flows.md}
```

Each layer is its own CMake target (`desktop_domain`, `desktop_application`, …) with explicit
`target_link_libraries` that encode the dependency rules.

---

## 5. Backend integration: SDK and contracts

### 5.1 C++ SDK (`packages/sdk-cpp`)

* **Mirrors the URL playbook:** `sdk.app().funnels().leads().get(id)` ↔
  `GET /api/v1/app/funnels/leads/{leadId}`; `sdk.admin().tenants().users().list(tenantId)` ↔
  `GET /api/v1/admin/tenants/{tenantId}/users`. Methods: `list/get/create/update/remove` plus
  verb methods (`suspend`, `launch`). Paths are built in exactly one place.
* Generated from the backend **OpenAPI** (use an OpenAPI generator targeting C++/Qt or a custom
  generator) so DTOs and paths cannot drift; hand-written code is limited to transport,
  interceptors and ergonomics.
* **No GUI dependencies**; depends on QtCore/QtNetwork only; returns `QFuture<Result<T, SdkError>>`.
* **Transport interceptors** (same order as `PLAYBOOK_FRONTEND.md` §3.2): auth (Bearer, single-flight
  refresh, replay once), tenant (`X-Tenant-Id` from the session), correlation
  (`X-Correlation-Id`), client info (`X-Client: desktop/<version> (<os>; <arch>)`), idempotency
  (`Idempotency-Key` for mutations), retry (backoff + jitter for network/429/5xx on idempotent
  calls), error mapping (envelope → `SdkError`).
* **Errors** reuse the shared taxonomy: `unauthenticated | forbidden(requiredPermission) | not-found |
  conflict | validation(fields) | rate-limited | network | server(correlationId) | upgrade-required`.
* **Versioning:** the SDK targets one API version; the desktop declares a minimum supported API and
  the backend can answer `upgrade-required` with a typed error that the app surfaces and the updater
  handles.
* **Network settings:** one `QNetworkAccessManager` for request/response traffic (HTTP/2 enabled
  where the server supports it), system proxy by default, bounded redirect policy, explicit timeouts
  (`QNetworkRequest::setTransferTimeout`), response size limits, compression accepted, conditional
  requests (`ETag`/`If-None-Match`) for cacheable lists.
* **HTTP/1.1 connection limit:** a `QNetworkAccessManager` runs up to six parallel requests per
  host/port on desktop, so any long-lived stream must not share the request manager (see 8.3).

### 5.2 Authorization on the client

* The session carries `permissions[]` (same strings as the backend). `can("funnels.leads.update")`
  only shapes the UI. **The backend decides**; every ViewModel handles `forbidden` and shows
  `requiredPermission`.
* `{userType}` (`/app`, `/admin`, `/partner`) selects the **experience** (navigation shell, windows,
  menus), never access. A user with the admin experience still has each call authorized by token, tenant,
  RBAC and ownership server-side.
* Multi-role users have an **active role**; switching resets caches, realtime subscriptions and
  permission projections.

### 5.3 Long operations

Operations answered with `202 Accepted` (for example `POST /api/v1/app/projects/{projectId}/launch`)
are tracked as **operation resources** (`.../runs/{runId}`). The app persists `runId`, polls with
backoff or receives progress events through realtime, survives restarts, and never blocks a thread
waiting.

### 5.4 Offline and outbox

* The local DB is a **projection cache**: server data with `updatedAt/version` and a "stale" marker; it is
  never an authority.
* Mutations the user performs while offline go to an **outbox** (SQLite): `{id, type, payload,
  idempotencyKey, attempts, nextRunAt, status}`; the sync worker sends them in order per entity with
  backoff; conflicts (`409`/version mismatch) surface as typed results that the ViewModel presents for
  resolution.
* Outbox handlers are idempotent by key, matching the backend's idempotency contract
  (`PLAYBOOK_BACKEND.md` §5/§6).
* A schema/version gate prevents old clients from writing new-format data; outbox items carry the
  client version.

### 5.5 Backend additions required for desktop and realtime

These must be added to the backend playbook/specs (new spec per slice) before client work begins:

| Addition | Contract |
|---|---|
| Realtime capabilities | `GET /api/v1/app/realtime/capabilities` → supported transports, heartbeat interval, max message size, resume window, topic catalog version |
| SSE stream | `GET /api/v1/app/realtime/stream?topics=…` (`text/event-stream`), supports `Last-Event-ID` |
| WebSocket | `GET /api/v1/app/realtime/socket` (upgrade), subprotocol `app.v1` |
| Admin variants | `/api/v1/admin/tenants/{tenantId}/realtime/…` for cross-tenant monitoring (admin permission checked server-side) |
| Device/session registration (optional) | `POST /api/v1/app/devices` (client version, OS, arch, channel) for audit and targeted notices |
| Update manifest | Static signed manifest on a CDN (preferred) or `GET /api/v1/public/desktop/updates/{channel}/{os}/{arch}` (`/public` = session-less) |
| Min-version gate | `upgrade-required` error with `minVersion`, `downloadUrl` hints |
| Topics | `{module}.{resource}[.{id}]`, authorized per topic with the same `module.resource.read` permissions |

Backend placement follows the hexagon: realtime is an **inbound adapter** per slice
(`adapters/in/realtime`) fed by the **outbox/event bus** (Redis Streams) through a `realtime`
deployment mode that fans events out per tenant, with backpressure and per-connection limits
(`PLAYBOOK_BACKEND.md` §5, §7.2, §8).

---

## 6. Navigation, routes and deep links

### 6.1 Route model

The desktop uses the **same path grammar** as the web and mobile clients:

```text
/{userType}/{module}/{resource}[/{resourceId}[/{subresource}]]

/app/funnels/leads/{leadId}
/app/projects/{projectId}/funnels/{funnelId}
/admin/tenants/{tenantId}/users
/admin/tenants/{tenantId}/billing
```

* A `Navigator` port accepts a route (from the generated route table), resolves the screen
  (ViewModel + View), and manages history/back/forward and multi-window behavior.
* Route builders are **generated** from the shared route table; no hand-written path strings in
  Views.
* Guards (`RequireUserType`, `RequirePermission`) redirect to sign-in, a "not permitted" view or the
  allowed home; they only shape UX.

### 6.2 Shell per `{userType}`

* `/app`: employee shell (funnels, leads, projects). `/admin`: admin shell (separate navigation,
  admin guard). `/partner`: partner shell. Shells are separate modules loaded on demand to keep
  startup small for users who never see admin screens (performance, not security).

### 6.3 Deep links and OS integration

* Custom protocol (`app://app/funnels/leads/{leadId}`) and, where useful, associated web URLs,
  registered per OS (registry/URL scheme, `Info.plist`, `.desktop` MIME handler).
* Incoming deep links, file-open events and second-launch arguments arrive through the
  **single-instance IPC** (`QLocalServer`/`QLockFile`), are parsed by a strict parser (allowlist of
  routes, size limits, no commands), mapped to a route and handled by the `Navigator`.
* Deep-link parameters are **untrusted input**: validate IDs, never execute actions without UI
  confirmation, and require the authenticated session.

---

## 7. Authentication and session

* **OIDC Authorization Code + PKCE** in the **system browser**; redirect via a loopback listener
  (`127.0.0.1`, random port, single-use state) or a registered custom scheme. Qt Network Auth can help;
  confirm PKCE support in your Qt version **(verify)**, otherwise implement it in the adapter.
  No embedded login webview.
* **Token storage**: access token in memory (refresh on demand); **refresh token in the OS keystore**
  through a `SecretStorePort` adapter (Windows Credential Manager/DPAPI, macOS Keychain, Linux Secret
  Service/libsecret or KWallet; a vetted wrapper library such as QtKeychain **(verify license and
  maintenance)**). If no secure store exists (headless Linux), degrade to an explicit "sign in each
  session" mode rather than plaintext files.
* Refresh rotation with reuse detection (server side), single-flight refresh in the SDK, immediate
  revoke on sign-out/suspension, token cleared from memory on lock/sleep if policy requires.
* Sign-out wipes tokens, caches (per policy), subscriptions and outbox decisions (the outbox is kept
  only if the user confirms, since it contains unsent user data).
* Enterprise SSO: IdP issuer/client ID from managed policy; support device-bound or conditional-access
  signals through the IdP, not custom device fingerprinting.
* Session expiry and policy changes surface as ViewModel statuses (`signed-out`, `policy-blocked`).

---

---

> Continues in [`PLAYBOOK_DESKTOP_QT_PART2.md`](PLAYBOOK_DESKTOP_QT_PART2.md).
