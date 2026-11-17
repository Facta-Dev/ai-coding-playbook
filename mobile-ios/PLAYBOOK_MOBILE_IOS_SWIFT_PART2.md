---
id: MOBILE_IOS_SWIFT_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [MOBILE_IOS_SWIFT]
---

# PLAYBOOK_MOBILE_IOS_SWIFT_PART2 — Native iOS playbook (Swift 6.x · SwiftUI in code · Game · Market · Avatar) (part 2)

> Part 2 of 3. Main entry: [`PLAYBOOK_MOBILE_IOS_SWIFT.md`](PLAYBOOK_MOBILE_IOS_SWIFT.md). Covers: 8. Push notifications (APNs, all variants) … 18. Build, release and operations.

## 8. Push notifications (APNs, all variants)

### 8.1 Architecture

```text
App (UIApplicationDelegateAdaptor) ──register──► APNs token ──► POST /api/v1/app/devices {platform:"ios", token, provider:"apns",
      environment:"sandbox|production", appVariant, build, locale, tz, authorization:"authorized|provisional|denied", categories}
Backend `notifications` slice → provider adapter (APNs HTTP/2, token-based .p8 auth) → delivery receipts / dead-token pruning
```

Same backend contract and payload semantics as `PLAYBOOK_FRONTEND_MOBILE_PART2.md` §8.2 (`v`, `type`, `category`, `deepLink`, `correlationId`, collapse, `ttl`, priority, minimal `data`), mapped to APNs headers:
`apns-push-type` (`alert`/`background`/`liveactivity`), `apns-priority`, `apns-expiration` (ttl), `apns-collapse-id` (collapse), `apns-topic` (bundle ID per variant), `thread-id` for grouping.

### 8.2 Client implementation

* **Registration**: after login and on every launch call `registerForRemoteNotifications()`; the token arrives in `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`; upload with an idempotent call (retry/backoff via a background task); send the **environment**
  (sandbox vs production tokens differ) and re-register on token change.
* **Authorization**: request at a contextual moment (first order, first catch, first avatar chat) after a primer; **provisional authorization** delivers quietly if you want an earlier soft opt-in; report authorization state to the server.
* **Categories/threads**: map payload `category` to `UNNotificationCategory` (actions are optional; keep them non-destructive); promotions remain **off until opted in** (server-side preference + category).
* **Interruption levels**: `passive`/`active` by default; **time-sensitive** only for genuinely urgent events (requires the capability); **critical alerts** only with Apple's special entitlement.
* **Tap handling**: `UNUserNotificationCenterDelegate.didReceive` → validate payload schema → parse `deepLink` against the route allowlist → build the synthetic back stack → route after auth/bootstrap. **No state-changing action from the payload.**
* **Foreground presentation**: `willPresent` decides banner/sound/none by category and current screen; no duplicate alerts for the visible conversation.
* **Lock-screen privacy**: no PII in `title/body`; use `UNNotificationContent.hiddenPreviewsBodyPlaceholder`/category hidden-preview settings; details are fetched after the tap.
* **Notification Service Extension (code-only)**: attach media (download with strict size/time limits) and optionally decrypt payloads; keep memory and time small (extensions run under tight limits); skip rich media on Low tier or poor networks.
* **Background (silent) pushes** (`content-available`): hints only, heavily throttled by the system; never rely on them for correctness. Use `BGAppRefreshTask`/`BGProcessingTask` for deferrable work.
* **Live Activities (optional)** for Market order tracking and Game events; updates via `liveactivity` push type; keep payloads small and respect update budgets **(verify limits)**.
* **Token lifecycle**: unregister on logout/account deletion; server prunes on APNs `410 Unregistered`/`BadDeviceToken`.

### 8.3 Reliability and low-end notes

APNs delivery is best-effort; Low Power Mode and Focus modes affect presentation/timing; never depend on push for state. **Reconcile on foreground** via API/realtime. Test: sandbox and production APNs, simulator payload injection
(`xcrun simctl push`), permission states (denied, provisional), Focus modes, app killed/background/foreground, and real devices on the Low pool.

### 8.4 Server-side

Device registry (per user/tenant/environment), preferences, templates/i18n, scheduling by timezone, rate limits/collapse, idempotent send jobs, delivery receipts, dead-token pruning, audit trail for transactional/security notifications, per-category kill switch
(`PLAYBOOK_BACKEND.md` batch layer with Redis/Dragonfly coordination). Provider adapters stay behind a port so APNs-direct and FCM can coexist across platforms.

---

## 9. Library selection (works on older and mid-range iPhones)

### 9.1 Selection rules

