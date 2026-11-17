---
id: DESKTOP_QT_PART3
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [DESKTOP_QT]
---

# PLAYBOOK_DESKTOP_QT_PART3 — Cross-platform Qt desktop application playbook (part 3)

> Part 3 of 3. Main entry: [`PLAYBOOK_DESKTOP_QT.md`](PLAYBOOK_DESKTOP_QT.md). Covers: 20. Definition of done and checklists … Appendix H — Support matrix document template.

## 20. Definition of done and checklists

### 20.1 Feature DoD

- [ ] Spec covers layers, ports, permissions, routes, realtime topics, policy keys, perf impact, a11y, per-OS notes.
- [ ] Domain/application tested with fake ports; ViewModel statuses covered; no GUI-thread blocking.
- [ ] Uses the generated SDK; no hand-written paths/DTOs; error taxonomy handled (`forbidden`, `offline`, …).
- [ ] Works with realtime on, degraded (polling) and off; resync path tested.
- [ ] Works in Compatibility Mode (software rendering) and meets Floor-profile budgets.
- [ ] Keyboard/screen-reader accessible; HiDPI and dark/high-contrast verified; strings are translation keys.
- [ ] Policy-aware (locked controls, kill switch); telemetry with correlation ID and redaction.
- [ ] Storage changes have migrations and fixtures; no secrets persisted outside the keystore.
- [ ] Parser/IPC inputs have fuzz targets; security tests updated.

### 20.2 Release checklist

- [ ] Reproducible build; hashes recorded; SBOM and license report generated.
- [ ] Sanitizer, static analysis, fuzz and dependency scans green.
- [ ] Unit/integration/contract/e2e/a11y/visual suites green on the CI matrix; Floor perf within budget.
- [ ] Installer install/upgrade/uninstall/silent tests green on clean VMs; policies verified.
- [ ] Signed (Authenticode/Developer ID/GPG), notarized (macOS), signatures verified post-build.
- [ ] Update manifest signed; rollback tested; staged rollout and halt criteria configured.
- [ ] Admin guide, support matrix, changelog and permission/policy changes documented.
- [ ] Canary soak complete; crash/stall/update metrics healthy.

### 20.3 Architecture acceptance checklist

- [ ] Qt LTS version pinned; C++20; CMake presets; locked dependency baseline.
- [ ] Layers are separate CMake targets with enforced dependencies; `#ifdef` only in `platform/`.
- [ ] Widgets-first UI; Qt Quick restricted and with Compatibility Mode and safe-mode fallback.
- [ ] MVVM with C++ ViewModels; Views contain no business logic; navigation by route.
- [ ] GUI-thread watchdog; async ports (`QFuture<Result<T>>`); no blocking on the GUI thread.
- [ ] Slices mirror backend slices; generated DTOs/SDK; permission catalog and route table shared.
- [ ] Realtime port with SSE, WebSocket, polling and off; state machine, resume, dedupe, resync, backpressure.
- [ ] SQLite storage with migrations, outbox, retention, encryption for Restricted data.
- [ ] OIDC + PKCE in system browser; secrets in OS keystore; policy-controlled configuration and kill switch.
- [ ] Signed, notarized, hardened builds; signed update channel with rollback; CRA/vulnerability process defined.
- [ ] Observability: structured logs, crash reporting, metrics, diagnostics bundle.
- [ ] Test pyramid including perf-on-Floor, installer/updater, policy, realtime conformance and fuzzing.

---

## Appendix A — CMake skeleton (illustrative)

```cmake
cmake_minimum_required(VERSION 3.25)
project(app_desktop LANGUAGES CXX VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_AUTOMOC ON)
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE ON)       # LTO

find_package(Qt6 6.12 REQUIRED COMPONENTS Core Gui Widgets Network Sql WebSockets LinguistTools)

include(cmake/hardening.cmake)                           # per-compiler flags (Appendix B)

add_library(desktop_domain STATIC ...)                   # links: shared_kernel only
add_library(desktop_application STATIC ...)              # links: desktop_domain, Qt6::Core
add_library(desktop_infrastructure STATIC ...)           # links: application, Qt6::Network, Qt6::Sql, Qt6::WebSockets
add_library(desktop_platform STATIC ...)                 # OS specifics via if(WIN32)/APPLE/UNIX
add_library(desktop_presentation STATIC ...)             # links: application, Qt6::Widgets, ui_kit
add_executable(app WIN32 MACOSX_BUNDLE src/app/main.cpp)
target_link_libraries(app PRIVATE desktop_presentation desktop_infrastructure desktop_platform)

target_compile_definitions(app PRIVATE
  QT_NO_CAST_FROM_ASCII QT_NO_CAST_TO_ASCII QT_NO_URL_CAST_FROM_STRING QT_NO_FOREACH
  QT_DISABLE_DEPRECATED_UP_TO=0x060800)
```

## Appendix B — Hardening flags (illustrative)

```text
MSVC compile:  /W4 /WX /sdl /GS /guard:cf /permissive- /Zc:__cplusplus
MSVC link:     /DYNAMICBASE /NXCOMPAT /HIGHENTROPYVA /guard:cf /CETCOMPAT
GCC/Clang:     -Wall -Wextra -Wconversion(-selective) -fstack-protector-strong -fstack-clash-protection
               -D_FORTIFY_SOURCE=2 (or 3 where supported) -fPIE -fcf-protection
Linker (ELF):  -pie -Wl,-z,relro,-z,now -Wl,-z,noexecstack
macOS:         hardened runtime at codesign; minimal entitlements; library validation on
Sanitizer CI:  -fsanitize=address,undefined (and thread in a separate job)
Baseline CPU:  no -march=native; default x86-64 baseline; runtime dispatch in SIMD libs
```

