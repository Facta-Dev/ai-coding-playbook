---
id: MOBILE_ANDROID_KOTLIN
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [FRONTEND_MOBILE]
---


# PLAYBOOK_MOBILE_ANDROID_KOTLIN.md — Native Android playbook (Kotlin · Jetpack Compose · Game · Market · Avatar)

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_MOBILE_ANDROID_KOTLIN.md`](PLAYBOOK_MOBILE_ANDROID_KOTLIN.md) | 1. Decisions up front (record each as an ADR) … 7. Shared platform features: onboarding, login, registration, forgot password |
| 2 | [`PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART2.md`](PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART2.md) | 8. Push notifications (FCM, all variants) … 18. Build, release and operations |
| 3 | [`PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART3.md`](PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART3.md) | 19. Governance, compliance and working with Claude Code … Appendix H — Support matrix template |

Architecture and engineering contract for building the **same three-variant
product family** as `PLAYBOOK_FRONTEND_MOBILE.md`, but as a **native Android
app in Kotlin**:

| Variant | What it is | Core capabilities |
|---|---|---|
| **Game** | Location-based 3D game in the style of Pokémon GO | Real-world map, spawns and encounters, 3D creatures, optional AR (ARCore), catching, collection, events, social |
| **Market** | Marketplace in the style of Amazon | Catalog, search and filters, product pages, reviews, cart, checkout, orders and tracking, wishlist, seller tooling |
| **Avatar** | 3D avatar with voice and movement | 3D character, speech in/out, lip-sync, gestures/emotions, optional camera-driven motion, live conversation |

**All three** share: **onboarding, login, registration, forgot/reset password,
push notifications (FCM)**, the same Kotlin SDK, design system, security model
and release pipeline, and all three must run well on **low- and mid-range
Android phones** (including Android Go–class devices), not only flagships.

It extends and must stay consistent with `PLAYBOOK_FRONTEND_MOBILE.md` (same
variants, contracts, budgets, device tiers and flows), `PLAYBOOK_FRONTEND.md`
(MVVM + SDK), `PLAYBOOK_URLS.md` (routes and permissions), `PLAYBOOK_BACKEND.md`
(slices, realtime, idempotency), `PLAYBOOK_SECURITY.md`, `PLAYBOOK_TESTS.md`,
`PLAYBOOK_AUDIT.md`, `PLAYBOOK_CLAUDE_CODE.md`, and reuses patterns from
`PLAYBOOK_DESKTOP_QT.md` (realtime state machine, quality governor) and
`PLAYBOOK_CHROME_EXTENSION.md` (managed config, kill switch, diagnostics).

The runnable, machine-checkable companion is the **Android skill pack**: three
Agent Skills (write, review, port) and a drop-in detekt/ktlint config that
enforces this contract.

The rules that carry the whole file:

1. **Native means we can do things React Native can't cheaply do**: baseline
   profiles, startup profiles, R8 full mode, platform performance hints,
   thermal/memory APIs, Play Feature/Asset Delivery. Use them; they are the
   reason to go native.
2. **Gradle modules enforce architecture at compile time.** Domain modules are
   pure Kotlin (no Android); a module that doesn't depend on another cannot
   import it.
3. **Unidirectional data flow.** `UiState` down, `UiEvent` up, effects as a
   separate one-shot channel; no business logic in composables.
4. **One variant = one app module = one binary.** The market app must not
   contain a game engine; permissions and native code are scoped per variant.
5. **The main thread is sacred.** Coroutines with injected dispatchers; StrictMode
   in debug; baseline profile and benchmarks in CI.
6. **Design for the floor, enhance upward** with capability tiers and a runtime
   quality governor (same contract as the RN playbook).
7. **The server is authoritative** for game state, prices, payments and
   entitlements; the app is untrusted.
8. **Push is a channel, not a data path.** Minimal payloads, fetch after tap.
9. **No vendor lock-in for irreplaceable assets** (avatars, models, user data).
10. **Measure on real low-end devices** and gate releases on Android vitals-style
    metrics.

> Verification note: status as of November 2026. **Android 17 (API 37)** is out
> (June 2026); **Google Play requires new apps and updates to target API 36
> (Android 16)** from 31 August 2026; **Jetpack Compose 1.12 (August '26)** moves
> to `compileSdk 37` and requires **AGP 9.1.1+**; **Navigation 3 is stable
> (1.0)**; AndroidX libraries require `minSdk 24` since July 2026. Items marked
> **(verify)** depend on exact versions, Play policy dates or library maintenance
> and must be re-checked in the Android developer documentation, the Play Console
> policy center and each library's release notes before adoption. Budgets are
> starting points to calibrate on your own device pool.

---
## 1. Decisions up front (record each as an ADR)

| # | Decision | Recommendation | Rationale / alternatives |
|---|---|---|---|
| D1 | Language | **Kotlin 2.x (K2 compiler)**, coroutines + Flow, kotlinx.serialization | Idiomatic, no reflection-heavy serialization (friendly to R8 and low-end startup) |
| D2 | UI | **Jetpack Compose** (Material 3) as the default UI toolkit; Views only for engine surfaces (`SurfaceView`, `AndroidView` interop) | Compose 1.12 reports first-frame times comparable to Views in Google's benchmarks; verify on your Low pool |
| D3 | Architecture | **Hexagonal + vertical slices + UDF (MVVM/MVI)**, enforced by Gradle modules | Same slices as backend and RN playbooks |
| D4 | Variants | **Three thin application modules** (`:apps:game`, `:apps:market`, `:apps:avatar`) depending on shared library modules; **not** product flavors that merely hide code | Compile-time guarantee that a variant can't pull another variant's engine/permissions |
| D5 | Navigation | **Navigation 3** (typed `NavKey` routes, state you own) | Stable 1.0; full back-stack control; routes mirror `PLAYBOOK_URLS.md` |
| D6 | DI | **Hilt** (compile-time graph, KSP) as default; Koin only if KMP is planned | Startup and correctness; avoid kapt |
| D7 | Networking | **OkHttp 5 + kotlinx.serialization** under a generated Kotlin SDK; Retrofit optional | HTTP/2, interceptors, first-party WebSocket and SSE |
| D8 | Persistence | **Room** (SQLite, WAL) + **DataStore** (prefs); secrets via **Android Keystore + Tink** | Room 3 is a KMP-oriented major version: adopt when stable for your needs **(verify)** |
| D9 | Images | **Coil 3** (Compose-first, size-aware) | Memory-safe loading with explicit sizes |
| D10 | Lists | LazyColumn/LazyVerticalGrid with keys + contentType; **Paging 3** for network/DB feeds | Virtualization on the main thread budget |
| D11 | Background | **WorkManager** for deferrable guaranteed work (outbox, uploads); foreground service only where policy-allowed | Doze/standby-friendly |
| D12 | Push | **Firebase Cloud Messaging** via **FCM HTTP v1** from your backend; `POST_NOTIFICATIONS` runtime permission on API 33+ | Section 8 |
| D13 | Auth | First-party email/password + **Credential Manager** (passkeys, passwords, Google) + OIDC/PKCE via **AppAuth + Custom Tabs**; tokens encrypted with Keystore | `PLAYBOOK_SECURITY.md` §4 |
| D14 | Payments | **Stripe Android SDK** (PaymentSheet, Google Pay) for physical goods/services; **Play Billing Library** (current major required by Play) for digital goods | Store rules differ by good type **(verify)** |
| D15 | 3D | Tiered behind a `SceneEngine` port: **2D fallback → Filament (directly or via SceneView) → Godot (Compatibility renderer) → Unity (AR-heavy, high tier only)** | Same tier model as RN; see section 13 |
| D16 | AR | **ARCore** (optional, never required for install); Geospatial API for location-anchored AR | `uses-feature … required="false"` + `com.google.ar.core=optional` |
| D17 | Maps (Game) | **MapLibre Native Android** (or Mapbox SDK); Google Maps Compose only for small marker counts | GL layers for entities |
| D18 | Min/target SDK | `minSdk` **24** (AndroidX/Play services floor; raise with fleet data), `compileSdk` **37** with AGP **9.1.1+** (required by Compose 1.12), `targetSdk` **37** — Play's floor is **36** (since 31 Aug 2026), so 36 is compliant but 37 is the target once the §15.2 Android 17 checklist is green | Verify the current Play target-API rule each year |
| D19 | ABIs | **arm64-v8a** primary; **armeabi-v7a** only where your fleet needs it (many low-end devices still run 32-bit userland) | Smaller downloads; use fleet analytics |
| D20 | Native libs | All `.so` files **16 KB page-size aligned** | Play requirement for native code; enforcement dates have been extended before **(verify current date)** |
| D21 | Optimization | **R8 full mode + Baseline Profiles + Startup Profiles** mandatory for release builds | Target reported ~6% smaller APK from R8 full mode and ~10% faster startup from Baseline Profiles, with ~11% faster startup and ~6% smaller APK after enabling full mode |
| D22 | Build | Gradle Kotlin DSL, **convention plugins** in `build-logic`, version catalog, **dependency verification**, configuration cache | Reproducible, auditable builds |
| D23 | Observability | Crashlytics or Sentry + `ApplicationExitInfo` + JankStats + Perfetto tracing | Section 16 |
| D24 | Distribution | AAB, Play App Signing, staged rollouts, Play Feature Delivery + Play Asset Delivery for heavy modules/assets | Section 18 |
| D25 | Non-GMS devices | Declare a policy: GMS-required (simpler) or GMS-optional (ports with AOSP fallbacks for push/location/integrity) | Affects Huawei-class devices |

### 1.1 AGP 9 migration notes (if you are not yet on it)

AGP 9 compiles Kotlin itself and rejects an explicit `org.jetbrains.kotlin.android`
plugin; it also removes the legacy `applicationVariants` API (use the Variant API
via `androidComponents`). Teams that cannot migrate immediately hold Compose BOM and
a few AndroidX libraries one release back until AGP 9.1.x/`compileSdk 37` is adopted.
Plan this as a dedicated upgrade task with a Low-pool performance check.

---

## 2. The product family

### 2.1 Variant matrix (same as the RN playbook; native specifics added)

| Capability | Game | Market | Avatar |
|---|---|---|---|
| Shared shell (auth, onboarding, push, settings, design system, SDK) | ✔ | ✔ | ✔ |
| Location | Fused Location + geofencing; optional foreground service | Optional approximate | No |
| Camera | Optional (AR via ARCore) | Optional (Google code scanner, CameraX photos) | Optional (CameraX → face/pose models) |
| Microphone | Optional | Optional (voice search) | **Core** (`AudioRecord`, communication mode) |
| 3D rendering | **Core** | Optional (off by default) | **Core** |
| Realtime | **Core** (WebSocket/SSE) | Order status, price alerts | **Core** (WebRTC/WebSocket) |
| Payments | Play Billing (digital) | **Core** (Stripe/Google Pay) | Play Billing (items/subscriptions) |
| Heavy modules | Map SDK + engine (Filament/Godot/Unity) as **dynamic feature** | Stripe, scanner | Engine + audio/WebRTC as **dynamic feature** |
| Target download (Low) | Base ≤ ~100 MB + PAD packs | ≤ ~25–35 MB | ≤ ~80 MB + PAD packs |

### 2.2 Identical across all three

Login, registration, forgot/reset password, onboarding, push registration and
routing, session/token handling, account deletion, consent, i18n, accessibility,
SDK, error taxonomy, correlation IDs, telemetry, kill switch/remote config, design
tokens (see `PLAYBOOK_FRONTEND_MOBILE.md` §2.2 and §7–§8).

### 2.3 May differ

Feature modules, native dependencies (via dynamic feature modules where useful),
permissions and foreground-service types, store listings, theme, onboarding steps.

---

## 3. Device classes, budgets and the quality governor

### 3.1 Device classes

Same `low | mid | high` classes and device-pool rule as `PLAYBOOK_FRONTEND_MOBILE.md` §3.1
(Low ≈ ≤ 3 GB RAM / little-core CPUs / entry GPUs / eMMC; Mid ≈ 4–6 GB; High ≥ 8 GB). Keep
a real-device pool (≥ 2 Low, 2 Mid, 1 High) plus a cloud farm for breadth; include at least one
**Android Go-edition** device.

### 3.2 Budgets (Low-class, release build with baseline profile; starting points)

Native apps should beat the RN numbers; targets below are tighter.

| Metric | Budget |
|---|---|
| Cold start, time to initial display (TTID) | ≤ 2.5 s (Low), ≤ 1.8 s (Mid) |
| Time to fully drawn (TTFD, `reportFullyDrawn`) | ≤ 3.5 s (Low), ≤ 2.5 s (Mid) |
| Slow/frozen frames | Jank rate < 5% in main flows; zero frozen frames in scroll benchmarks |
| Touch response | ≤ 100 ms |
| Shell memory (PSS, no 3D) | ≤ ~120 MB |
| 3D scene memory (total process PSS) | Low ≤ ~300 MB, Mid ≤ ~450 MB (Android 17 enforces RAM-based app memory limits) |
| 3D frame rate | Low: stable 30 fps (resolution scale ≤ 0.75); Mid: 30–60; High: 60 |
| Download size (per-device, AAB) | Market ≤ ~25–35 MB; Game/Avatar base ≤ ~100 MB, assets in PAD |
| Battery (Game active session) | Tracked %/hour on the Low pool; no regression release over release |
| Network | Works on slow 3G; request count and payload budgets per screen |
| Memory growth over 30 min | ≈ 0 |
| Android vitals | User-perceived crash and ANR rates well under Play's bad-behavior thresholds, per device model **(verify current thresholds)** |

### 3.3 Capability detection (native signals)

```text
DeviceTier hint ← ActivityManager.isLowRamDevice(), MemoryInfo.totalMem (reported RAM is below marketing RAM),
                  Build.VERSION.MEDIA_PERFORMANCE_CLASS (API 31+), Build.SOC_MODEL (API 31+), SDK_INT,
                  supported ABIs, GL ES / Vulkan feature levels (PackageManager features),
                  Display refresh rates, ArCoreApk.checkAvailability()
