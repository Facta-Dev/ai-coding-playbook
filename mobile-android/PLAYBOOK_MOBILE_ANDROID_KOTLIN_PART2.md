---
id: MOBILE_ANDROID_KOTLIN_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [MOBILE_ANDROID_KOTLIN]
---

# PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART2 — Native Android playbook (Kotlin · Jetpack Compose · Game · Market · Avatar) (part 2)

> Part 2 of 3. Main entry: [`PLAYBOOK_MOBILE_ANDROID_KOTLIN.md`](PLAYBOOK_MOBILE_ANDROID_KOTLIN.md). Covers: 8. Push notifications (FCM, all variants) … 18. Build, release and operations.

## 8. Push notifications (FCM, all variants)

### 8.1 Architecture

```text
App (FirebaseMessagingService) ──token──► POST /api/v1/app/devices {platform:"android", token, provider:"fcm",
                                           appVariant, versionCode, locale, tz, notificationsEnabled, channelStates}
Backend `notifications` slice → provider adapter (FCM HTTP v1; OAuth2 service account) → delivery receipts / dead-token pruning
```

Same backend contract and payload as `PLAYBOOK_FRONTEND_MOBILE_PART2.md` §8.2 (`v`, `type`, `category`, `deepLink`, `correlationId`,
`collapseKey`, `ttl`, `priority`, minimal `data`). The legacy FCM endpoint is retired; use **FCM HTTP v1**.

### 8.2 Client implementation

* `FirebaseMessagingService`: `onNewToken` → enqueue token upload with **WorkManager** (retry/backoff, only if logged in);
  `onMessageReceived` → validate against the versioned schema, build a notification, return quickly (hand heavy work to WorkManager;
  you have only a short window).
* **Channels** (API 26+) per category: `transactional`, `account-security`, `game-events`, `social`, `avatar`, `promotions`
  (promotions **off until opted in**). Create channels at app start; changing importance later requires a new channel ID.
* **Permission**: on API 33+, request `POST_NOTIFICATIONS` at a contextual moment (first order, first catch, first avatar chat) after a primer;
  report permission and channel states to the server.
* **Tap handling**: `PendingIntent` to an **Activity directly** (Android 12+ forbids notification trampolines via services/receivers), with
  `FLAG_IMMUTABLE`; the Activity parses the `deepLink`, validates it against the route allowlist, builds a synthetic back stack, and routes
  after auth/bootstrap. **No state-changing action from the payload.**
* **Lock-screen privacy**: no PII in titles/bodies; `setPublicVersion` for sensitive content; details are fetched after the tap.
* **Rich content** (images, `MessagingStyle` for chat-like avatar sessions): images loaded with Coil under strict size/time budgets; skip on Low tier.
* **Token lifecycle**: register after login and on every app start; `onNewToken`; `deleteToken()` + server unregister on logout/account deletion;
  server prunes on `UNREGISTERED`.
* **Message types**: *notification* messages for user-visible alerts; *data* messages for sync hints only. High-priority data messages that don't result
  in a user-visible notification can be deprioritized by the system, so use priority sparingly.

### 8.3 Low-end and OEM realities

Aggressive OEM battery managers kill background work and delay messages. Keep payloads small, avoid depending on background execution, never request
battery-optimization exemptions (restricted by policy), offer a one-time in-app guide to the OEM's settings when delivery fails repeatedly, and always
**reconcile on foreground** via API/realtime. Test with Doze/standby (`dumpsys deviceidle`, standby buckets) and on the OEM devices in your pool.

### 8.4 Server-side

Device registry, preferences, templates/i18n, scheduling by timezone, rate limits and collapse, idempotent send jobs, delivery/open receipts, dead-token pruning,
audit trail for transactional/security notifications, per-category kill switch (`PLAYBOOK_BACKEND.md` batch layer with Redis/Dragonfly coordination).

---

## 9. Library selection (works on low- and mid-range devices)

### 9.1 Selection rules

1. **Prefer Jetpack/first-party libraries and Kotlin-first libraries with compile-time processing** (KSP, no runtime reflection).
2. **Every dependency passes a weight check** on the Low pool: APK size, method count, cold-start, memory, and maintenance health
   (releases, issues, bus factor, license). Record it in `docs/dependency-register.md`.