1. **Prefer Apple frameworks and first-party Swift packages** (URLSession, CryptoKit, AuthenticationServices, StoreKit 2, MetricKit, swift-openapi-generator, swift-async-algorithms, swift-collections).
2. **Every dependency passes a weight check** on the Low pool: binary size, launch time, memory, and maintenance health (releases, issues, bus factor, license, Swift 6/strict-concurrency readiness). Record it in `docs/dependency-register.md`.
3. **No binary XCFrameworks without review**: privacy manifest present, signed, reproducible provenance, App Store–compatible.
4. **Static linking and few dependencies**; prefer small, focused packages; no UI kits.
5. **Swift 6 readiness**: packages must compile in Swift 6 mode (or be isolated behind a wrapper) before adoption.
6. **Pin versions** (`Package.resolved`), cooldown for fresh releases, SCA/SBOM in CI.

### 9.2 Curated stack

| Area | Library (default) | Low/mid-end notes | Alternatives / cautions |
|---|---|---|---|
| Language/runtime | Swift 6.x, Observation, Swift Concurrency | Strict concurrency | — |
| UI | **SwiftUI** (+ UIKit in code where measured) | Fine-grained invalidation; avoid heavy effects | No Storyboards/XIBs |
| Navigation | `NavigationStack` + own `Router` | Codable paths | TCA only if the team commits to it |
| DI | Constructor injection + composition root | No reflection | `swift-dependencies` optional |
| Networking | **URLSession**, **swift-openapi-generator** (+ runtime, URLSession transport), `URLSessionWebSocketTask`, SSE parser (own) | HTTP/2/3, tiny footprint | Alamofire adds weight without need |
| Concurrency utils | **swift-async-algorithms** (debounce, throttle, merge), swift-collections | Search debounce, event coalescing | — |
| Images | **Nuke/NukeUI** + ImageIO downsampling | Memory/disk caches, decoding off-main | Kingfisher is comparable |
| DB | **GRDB** | WAL, observation, migrations in code | SwiftData for simple cases **(verify)**; Core Data editor excluded |
| Secrets/crypto | Keychain (thin wrapper), **CryptoKit**, Secure Enclave | Small, native | — |
| Auth | **AuthenticationServices** (passkeys, Sign in with Apple, `ASWebAuthenticationSession`), **LocalAuthentication** | System UI | No embedded WebView login |
| Push | **UserNotifications**, APNs (server), notification service extension | Direct APNs, no Firebase SDK on iOS | FCM for iOS only if you already run it server-side |
| Maps (Game) | **MapLibre Native iOS** or **Mapbox Maps SDK** | GL layers; tile cache; cap pitch/3D buildings | **MapKit for SwiftUI** for few annotations; clustering needs care |
| Location | **Core Location** (`CLLocationUpdate.liveUpdates`, `CLMonitor`, `CLBackgroundActivitySession`, `CLServiceSession`) | Adaptive accuracy, geofencing | — |
| Camera/vision | AVFoundation, **VisionKit `DataScannerViewController`**, Vision | Disable analysis on Low | — |
| AR | **ARKit + RealityKit** | Optional; capability-gated | Unity AR Foundation for heavy AR |
| 3D | **RealityKit** (ECS, `RealityView`), **Metal/MetalKit** (+ MetalFX where supported), embedded **Godot** (Compatibility renderer) / **Unity as a Library** | RealityKit preferred; SceneKit is soft-deprecated | Verify engine embedding/maintenance and size (Godot adds roughly tens of MB) |
| 2D fallback | **SpriteKit**, SwiftUI `Canvas` | Cheap on Low | — |
| Game services | **GameKit** (Game Center), **GameController** | Optional provider behind a port | — |
| Audio | **AVAudioEngine** (+ voice processing), **AVAudioSession**, AVFoundation | AEC/NS via voice processing; route/interruption handling | — |
| Speech | **Speech** framework (`SFSpeechRecognizer`; newer `SpeechAnalyzer`/`SpeechTranscriber` where available **(verify)**), cloud streaming for quality | On-device only on capable devices | `AVSpeechSynthesizer` fallback TTS |
| Realtime voice | **LiveKit Swift SDK** (WebRTC) **(verify maintenance)** | Opus, echo cancel | WebSocket streaming fallback |
| On-device ML | **Core ML**, Vision, SoundAnalysis (VAD/event models) | Neural Engine on A11+; Mid/High for heavy models | Server fallback |
| On-device LLM | **Foundation Models** framework | Only Apple Intelligence-capable devices; optional | Never required for core flows |
| Payments | **PassKit (Apple Pay)** + **Stripe iOS SDK**; **StoreKit 2** for digital goods | PCI scope minimized | RevenueCat optional |
| Search | Backend engine; `.searchable` with debounce | Cached suggestions | — |
| i18n | String Catalogs, `String(localized:)`, `Locale` | Pseudo-locales | — |
| Observability | **MetricKit**, `os.Logger` + signposts, **Sentry Cocoa** (or Crashlytics) | Sampling tuned for Low | — |
| Remote config | Backend config / GrowthBook | Tier overrides | — |
| Testing | **Swift Testing**, XCTest/XCUITest (incl. `performAccessibilityAudit`), **swift-snapshot-testing**, Maestro (optional) | Real-device pool | — |
| Quality | **SwiftLint**, **swift-format**/SwiftFormat, **Periphery** (dead code), Instruments | CI gates | — |
| Asset tooling | **gltf-transform/gltfpack**, `usdz` tools, `toktx`/KTX2 or ASTC textures | CI-enforced budgets | — |