Runtime state   ← PowerManager thermal status + headroom (API 29/30+), isPowerSaveMode, ComponentCallbacks2.onTrimMemory,
                  Window frame metrics / JankStats, ApplicationExitInfo (previous OOM/memory-limiter exits)
Measured        ← first-run micro-benchmark (reference scene p95 frame time), refreshed after OS/app updates
Remote override ← remote config keyed by Build.MODEL / SOC / API level (blocklist or forced tier)
```

Rules: the hint is a **hint**; the **measured** result and the **runtime governor** win. Persist the tier and
re-evaluate after OS/app updates and repeated frame-drop events. Android 17's RAM-based memory limits mean a
memory ceiling is a **correctness** constraint, not just a performance goal: when a process is killed by the
limiter, `ApplicationExitInfo` reports it (reason `OTHER` with a memory-limiter description), so ingest that
signal into telemetry and lower the tier for that device class.

### 3.4 Quality governor

Same `QualityProfile` knobs as `PLAYBOOK_FRONTEND_MOBILE.md` §3.4 (render scale, frame cap, shadows/post,
texture pack, LOD, particles, map layers, camera tracking/AR). Native additions:

* **Thermal**: listen to thermal status changes and, on API 30+, the thermal headroom forecast; step down
  before throttling hits.
* **Performance hints (ADPF)**: for engine threads, use `PerformanceHintManager` sessions so the scheduler gets
  accurate work durations; report actual vs target frame time.
* **Game Mode / frame rate**: respect the user's Game Mode (performance/battery) where available; use
  `Surface.setFrameRate`/`Window` frame-rate hints to avoid rendering above what the screen/budget needs;
  consider frame-pacing (Swappy) for NDK render loops.
* **Memory pressure**: `onTrimMemory` levels trigger cache eviction and scene LOD reduction before the OS acts.
* **Power saver / low-RAM**: force the Low profile and disable AR/camera tracking.
* Step **down** immediately on breach; step **up** only after a sustained healthy period (hysteresis). Expose
  Auto / Battery saver / High quality in settings; remote config and managed policy can force a profile.

---

## 4. Architecture: hexagonal + vertical slices + UDF on Android

### 4.1 Layers mapped to Gradle modules

```text
┌────────────────────────────── one app module (per variant) ──────────────────────────────┐
│ :apps:<variant>  (Application, manifest, Nav3 root, variant config, Hilt entry points)     │
└──────────┬───────────────────────────────────────────────────────────────────────────────┘
           ▼
 :feature:<variant>:<slice>:ui        Compose screens + ViewModels (presentation adapters)
 :feature:<variant>:<slice>:data      Repositories implementing ports (SDK, Room, push, location…)   [adapters/out]
 :feature:<variant>:<slice>:domain    Use cases + ports + domain model (PURE KOTLIN, JVM-only)        [application + domain]
 :feature:<variant>:<slice>:contracts Public API of the slice (DTO-free interfaces/events) for other slices
           ▼
 :shell:*  (identity, notifications, devices, consent, settings)   :core:* (kernel, contracts, sdk, designsystem, …)