3. **No library without a fallback** if it is unmaintained or GMS-dependent (when you declare GMS-optional).
4. **Pin and verify** (version catalog, dependency verification, cooldown); keep AndroidX/Play services within supported `minSdk` rules.
5. **Native code only when needed**; every `.so` must be 16 KB-aligned and ABI-filtered per variant.
6. **No heavy UI kits**; Material 3 + your design system; avoid runtime-theming engines and image libs that decode on the main thread.

### 9.2 Curated stack

| Area | Library (default) | Low/mid-end notes | Alternatives / cautions |
|---|---|---|---|
| Language/runtime | Kotlin 2.x, coroutines, Flow | K2 compiler | — |
| UI | **Jetpack Compose (BOM 2026.08 = Compose 1.12)**, Material 3 | Baseline profiles + R8 full mode; strong skipping | Views only for engine surfaces |
| Navigation | **Navigation 3** | State you own; adaptive scenes | Nav2 (Navigation Compose) legacy |
| DI | **Hilt (KSP)** | Compile-time graph | Koin for KMP; Metro (compile-time) is an option **(verify maturity)** |
| Network | **OkHttp 5**, `okhttp-sse`, WebSocket; **kotlinx.serialization** | HTTP/2, small footprint, no reflection | Retrofit on top if desired; Cronet only for HTTP/3 needs |
| Images | **Coil 3** | Explicit `size`, memory/disk caches | Glide (more weight) |
| DB | **Room** (KSP) + **Paging 3** | WAL, schema export | Room 3 when stable **(verify)**; SQLDelight for KMP |
| Prefs | **DataStore** | Async, safe | Never SharedPreferences for secrets |
| Crypto | **Tink** + Android Keystore (StrongBox if present) | Small fixed key set | `androidx.security:security-crypto` is deprecated **(verify)** |
| Background | **WorkManager**, App Startup | Constraints, backoff | Foreground services only for policy-allowed cases |
| Auth | **Credential Manager**, **AppAuth-Android**, `androidx.browser` (Custom Tabs), `androidx.biometric`, Google Identity | System UI; passkeys | No embedded WebView login |
| Push | **Firebase Messaging** (+ FCM HTTP v1 server) | Channels, short handlers | UnifiedPush/HMS only if non-GMS support is required |
| Maps (Game) | **MapLibre Native Android** or **Mapbox Maps SDK** | Vector tiles, GL layers, tile cache | `maps-compose` for few markers only |
| Location | **Fused Location (Play services)** + AOSP `LocationManager` fallback; Geofencing API; Activity Recognition | Balanced power/accuracy; batching | Fused unavailable on non-GMS |
| Camera | **CameraX** (+ `ImageAnalysis`) | Disable analysis on Low | Google Code Scanner (`play-services-code-scanner`) avoids camera permission and APK weight for barcodes |
| ML on-device | **MediaPipe Tasks** (face/pose), **ML Kit**, TFLite via LiteRT, ONNX Runtime Mobile (VAD) | Mid/High only; quantized models | Server fallback |
| 3D (default) | **Filament** (Google, GLES3/Vulkan) directly or via **SceneView** (`io.github.sceneview`: Compose nodes, glTF, ARCore) | Native render thread; baked lighting; KTX2 | Verify SceneView version/maintenance and 16 KB alignment |
| 3D (engine) | **Godot** (Android library/export, Compatibility renderer for low-end), **Unity as a Library** (AR Foundation), **libGDX** (lightweight GLES) | Dynamic feature module; PAD for assets | Heavier engines never on Low path |
| AR | **ARCore** (+ Geospatial API: Terrain/Rooftop anchors, Streetscape) | Optional; needs API key + billing; capability-gated | Unity AR Foundation for heavy AR |
| Audio | `AudioRecord` + platform `NoiseSuppressor`/`AcousticEchoCanceler`, **AudioTrack** (low-latency), **Oboe** (C++) if needed, **Media3** for media | Communication mode + audio focus | — |
| Realtime voice | **LiveKit Android SDK** or `libwebrtc` wrappers **(verify maintenance)** | Opus, echo cancel | WebSocket streaming fallback |
| STT/TTS | Cloud streaming; Android `SpeechRecognizer` (on-device mode where available); `TextToSpeech` fallback | On-device heavy on Low | Lip-sync needs timing data (section 12) |
| Payments | **Stripe Android SDK**, **Google Pay**; **Play Billing Library** (current major) | PCI scope minimized | RevenueCat optional |
| Search | Backend (Algolia/Typesense/Meilisearch) | Debounce, cached suggestions | — |
| i18n | Android resources, per-app language (`LocaleManager`) | `localeConfig`, pseudo-locales | — |
| Observability | **Crashlytics** or **Sentry Android**, **JankStats**, `androidx.tracing`, `ApplicationExitInfo` | Sampling tuned for Low | Timber + redaction |
| Remote config | Firebase Remote Config / GrowthBook | Device-tier overrides | — |
| Testing | JUnit4/5, **Turbine**, **kotlinx-coroutines-test**, MockK/**fakes**, Compose UI test, Robolectric, **Roborazzi/Paparazzi** or Compose Preview Screenshot Testing, **Macrobenchmark**, **Maestro/UI Automator** | Real-device pool | Robolectric support for newest API levels lags **(verify)** |
| Quality | **Detekt (+ Compose rules)**, **ktlint/Spotless**, Android Lint, **Konsist**, LeakCanary (debug), StrictMode | CI gates | — |
| Asset tooling | **gltf-transform/gltfpack, toktx (KTX2)**, meshopt/Draco | CI-enforced budgets | — |

### 9.3 Avoid on low-end

WebView-hosted games/3D; image loading without target sizes; reflection-heavy serialization/DI at startup; many simultaneous animated layers,
blur/shadow stacks and full-screen alpha; per-frame allocation in Canvas/draw code; unbounded caches; large native engines on the Low path;
polling timers; `AsyncTask`/`Handler` soup instead of coroutines; kapt.

---

## 10. Variant A — Game (location-based 3D, Pokémon-GO-style)

Gameplay, server-authoritative design, anti-cheat, economy and compliance are **identical** to `PLAYBOOK_FRONTEND_MOBILE_PART2.md` §10 (server owns spawns, RNG,
outcomes, inventory; client sends intents; plausibility checks; Play Integrity as a signal; location privacy). Android-native specifics:

### 10.1 Slices

`map`, `spawns`, `encounters`, `catching`, `inventory`, `collection`, `events`, `social`, `shop`, `progression`, `safety`; permissions like
`game.encounters.create`, `game.inventory.read`; backend slice `game`.

### 10.2 Map and world

* **MapLibre/Mapbox GL layers** (symbol/circle/fill-extrusion fed by GeoJSON sources) for spawns, POIs and the player marker; no per-entity Views;
  offline tile cache for the player's area; cap zoom/pitch; disable 3D buildings and dense labels on Low; simplified style per tier.
* **Viewport queries + realtime events** (`GET /api/v1/app/game/map/nearby?bbox=…&cursor=…` + `game.spawn.created/expired`), snapshot + stream.
* Entities on the map are 2D sprites/billboards by default; 3D appears in the encounter screen and optionally on higher tiers.

### 10.3 Location, battery and background rules

| Mode | API | Notes |
|---|---|---|
| Foreground, high accuracy | Fused `LocationRequest` (priority high), adaptive interval by speed | Map open |
| Foreground, balanced | `PRIORITY_BALANCED_POWER_ACCURACY`, min distance | Walking |
| Geofences | Geofencing API (limited count), significant-change patterns | Cheapest; OS-driven |
| Background (optional) | **Foreground service with type `location`** (`FOREGROUND_SERVICE_LOCATION` permission) + `ACCESS_BACKGROUND_LOCATION` | Visible notification; Play declaration and review; offer foreground-only play by default |

Rules: batch uploads (deltas, not streams), pause when stationary or low battery, respect thermal/power-saver state, use Activity Recognition to detect
vehicle movement (safety warnings and anti-cheat signal), `Location.isMock` as a **signal only**, verify the battery impact on the Low pool each release.
Android 17 includes location-privacy changes: re-verify permission flows and background behavior on API 37 **(verify details)**.

### 10.4 3D encounter and AR

* **Tiers**: T0 sprite-sheet/turntable flipbook; T1 Filament low-poly with baked lighting at 30 fps; T2 Godot Compatibility for richer scenes; T3 Unity/ARCore
  for AR-heavy high-end (section 13).
* **Render surface**: `SurfaceView` (hardware overlay, lowest overhead) embedded in Compose (`AndroidView` / `AndroidExternalSurface`); avoid `TextureView` on Low;
  tie engine lifecycle to the Android lifecycle (pause on `ON_STOP`, release on dispose).
* **AR is optional and capability-gated**: declare `<uses-feature android:name="android.hardware.camera.ar" android:required="false"/>` and
  `<meta-data android:name="com.google.ar.core" android:value="optional"/>` so non-AR devices can still install; check `ArCoreApk.checkAvailability()` at runtime;
  **Geospatial API** needs `ACCESS_FINE_LOCATION`, an ARCore API key restricted to your package/signing certificate, and billing enabled on the Cloud project;
  fall back to the non-AR encounter when unavailable, thermal-limited or on Low tier.
* Throw/catch input → intent to the server; the engine renders; only events cross to the shell (`encounter.thrown`, `encounter.result`).
* **Game platform APIs**: Game Mode / Game State, ADPF performance hints, frame pacing; optional **Play Games Services** (achievements, leaderboards, cloud save) as a
  provider behind a port.

### 10.5 Assets and performance

Base APK + **Play Asset Delivery** packs (install-time for core, fast-follow/on-demand per region/creature set) with **texture compression format targeting**
(ASTC/ETC2 per device); prefetch on Wi-Fi; memory ceilings per tier enforced by the governor; unload encounter assets on exit; 20-minute soak on the Low pool (temperature,
battery, frame time, memory); realtime updates to the map batched at ≤ 10–20 Hz.

### 10.6 Compliance

Digital items through Play Billing with server-side purchase validation and idempotent grants; odds disclosure/regional rules for loot-box-style mechanics **(verify)**;
spending limits and parental controls for minors; moderation/reporting for any user-generated names or chat; safety reminders and speed warnings.

---

## 11. Variant B — Market (Amazon-style)

Slices, flows, server-authoritative pricing, idempotent checkout, search, reviews and compliance are **identical** to `PLAYBOOK_FRONTEND_MOBILE_PART2.md` §11. Android specifics:

* **Lists**: `LazyColumn`/`LazyVerticalGrid` with `key` + `contentType`, fixed aspect-ratio tiles, **Paging 3** (+ `RemoteMediator` with Room for offline-first feeds),
  prefetch distance tuned for Low devices; shimmer/skeleton placeholders; stable item state (`@Immutable`).
* **Images**: Coil 3 with the **exact display size** and CDN-resized WebP/AVIF variants, memory cache cap proportional to RAM class, disk cache quota; placeholders (blurhash/thumbhash).
* **Home rails**: server-driven *layout* using a typed set of native rail components (no arbitrary remote code).
* **Search**: debounced `Flow` (`debounce(250)`), cached suggestions/recents; **barcode** via Google code scanner (no camera permission, no bundled model), voice search optional.
* **Checkout**: server computes totals/taxes/shipping; **Stripe PaymentSheet** + Google Pay for physical goods; PCI scope minimized (no raw card data); `Idempotency-Key` on order creation;
  `FLAG_SECURE` on payment screens; **Play Billing** (current required major) for digital goods; address autofill.
* **Photos for reviews**: Photo Picker (no storage permission), compress/resize on-device, strip EXIF, upload via WorkManager.
* **Seller mode** (`/app/market/seller/…` or `{userType}=partner`): role-gated, listing creation with image pipeline, inventory, orders, payouts onboarding via the provider's hosted flow.
* **Performance**: avoid blur/large shadows on cards, flatten hierarchies, avoid nested scrollables, `Modifier` lambdas for animated reads, baseline profile covering home → search → product → cart → checkout journeys.
* **3D/AR product view**: off by default; lazy dynamic feature module with Filament + a 2D fallback, Mid/High only.

---

## 12. Variant C — Avatar (3D, voice and movement)

Slices (`avatars`, `sessions`, `voice`, `performance`, `tracking`, `wardrobe`, `safety`), avatar formats and sourcing (glTF/GLB + VRM 1.0, provider-agnostic, selfie data as sensitive),
performance-script contract, latency budgets, privacy and AI disclosure are **identical** to `PLAYBOOK_FRONTEND_MOBILE_PART2.md` §12. Android-native implementation:

### 12.1 Rendering

* **Filament** (directly or via SceneView) for the avatar viewer: glTF/GLB with meshopt/Draco, KTX2 textures; **VRM 1.0** support through an adapter that reads the glTF
  `VRMC_vrm` extension (humanoid bone map, expressions) and drives Filament **morph targets** (`RenderableManager` morph weights) and skeleton transforms. There is no first-party
  Android VRM runtime, so budget for this adapter or choose Godot with a VRM add-on **(verify)**.
* Low tier: **2D fallback** (pre-rendered sprite avatar with audio-driven mouth frames) or a very low-poly model; Mid: Filament at 30 fps cap; High: richer lighting/expressions.
* Pause rendering when off-screen/backgrounded; animation update stays on the engine side; Compose sends high-level commands.
* Budgets per tier as in `PLAYBOOK_FRONTEND_MOBILE.md` Appendix E (Low ≤ ~10k tris, ≤ 25 bones, 512 px textures, 10–15 morph targets).

### 12.2 Voice pipeline (Android specifics)

```text
Mic → AudioRecord (VOICE_COMMUNICATION source) + NoiseSuppressor/AcousticEchoCanceler/AGC (where present) + VAD
   → STT (cloud streaming | SpeechRecognizer on-device where available) → text → backend conversation service (LLM + safety)
   → performance script → TTS (cloud with viseme/alignment timestamps | TextToSpeech fallback) → AudioTrack (low-latency) + timeline
   → PerformancePlayer (audio clock is master) → SceneEngine (visemes, gestures, emotion)
```

* **Audio session management**: `MODE_IN_COMMUNICATION`, audio focus handling (calls, other apps), route changes (Bluetooth/wired/speaker) with
  `AudioManager` communication-device APIs on newer releases, `AudioTrack` with a low-latency performance mode, `Oboe` only if you need NDK-level latency.
* **Transport**: WebRTC (LiveKit or equivalent) for real-time audio; WebSocket streaming as the simpler fallback; adaptive bitrate; degrade to text chat.
* **Latency**: stream STT partials, LLM tokens and TTS chunks; barge-in (stop playback when the user speaks); measure end-to-end on the Low/Mid pool.
* **Foreground service type `microphone`** only if background voice is a real requirement; default is foreground-only conversation. Show an in-app/privacy-indicator-consistent live-mic cue.
* **Camera-driven movement (optional, Mid/High)**: CameraX `ImageAnalysis` (low resolution, 15–30 fps) → MediaPipe Face/Pose Landmarker → mapped to VRM expressions; disable on Low, on thermal/battery limits, and when
  the app is backgrounded; raw frames never leave the device (derived parameters only, with consent).
* **Lip-sync fallbacks** by quality/cost: TTS visemes → server phoneme alignment → on-device amplitude estimation (Low tier).
* **Privacy/AI**: AI disclosure, safety filters server-side, no recording by default, retention controls, no voice cloning without explicit revocable consent, selfie-to-avatar data deleted after generation.

### 12.3 Sessions and entitlements

Session lifecycle via `POST /api/v1/app/avatar/sessions`, server-enforced usage limits and entitlements (STT/TTS/LLM cost controls), reconnect/resume, push for scheduled sessions,
wardrobe items as digital goods via Play Billing with server-validated entitlements.

---

## 13. Scene engines, 3D assets and delivery

### 13.1 `SceneEnginePort` and tiers (same model as RN)

| Tier | Module | When |
|---|---|---|
| **T0** | `:core:scene:scene-2d` (Compose Canvas/`SurfaceView` sprites, flipbooks) | Low devices, safe mode, thermal emergency, unsupported GPU |
| **T1** | `:core:scene:scene-filament` (Filament / SceneView) | Mid 3D viewers, encounters, avatars |
| **T2** | `:core:scene:scene-godot` (Compatibility renderer for low-end GLES3; Mobile renderer on capable GPUs) | Game scenes needing physics/scripting |
| **T3** | `:core:scene:scene-unity` (AR Foundation) / ARCore via SceneView | AR-heavy, high tier only |

* Adapters implement the same commands/events; scenes are **data**, not shell logic. Fallback chain on init failure or repeated frame-time breach: step down a tier (persisted) and report.
* Engines run on **their own render thread**; the shell communicates by message passing (commands in, events out), never per-frame bridging.
* Engine modules are **dynamic feature modules** (on-demand) where possible; lazily loaded on scene entry, disposed on exit; a variant without 3D contains none of them.
* **WebView 3D / HTML5 games** are not allowed on the Low/Mid path.

### 13.2 Engine notes

* **Filament**: physically based, Vulkan and OpenGL ES backends, Kotlin/Java API, glTF loader (gltfio), morph targets, skinning; verify the chosen version's 16 KB alignment and size.
* **SceneView**: Compose-native nodes over Filament + ARCore (Stable on Android per its docs); pin versions and review maintenance; keep your own `SceneEnginePort` so it stays replaceable.
* **Godot**: embed as an Android library/fragment (verify the current embedding mechanism and export tooling); Compatibility renderer targets OpenGL ES 3 for low-end.
* **Unity as a Library**: single instance, large footprint; AR-first high tier only; isolate in a dynamic feature module.
* **libGDX**: very light GLES engine (Kotlin-friendly) if you want a lean 2D/low-poly game core on the Low tier.

### 13.3 Asset pipeline (CI-enforced) and delivery

1. DCC → glTF/GLB/VRM. 2. **gltf-transform/gltfpack**: simplification, **LOD chains**, meshopt/Draco, animation quantization, dedupe/prune.
3. **KTX2 (Basis)** → ETC2/ASTC per tier/resolution; mipmaps; atlasing. 4. **glTF-Validator + budget checks** (triangles, bones, materials, textures, draw calls) fail the build.
5. **Play Asset Delivery** packs: install-time (core), fast-follow, on-demand; **texture compression format targeting**; or your CDN with a signed manifest and hash verification.
6. Resumable downloads, Wi-Fi preference, disk quota + LRU eviction, integrity check, rollback to the previous pack.

### 13.4 Memory discipline

Texture memory dominates: GPU-compressed formats, tiered resolutions, shared materials, unload on exit, no duplicate CPU copies of models, respond to `onTrimMemory`, and keep the process below the
tier ceiling **and below the Android 17 RAM-based limit for the device class**.

---

## 14. Realtime, connectivity and background behavior

* Realtime follows `PLAYBOOK_DESKTOP_QT_PART2.md` §8 / `PLAYBOOK_FRONTEND_MOBILE_PART2.md` §14: `RealtimeMode = auto | websocket | sse | polling | off`, snapshot + stream, dedupe by event ID, resume tokens,
  resync after gaps, per-topic authorization server-side.
* **OkHttp provides first-party WebSocket and SSE** (`okhttp-sse` `EventSources`): use them with a dedicated client (read timeout longer than the server heartbeat, e.g., 45 s with a 15 s heartbeat);
  token in the `Authorization` header (never in the URL); conformance-test the SSE handling against the shared fixture suite.
* **Lifecycle**: connect while the app is in the foreground (`ProcessLifecycleOwner`), disconnect on background; observe connectivity with `ConnectivityManager.NetworkCallback`; backoff with jitter; push is the wake-up channel.
* **Background work**: WorkManager for deferrable work (outbox sync, uploads, asset prefetch) with constraints (unmetered, charging, battery-not-low); no exact alarms; foreground services only for policy-allowed
  cases with the correct **foreground-service type** and permission (e.g., `location` for Game background tracking), a visible notification, and a Play declaration.
* **Doze/App Standby**: design for no background execution by default; test with `dumpsys deviceidle` and standby buckets.
* **Network adaptation**: detect metered/slow connections (`NetworkCapabilities`), lower image quality, disable prefetch, defer large packs to Wi-Fi.
* Android 17: re-test local-network access, loopback restrictions and the new lock-free `MessageQueue` behavior (reflection-based hacks on it will break).

---

## 15. Security, privacy and Play compliance

### 15.1 Baseline (OWASP MASVS-style)

| Area | Controls |
|---|---|
| Storage | Secrets only via Keystore + Tink; `allowBackup=false`/`dataExtractionRules`; no secrets in DataStore/Room plaintext/logs; encrypt sensitive Room fields (SQLCipher or field-level AEAD) |
| Network | **Network Security Config**: no cleartext, no user-installed CAs in release (unless required), TLS 1.2+; optional `CertificatePinner` with backup pins, rotation plan and remote kill switch; for apps targeting API 37, Encrypted Client Hello is used by default (configure via `domainEncryption` when needed) |
| Auth | Section 7; rotation; biometric gate; step-up; session list/revoke |
| Components | `android:exported` explicit (default false), verified App Links, immutable `PendingIntent`s, no implicit URI-permission reliance (Android 18 stops implicit grants for share/capture intents; detect with StrictMode), permission-protected broadcasts |
| UI | `FLAG_SECURE` on payment/auth screens, `filterTouchesWhenObscured` against tapjacking, sensitive clipboard flag, hide content in recents where needed |
| Binary | R8 full mode (obfuscation is not security), no secrets/API keys in the APK (use build-time injection + key restrictions), debuggable off, signing keys in Play App Signing + KMS-held upload key |
| Platform trust | **Play Integrity API** (standard requests) as a server-evaluated risk signal; root signals advisory; never block solely on client checks |
| WebView | Avoid; if unavoidable: restrict origins, disable file access, `WebViewAssetLoader`, no JS bridges to untrusted content |
| Supply chain | Dependency verification, lockfiles, cooldown for new versions, SCA/SBOM (CycloneDX), signed CI artifacts, action pinning by SHA (`PLAYBOOK_SECURITY.md` §11) |
| Native engines | Review sources/licenses, scan binaries, keep versions current, 16 KB-aligned |

### 15.2 Android 17 checklist (verify against the current behavior-change pages)

* **App memory limits** based on total device RAM apply to all apps: baseline memory per variant, detect limiter kills via `ApplicationExitInfo`, and test with the `am memory-limiter` commands.
* **Keystore key cap** for apps targeting API 37 (small fixed key set).
* **SMS OTP protections** (including WebOTP-format messages): use SMS Retriever/User Consent, not SMS permissions.
* **ECH** for TLS on apps targeting 37; **cross-profile loopback** blocked; **local-network access** changes; **static final fields** immutable; **IME visibility after rotation** not restored automatically;
  **new lock-free MessageQueue** for apps targeting 37; stricter RemoteViews memory limits.
* Run the app on API 37 devices/emulators in CI before raising `targetSdk` to 37; until then hold at `targetSdk` 36 (Play's floor — compliant, not the target).

### 15.3 Privacy and Play policy

* Data minimization per variant; **location, microphone, camera, voice and face-derived data are sensitive**: explicit consent, purpose limitation, retention limits, deletion with the account, regional rules **(verify)**.
* Children/teens: age gate and age-appropriate defaults for Game/Avatar; Families policy where applicable; restrict chat, voice and purchases by age.
* **Play Data safety form** and **permission declarations** (background location, foreground-service types, photo/video access) generated from the permissions and dependency registers; keep in sync with SDK behavior.
* Analytics/telemetry: consent aware; no precise location or content; hashed IDs; retention limits.

### 15.4 Play policy checklist (verify each release)

| Topic | Requirement to confirm |
|---|---|
| Target API | New apps/updates target API 36 (or the current floor) |
| Native code | 16 KB page-size support (check the current enforcement date) |
| Billing | Play Billing Library at the currently required major |
| Account deletion | In-app path and web path declared |
| Permissions | Background location, foreground-service types, notifications justified; no unnecessary sensitive permissions |
| Data safety | Matches actual SDK/data behavior |
| UGC/AI | Reporting, blocking, moderation, AI disclosure |
| Content rating | Reflects chat, voice, purchases, location |
| Edge-to-edge/predictive back/large screens | Verified (orientation locks ignored on large screens at target 36) |
| Loot boxes | Odds disclosure/regional restrictions if applicable |

---

## 16. Observability

| Signal | Implementation |
|---|---|
| Crashes/ANRs | Crashlytics or Sentry (NDK crash handling for engines), R8 mapping + native symbols uploaded; tags: variant, tier, device class |
| Exit reasons | `ApplicationExitInfo` on next start (OOM, memory limiter, ANR, signal) → telemetry and tier adjustment |
| Performance | **Macrobenchmark** in CI; production **JankStats**, startup (`reportFullyDrawn`), screen TTI via `androidx.tracing`/custom markers, frame time p50/p95 in scenes, memory (PSS) samples, thermal/battery state, governor decisions |
| Vitals | Play Console/Developer Reporting API alerts for crash/ANR/jank/wakelock/startup per device model |
| Network | Latency/error rates per endpoint and network type; realtime state transitions and lag; asset pack download success |
| Product | Onboarding → registration → verification funnel; checkout; encounter; session start; push opt-in/open rates |
| Tracing | `X-Correlation-Id` per user action, propagated via SDK/realtime/push payloads, shown on error screens |
| Diagnostics bundle | User-initiated, redacted: variant/version/build, device tier and capabilities, engine/renderer, governor history, permissions and channel states, push status, recent logs/errors with correlation IDs |
| Privacy | Consent-aware sampling, redaction filters, no PII/precise location in logs |

---

## 17. Testing strategy

Follows `PLAYBOOK_TESTS.md`; adds an `android` side (placement ADR in section 5):

| Level | Scope | Tooling |
|---|---|---|
| Unit | Domain use cases, ViewModels, mappers with fakes | JUnit, Turbine, coroutines-test, MockK/fakes (`src/test`) |
| Architecture | Module graph and layering rules | Konsist, Gradle dependency checks |
| Contract | SDK vs OpenAPI, notification payload schema, performance-script schema, route table parity, permission catalog | schema tests, MockWebServer |
| Compose UI | Screens per status; semantics/accessibility | Compose test rules, Robolectric |
| Screenshot | Layouts per font scale/dark mode/locale/RTL/large screen | Roborazzi/Paparazzi/Compose Preview Screenshot Testing |
| Integration | Repository + Room + outbox + WorkManager (test driver), push handling, realtime transports conformance | AndroidX test, WorkManager testing, MockWebServer |
| **E2E** | Onboarding → register → verify → login → forgot → reset; permission denial paths; push tap deep links; market checkout; game encounter (mock location); avatar session (mock audio/script) | Maestro / UI Automator / Espresso on emulators **and** real devices |
| **Device performance** | Cold/warm startup, scroll jank, scene frame time/memory/thermal on the Low/Mid pool | **Macrobenchmark**, Perfetto, JankStats, custom scene harness |
| Baseline profile | Generation and verification per variant | Baseline Profile Gradle plugin on real devices |
| Memory/limits | Memory ceilings, leak checks, memory-limiter behavior | LeakCanary, `am memory-limiter`, heap profiling |
| Location/anti-cheat | Mock routes (walk/drive/teleport), poor GPS, permission changes | Emulator routes, test providers |
| Audio/voice | Latency, barge-in, route changes, interruptions, lip-sync drift | Instrumented harness with recorded audio |
| Push | FCM test sender, token refresh, permission/channel states, Doze/standby, OEM devices, collapse/ttl | Device farm + `adb` |
| Accessibility | TalkBack flows, 200% font scale, contrast, touch targets, reduce motion | Accessibility Test Framework + manual |
| Security | MASTG-style checks, storage inspection, deep-link fuzzing, network config, secrets scan, dependency/SBOM scan | MobSF-class tools, custom |
| Compatibility | API 24 → 37, screen sizes/foldables/large screens, languages/RTL, offline/slow networks, 16 KB page-size emulator | Gradle Managed Devices, Firebase Test Lab |
| Upgrade | N-1 → N data/migration and token continuity | scripts |
| Store readiness | Manifest/permissions diff, 16 KB alignment, Data safety forms, listing assets, Play pre-launch report | CI scripts |

Rules: tests run on the **Low pool**, not only emulators; no production data; flaky tests quarantined with owner/expiry; every notification type and route has a contract/e2e test;
performance gates compare to the last release (e.g., +10% regression fails the build) and are stored as release evidence. **The contract tests cover every declared failure
mode**: each schema's *Validation Failure Modes* list — missing key, bad division, missing section, placeholder leak, CRLF, empty frontmatter, name/slug mismatch — has
a fixture and an assertion. A declared mode without a test is a gap, not a documentation line.

---

## 18. Build, release and operations

* **AAB** with Play App Signing; per-ABI/density/language splits; R8 full mode; baseline + startup profiles bundled; **dynamic feature modules** and **PAD** for heavy modules/assets.
* **Tracks**: internal → closed → open/production with **staged rollout** and halt; pre-launch report gating; Android vitals thresholds gate promotion.
* **In-app updates** (flexible/immediate) for forced upgrades via minimum-version config; **in-app review** at good moments.
* **Remote config** (data only, validated/signed): feature flags, device-tier overrides and blocklists, quality defaults, onboarding content, realtime mode, push categories, minimum version, emergency kill switches
  (AR, background location, voice, 3D, checkout provider).
* **Pipeline**: PR (typecheck/lint/Detekt/architecture/unit/Compose/contract, dependency+SBOM+secrets scan, size/permission diff, asset budgets) → main (variant builds, emulator e2e smoke, baseline-profile verify) → nightly (full e2e,
  device-farm run, Low-pool macrobenchmarks, soak, push suite) → RC (all + store-readiness, accessibility, security, evidence bundle) → staged rollout → post-release monitoring with rollback (halt rollout, remote kill switch, hotfix release).
* **Signing**: upload key in KMS/HSM with an isolated CI job and approval; never on developer machines.
* **Runbooks**: crash/ANR spike on a device model (blocklist + tier override), OEM push delivery failure, FCM credential expiry/outage, Play rejection/appeal, memory-limiter kill wave, engine regression, asset-pack corruption (rollback),
  payment provider incident, IdP outage, background-location policy review, privacy incident, avatar-provider loss, voice/LLM outage (degrade to text).

---


---

> Continues in [`PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART3.md`](PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART3.md).