### 9.3 Avoid on low-end

WKWebView-hosted games/3D; third-party UI kits and heavy animation libraries; many dynamic frameworks; reflection-heavy/runtime-parsing libraries on the launch path; unbounded image caches; `AsyncImage` for lists;
SceneKit for new work; large Lottie stacks; polling timers; synchronous disk/network on the main actor; Combine pipelines where `async`/Observation suffice (keep Combine only where a framework requires it).

---

## 10. Variant A — Game (location-based 3D, Pokémon-GO-style)

Gameplay, server-authoritative design, anti-cheat, economy and compliance are **identical** to `PLAYBOOK_FRONTEND_MOBILE_PART2.md` §10. iOS-native specifics:

### 10.1 Slices

`map`, `spawns`, `encounters`, `catching`, `inventory`, `collection`, `events`, `social`, `shop`, `progression`, `safety`; permissions like `game.encounters.create`, `game.inventory.read`; backend slice `game`.

### 10.2 Map and world

* **MapLibre/Mapbox GL layers** for spawns/POIs/player marker (symbol/circle/fill-extrusion fed by GeoJSON sources); no per-entity SwiftUI views over the map; offline tile cache; cap zoom/pitch; disable 3D buildings and dense labels on Low;
  simplified style per tier. MapKit annotations are acceptable only for small counts (use clustering).
* Viewport queries + realtime events (`GET /api/v1/app/game/map/nearby?bbox=…&cursor=…` + `game.spawn.created/expired`), snapshot + stream.
* Entities on the map are 2D sprites/billboards by default; 3D appears in the encounter screen and optionally on higher tiers.

### 10.3 Location, battery and background rules

| Mode | API | Notes |
|---|---|---|
| Foreground, high accuracy | `CLLocationUpdate.liveUpdates(.otherNavigation/.fitness)` with `CLServiceSession` | Map open; adaptive by speed |
| Foreground, balanced | Reduced accuracy/distance filter | Walking |
| Geofences | `CLMonitor` conditions (region limit applies) | Cheapest; OS-driven |
| Background (optional) | `UIBackgroundModes: location` + **`CLBackgroundActivitySession`** (shows the blue status indicator) + **Always** authorization | App Store review needs a clear justification; default to foreground-only play |

Rules: batch uploads (deltas, not streams), pause when stationary/low battery/thermal pressure, use `CLLocationSourceInformation.isSimulatedBySoftware` and accessory flags as **anti-cheat signals only**, detect vehicle movement via Core Motion activity for safety warnings,
prove battery impact on the Low pool each release.

### 10.4 3D encounter and AR

* **Tiers**: T0 SpriteKit/sprite flipbook; T1 RealityKit low-poly with baked lighting at 30 fps; T2 Metal custom renderer or embedded Godot (Compatibility renderer) for richer scenes; T3 Unity/ARKit for AR-heavy high-end (section 13).
* **RealityKit in code**: build `Entity` hierarchies and components programmatically inside a `RealityView` (iOS 18+); load USDZ assets via `Entity(named:)`/async loaders; **don't depend on Reality Composer Pro scene files** (D3).
* **AR is optional and capability-gated**: check `ARWorldTrackingConfiguration.isSupported`, device tier and thermal state; geo-anchoring (`ARGeoTrackingConfiguration`) works only in supported regions and needs location/GPS **(verify coverage)**, so the default AR is world-tracking with GPS-informed
  spawn placement and a **non-AR fallback** encounter.