```

| Layer / module type | Contains | May depend on | Must not depend on |
|---|---|---|---|
| `domain` (JVM library) | Entities, value objects, rules, **ports**, use cases, `Result`/errors | `:core:kernel`, kotlinx-coroutines | Android SDK, Compose, OkHttp, Room, Hilt annotations beyond `@Inject` constructor (optional) |
| `data` (Android library) | Port implementations: SDK calls, Room DAOs, DataStore, push, location, camera, audio, scene adapters | own `domain`, `:core:*`, Android/Jetpack | `ui` modules |
| `ui` (Android library) | Composables, ViewModels, UiState/UiEvent/UiEffect, navigation entries | own `domain`, `:core:designsystem`, `:core:ui-core` | `data` (reach it only through DI) |
| `contracts` (JVM) | Cross-slice interfaces, event types, route keys | `:core:kernel` | everything else |
| `:core:sdk` (JVM or Android lib) | Generated DTOs + thin SDK over OkHttp | `:core:contracts`, `:core:kernel` | UI, Android UI APIs |
| `:apps:*` | Wiring only | feature modules | business logic |

Rules:

* **Domain modules are pure Kotlin** (`kotlin("jvm")`): the compiler forbids Android imports there.
* `ui` never depends on `data`; Hilt provides implementations at the app module (dependency inversion).
* **Cross-slice access only through `contracts`** (same rule as the backend).
* Add **architecture tests** (Konsist or equivalent) and module-graph checks in CI: forbidden dependencies,
  naming, `@Composable` only in `ui`, no `android.*` in `domain`.
* Android lint + `dependency-analysis` plugin to prevent unused/transitive leakage; module count is a build-time
  trade-off, so keep modules coarse enough (per slice, not per class).

### 4.2 Presentation: UDF with statuses

```kotlin
sealed interface UiStatus { data object Loading; data object Ready; data object Empty; data object Offline
  data class Forbidden(val requiredPermission: String?) : UiStatus; data object NotFound
  data class Error(val correlationId: String?) : UiStatus; data object PolicyBlocked }