## Appendix C — Realtime port and state (sketch)

```cpp
struct RealtimeEvent {
  QString id;        // monotonic per stream (resume token)
  QString type;      // "funnels.lead.updated"
  QString tenantId;
  QString topic;     // "funnels.leads.<id>"
  qint64  ts = 0;
  int     v  = 1;
  QByteArray payload;   // small JSON, schema-validated by the transport/router
};

class RealtimePort : public QObject {
  Q_OBJECT
public:
  enum class State { Disabled, Disconnected, Connecting, Live, Reconnecting, Degraded };
  Q_ENUM(State)
  virtual void start(const RealtimeConfig&) = 0;    // transport from policy + capabilities
  virtual void stop() = 0;
  virtual void setTopics(const QSet<QString>&) = 0; // sync with visible screens
signals:
  void stateChanged(State s);
  void eventReceived(const RealtimeEvent& e);       // already deduplicated
  void resyncRequired(const QSet<QString>& topics); // gap/overflow/resume rejected
};
```

## Appendix D — SSE parser rules (conformance checklist)

```text
- Decode UTF-8 (strip leading BOM); lines end with \n, \r or \r\n
- A line starting with ':' is a comment (heartbeat)
- field:value (single optional space after ':') — fields: event, data, id, retry
- 'data' lines accumulate joined by '\n'; dispatch on empty line; empty data → no event
- 'id' sets last-event-id (ignore if it contains NUL); 'retry' (digits only) sets reconnection delay
- Unknown fields ignored; enforce max line length and max event size
- On reconnect send Last-Event-ID; honor retry; stop on HTTP 204 (server says do not reconnect)
- Treat non-200 or wrong Content-Type as failure → fallback path
```

## Appendix E — Renderer safe-mode logic (sketch)

```cpp
// main.cpp, before creating any window
const bool crashedLastTime = settings.value("startup/inProgress", false).toBool();
const bool forceSoftware   = policy.compatibilityMode() == Compat::Force
                          || cli.has("--software-rendering")
                          || crashedLastTime
                          || gpuBlocklist.matches(probeGpuInfo());
settings.setValue("startup/inProgress", true);

if (forceSoftware) {
  qputenv("QT_QUICK_BACKEND", "software");            // Qt Quick surfaces only; Widgets unaffected
  appState.setCompatibilityMode(true);                // disables non-essential animation/transparency
}
// ... create QApplication, composition root, first window ...
QObject::connect(firstWindow, &MainWindow::firstFrameRendered, [&]{
  settings.setValue("startup/inProgress", false);     // healthy start confirmed
});
```

## Appendix F — Policy schema (JSON form; same keys in ADMX/plist)

```json
{
  "type": "object",
  "properties": {
    "TenantUrl":        { "type": "string" },
    "SsoMode":          { "type": "string", "enum": ["oidc", "local"] },
    "UpdatesEnabled":   { "type": "boolean" },
    "UpdateChannel":    { "type": "string", "enum": ["stable", "beta", "canary"] },
    "RealtimeMode":     { "type": "string", "enum": ["auto", "websocket", "sse", "polling", "off"] },
    "TelemetryLevel":   { "type": "string", "enum": ["off", "errors", "full"] },
    "CompatibilityMode":{ "type": "string", "enum": ["auto", "force", "off"] },
    "KillSwitch":       { "type": "boolean" },
    "FeatureFlags":     { "type": "object", "additionalProperties": { "type": "boolean" } },
    "DataRetentionDays":{ "type": "integer", "minimum": 0 },
    "AllowUserSettings":{ "type": "boolean" }
  },
  "additionalProperties": false
}
```

## Appendix G — Example vertical slice flow: update a lead's stage (desktop)

```text
View (LeadDetailView) → ViewModel (LeadDetailViewModel::moveToStage)
  → use case MoveLeadStage (checks can('funnels.leads.update') as UX hint, builds IdempotencyKey)
  → LeadRepositoryPort::updateStage → SDK: PATCH /api/v1/app/funnels/leads/{leadId}
     (Authorization, X-Tenant-Id, X-Correlation-Id, Idempotency-Key) → backend authorizes (RBAC, tenant, ownership)
  → Result<Lead> → ViewModel status Ready / Forbidden(requiredPermission) / Conflict / Offline(outbox)
  ← Realtime event "funnels.lead.updated" (topic funnels.leads.<id>) → dedupe → handler → cache refresh
     → coalesced model update (≤ 30 Hz) → View repaints the affected row only
Tests: unit (policy/domain), ViewModel statuses, adapter integration (SDK mock), realtime conformance,
       parity fixture vs web/mobile, authz-matrix row, Floor-profile list-scroll perf.
```

## Appendix H — Support matrix document template

```markdown
# Support matrix (generated per release)
| OS | Min build | Archs | Display servers | Status | End of support |
| Windows 10 | 22H2 | x64 | n/a | Supported until <date> | <date> |
| Windows 11 | 23H2+ | x64, arm64 | n/a | Supported | |
| macOS | <N-2> | arm64, x86-64 | n/a | Supported | |
| Ubuntu LTS | 22.04, 24.04 | x64, arm64 | X11, Wayland | Supported | |
Minimum hardware (Floor): 2 cores, 4 GB RAM, software rendering supported.
Known limitations: <tray on some Wayland desktops, global shortcuts on Wayland, ...>
Qt version: 6.12 LTS (maintenance until <date>)
```