* Throw/catch input → intent to the server; the engine renders; only events cross to the shell (`encounter.thrown`, `encounter.result`).
* **Game platform APIs**: Game Center via a port; Game Mode behavior for game-category apps **(verify)**; `GameController` for controllers; frame pacing with `CAMetalDisplayLink`.
* SceneKit is **not** used for new work (soft-deprecated since iOS 26; `SceneView` formally deprecated); existing SceneKit code follows Apple's migration sample to RealityKit.

### 10.5 Assets and performance

Base bundle + **Background Assets** (system-managed asset packs, Apple-hosted or self-hosted **(verify hosting limits)**) or On-Demand Resources for region/creature packs; compressed textures (ASTC) per tier; prefetch on Wi-Fi; memory ceilings enforced by the governor;
unload encounter assets on exit; 20-minute soak on the Low pool (temperature, battery, frame time, memory); map updates batched at ≤ 10–20 Hz.

### 10.6 Compliance

Digital items through StoreKit 2 with **server-side validation of signed transactions/App Store Server Notifications** and idempotent grants (`appAccountToken` links purchases to users); odds disclosure for loot-box-style mechanics (an App Store requirement) and regional rules **(verify)**;
spending limits and parental controls for minors; moderation/reporting for user-generated names/chat; safety reminders and speed warnings.

---

## 11. Variant B — Market (Amazon-style)

Slices, flows, server-authoritative pricing, idempotent checkout, search, reviews and compliance are **identical** to `PLAYBOOK_FRONTEND_MOBILE_PART2.md` §11. iOS specifics:

* **Lists**: `LazyVStack`/`LazyVGrid`/`List` with stable IDs and fixed-aspect tiles; cursor pagination with prefetch near the end; skeleton placeholders; item models precomputed off-main; if Instruments shows layout cost on very large feeds, host a code-only `UICollectionView` (compositional layout + diffable data source).
* **Images**: Nuke with exact display size and CDN-resized WebP/AVIF/HEIC variants; downsampling; memory cache cap proportional to RAM class; placeholders (blurhash/thumbhash).
* **Home rails**: server-driven *layout* of typed native rail components (no remote code).
* **Search**: `.searchable` + `AsyncAlgorithms` debounce (~250 ms), cached suggestions/recents; **barcode** via `DataScannerViewController` (VisionKit; A12+) or AVFoundation metadata output; voice search optional.
* **Checkout**: server computes totals/taxes/shipping; **Apple Pay** (`PayWithApplePayButton`/PassKit) and **Stripe PaymentSheet** for physical goods; PCI scope minimized; `Idempotency-Key` on order creation; hide sensitive content in the app switcher; **StoreKit 2** for digital goods.
* **Photos for reviews**: `PhotosPicker` (no library permission), compress/resize on-device, strip EXIF, upload via background `URLSession`.
* **Order tracking**: push + optional **Live Activities**; Wallet order tracking is optional **(verify requirements)**.
* **Seller mode** (`/app/market/seller/…` or `{userType}=partner`): role-gated, listing creation with the image pipeline, inventory, orders, payouts onboarding via the provider's hosted flow.
* **Performance**: avoid blur/large shadows on cards, flatten view hierarchies, avoid nested scroll views, profile journeys (home → search → product → cart → checkout) with Instruments and XCTest metrics.
* **3D/AR product view**: off by default; lazy-loaded RealityKit `RealityView`/AR Quick Look (system) with a 2D fallback, Mid/High only; AR Quick Look needs no custom engine code.

---

## 12. Variant C — Avatar (3D, voice and movement)

Slices (`avatars`, `sessions`, `voice`, `performance`, `tracking`, `wardrobe`, `safety`), avatar formats and sourcing (glTF/GLB + VRM 1.0 source assets; provider-agnostic; selfie data as sensitive), the performance-script contract, latency budgets, privacy and AI disclosure are **identical** to
`PLAYBOOK_FRONTEND_MOBILE_PART2.md` §12. iOS-native implementation:

### 12.1 Rendering

* **RealityKit** (`RealityView`) for the avatar viewer: ship avatars as **USDZ** (converted from GLB/VRM in the asset pipeline) with morph targets driven through RealityKit's blend-shape components (`BlendShapeWeightsComponent`, iOS 18) and skeletal animation **(verify API surface in your SDK)**;
  VRM expressions are mapped to blend shapes in an adapter, and the humanoid bone map is baked in the pipeline. There is no first-party VRM runtime on iOS, so the **asset pipeline** performs the conversion rather than runtime parsing.