@Immutable data class LeadDetailState(val status: UiStatus, val lead: LeadUi?, val canEdit: Boolean, val isMoving: Boolean)
sealed interface LeadDetailEvent { data class MoveToStage(val stage: Stage) : LeadDetailEvent; data object Retry : LeadDetailEvent }
sealed interface LeadDetailEffect { data class ShowMessage(val key: MessageKey) : LeadDetailEffect; data class Navigate(val route: Route) : LeadDetailEffect }
```

* ViewModels expose `StateFlow<State>` (collected with `collectAsStateWithLifecycle`) and a `Channel`-backed
  effect flow; commands via `onEvent`.
* Every screen handles the shared statuses `loading | ready | empty | forbidden | not-found | offline | error | policy-blocked`
  (same as `PLAYBOOK_FRONTEND.md` §4).
* ViewModels depend on use cases and ports (`NavigatorPort`, `NotifierPort`, `PermissionsPort`), never on `Context`
  or composables; use `SavedStateHandle` for restorable inputs.
* **Compose rules for Low devices**: stable/immutable state (`@Immutable`, kotlinx.collections.immutable), strong
  skipping enabled (default with current Kotlin), `key` and `contentType` in lazy lists, `derivedStateOf`, deferred
  state reads (lambda modifiers), no allocation in composition hot paths, `remember` for expensive objects, no
  business logic in composables; review Compose compiler reports in CI for unstable hot paths.

### 4.3 Ports (examples)

```kotlin
interface LeadRepositoryPort { suspend fun byId(id: LeadId): Outcome<Lead>; suspend fun list(q: LeadQuery): Outcome<LeadPage>
  suspend fun updateStage(id: LeadId, stage: Stage, expected: Version, key: IdempotencyKey): Outcome<Lead> }
