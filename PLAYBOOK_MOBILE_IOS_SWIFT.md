---
id: MOBILE_IOS_SWIFT
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [FRONTEND_MOBILE]
---


# PLAYBOOK_MOBILE_IOS_SWIFT.md — Native iOS playbook (Swift 6.x · SwiftUI in code · Game · Market · Avatar)

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_MOBILE_IOS_SWIFT.md`](PLAYBOOK_MOBILE_IOS_SWIFT.md) | 1. Decisions up front (record each as an ADR) … 7. Shared platform features: onboarding, login, registration, forgot password |
| 2 | [`PLAYBOOK_MOBILE_IOS_SWIFT_PART2.md`](PLAYBOOK_MOBILE_IOS_SWIFT_PART2.md) | 8. Push notifications (APNs, all variants) … 18. Build, release and operations |
| 3 | [`PLAYBOOK_MOBILE_IOS_SWIFT_PART3.md`](PLAYBOOK_MOBILE_IOS_SWIFT_PART3.md) | 19. Governance, compliance and working with Claude Code … Appendix G — Support matrix template |

Architecture and engineering contract for building the **same three-variant
product family** as `PLAYBOOK_FRONTEND_MOBILE.md` and
`PLAYBOOK_MOBILE_ANDROID_KOTLIN.md`, as a **native iOS app in Swift**, with one
hard rule about how we build UI: **every view is written as code**. No
Storyboards, no XIBs, no Interface Builder, no visual workflow editors as a
source of truth. We develop with Claude Code; code is diffable, reviewable,
testable and generatable, visual canvases are not.

| Variant | What it is | Core capabilities |
|---|---|---|
| **Game** | Location-based 3D game in the style of Pokémon GO | Real-world map, spawns and encounters, 3D creatures, optional AR (ARKit), catching, collection, events, social |
| **Market** | Marketplace in the style of Amazon | Catalog, search and filters, product pages, reviews, cart, checkout (Apple Pay), orders and tracking, wishlist, seller tooling |
| **Avatar** | 3D avatar with voice and movement | 3D character, speech in/out, lip-sync, gestures/emotions, optional face-tracking (TrueDepth), live conversation |

**All three** share **onboarding, login, registration, forgot/reset password,
push notifications (APNs)**, the same Swift SDK, design system, security model
and release pipeline, and all three must run well on **older and mid-range
iPhones** (A12/A13-class), not only the newest models.

It extends and must stay consistent with `PLAYBOOK_FRONTEND_MOBILE.md` (variants,
backend contracts, device tiers, flows), `PLAYBOOK_MOBILE_ANDROID_KOTLIN.md` (parity
of slices, ports and budgets), `PLAYBOOK_FRONTEND.md` (MVVM + SDK),
`PLAYBOOK_URLS.md`, `PLAYBOOK_BACKEND.md`, `PLAYBOOK_SECURITY.md`,
`PLAYBOOK_TESTS.md`, `PLAYBOOK_AUDIT.md`, `PLAYBOOK_CLAUDE_CODE.md`, and reuses patterns
from `PLAYBOOK_DESKTOP_QT.md` (realtime state machine) and
`PLAYBOOK_CHROME_EXTENSION.md` (managed config, kill switch, diagnostics).

The runnable, machine-checkable companion is the **iOS skill pack**: three
Agent Skills (write, review, port) and a drop-in SwiftLint/swift-format config
that enforces this contract.

The rules that carry the whole file:

1. **Views are code.** SwiftUI first (UIKit only in code, never via Interface
   Builder). Project and build configuration are text manifests, not GUI state.
2. **Swift 6 language mode with strict concurrency.** Data races are compile
   errors; isolation is explicit; the main actor owns UI.
3. **Modules enforce architecture.** Swift packages with `Domain` targets that
   import no UI frameworks; a target that doesn't depend on another can't import it.
4. **Unidirectional data flow.** `@Observable` ViewModels expose state; views send
   intents; side effects go through ports.
5. **One variant = one app target = one binary.** The market app doesn't ship a
   3D engine; entitlements and usage strings are scoped per variant.
6. **Design for the floor, enhance upward** with capability tiers and a runtime
   quality governor, using Metal GPU families and memory APIs, not device lists.
7. **The server is authoritative** for game state, prices, payments and
   entitlements; the app is untrusted.
8. **Push is a channel, not a data path.** Minimal payloads, fetch after tap.
9. **No vendor lock-in for irreplaceable assets** (avatars, models, user data).
10. **Measure on real older iPhones** and gate releases on MetricKit-style metrics.

> Verification note: status as of November 2026. **Xcode 27.2** (29 Oct 2026) with
> **Swift 6.4(.2)** is current; it requires a **Mac with Apple silicon on macOS 26.6+**.
> The App Store submission floor has been **Xcode 26 and the iOS 26 SDK since
> 28 April 2026**; plan the move to the iOS 27 SDK when Apple announces its
> deadline. **iOS 27** shipped in September 2026. Items marked **(verify)** depend
> on exact versions, App Store policy dates or library maintenance and must be
> re-checked in Apple's documentation, App Store Review Guidelines and release
> notes before adoption. Budgets are starting points to calibrate on your own
> device pool.

---
## 1. Decisions up front (record each as an ADR)

| # | Decision | Recommendation | Rationale / alternatives |
|---|---|---|---|
| D1 | Language | **Swift 6 language mode** on current toolchain (Swift 6.4 in Xcode 27.x; 6.3 in Xcode 26.4+), complete strict concurrency | Data-race safety at compile time; migrate packages individually |
| D2 | UI | **SwiftUI, written in code**; UIKit only when measured necessary (code-only: `UICollectionView` compositional layout, `UIViewRepresentable` for engine surfaces) | Declarative, previews as code (`#Preview`), Claude Code can read/write every view |
| D3 | No visual builders | **Forbidden as source of truth:** Storyboards, XIBs, Interface Builder, Reality Composer Pro scenes, Core Data model editor, Xcode Cloud GUI workflows, visual Shortcuts. CI blocks adding these files | Reviewability, merge-ability, AI-assisted development |
| D4 | Project definition | **SwiftPM local packages + a generated Xcode project** from a text manifest (**Tuist** `Project.swift` or **XcodeGen** `project.yml`); `.xcodeproj` is a build artifact (git-ignored) with settings in **`.xcconfig`** files | Hand-edited `.pbxproj` is merge-hostile and agent-hostile |
| D5 | Architecture | **Hexagonal + vertical slices + UDF (MVVM)**, enforced by package/target dependencies | Same slices as backend, RN and Android playbooks |
| D6 | State | **Observation** (`@Observable`) ViewModels, `@MainActor` isolation for UI; async/await + `AsyncSequence`; actors for shared mutable state | Fine-grained view invalidation is cheaper on old CPUs than `ObservableObject` |
| D7 | Navigation | `NavigationStack` with typed route values + path state owned by a router; routes mirror `PLAYBOOK_URLS.md` | Deep links and restoration |
| D8 | DI | **Constructor injection + composition root** (`AppEnvironment`); optional `swift-dependencies` if the team adopts it | No heavy frameworks, no reflection |
| D9 | Networking | **URLSession** (HTTP/2, HTTP/3 where available) under a Swift SDK generated by **swift-openapi-generator** from the backend OpenAPI spec; `URLSessionWebSocketTask`; SSE over `URLSession.bytes` | First-party, no third-party transport weight |
| D10 | Persistence | **GRDB** (SQLite, WAL, code-defined migrations) for offline cache/outbox; `UserDefaults`/`@AppStorage` for non-sensitive prefs; Keychain for secrets | SwiftData is optional for simple local state; the Core Data model editor is excluded by D3 **(verify SwiftData maturity for your needs)** |
| D11 | Images | **Nuke/NukeUI** with downsampling processors (SwiftUI `AsyncImage` doesn't cache) | Memory-safe |
| D12 | Push | **APNs (token-based `.p8` auth)** sent directly by the backend; `UNUserNotificationCenter`; notification service extension (code-only) | Section 8 |
| D13 | Auth | First-party email/password + **Sign in with Apple** + **passkeys** (AuthenticationServices) + OIDC/PKCE via `ASWebAuthenticationSession`; tokens in Keychain | `PLAYBOOK_SECURITY.md` §4 |
| D14 | Payments | **Apple Pay (PassKit) + Stripe iOS SDK PaymentSheet** for physical goods/services; **StoreKit 2** for digital goods | Store rules differ by good type **(verify)** |
| D15 | 3D | Tiered behind a `SceneEngine` port: **SpriteKit/2D fallback → RealityKit (ECS, `RealityView`) → Metal custom renderer or embedded Godot → Unity (AR-heavy, high tier only)**. **SceneKit is soft-deprecated since iOS 26; don't start new work on it** | Section 13 |
| D16 | AR | **ARKit + RealityKit**, optional; geo-anchoring only where supported **(verify city coverage)** | Capability-gated |
| D17 | Maps (Game) | **MapLibre Native / Mapbox Maps** (GL layers, same tiles as Android); **MapKit for SwiftUI** for simple maps (store locator) | Entities as GL layers |
| D18 | Deployment target | **iOS 18.0** for all variants (covers iPhone XS/XR and later; RealityView on iOS, modern SwiftUI/Observation). Lower to **iOS 17** only with fleet data | Verify against your analytics each release |
| D19 | Linking | **Static linking** for SwiftPM libraries (default), few dynamic frameworks; mergeable libraries where useful | Fewer dyld loads at launch |
| D20 | Observability | **MetricKit + os.Logger/signposts + Sentry Cocoa (or Crashlytics)** | Section 16 |
| D21 | CI/CD | **Code-defined CI** (GitHub Actions or equivalent, Apple-silicon runners with pinned Xcode) + fastlane or scripts + App Store Connect API; **no Xcode Cloud GUI workflows** | Reproducible and reviewable |
| D22 | Testing | **Swift Testing** for unit/domain/ViewModel, **XCTest/XCUITest** for UI/perf, snapshot tests | Section 17 |
| D23 | Localization | **String Catalogs** (`.xcstrings`, plain JSON) with typed keys via `String(localized:)` | Editable as text; Xcode's editor optional |
| D24 | Assets | Vector (PDF/SVG) + asset catalogs for images/colors with **generated Swift symbols**; design tokens defined **in code** | Colors/fonts come from tokens, not from the catalog editor |

### 1.1 What "no visual workflows" means in practice

* **Allowed:** Xcode as an editor/debugger/profiler; `#Preview` blocks **in the same Swift file** as the view; Instruments; the asset-catalog and
  String Catalog editors as convenience over their JSON.
* **Forbidden as source of truth:** `.storyboard`, `.xib`, SwiftUI-canvas-only edits that are not in Swift source, `.rcproject`/Reality Composer Pro scenes
  (author 3D content in DCC tools → export USDZ/glTF; build entities **in code**), `.xcdatamodeld`, Xcode Cloud workflows configured in the GUI,
  GUI-only signing/capability toggles (declare entitlements, Info keys and capabilities in the manifest/`.xcconfig`/`.entitlements`).
* **CI guard:** fail the build if a PR adds forbidden file types or edits `project.pbxproj` by hand (the project is generated).
* **Claude Code loop:** Xcode 26.3+ integrates Claude Agent (the Claude Agent SDK harness), including Xcode Previews for visual checks, and exposes Xcode capabilities through MCP; for headless work
  use `swift build/test`, `xcodebuild`, `xcrun simctl` or an MCP bridge such as XcodeBuildMCP **(verify tool versions)**.

---

## 2. The product family

### 2.1 Variant matrix (same as other mobile playbooks; iOS specifics added)

| Capability | Game | Market | Avatar |
|---|---|---|---|
| Shared shell (auth, onboarding, push, settings, design system, SDK) | ✔ | ✔ | ✔ |
| Location | Core Location (live updates, `CLMonitor`), optional background | Optional approximate | No |
| Camera | Optional AR (ARKit) | Optional (`DataScannerViewController`, photos) | Optional (ARKit face tracking / Vision) |
| Microphone | Optional | Optional (voice search) | **Core** (`AVAudioEngine`, voice processing) |
| 3D rendering | **Core** (RealityKit/Metal) | Optional, off by default | **Core** (RealityKit) |
| Realtime | **Core** (WebSocket/SSE) | Order status, price alerts, Live Activities (optional) | **Core** |
| Payments | StoreKit 2 (digital) | **Core** (Apple Pay/Stripe) | StoreKit 2 (items/subscriptions) |
| Extensions | Notification service, Background Assets | Notification service, Widgets/Live Activities (optional) | Notification service, Background Assets |
| Target download (Low) | Base ≤ ~100 MB + Background Assets packs | ≤ ~35 MB | ≤ ~80 MB + packs |

### 2.2 Identical across all three

Login, registration, forgot/reset password, onboarding, push registration/routing, session/token handling, account deletion, consent, i18n,
accessibility, SDK, error taxonomy, correlation IDs, telemetry, kill switch/remote config, design tokens
(`PLAYBOOK_FRONTEND_MOBILE.md` §2.2, §7, §8).

### 2.3 May differ

Feature packages, native dependencies, entitlements, background modes, usage-description strings, App Store listings, theme, onboarding steps.

---

## 3. Device classes, budgets and the quality governor

### 3.1 Device classes (by silicon, not by model list)

| Class | Typical devices | Traits |
|---|---|---|
| **Low** | iPhone XS/XR (A12, iOS 18 ceiling), iPhone 11 / SE 2 / SE 3 (A13/A15), 3–4 GB RAM | Older GPU family, thermal throttling sooner, small RAM headroom |
| **Mid** | iPhone 12/13/14 (A14–A16), 4–6 GB RAM | Bulk of the active base |
| **High** | A17 Pro and newer, 8 GB RAM | Optional extras; Apple Intelligence-capable devices |

Reports after WWDC indicate iOS 27 runs on every iPhone that ran iOS 26 (back to iPhone 11 and SE 2/3), with a back-ported scheduler aimed at older hardware, while Apple Intelligence features require
newer devices **(verify the official compatibility list)**. Keep a **real-device pool** (≥ 2 Low incl. an A12 on iOS 18 and an A13, 2 Mid, 1 High) plus a cloud farm.

### 3.2 Budgets (Low-class, release build; starting points)

| Metric | Budget |
|---|---|
| Cold launch to first frame (TTID) | ≤ 1.5 s (Low), ≤ 1.0 s (Mid) |
| Time to usable content (cached) | ≤ 2.5 s (Low) |
| Hangs | No main-thread hangs > 250 ms in main flows; hang rate under App Store Connect/MetricKit "good" thresholds **(verify)** |
| Scroll | Smooth 60 fps lists (no sustained dropped frames in the scroll benchmark) |
| Touch response | ≤ 100 ms |
| Shell memory | ≤ ~150 MB footprint (no 3D) |
| 3D scene memory | Low ≤ ~600 MB footprint, Mid ≤ ~1 GB; keep a margin under `os_proc_available_memory()` and jetsam limits |
| 3D frame rate | Low: stable 30 fps (resolution scale ≤ 0.75); Mid: 30–60; High: 60/120 |
| Download size | Market ≤ ~35 MB; Game/Avatar base ≤ ~100 MB with Background Assets |
| Battery (Game active) | Tracked %/hour on the Low pool; no regression release over release |
| Memory growth over 30 min | ≈ 0 |
| Crash-free sessions | ≥ 99.5% (Low pool measured separately) |

### 3.3 Capability detection (native signals)

```text
Hint     ← ProcessInfo.physicalMemory, os_proc_available_memory(), Metal GPU family (MTLDevice.supportsFamily(.apple6…)),
           chip generation via model identifier → table maintained in code/remote config, OS version
Features ← ARWorldTrackingConfiguration.isSupported, ARFaceTrackingConfiguration.isSupported, DataScannerViewController.isSupported,
           SpeechTranscriber/SFSpeechRecognizer on-device support, display refresh (ProMotion)
Runtime  ← ProcessInfo.thermalState (+ notification), isLowPowerModeEnabled, memory warnings,
           frame timing (CADisplayLink / CAMetalDisplayLink), MetricKit history (previous hangs/jetsam)
Measured ← first-run micro-benchmark (reference scene p95 frame time), refreshed after OS/app updates
Remote   ← remote config keyed by model identifier / OS (blocklist or forced tier)
```

Rules: the hint is a **hint**; the **measured** result and the **runtime governor** win; persist the tier; re-evaluate after OS/app updates and repeated hitches.
Prefer **GPU family and feature checks** over model tables wherever possible.

### 3.4 Quality governor

Same `QualityProfile` knobs as `PLAYBOOK_FRONTEND_MOBILE.md` §3.4 (render scale, frame cap, shadows/post, texture pack, LOD, particles, map layers, tracking/AR). Native additions:

* **Thermal**: observe `ProcessInfo.thermalState`; step down at `.fair`/`.serious` before throttling hurts.
* **Low Power Mode**: force the Low profile, disable AR/camera tracking, cut frame cap to 30.
* **Memory**: respond to memory warnings immediately (drop caches, LOD down); use `os_proc_available_memory()` to cap scene budgets dynamically.
* **Frame pacing**: `CAMetalDisplayLink`/`preferredFrameRateRange` to avoid rendering above the budget; ProMotion only on High/Mid when thermally healthy.
* **UI visuals**: honor `accessibilityReduceMotion` and `accessibilityReduceTransparency`; provide a **Compatibility visual mode** that replaces translucent/glass effects with solid surfaces on the Low tier.
* Step **down** immediately on breach; step **up** only after a sustained healthy period (hysteresis). Expose Auto / Battery saver / High quality in settings; remote config/managed policy can force a profile.

### 3.5 Liquid Glass and visual cost

Adopt system components (they get the platform look for free). Custom translucent/“glass” effects, blurs and materials are GPU-expensive on older devices: use few, avoid stacking them behind scrolling lists, gate
custom effects by tier, and honor Reduce Transparency. Apple provided an Info.plist opt-out for the iOS 26 design during the transition (`UIDesignRequiresCompatibility`); do not rely on it as a long-term strategy **(verify its status in the iOS 27 SDK)**.

---

## 4. Architecture: hexagonal + vertical slices + UDF on iOS

### 4.1 Layers mapped to Swift packages and targets

```text
App target (per variant)   Game | Market | Avatar                                (composition root, @main App, navigation root)
  │
  ├── Features/<Variant>/<Slice>/   (one Swift package per slice)
  │     ├── <Slice>Contracts   public cross-slice API (protocols, events, route keys)
  │     ├── <Slice>Domain      entities, value objects, rules, PORTS, use cases     → PURE SWIFT (no UI or platform frameworks)
  │     ├── <Slice>Data        port implementations: SDK calls, GRDB, push, location, camera, audio, scene adapters   [adapters/out]
  │     └── <Slice>UI          SwiftUI views + @Observable ViewModels + Router entries                               [presentation adapters]
  ├── Shell/{Identity,Notifications,Devices,Consent,Settings}/…   (same four-target layout)
  └── Core/{Kernel,Contracts,SDK,DesignSystem,UICore,Device,Telemetry,Security,Scene*,Testing}
```

| Target type | Contains | May depend on | Must not depend on |
|---|---|---|---|
| `Domain` | Entities, value objects, ports, use cases, `Outcome`/errors | `Kernel` | SwiftUI, UIKit, URLSession, GRDB, ARKit/RealityKit, CoreLocation, anything platform-specific |
| `Data` | Adapters (SDK, GRDB, Keychain, push, location, camera, audio, scene engines) | own `Domain`, `Core/*`, system frameworks | `UI` targets |
| `UI` | Views, ViewModels, route entries, previews | own `Domain`, `DesignSystem`, `UICore` | `Data` (resolved through the composition root) |
| `Contracts` | Cross-slice protocols/events | `Kernel` | everything else |
| `SDK` | Generated OpenAPI client + thin hand-written wrapper | `Contracts`, `Kernel`, Foundation | UI, UIKit/SwiftUI |
| App target | Wiring only | all needed packages | business logic |

Rules:

* **`Domain` targets compile without Apple UI frameworks**, so their tests can run with `swift test` on macOS *and Linux CI* for speed.
* Use the **`package` access level** for intra-package visibility and `public` only for cross-package APIs; keep protocols/ports `public` only where another target implements them.
* **Cross-slice access only via `Contracts`**, like the backend.
* **Architecture tests**: a script validates `swift package show-dependencies --format json` against an allowlist; SwiftLint custom rules ban `import SwiftUI` in `Domain`/`Data`; CI fails on violations.
* **Static linking** by default; avoid many small dynamic frameworks; keep package granularity per slice (not per type) to protect build/launch time.

### 4.2 Concurrency model (Swift 6)

* **Language mode 6, complete strict concurrency** in every package. Domain/data packages: default nonisolated; **UI packages set default isolation to `MainActor`** (Swift 6.2+ `defaultIsolation`) so view/ViewModel code is main-actor by default.
* Adopt the Swift 6.2 "approachable concurrency" settings consistently (nonisolated-nonsending by default, explicit `@concurrent` for work that must hop off the caller's actor); verify the exact flag set against the Swift 6.4 release notes before standardizing.
* **Repositories and caches are actors** (or wrap GRDB's `DatabaseQueue/Pool`); DTOs are `Sendable` value types; no `@unchecked Sendable` without a documented reason.
* **Structured concurrency only**: `async let`, task groups, `.task {}` in views (cancelled with the view); no unmanaged `Task {}` in ViewModels without storing/cancelling the handle.
* **Typed throws / `Outcome<T, AppError>`**: errors are values across layers; always propagate `CancellationError` correctly.
* Low-end CPUs have 2–6 cores with 2 performance cores: cap concurrent work (`TaskGroup` with limits), avoid thousands of tiny tasks, use `AsyncStream` with buffering policies (`.bufferingNewest`) for high-rate sensor/realtime data.

### 4.3 Presentation: Observation + UDF

```swift
// <Slice>UI/LeadDetailViewModel.swift
@MainActor @Observable
final class LeadDetailViewModel {
    enum Status: Equatable { case loading, ready, empty, offline, notFound, policyBlocked
                             case forbidden(requiredPermission: String?), error(correlationID: String?) }
    private(set) var status: Status = .loading
    private(set) var lead: LeadUI?
    private(set) var canEdit = false
    private(set) var isMoving = false

    private let getLead: any GetLeadUseCase, moveStage: any MoveLeadStageUseCase, permissions: any PermissionsPort
    init(getLead: some GetLeadUseCase, moveStage: some MoveLeadStageUseCase, permissions: some PermissionsPort) { … }

    func onAppear(id: LeadID) async { … }                    // loads, maps Outcome → status
    func send(_ intent: Intent) { … }                         // .moveToStage(Stage), .retry — returns quickly, work in tracked tasks
}
```

* Views are **pure functions of state**: `struct LeadDetailView: View { @State var viewModel: LeadDetailViewModel … }`; no business logic or networking in views.
* Every screen renders the shared statuses (`loading | ready | empty | forbidden | not-found | offline | error | policy-blocked`), same as the other clients.
* ViewModels depend on use cases and ports (`NavigatorPort`, `NotifierPort`, `PermissionsPort`), never on `UIApplication`, `UIViewController` or concrete adapters.
* **SwiftUI performance rules (Low tier)**: small `body`s with extracted subviews; stable `id`s in `ForEach`; `List`/`LazyVStack` for long collections; avoid `AnyView` and deep `GeometryReader`
  nesting; read observable properties as late as possible (fine-grained tracking); no heavy work in `body`; precompute display models off the main actor; avoid per-frame `State` writes; use `Canvas`/`TimelineView`
  only with measured budgets; avoid `.blur`, large `.shadow`, stacked materials; profile with the SwiftUI and Time Profiler instruments.

### 4.4 Ports (examples)

```swift
public protocol LeadRepositoryPort: Sendable {
    func lead(id: LeadID) async -> Outcome<Lead>
    func list(_ query: LeadQuery) async -> Outcome<LeadPage>
    func updateStage(id: LeadID, to: Stage, expected: Version, key: IdempotencyKey) async -> Outcome<Lead>
}
public protocol PushPort: Sendable { func permission() async -> PermState; func requestPermission() async -> PermState
    func registerDevice() async -> Outcome<DeviceReg>; func unregisterDevice() async }
public protocol SecureStorePort: Sendable { func get(_ key: String) async throws -> Data?; func set(_ v: Data, for key: String) async throws; func remove(_ key: String) async throws }
public protocol LocationPort: Sendable { func updates(_ opts: LocOpts) -> AsyncStream<Fix>; func startBackground(_ o: BgLocOpts) async; func stopBackground() async }
public protocol DeviceCapabilityPort: Sendable { func tier() async -> DeviceTier; func capabilities() -> Capabilities; func thermal() -> AsyncStream<Thermal> }
public protocol SceneEnginePort { /* @MainActor where it touches views */ func load(_ spec: SceneSpec) async throws; func send(_ cmd: SceneCommand)
    var events: AsyncStream<SceneEvent> { get }; func setQuality(_ q: QualityProfile); func dispose() async }
public protocol RealtimePort: Sendable { func start(_ cfg: RtConfig); func stop(); func setTopics(_ t: Set<String>)
    var state: AsyncStream<RtState> { get }; var events: AsyncStream<RtEvent> { get } }
```

### 4.5 State, data, offline and outbox

| Concern | Choice |
|---|---|
| Server data | Repository + GRDB cache (projection), stale-while-revalidate, `ValueObservation` for reactive reads |
| Prefs/flags | `UserDefaults`/`@AppStorage` (non-sensitive), remote config |
| Secrets | Keychain (`AfterFirstUnlockThisDeviceOnly` or stricter) + optional Secure Enclave key (CryptoKit) |
| Feeds | Cursor pagination + diffable, bounded in-memory windows |
| Offline mutations | **Outbox** table + `BGProcessingTask`/foreground sync with `Idempotency-Key`, backoff, per-entity ordering |
| Conflicts | Typed results (`409`/version) surfaced to the ViewModel |
| Migrations | GRDB code migrations (versioned, forward-only) tested from every released schema |

The local DB is a **projection**; the backend is the authority.

---

## 5. Project layout, build system and variants

```text
ios/
├── Tuist/ or project.yml            # text project manifest (Tuist Project.swift / XcodeGen) — the .xcodeproj is generated, git-ignored
├── Config/                          # Base.xcconfig, Debug/Staging/Release.xcconfig, Game|Market|Avatar.xcconfig, *.entitlements
├── Apps/
│   ├── Game/   Sources/ GameApp.swift  AppEnvironment+Game.swift   Resources/ PrivacyInfo.xcprivacy
│   ├── Market/ …
│   └── Avatar/ …
├── Packages/
│   ├── Core/{Kernel,Contracts,SDK,DesignSystem,UICore,Device,Telemetry,Security,Scene,SceneRealityKit,SceneMetal,SceneGodot,SceneUnity,Testing}
│   ├── Shell/{Identity,Notifications,Devices,Consent,Settings}/       # each: Domain, Data, UI, Contracts targets
│   └── Features/{Game,Market,Avatar}/<Slice>/…
├── Extensions/                      # NotificationService (code-only), NotificationContent (optional), Widgets/LiveActivities (optional), BackgroundAssets
├── Scripts/                         # ci, tdd runner, architecture checks, asset validation
└── tests/<slice>/ios/{e2e,contract,perf,security,a11y}/   tests/_platform/{architecture,device-perf,push,auth,store-readiness}/
docs/{adr,support-matrix.md,dependency-register.md,permissions-register.md,device-pool.md,runbooks/}
```

**Tests placement ADR:** unit/ViewModel/snapshot tests live next to their package (`Tests/` in each SwiftPM package, runnable with `swift test`/`xcodebuild test`); cross-cutting suites
(e2e, contract, device performance, security, accessibility audits, architecture) live under `tests/…/ios/` to match `PLAYBOOK_TESTS.md`.

### 5.1 Build rules

* **Text manifests** define targets, schemes, test plans, entitlements, Info keys and capabilities; **`.xcconfig`** holds build settings; regenerate the project in CI and locally (`tuist generate`/`xcodegen`).
* **Swift 6 language mode** in every package (`// swift-tools-version: 6.x`), with upcoming features enabled deliberately (for example `ExistentialAny`, `InternalImportsByDefault`) via `swiftSettings`.
* **Package resolution**: pinned versions, committed `Package.resolved`, release-age cooldown for new versions (Renovate/Dependabot), `swift package` dependency scanning (OSV) in CI.
* **Per-variant** entitlements, `Info` keys, background modes and usage strings only in that variant's manifest; CI diffs the merged Info/entitlements against the permissions register.
* **Compiler/linker settings**: whole-module optimization in Release, `-Osize` vs `-O` decided by measurement, dead-strip, strip symbols with dSYMs archived, bitcode not applicable, explicit-module builds as supported by the toolchain.
* **Xcode versions**: pin the Xcode version in CI; Xcode 27.x needs Apple silicon and macOS 26.6+; Xcode 26.6 is the last 26-series release if a runner can't move yet. `PreviewProvider` is deprecated in Xcode 27: use the `#Preview` macro everywhere.
* **Generated code** (OpenAPI client, asset/string symbols) is produced by plugins/scripts in CI and never hand-edited.
* **Per-variant size guard**: CI fails if the app slice size or the linked-framework list for a variant exceeds its allowlist.

---

## 6. Navigation, routes and deep links

* **NavigationStack** with value-typed routes (`enum Route: Hashable, Codable`) and a `Router` (`@Observable`, `@MainActor`) owning `NavigationPath`; one stack per tab; state restoration via `Codable` paths.
* The shared **route table** (JSON, same as other clients) is the source of truth; route builders and the `Route` enum are generated/verified against it with a **parity test**; no hand-written paths.

```text
/{userType}/{module}/{resource}[/{resourceId}[/{subresource}]]
/app/market/products/{productId}   /app/market/cart   /app/game/map   /app/game/encounters/{encounterId}
/app/avatar/sessions/{sessionId}   /app/notifications/preferences
Session-less: /onboarding  /login  /register  /forgot-password  /reset-password  /verify-email
```

* **Universal Links** (`https://<domain>/app/...`) with the `apple-app-site-association` file and Associated Domains entitlement per variant (also used for passkeys/`webcredentials` and AutoFill);
  avoid custom URL schemes except for development.
* A `DeepLinkParser` (allowlist of routes, validated params, size limits) feeds the router; a **synthetic back stack** is built from the route hierarchy; links received while signed out are queued and resumed after login/bootstrap.
* Guards (`RequireAuth`, `RequireUserType`, `RequirePermission`) only shape UX (redirect to `/login`, `/403`, allowed home); **the server authorizes every call**.
* Link and notification parameters are **untrusted**; never perform state-changing actions without UI confirmation.

---

## 7. Shared platform features: onboarding, login, registration, forgot password

Backend contract, UX rules and flows are **identical** to `PLAYBOOK_FRONTEND_MOBILE.md` §7 (endpoints under `/api/v1/public/auth/*`, device registration at `/api/v1/app/devices`, consent, account deletion,
uniform forgot-password responses, single-use reset tokens, session revocation after reset). iOS-specific implementation:

### 7.1 Onboarding

3–5 skippable SwiftUI screens driven by remote config with bundled fallback; value first, permissions later (primers at point of use); variant steps (Game: safety + age gate; Market: country/language/interests;
Avatar: avatar choice, voice consent, AI disclosure). Low tier: static images, no looping heavy animation, honor Reduce Motion, support Dynamic Type up to accessibility sizes.

### 7.2 Registration

Minimal fields; inline password-policy feedback; **AutoFill** (`textContentType(.username/.newPassword/.emailAddress)`, Strong Password suggestions); versioned consent capture; age gate where required (consider the Declared Age Range API for
age assurance where applicable **(verify availability and regional requirements)**); verification by **Universal Link** or OTP with `textContentType(.oneTimeCode)` (SMS AutoFill) or email code. Abuse controls: server rate limits, **App Attest** assertion (and DeviceCheck)
as a risk signal, challenge only on high risk.

### 7.3 Login

* **Sign in with Apple** (`SignInWithAppleButton` / `ASAuthorizationAppleIDProvider`) — required when other third-party social logins are offered unless an equivalent privacy-preserving option exists **(verify guideline 4.8)**.
* **Passkeys** via AuthenticationServices (`ASAuthorizationPlatformPublicKeyCredentialProvider`, sign-in and registration), with the backend's WebAuthn options endpoint; AutoFill-assisted passkey sign-in on the username field.
* **Enterprise/social SSO**: OIDC Authorization Code + PKCE through **`ASWebAuthenticationSession`** (no embedded WKWebView, no Google/Facebook SDK weight unless required).
* **MFA/step-up** for sensitive actions; **Face ID/Touch ID** via LocalAuthentication gating a Keychain item (`SecAccessControl` with `.biometryCurrentSet`/`.userPresence`) for app lock; biometrics never replace server authentication.
* Throttling is server-side; the client shows generic errors and `Retry-After`.

### 7.4 Session and token storage

* Access token in memory; **refresh token in the Keychain** (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, or `WhenUnlockedThisDeviceOnly` for stricter apps), non-synchronizable, with an app-specific access group only if extensions need it.
* Single-flight refresh (an actor), rotation with server-side reuse detection, immediate wipe on sign-out/suspension; Data Protection class `complete`/`completeUnlessOpen` for sensitive files.
* Multi-role users: active role switch resets caches/subscriptions; `{userType}` selects the experience only.

### 7.5 Forgot password and reset

Request screen with **uniform response** and cooldown → email with a **single-use short-lived Universal Link** (`https://<domain>/reset-password?token=…`) and/or a code → reset screen validates on submit → all sessions revoked → login. Handle cold start from the link, expired/used tokens, offline,
keyboard avoidance. Never log or persist the token.

### 7.6 Permission primers (iOS specifics)

| Permission | Mechanism | Notes |
|---|---|---|
| Notifications | `UNUserNotificationCenter.requestAuthorization` (alert/badge/sound; optional **provisional**) | Show a primer first; the system prompt appears once, afterwards deep-link to Settings |
| Location | `CLServiceSession`/`CLLocationManager` **When In Use** first; **Always** upgrade only when needed; Precise vs Approximate | `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` strings must be specific |
| Camera | `AVCaptureDevice`/ARKit | `NSCameraUsageDescription`; prefer `PhotosPicker` for images (no permission) |
| Microphone | `AVAudioApplication.requestRecordPermission` | `NSMicrophoneUsageDescription`; show an in-app live-mic cue |
| Speech recognition | `SFSpeechRecognizer`/`SpeechAnalyzer` authorization | Only if on-device STT is used |
| Face ID | `NSFaceIDUsageDescription` | For biometric lock |
| Tracking (ATT) | Only if you actually track across apps/sites | Otherwise omit |

Each denial has a degraded path (browse-only map, text chat, no AR).

### 7.7 Account lifecycle

In-app account deletion (initiate → re-authenticate → grace period → confirmation) required by the App Store **(verify guideline 5.1.1(v))**; server cascades to devices/push tokens, avatar assets, location history, caches; data export and consent management in settings;
terms/privacy version bumps trigger re-consent. Revoke Sign in with Apple tokens on deletion as required by Apple's REST API.

---

---

> Continues in [`PLAYBOOK_MOBILE_IOS_SWIFT_PART2.md`](PLAYBOOK_MOBILE_IOS_SWIFT_PART2.md).