* Low tier: **SpriteKit/2D fallback** (pre-rendered sprite avatar with audio-driven mouth frames) or a very low-poly model; Mid: RealityKit at 30 fps; High: richer lighting/expressions.
* Pause rendering when off-screen/backgrounded; animation updates stay in the engine; SwiftUI sends high-level commands.
* Budgets per tier as in `PLAYBOOK_FRONTEND_MOBILE.md` Appendix E (Low ≤ ~10k tris, ≤ 25 bones, 512 px textures, 10–15 blend shapes).

### 12.2 Voice pipeline (iOS specifics)

```text
Mic → AVAudioEngine input (voice processing: AEC/noise suppression) + VAD
   → STT (cloud streaming | Speech framework on-device where available) → text → backend conversation service (LLM + safety)
   → performance script → TTS (cloud with viseme/alignment timestamps | AVSpeechSynthesizer fallback) → AVAudioPlayerNode (low-latency) + timeline
   → PerformancePlayer (audio clock is master) → SceneEngine (visemes, gestures, emotion)
```

* **Audio session**: `AVAudioSession` category `.playAndRecord` with mode `.voiceChat` (or `.default` + voice processing on the engine), options for Bluetooth/speaker routing; handle **interruptions** (calls, Siri), **route changes**, and background audio only if the feature truly needs it (`UIBackgroundModes: audio`).
* **Transport**: WebRTC (LiveKit or equivalent) for real-time audio; WebSocket streaming as the simpler fallback; adaptive bitrate; degrade to text chat.
* **Latency**: stream STT partials, LLM tokens and TTS chunks; barge-in (stop playback when the user speaks); measure end-to-end on the Low/Mid pool.
* **Camera-driven movement (optional)**: **ARKit face tracking** (TrueDepth devices) provides ARKit blend-shape coefficients that map directly to avatar expressions; on non-TrueDepth devices use Vision face landmarks at low frame rates, Mid/High only; disable on Low, on thermal/Low Power Mode, and
  when backgrounded; raw frames never leave the device (derived parameters only, with consent).
* **Lip-sync fallbacks** by quality/cost: TTS visemes → server phoneme alignment → on-device amplitude estimation (Low tier).
* **Privacy/AI**: AI disclosure, server-side safety filters, no recording by default, retention controls, no voice cloning without explicit revocable consent (Personal Voice is a user-owned system feature, not a cloning pipeline for your app), selfie-to-avatar data deleted after generation.
* **On-device models** (Core ML VAD, small classifiers) only on Mid/High; **Foundation Models** (Apple Intelligence devices) may assist with local intent/gesture tagging but is never required.

### 12.3 Sessions and entitlements

Session lifecycle via `POST /api/v1/app/avatar/sessions`, server-enforced usage limits and entitlements (STT/TTS/LLM cost controls), reconnect/resume, push for scheduled sessions, wardrobe items as digital goods via StoreKit 2 with server-validated entitlements.

---

## 13. Scene engines, 3D assets and delivery

### 13.1 `SceneEnginePort` and tiers

| Tier | Package | When |
|---|---|---|
| **T0** | `SceneSprite` (SpriteKit/SwiftUI Canvas flipbooks) | Low devices, safe mode, thermal emergency, unsupported GPU family |
| **T1** | `SceneRealityKit` (`RealityView`, ECS built in code) | Mid 3D viewers, encounters, avatars |
| **T2** | `SceneMetal` (custom renderer, MetalFX where supported) or `SceneGodot` (Compatibility renderer) | Game scenes needing custom rendering/physics/scripting |
| **T3** | `SceneUnity` (AR Foundation) / ARKit via RealityKit | AR-heavy, high tier only |

* Adapters implement the same commands/events; scenes are **data** (scene specs/assets), not shell logic. Fallback chain on init failure or repeated frame-time breach: step down a tier (persisted) and report.
* Render surfaces are hosted through `RealityView`/`UIViewRepresentable` (`MTKView`); lifecycle tied to scene phase (pause on inactive/background, release on dismantle).
* Engine packages are separate optional targets; a variant without 3D contains none of them. **WKWebView 3D/HTML5 games are not allowed** on the Low/Mid path.

### 13.2 Engine notes

* **RealityKit**: Apple's forward path for 3D and AR (ECS, PBR, USD/USDZ, physics, animation); cross-platform API since iOS 18 (`RealityView`); build entities/systems/components in Swift. Apple publishes a sample showing how to port a SceneKit platformer to RealityKit.
* **Metal**: for custom rendering and maximum control (A-series GPU families, MetalFX upscaling on supported chips **(verify chip support)**); budget engineering time; keep a RealityKit path for the Mid tier.
* **Godot**: embeddable in iOS apps; the Compatibility renderer targets low-end; adds binary size (tens of MB) and build complexity **(verify embedding tooling and App Store review considerations)**.
* **Unity as a Library**: strong AR tooling, large footprint; AR-first high tier only.
* **SceneKit**: soft-deprecated since iOS 26 (critical fixes only); no new features or new projects.