interface PushPort          { suspend fun permissionState(): PermState; suspend fun registerDevice(): Outcome<DeviceReg>; suspend fun unregisterDevice() }
interface SecureStorePort   { suspend fun get(key: String): ByteArray?; suspend fun put(key: String, value: ByteArray); suspend fun remove(key: String) }
interface LocationPort      { fun updates(opts: LocOpts): Flow<Fix>; suspend fun startBackground(opts: BgLocOpts); suspend fun stopBackground() }
interface DeviceCapabilityPort { suspend fun tier(): DeviceTier; fun capabilities(): Capabilities; val thermal: StateFlow<Thermal> }
interface SceneEnginePort   { suspend fun init(cfg: SceneConfig); suspend fun load(scene: SceneSpec); fun send(cmd: SceneCommand)
                              val events: Flow<SceneEvent>; fun setQuality(q: QualityProfile); suspend fun dispose() }
interface RealtimePort      { fun start(cfg: RtConfig); fun stop(); fun setTopics(t: Set<String>); val state: StateFlow<RtState>; val events: Flow<RtEvent> }
```

`Outcome<T>` is a sealed result (`Success | Failure(AppError)`), errors are values; **always rethrow
`CancellationException`**. Platform/library types stay inside `data`.

### 4.4 Concurrency

* Structured concurrency; `viewModelScope`/`lifecycleScope`; injected dispatchers (`@IoDispatcher`, `@DefaultDispatcher`,
  `@MainImmediate`); main-safe suspend APIs; no `GlobalScope`; no blocking calls on Main (StrictMode thread policy
  in debug: disk, network, slow calls).
* Low-end CPUs have 2–4 usable cores: cap parallelism (`limitedParallelism`) for CPU-bound work; avoid launching
  hundreds of coroutines for tiny tasks; batch.
* Flows: `stateIn(WhileSubscribed(5_000))`, `conflate` for high-rate sensor streams, `debounce` for search.

### 4.5 State, data, offline and outbox

| Concern | Choice |
|---|---|
| Server data | Repository + Room cache (projection) + `Flow`; stale-while-revalidate |
| Prefs/flags | DataStore (Preferences/Proto) |
| Secrets | Keystore-backed AES-GCM via Tink (never SharedPreferences/DataStore plaintext) |
| Feeds | Paging 3 with `RemoteMediator` |
| Mutations offline | **Outbox** table + WorkManager sync with `Idempotency-Key`, backoff, per-entity ordering (mirrors the backend idempotency contract) |
| Conflicts | Typed results (`409`/version) surfaced to the ViewModel for resolution |
| Migrations | Room schema export + migration tests from every released version; destructive fallback forbidden |

The local DB is a **projection**; the backend is the authority.

---

## 5. Project layout, variants and build logic

```text
android/
├── settings.gradle.kts  build.gradle.kts  gradle/libs.versions.toml  gradle/verification-metadata.xml
├── build-logic/convention/            # plugins: app, library, jvm-library, compose, hilt, detekt, baseline-profile, signing, variant-config
├── apps/{game,market,avatar}/         # thin application modules (variant ID, manifest, Nav3 root, feature wiring)
├── core/
│   ├── kernel/        # pure Kotlin: Outcome, ids, errors, time, strong types
│   ├── contracts/     # DTOs, error codes, notification payloads, realtime envelope, performance-script schema, route table
│   ├── sdk/           # Kotlin SDK (OkHttp + kotlinx.serialization), generated from OpenAPI
│   ├── designsystem/  # tokens + Compose components + variant themes
│   ├── ui-core/       # UiStatus, base ViewModel helpers, navigation helpers, a11y utils
│   ├── device/        # DeviceCapabilityPort, QualityGovernor, remote overrides
│   ├── telemetry/     # logging+redaction, crash, performance markers, diagnostics bundle
│   ├── security/      # Keystore/Tink wrappers, biometrics, integrity client
│   ├── scene/         # SceneEnginePort + scene-2d, scene-filament, scene-godot, scene-unity (separate modules)
│   └── testing/       # fakes, rules, builders, fixtures
├── shell/{identity,notifications,devices,consent,settings}/{domain,data,ui,contracts}
├── feature/
│   ├── game/{map,spawns,encounters,catching,inventory,collection,events,social,shop,safety}/…
│   ├── market/{catalog,search,product,cart,checkout,orders,reviews,wishlist,seller,support}/…
│   └── avatar/{avatars,sessions,voice,performance,tracking,wardrobe,safety}/…
├── baselineprofile/  benchmark/       # profile generators + macrobenchmarks per variant
└── tests/<slice>/android/{e2e,contract,perf,security,a11y}/   tests/_platform/{architecture,device-perf,push,auth,store-readiness}/
docs/{adr,support-matrix.md,dependency-register.md,permissions-register.md,device-pool.md,runbooks/}
```

**Scope of the shipped template:** the template that ships with this playbook is the **minimal instantiation** of the graph above, not the recommended production
graph: one variant (a single `:app`, not `:apps/{game,market,avatar}`), one slice (`:feature:notes` split into `contracts`/`domain`/`data`/`ui`) and the shared
modules that slice needs (`:core:kernel`, `:core:ui-core`), plus `:evals` for the contract tests. The full variant grid, the `shell/*` modules and the remaining
`:core/*` modules are the **growth path**: add them when the product needs them, one consumer at a time. The rules in §4.1 hold for the minimal instantiation —
the module boundary is the enforcement — so the template proves the architecture without shipping modules nothing consumes.

**Tests placement ADR:** Gradle requires JVM and instrumented tests inside each module (`src/test`, `src/androidTest`);
colocate **unit/ViewModel/UI-component** tests there. Cross-module suites (e2e, contract, device performance, security,
accessibility audits, architecture) live under `tests/…/android/` to match `PLAYBOOK_TESTS.md` and are wired as separate
Gradle modules/tasks.

### 5.1 Build rules

* **Convention plugins** define SDK levels, Kotlin/JVM targets, Compose, lint, Detekt, R8, baseline profile and signing once;
  modules stay declarative.
* **Version catalog** (`libs.versions.toml`) is the single source of versions; use the Compose BOM; no dynamic versions.
* **Dependency verification** (`verification-metadata.xml` with checksums/signatures) and dependency locking; Renovate/Dependabot
  with a **release-age cooldown** for new versions; Gradle wrapper validation in CI.
* **Configuration cache + build cache** on; parallel builds; KSP instead of kapt.
* **Per-variant manifests** merge only permissions/services declared by modules that variant includes; CI asserts the merged
  manifest and native libs against an allowlist per variant (permission diff vs register).
* **R8**: full mode, resource shrinking, `isDebuggable=false`; keep rules per library in consumer rules; mapping files archived.
* **Baseline Profile + Startup Profile** modules per variant, generated in CI on real devices and committed/artifacted; refresh on every
  release candidate and after major UI changes.
* **Dynamic feature modules** (Play Feature Delivery) for heavy engines (Godot/Unity/AR) and rarely used features; PAD for assets.
* **16 KB alignment** check in CI for every native library (e.g., verify ELF `LOAD` segment alignment); run a test on a 16 KB-page emulator.
* **Full JDK, pinned.** *Toolchain reality:* Gradle runs on `JAVA_HOME`, or on `java` from `PATH` when `JAVA_HOME` is unset, and AGP compiles with the `javac` of that
  same installation — so a JRE-only default JVM fails the build with `does not provide the required capabilities: [JAVA_COMPILER]`. Pin a **full JDK (17+)**, and
  verify that `bin/java` and `bin/javac` come from the same installation: a `java` from one JDK and a `javac` from another fails the same way. The build entry point
  — the CI job and the developer target — resolves such a JDK and exports `JAVA_HOME` before the first `./gradlew` call. A Kotlin `jvmToolchain` does not replace
  that: the toolchain drives compilation, not the plugin that runs the build.
* **Every shipped linter runs in the gate.** Android Lint, Detekt and the architecture checks are part of the PR gate, not side commands nobody remembers. A linter the
  project ships but the gate does not run finds nothing until a human review finds it for it.
* **The instantiation script validates its arguments before it mutates the tree.** A slug and a scope that cannot be package segments are rejected up front; a
  half-applied rename leaves an unbuildable copy behind and the failure surfaces far from its cause.

---

## 6. Navigation, routes and deep links

* **Navigation 3**: routes are `@Serializable` `NavKey` types; back stacks are state you own (`rememberNavBackStack`); screens are
  declared in an `entryProvider`; multiple back stacks for tabs; adaptive scenes (list-detail) for tablets/foldables.
* The **route table** (shared JSON, same as other clients) is the source of truth for path grammar:

```text
/{userType}/{module}/{resource}[/{resourceId}[/{subresource}]]
/app/market/products/{productId}   /app/market/cart   /app/game/map   /app/game/encounters/{encounterId}
/app/avatar/sessions/{sessionId}   /app/notifications/preferences
Session-less: /onboarding  /login  /register  /forgot-password  /reset-password  /verify-email
```

* A **parity test** asserts that the Kotlin `NavKey` set and `RouteBuilders` match the route table; no hand-written path strings.
* **App Links**: `https://<domain>/app/…` with `android:autoVerify="true"` and `assetlinks.json` per variant; optional custom scheme
  `<scheme>://app/…`. The intent filter delivers into a `DeepLinkParser` (allowlist of routes, validated params, size limits).
* **Synthetic back stack** from notification/deep link taps (Up navigation lands on a sensible parent) built from the route hierarchy.
* Guards (`RequireAuth`, `RequireUserType`, `RequirePermission`) shape UX only (redirect to `/login`, `/403`, allowed home); **the server
  authorizes every call**. Deep links received while signed out are queued and resumed after login/bootstrap.
* Deep-link and notification parameters are **untrusted**; never perform state-changing actions without UI confirmation.

---

## 7. Shared platform features: onboarding, login, registration, forgot password

The **backend contract, UX rules and flows are identical** to `PLAYBOOK_FRONTEND_MOBILE.md` §7 (endpoints under
`/api/v1/public/auth/*`, device registration at `/api/v1/app/devices`, consent, account deletion, generic forgot-password
responses, single-use reset tokens, session revocation after reset). Android-specific implementation:

### 7.1 Onboarding

3–5 skippable screens driven by remote config with bundled fallback; value first, permissions later (primers at point of use);
variant-specific steps (Game: safety + age gate; Market: country/language/interests; Avatar: avatar choice, voice consent, AI disclosure).
Low-end: static WebP/AVIF assets, no looping heavy animation, honor `ANIMATOR_DURATION_SCALE`/reduce-motion, large font scale support.

### 7.2 Registration

Minimal fields; password policy feedback; **autofill/Credential Manager integration** (`ContentType.Username/Password/NewPassword` semantics
in Compose); versioned consent capture; age gate where required (consider Play's age-signal facilities where available **(verify)**);
email/phone verification via **App Link** or OTP. **Do not read SMS with SMS permissions**: Android 17 delays SMS-delivered OTP access
for apps that are not the intended recipient, so use the **SMS Retriever** or **SMS User Consent** APIs (or email OTP).
Abuse controls: server rate limits, **Play Integrity** verdict (standard request) as a risk signal, CAPTCHA only on high risk.

### 7.3 Login

* **Credential Manager** (`androidx.credentials`) as the single entry for **passkeys**, saved passwords and **Sign in with Google**
  (`GetGoogleIdOption`); fall back to the first-party form. Compose 1.12 adds integration with Credential Manager **(verify API surface)**.
* Enterprise SSO: **OIDC Authorization Code + PKCE** via **AppAuth-Android** and Custom Tabs; no embedded WebView logins.
* MFA/step-up for sensitive actions (payments, password change, deletion); biometric app lock via `BiometricPrompt` with a
  Keystore-bound key (`setUserAuthenticationRequired`) gating the refresh token; biometrics never replace server authentication.
* Throttling is server-side; the client shows generic errors and `Retry-After`.

### 7.4 Session and token storage

* Access token in memory; **refresh token encrypted with Tink AEAD whose key lives in Android Keystore** (StrongBox when available);
  DataStore/file holds only ciphertext. `android:allowBackup="false"` and `dataExtractionRules`/`fullBackupContent` exclude token stores.
* **Keystore hygiene (Android 17):** the platform now caps the number of Keystore keys per app (a much larger cap applies to apps
  targeting older SDKs); create a **small, fixed set of keys** (e.g., one master key per purpose) rather than per-item keys.
* Single-flight refresh (a `Mutex` in the OkHttp `Authenticator`), rotation with server-side reuse detection, immediate wipe on sign-out/suspension.

### 7.5 Forgot password and reset

Same flow as the RN playbook: request screen with **uniform response** and cooldown → email with a **single-use short-lived App Link**
(`https://<domain>/reset-password?token=…`) and/or code → reset screen validates the token on submit → all sessions revoked → login.
Handle cold start from the link, expired/used tokens, offline, IME insets. Never log or persist the token.

### 7.6 Permission primers (Android specifics)

| Permission | Mechanism | Notes |
|---|---|---|
| Notifications (API 33+) | `POST_NOTIFICATIONS` via `ActivityResultContracts.RequestPermission` | Show a primer first; after repeated denial the system stops prompting → deep-link to app notification settings |
| Location | Foreground first (`ACCESS_COARSE/FINE_LOCATION`), **background (`ACCESS_BACKGROUND_LOCATION`) only after** foreground is granted and only if needed | Two-step flow required; Play declaration + justification |
| Camera | `CAMERA` (CameraX/ARCore) | Prefer the Photo Picker for images (no storage permission) |
| Microphone | `RECORD_AUDIO` | Show a live-mic indicator in-app |
| Activity recognition (Game safety/anti-cheat) | `ACTIVITY_RECOGNITION` | Optional; degrade gracefully |

Each denial has a degraded path (browse-only map, text chat, no AR).

### 7.7 Account lifecycle

In-app account deletion (initiate → re-authenticate → grace period → confirmation) plus the web deletion path required by Play's data-deletion
policy **(verify)**; cascades server-side to devices/push tokens, avatar assets, location history, caches; data export and consent management in
settings; terms/privacy version bumps trigger re-consent.

---

---

> Continues in [`PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART2.md`](PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART2.md).