### 13.3 Asset pipeline (CI-enforced) and delivery

1. DCC → glTF/GLB/VRM (source of truth) → **USDZ** conversion for RealityKit (and keep GLB for other engines). 2. **gltf-transform/gltfpack**: simplification, **LOD chains**, quantization, dedupe/prune.
3. Textures → **ASTC** (and KTX2 for cross-engine) at tiered resolutions with mipmaps. 4. **Validation + budget checks** (triangles, bones, materials, textures, draw calls, blend shapes) fail the build.
5. **Background Assets** packs (or On-Demand Resources / CDN with a signed manifest): install-time core, on-demand per region/creature set; resumable downloads, Wi-Fi preference, disk quota + LRU eviction, integrity check, rollback to the previous pack.

### 13.4 Memory discipline

Texture memory dominates: GPU-compressed formats, tiered resolutions, shared materials, unload on exit, no duplicate CPU copies, respond to memory warnings, keep the footprint below the tier ceiling **and below the jetsam limit for the device class** (read `os_proc_available_memory()` and refuse to load assets that don't fit).

---

## 14. Realtime, connectivity and background behavior

* Realtime follows `PLAYBOOK_DESKTOP_QT_PART2.md` §8 / `PLAYBOOK_FRONTEND_MOBILE_PART2.md` §14: `RealtimeMode = auto | websocket | sse | polling | off`, snapshot + stream, dedupe by event ID, resume tokens, resync after gaps, per-topic authorization server-side.
* **WebSocket**: `URLSessionWebSocketTask` with `Authorization` header, app-level heartbeat plus ping, message-size caps, schema-validated envelopes.
* **SSE**: stream with `URLSession.bytes(for:)` and parse the **raw byte stream** with a spec-compliant parser; **do not rely on `AsyncBytes.lines` for SSE** because it does not surface the blank lines that delimit events **(verify on your SDK)**. Request `Accept: text/event-stream`, `Last-Event-ID` on resume, a timeout longer than the server heartbeat,
  token in the header (never in the URL). Run the shared SSE conformance fixtures.
* **Lifecycle**: connect when the scene is active; suspend/disconnect on background; observe reachability with `NWPathMonitor`; backoff with jitter; **push is the wake-up channel**; reconcile on foreground.
* **Background work**: `BGAppRefreshTask`/`BGProcessingTask` for deferrable work (outbox sync, uploads, asset prefetch) and **background `URLSession`** for uploads/downloads that must survive suspension; no polling loops; design for **no background execution** by default.
* **Network adaptation**: `NWPath.isConstrained`/`isExpensive` (Low Data Mode, cellular) → lower image quality, disable prefetch, defer large packs to Wi-Fi.
* Handle Low Power Mode (`NSProcessInfoPowerStateDidChange`) and thermal changes in the governor.

---

## 15. Security, privacy and App Store compliance

### 15.1 Baseline (OWASP MASVS-style)

| Area | Controls |
|---|---|
| Storage | Keychain for secrets (device-only accessibility); Data Protection classes for files; no secrets in `UserDefaults`/GRDB plaintext/logs; encrypt sensitive DB fields (SQLCipher or CryptoKit AES-GCM with a Keychain/Secure Enclave–held key) |
| Network | **ATS** with no exceptions; TLS 1.2+; optional pinning via `NSPinnedDomains` (declarative, supports backup keys/rotation) or `URLSessionDelegate` public-key pinning with a kill switch and rotation plan |
| Auth | Section 7; refresh rotation; biometric gate; step-up; session list/revoke |
| Components | Verified Universal Links; avoid custom URL schemes; validate all inbound URLs/notification payloads; minimal App Groups/Keychain sharing; no unnecessary extensions |
| UI | Privacy overlay in the app switcher (`scenePhase`), `UIScreen.isCaptured` handling for sensitive screens, secure text entry, pasteboard minimization |
| Binary | Release builds stripped, no secrets/API keys in the bundle (inject via CI + restrict keys), debug flags off; obfuscation is not security |
| Platform trust | **App Attest** (+ DeviceCheck) assertions verified server-side as risk signals; jailbreak signals advisory; never block solely on client checks |
| WebView | Avoid `WKWebView`; if unavoidable: restrict origins, disable JS bridges to untrusted content, `limitsNavigationsToAppBoundDomains` where applicable |
| Supply chain | Pinned SwiftPM versions, cooldown for new versions, SCA/SBOM, signed CI artifacts, action pinning by SHA (`PLAYBOOK_SECURITY.md` §11); binary frameworks reviewed |
| Native engines | Review sources/licenses; scan binaries; privacy manifests for third-party SDKs |
| Memory safety | Swift's safety + strict concurrency; audit `unsafe` pointer use and C interop; fuzz parsers (SSE, deep links, manifests) |

### 15.2 Privacy

* Data minimization per variant; **location, microphone, camera, voice and face-derived data are sensitive**: explicit consent, purpose limitation, retention limits, deletion with the account, regional rules **(verify)**.
* **Privacy manifests** (`PrivacyInfo.xcprivacy`) for the app and every third-party SDK, including *required reason API* declarations; **App Privacy nutrition labels** kept in sync with actual SDK behavior; ATT only if you track.
* Children/teens: age gate and age-appropriate defaults for Game/Avatar; Kids Category rules if targeted; restrict chat/voice/purchases by age; consider the Declared Age Range API **(verify)**.
* Analytics/telemetry: consent-aware; no precise location or content; hashed IDs; retention limits.

### 15.3 App Store checklist (verify each release)

| Topic | Requirement to confirm |
|---|---|
| Toolchain | Built with Xcode 26+/iOS 26 SDK (current floor) and the newer SDK when Apple sets the deadline |
| Sign in with Apple | Offered when other third-party social logins exist (guideline 4.8) |
| Account deletion | In-app initiation (5.1.1(v)) and Sign in with Apple token revocation |
| Permissions | Specific usage strings; background location justification; `UIBackgroundModes` limited to what's used |
| Payments | Digital goods via StoreKit; physical goods via Apple Pay/Stripe; correct disclosures |
| UGC/AI | Reporting, blocking, moderation, AI disclosure |
| Privacy | Manifests and nutrition labels match reality; export compliance (`ITSAppUsesNonExemptEncryption`) |
| Age rating | Questionnaire reflects chat, voice, purchases, location |
| Loot boxes | Odds disclosure and regional restrictions if applicable |
| Push | Time-sensitive/critical entitlements only if justified |
| Review notes | Demo account, test instructions, location simulation steps for Game |

---

## 16. Observability

| Signal | Implementation |
|---|---|
| Crashes/hangs | Sentry Cocoa (or Crashlytics) + **MetricKit** diagnostics (`MXCrashDiagnostic`, `MXHangDiagnostic`, `MXCPUExceptionDiagnostic`); dSYMs uploaded in CI; tags: variant, tier, device class |
| Performance | **MetricKit** payloads (launch, hang rate, memory, battery, disk I/O), `os_signpost` intervals for startup phases/screens, frame-time p50/p95 in scenes, thermal/battery state, governor decisions; Xcode Organizer for field trends |
| Jetsam/memory | Previous-launch termination reasons from MetricKit; `os_proc_available_memory()` samples; lower the tier for device classes with repeated terminations |
| Network | Latency/error rates per endpoint and network type; realtime state transitions and lag; asset pack download success |
| Product | Onboarding → registration → verification funnel; checkout; encounter; session start; push opt-in/open rates |
| Tracing | `X-Correlation-Id` per user action, propagated via SDK/realtime/push payloads, shown on error screens |
| Diagnostics bundle | User-initiated, redacted: variant/version/build, device tier/capabilities, engine/renderer, governor history, permissions and notification authorization, push status, recent `OSLogStore` entries/errors with correlation IDs |
| Privacy | Consent-aware sampling, redaction (`Logger` privacy modifiers), no PII/precise location in logs |

---

## 17. Testing strategy

Follows `PLAYBOOK_TESTS.md`; adds an `ios` side (placement ADR in section 5):

| Level | Scope | Tooling |
|---|---|---|
| Unit | Domain use cases, ViewModels, mappers with fakes | **Swift Testing** (`@Test`, `#expect`, parameterized); `swift test` for Domain packages (also on Linux CI) |
| Architecture | Package/target graph and layering rules | dependency-graph script, SwiftLint custom rules |
| Contract | SDK vs OpenAPI (generator output + parity), push payload schema, performance-script schema, route table parity, permission catalog | schema tests, URLProtocol stubs |
| View/snapshot | Screens per status; Dynamic Type, dark mode, locale/RTL, Reduce Transparency | **swift-snapshot-testing**, `#Preview` as living examples |
| Integration | Repository + GRDB + outbox + background tasks, push handling, realtime transports conformance | Swift Testing + fakes |
| **UI/E2E** | Onboarding → register → verify → login → forgot → reset; permission denial paths; push-tap deep links; market checkout; game encounter (simulated location); avatar session (mock audio/script) | XCUITest (accessibility identifiers) / Maestro, on simulators **and** real devices |
| **Device performance** | Launch, scroll hitches, scene frame time/memory/thermal on the Low/Mid pool | **XCTest metrics** (`XCTApplicationLaunchMetric`, `XCTOSSignpostMetric`, `XCTMemoryMetric`, `XCTCPUMetric`), Instruments traces, custom scene harness |
| Memory/limits | Memory ceilings, leaks, jetsam behavior | Instruments (Leaks/Allocations), memory graph checks |
| Location/anti-cheat | GPX routes (walk/drive/teleport), poor GPS, permission changes | Simulator location, `simctl location`, test servers |
| Audio/voice | Latency, barge-in, route changes, interruptions, lip-sync drift | Instrumented harness with recorded audio |
| Push | Simulator payloads (`xcrun simctl push`), sandbox/production APNs on devices, authorization states, Focus/Low Power, collapse/ttl | device farm + test sender |
| Accessibility | VoiceOver flows, Dynamic Type XXXL/accessibility sizes, contrast, Reduce Motion/Transparency, touch targets | `performAccessibilityAudit()` + manual |
| Security | MASTG-style checks, Keychain/file inspection, URL-scheme/Universal Link fuzzing, ATS/pinning config, secrets scan, dependency/SBOM scan | MobSF-class tools, custom |
| Compatibility | iOS 18 → current, iPhone SE → Pro Max, iPad (if supported), languages/RTL, offline/slow networks | simulators + device farm |
| Upgrade | N-1 → N data/migration and Keychain/token continuity | scripts |
| Store readiness | Entitlements/Info/privacy-manifest diffs, App Store validation, TestFlight processing | CI scripts, `xcodebuild -exportArchive` validation |

Rules: tests run on the **Low pool**, not only simulators; no production data; flaky tests quarantined with owner/expiry; every notification type and route has a contract/e2e test; performance gates compare to the last release (e.g., +10% regression fails the build) and are stored as release evidence.

### 17.1 TDD loop with Claude Code (`PLAYBOOK_CLAUDE_CODE.md`)

The TDD runner dispatches by marker: a package directory with `Package.swift` → `swift test` in that directory (optionally `--filter <Pattern>` to narrow by test name); app/UI suites → `xcodebuild test -only-testing:…` with an `.xctestplan`; output piped through a formatter (xcbeautify/xcsift). Roles stay separate (test-writer edits `Tests/**`, implementer edits `Sources/**`).
Visual verification uses `#Preview` rendering in Xcode 26.3+ or simulator screenshots compared with snapshots; **views remain code**.

---

## 18. Build, release and operations

* **Code-defined CI** on Apple-silicon runners with a pinned Xcode, cached SwiftPM/derived data; steps: generate project → build variants → unit/snapshot tests → architecture/privacy/entitlement diffs → archive → validate → upload to TestFlight (App Store Connect API key), all in version control.
* **Signing**: App Store Connect API key + cloud-managed or fastlane-match style certificates; secrets in the CI secret store; no developer-machine signing for releases; entitlement changes reviewed by CODEOWNERS.
* **Release channels**: internal TestFlight (every merge to main) → external TestFlight (pilot) → App Store with **phased release** and pause; App Store Connect metrics + MetricKit gates promotion.
* **Remote config** (data only, validated/signed): feature flags, device-tier overrides and blocklists, quality defaults, onboarding content, realtime mode, push categories, minimum version (force-upgrade screen linking to the App Store), emergency kill switches (AR, background location, voice, 3D, checkout provider).
* **Pipeline**: PR (build, lint/format, architecture, unit/snapshot/contract, dependency/SBOM/secrets scan, size and entitlement diff, asset budgets) → main (variant builds, simulator UI smoke) → nightly (full UI/e2e, device-farm, Low-pool performance, soak, push suite) → RC (all + store-readiness, accessibility, security, evidence bundle) → phased release → monitoring and rollback (pause phased release, kill switch, expedited hotfix).
* **Runbooks**: crash/hang spike on a device class (blocklist + tier override), APNs credential expiry/outage, App Review rejection/appeal, jetsam wave (memory ceilings), engine regression, asset-pack corruption (rollback), payment provider incident, IdP outage, background-location review, privacy incident,
  avatar-provider loss, voice/LLM outage (degrade to text).

---


---

> Continues in [`PLAYBOOK_MOBILE_IOS_SWIFT_PART3.md`](PLAYBOOK_MOBILE_IOS_SWIFT_PART3.md).
