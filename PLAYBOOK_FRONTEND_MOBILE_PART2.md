---
id: FRONTEND_MOBILE_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [FRONTEND_MOBILE]
---

# PLAYBOOK_FRONTEND_MOBILE_PART2 — React Native mobile playbook (Game · Market · Avatar) (part 2)

> Part 2 of 3. Main entry: [`PLAYBOOK_FRONTEND_MOBILE.md`](PLAYBOOK_FRONTEND_MOBILE.md). Covers: 8. Push notifications (all three variants) … 14. Realtime, connectivity and background behavior.

## 8. Push notifications (all three variants)

### 8.1 Architecture

```text
App (expo-notifications) ──permission──► OS
   │ device token (FCM on Android, APNs on iOS via FCM or direct)
   ▼
POST /api/v1/app/devices {platform, token, provider, appVariant, appVersion, locale, tz, prefs}
   ▼
Backend `notifications` slice: device registry, preferences, templates, scheduler,
   dedupe/collapse, rate limits → provider adapters (FCM HTTP v1, APNs) → delivery receipts
```

Decisions:

* **Client library:** `expo-notifications` (permissions, channels/categories, listeners,
  scheduling, native device token via `getDevicePushTokenAsync`). Bare projects may use
  `@react-native-firebase/messaging` with a display library (Notifee, or a maintained fork;
  **verify maintenance**) for advanced Android UI.
* **Provider:** your backend sends through **FCM HTTP v1** (the legacy FCM endpoint was
  retired in 2024) and APNs; store the provider with each token because Expo push tokens and
  native tokens are different types. Using the Expo Push Service is acceptable for speed but adds
  a processor to your data map; document the choice.
* **Remote push needs a development build**: Expo Go cannot receive remote push on Android since
  SDK 53.
* **Android 13+ requires the `POST_NOTIFICATIONS` runtime permission**; without it notifications silently
  never appear.

### 8.2 Notification contract

```json
{
  "v": 1,
  "type": "market.order.shipped",
  "category": "transactional",
  "deepLink": "app://app/market/orders/ord_123",
  "correlationId": "…",
  "collapseKey": "order:ord_123",
  "ttl": 86400,
  "priority": "high",
  "title": "…", "body": "…",
  "data": { "orderId": "ord_123" }
}
```

Rules:

* **Minimal, non-sensitive payloads** (lock screens are public): no PII, no tokens, no full
  addresses or message bodies; the app **fetches details after the tap**.
* `deepLink` follows the route table and is validated against an allowlist before navigation.
* Versioned types; unknown types are ignored safely and counted.
* **Data-only (silent) messages** are for sync hints, not reliable delivery; the OS and OEM battery
  managers may delay or drop them. Notification messages are used for user-visible alerts.
* `collapseKey`/`tag` to replace stale alerts; `ttl` per type (a "price drop" expires; an "order
  shipped" persists longer).

### 8.3 Categories and channels

| Category (Android channel / iOS category) | Examples | Default |
|---|---|---|
| `transactional` | Order status, payment issues, security alerts, password reset notices | On, high importance |
| `account-security` | New login, password changed | On, cannot be disabled |
| `game-events` | Nearby spawns, raids, event start | On (user-tunable), default importance |
| `social` | Friend requests, trades, mentions | On |
| `avatar` | Avatar session invites, scheduled sessions | On |
| `promotions` | Offers, price drops | **Off until opted in** |

Channels are created on first launch (Android 8+); users manage them in-app (preferences stored
server-side) and in OS settings; quiet hours and per-category toggles are supported.

### 8.4 Token lifecycle

* Register **after login** (not before), on every app start (to detect refresh) and on token
  change events; send `appVariant`, version, locale, timezone, and capability info.
* **Unregister on logout** and on account deletion; the server also prunes tokens on provider errors
  (`UNREGISTERED`, `NotRegistered`) and by inactivity.
* One token per install; reinstall yields a new token; the server de-duplicates by device ID.
* Permission state changes (granted/denied/provisional) are reported so the server stops
  sending to denied devices.
* iOS: standard, **provisional** (quiet delivery) as an option for early-opt-in; critical alerts
  only with the special entitlement **(verify)**.

### 8.5 Handling states

| App state | Behavior |
|---|---|
| Foreground | Show an in-app banner/toast via `Notifier`, update badges/inbox; don't duplicate OS alerts unless configured |
| Background | OS displays; tap → deep link → route after auth |
| Killed/cold | Tap launches app; initial notification retrieved; queued until bootstrap/auth done |
| Signed out | Show generic alert content; after login, route to the target or fall back to home |

### 8.6 Low-end and OEM realities

* Aggressive OEM battery managers (common on low-end Android) can kill background work and delay
  messages: use **high-priority FCM only for time-sensitive** alerts, keep payloads small, avoid
  relying on background JS, and offer a one-time in-app guide to battery settings where delivery
  fails repeatedly.
* Never depend on push for correctness: the app **reconciles on foreground** and via realtime/polling.
* Foreground services are used only where policy-allowed (see Game background location).

### 8.7 Server-side requirements (backend spec)

Device registry per user/tenant; preferences; template and i18n rendering; scheduling with timezone; per-user
rate limits and collapse; idempotent send jobs; delivery/open receipts feeding analytics; dead-token pruning; audit trail for
transactional and security notifications; kill switch per category. Implements the `notifications` slice following
`PLAYBOOK_BACKEND.md` (batch layer with Redis/Dragonfly coordination and idempotency).

---

## 9. Library selection (works on low- and mid-range phones)

### 9.1 Selection rules

1. **Prefer Expo SDK modules and libraries that declare New Architecture support** (legacy is gone).
2. **Native over JS-bridge-heavy**: choose libraries whose work happens on native/GPU/background threads (e.g., Filament,
   FlashList, MMKV) rather than the JS thread.
3. **Every dependency passes a weight check** on the Low pool: app size delta, cold-start delta, memory delta, and
   maintenance health (recent releases, open critical issues, bus factor, license). Record it in
   `docs/dependency-register.md`.
4. **No library without a fallback or a replacement plan** if it is unmaintained.
5. **Avoid CSS-in-JS runtimes and heavy UI kits** on low-end; prefer StyleSheet + tokens or a compile-time styling tool
   (**verify** impact on your pool).
6. **Pin versions** with the SDK's compatibility set (`expo install`, `expo-doctor`); upgrade SDKs deliberately. Pin `react`
   and `react-native` **exactly** (no range): a newer `react` patch can fail `expo-doctor` against the SDK's compatibility set, so
   a floating range breaks the build on a patch bump nobody chose. Note: Expo
   SDK 56 had a Hermes V1 memory regression affecting apps using Reanimated/worklets, fixed in later patch releases (SDK 57.0.9 and
   newer): never run an unpatched SDK on the Low pool.

### 9.2 Curated stack

| Area | Library (default) | Low/mid-end notes | Alternatives / cautions |
|---|---|---|---|
| Runtime | **React Native 0.88 + Expo SDK 58**, Hermes V1 | New Architecture only; Hermes V1 default | Verify patch level for known regressions |
| Navigation | **Expo Router** | File-based, deep linking built in | React Navigation underneath; a plain app entry + the typed route table is enough for a small app (section 6) |
| Lists | **@shopify/flash-list v2** | Recycling and virtualization; New Arch | FlatList only for tiny lists |
| Images | **expo-image** | Disk/memory cache, blurhash, WebP/AVIF, downscaling | Avoid un-sized remote images |
| Animation | **react-native-reanimated 4 + worklets**, gesture-handler | Use sparingly on Low: few simultaneous worklets; verify memory on the pool | RN `Animated` with native driver for simple fades |
| 2D/particles | **@shopify/react-native-skia** | GPU 2D; budget memory | Pre-rendered sprites on Low |
| Server state | **@tanstack/react-query** | Dedupe/caching reduces network and renders | — |
| Client state | **zustand** | Selector subscriptions | Avoid large context trees/Redux where unneeded |
| KV storage | **react-native-mmkv** | Sync JSI, very fast | AsyncStorage is slower |
| Secrets | **expo-secure-store** | Keychain/Keystore | Check value size limits **(verify)** |
| DB | **expo-sqlite** (+ Drizzle optional) | WAL, bounded size | WatermelonDB for very large sync sets |
| Forms/validation | **react-hook-form + zod** | Low re-render form model | — |
| Networking | `fetch` via the SDK; `@react-native-community/netinfo` | Retry/backoff, abort | Avoid chatty polling |
| Auth | **expo-auth-session**, **expo-web-browser**, **expo-apple-authentication**, **@react-native-google-signin/google-signin**, **expo-local-authentication**, **expo-crypto**; passkeys via a maintained native module **(verify)** | System browser + PKCE | No embedded login WebViews |
| Push | **expo-notifications** (+ FCM HTTP v1 server) | Native tokens; channels | `@react-native-firebase/messaging` + Notifee/fork for bare/rich Android UI **(verify maintenance)** |
| Maps (Game) | **@maplibre/maplibre-react-native** or **@rnmapbox/maps** | Native vector tiles; entities as GL layers; cache tiles; cap pitch/3D buildings | `react-native-maps` struggles with many markers |
| Location | **expo-location + expo-task-manager** | Adaptive accuracy, geofencing, foreground service rules | Fused/significant-change modes to save battery |
| Camera | **react-native-vision-camera** (frame processors) / **expo-camera** | Disable processors on Low | — |
| On-device ML | **react-native-fast-tflite** (TFLite + GPU/NNAPI/CoreML delegates) **(verify)** | Only on Mid/High; fallback to server/none | Keep models small, quantized |
| 3D (RN-native) | **react-native-filament** (glTF/GLB, native render thread, Metal/Vulkan/GLES, Bullet physics) | Best RN-native option for viewers and light scenes; confirm maintenance and 16 KB page-size support **(verify)** | — |
| 3D (JS-driven) | `@react-three/fiber/native` + `expo-gl` | GL calls on the JS thread, no JIT in Hermes: only for very light scenes on Mid/High | Don't use for the Low tier or heavy animation |
| 3D (engine) | **Godot** via `@borndotcom/react-native-godot` (LibGodot, own thread; use the Compatibility renderer for low-end) ; **Unity** via `@azesmway/react-native-unity` (AR Foundation; heavy) | Embed only in Game/Avatar variants that need it; on-demand asset packs | Check maintenance, build tooling and 16 KB alignment **(verify)** |
| WebGPU | `react-native-wgpu` | Experimental; not for production low-end | Revisit yearly |
| Audio | **expo-audio** (replaces expo-av) | Low-latency playback/recording | `react-native-audio-api` for graph-style audio **(verify)** |
| Video | **expo-video** | Hardware decode | — |
| Realtime voice | **@livekit/react-native** (WebRTC) or `react-native-webrtc` | Echo cancellation, low latency | Cloud STT/TTS streaming over WebSocket |
| STT/TTS | Cloud streaming for quality; **whisper.rn** (small models) for offline on Mid/High **(verify)**; `expo-speech` as system fallback | On-device models are heavy for Low | Lip-sync needs timing data (section 12) |
| Payments | **@stripe/stripe-react-native** (PaymentSheet, Apple Pay, Google Pay) | PCI scope minimized | Digital goods: StoreKit/Play Billing via `react-native-iap` or RevenueCat |
| Search | Backend-driven (Algolia/Typesense/Meilisearch) | Thin client, debounce, cached suggestions | — |
| i18n | **i18next + expo-localization** | Lazy-load locales | — |
| Observability | **@sentry/react-native** or Crashlytics; `react-native-performance` | Sample rates tuned for Low | — |
| Flags/config | Remote config (Firebase RC, GrowthBook, Statsig) + backend config | Device-tier overrides | — |
| Testing | **Vitest** (or Jest) for the framework-free layers, **@testing-library/react-native** for views, `node --test` for contract evals, **Maestro** (or Detox), **Reassure**, **Flashlight**, MSW | Real-device farm | Below the view layer there is usually nothing to render: a node environment is enough (section 17.1) |
| Asset tooling | **gltf-transform / gltfpack, toktx (KTX2/Basis), meshopt/Draco** | Mandatory in CI for 3D assets | — |

**Pinned baseline.** Start from the set the reference kit locks and verified against
Expo SDK 58 (`frontend-mobile/package.json`, `frontend-mobile/app/package.json`,
`frontend-mobile/MEMORY.md`): Expo **~58.0.24**, React **19.3.0** (exact),
React Native **0.88.1** (exact), TypeScript **~6.0.3**, Vitest **~5.1.0**,
zod **^4.6.7**, Node **≥ 24**, pnpm **10.x**. Copy them verbatim; move one at a
time with `expo install` + `expo-doctor`, and re-measure the Low-pool budgets
(section 3.2) in the same pull request.

### 9.3 Libraries and patterns to avoid on low-end

* WebView-hosted games or 3D (Phaser/three in a WebView run several times slower on Android than on desktop).
* Large animated-gradient/blur stacks, many simultaneous Lottie loops, full-screen blur on lists.
* Rendering game entities or product tiles as hundreds of absolutely-positioned Views.
* JS-thread physics/animation loops; per-frame JSON bridging; polling timers at high frequency.
* Unbounded image caches, uncompressed textures, 4K assets.
* Heavy state libraries triggering app-wide re-renders; context values that change every frame.

---

## 10. Variant A — Game (location-based 3D, Pokémon-GO-style)

### 10.1 Slices (mirror backend slices)

`map`, `spawns`, `encounters`, `catching`, `inventory`, `collection`, `events`, `social` (friends, trades),
`shop` (digital), `progression`, `safety`. Backend slice `game` (and `notifications`, `identity`) owns the
rules; permissions like `game.encounters.create`, `game.inventory.read`.

### 10.2 Server-authoritative design

* **The server owns**: spawn generation, encounter outcomes, RNG, inventory/economy, event schedules, anti-cheat
  decisions. The client sends **intents** (`startEncounter`, `throwBall` with minimal inputs) and renders results.
* **Anti-cheat and integrity**: server-side plausibility (speed limits, teleport detection, impossible travel,
  spawn proximity), rate limits, signed encounter tokens, replay protection; device attestation (Play Integrity /
  App Attest **(verify)**) as a **risk signal**; mock-location detection on Android as a signal, not a sole
  verdict; progressive penalties and appeals.
* **Location privacy**: precise coordinates are sensitive personal data: send only what gameplay needs, coarsen
  or fuzz in social views, never expose other players' exact positions, limit retention, explain in the primer and
  privacy policy.

### 10.3 Map and world rendering

* Use **MapLibre/Mapbox GL layers** (symbol/circle/fill-extrusion from GeoJSON sources) for spawns, POIs and the
  player marker: thousands of features cost almost nothing, whereas RN Views over a map don't scale.
* Tile strategy: vector tiles with an offline cache for the player's area; cap zoom/pitch; disable 3D buildings and
  heavy labels on Low; style simplified per tier.
* The "player avatar" and creatures on the map are **2D sprites/billboards** by default; 3D only in the encounter
  screen and optional 3D map mode on higher tiers.
* **Spawn sync** via viewport queries (`GET /api/v1/app/game/map/nearby?bbox=…&cursor=…`) plus realtime events
  (`game.spawn.created/expired`), snapshot + stream like the desktop playbook §8.

### 10.4 Location and battery

| Mode | Use | Notes |
|---|---|---|
| Foreground, high accuracy | Map open | Adaptive interval by speed; reduce when stationary |
| Foreground, balanced | Walking | Distance filter (e.g., tens of meters) |
| Geofences / significant-change | Spawn alerts, passive tracking | Cheapest; OS-driven |
| Background (optional) | Only for features that need it (e.g., adventure sync/step tracking) | Android foreground service with persistent notification; iOS "Always" permission requires strong justification and review; offer foreground-only play by default |

Rules: batch uploads, send deltas not streams, pause when stationary/low battery, respect thermal and
power-saver states, and prove battery impact on the Low pool each release. Background location use must be justified
in store declarations and onboarding **(verify store policies)**.

### 10.5 Encounter screen (3D)

* Pipeline: server returns an encounter spec (creature ID, level, modifiers, tokens); the client loads the
  creature model for the current **tier** (LOD/texture pack), plays idle/attack animations, handles throw input
  (gesture → intent), shows result from the server.
* **Tiers:** Low: pre-rendered sprite-sheet or turntable of the 3D model (flipbook), parallax background, no AR; Mid:
  low-poly 3D via the Filament adapter with baked lighting, 30 fps cap; High: richer 3D, optional AR.
* **AR mode** is **optional and capability-gated**: requires ARCore/ARKit support and enough performance; fall back to
  the non-AR encounter with a still/camera-less background. Implement AR through the Unity adapter (AR Foundation) or
  a custom native module (ARKit/ARCore via the Expo Modules API); ViroReact-style libraries need a maintenance check
  **(verify)**.
* Throw/catch mechanics run in the engine/scene layer at the scene's frame rate; the RN shell only receives events
  (`encounter.thrown`, `encounter.result`).
* Safety: in-app reminders to be aware of surroundings, speed warnings when moving fast (driving), cooldowns,
  parental controls and age-appropriate defaults.

### 10.6 Economy, IAP and compliance

* Digital items via StoreKit/Play Billing; server validates receipts and grants entitlements; idempotent.
* If loot-box-style mechanics exist, disclose odds and respect regional restrictions **(verify)**; spending limits and
  parental controls for minors.
* Moderation and reporting for any user-generated names/chat.

### 10.7 Game realtime

WebSocket (or SSE) for nearby events, raids, trades; reconnect with backoff; resync after gaps; pause in background and
rely on push for time-critical alerts; never trust client time or position. Protocol envelope and state machine as in
`PLAYBOOK_DESKTOP_QT_PART2.md` §8 (adapted to mobile lifecycle: socket drops when the app is suspended).

### 10.8 Performance specifics (Game)

* GPU/engine work off the JS thread; entity updates batched at ≤ 10–20 Hz for the map; throttle JS→native bridges.
* Asset delivery: base app + **on-demand packs** per region/creature set (Play Asset Delivery / iOS On-Demand
  Resources or your own CDN with signed manifests); prefetch on Wi-Fi.
* Memory ceilings per tier enforced by the governor; unload encounter assets on exit.
* Test on the Low pool for sustained 20-minute sessions: temperature, battery, frame time, memory.

---

## 11. Variant B — Market (Amazon-style marketplace)

### 11.1 Slices

`catalog`, `search`, `product`, `cart`, `checkout`, `payments`, `orders`, `tracking`, `reviews`, `wishlist`, `promotions`,
`recommendations`, `account` (addresses, payment methods), `seller` (seller tools: listings, inventory, orders, payouts),
`support` (returns, disputes). Backend slices: `catalog`, `orders`, `payments`, `sellers`, … with permissions like
`market.cart.update`, `market.orders.read`, `market.listings.create`.

### 11.2 Screens and flows

Home (personalized rails) → Search (suggestions, recents, scan) → Results (facets, sort, infinite scroll) → Product detail (gallery, variants,
availability, delivery estimate, reviews, Q&A, seller info) → Cart → Checkout (address, shipping, payment, review) → Order confirmation →
Orders/tracking → Returns/support. Seller mode: dashboard, listings (create/edit with photos), orders, messaging, payouts.

### 11.3 Performance and low-end

* **FlashList v2** for results and rails with fixed-aspect tiles; image placeholders (blurhash), `expo-image` with
  CDN-resized variants (request the exact size/format, WebP/AVIF), disk cache with quota.
* **Server-driven UI sparingly**: home layouts from a typed server response (rails of known types) so layouts change
  without releases but stay native and validated; no arbitrary remote code.
* Paginate with cursors; prefetch the next page near the end; cancel stale requests; debounce search input (e.g., 200–300 ms);
  cache suggestions and facets.
* Avoid heavy shadows/blur on cards; flatten view hierarchies; keep list item components memoized and light.
* Product gallery: progressive loading, pinch-zoom with gesture-handler/native image zoom; **no 3D/AR product view by default**; if
  offered, lazy-load a GLB with strict budgets and the Filament adapter only on Mid/High, with a 2D fallback.
* Skeletons instead of spinners; optimistic cart updates with rollback.
* Cold start: render the cached home immediately, then refresh.

### 11.4 Cart, checkout and payments

* **Server-authoritative pricing**: the client shows prices but the server computes totals, taxes, shipping and promotions at
  checkout; cart items revalidated before payment; price/stock changes shown clearly.
* **Idempotent checkout**: `Idempotency-Key` on order creation; safe retries; no double charges.
* **Stripe PaymentSheet** with Apple Pay/Google Pay for physical goods; the app never touches raw card data (PCI scope minimized, SAQ A-class
  **(verify with your QSA)**); 3-D Secure/SCA handled by the SDK; payment intent created server-side.
* **Digital goods** (subscriptions, in-app items) use the store billing APIs; physical goods and services may use external payment
  **(verify current store rules)**.
* Address entry with validation/autocomplete (provider SDK) and saved addresses; **secure screens**: block screenshots on payment screens
  where appropriate (Android `FLAG_SECURE`, iOS privacy overlays).
* Fraud/risk: server-side scoring, device signals, velocity limits; step-up auth for high-risk orders.

### 11.5 Search

Backend search engine (typo tolerance, facets, synonyms, ranking, personalization) exposed through
`GET /api/v1/app/market/search?q=…&filters=…&cursor=…`; the client handles suggestions, recents, voice (optional) and barcode scan
(`expo-camera`/VisionCamera) → product lookup. Search analytics feed ranking (privacy-safe).

### 11.6 Reviews, wishlist, notifications

Verified-purchase reviews, photo uploads (compressed on-device before upload, EXIF stripped), moderation and abuse reporting;
wishlist with price-drop alerts (`promotions` category, opt-in); order-status and delivery push (`transactional`).

### 11.7 Seller tools (if in scope)

Role-gated experience (`/app/market/seller/...` or `{userType}=partner`), listing creation with image pipeline, inventory, order
management, payouts onboarding (KYC through the payment provider's hosted flow), messaging; all authorization server-side.

### 11.8 Compliance specifics

Consumer-protection rules (pricing display, returns, delivery promises), marketplace obligations (seller transparency, illegal-content
reporting) **(verify per market)**, tax display, accessibility, privacy (marketing consent), PCI via provider, review authenticity.

---

## 12. Variant C — Avatar (3D, voice and movement)

### 12.1 Slices

`avatars` (creation, selection, customization), `sessions` (conversation/performance sessions), `voice` (capture, STT, TTS), `performance`
(lip-sync, gestures, emotions), `tracking` (optional camera-driven motion), `wardrobe` (items), `safety`.
Backend slice `avatar` (assets, entitlements, sessions) plus an AI/conversation service behind it; permissions like
`avatar.sessions.create`, `avatar.avatars.update`.

### 12.2 Avatar formats and sourcing

* **Open formats**: glTF/GLB, **VRM 1.0** (humanoid rig, standardized expressions), meshopt/Draco compression, KTX2 textures.
* **Provider-agnostic**: `AvatarProviderPort` with adapters (in-house artist-made library, VRoid/VRM imports, selfie-to-avatar vendors such as
  MetaPerson/Avaturn). **Ready Player Me shut down on 31 January 2026**, so design for vendor loss: store exported GLB/VRM in your own storage,
  keep a manifest of source/licence, never depend on a vendor runtime at play time.
* **Selfie-to-avatar** (optional): treat the photo and derived face geometry as **biometric-adjacent sensitive data**: explicit consent, process
  on-device or via a vetted processor with a DPA, delete the raw photo after generation, short retention, no secondary use **(verify legal basis
  per region, e.g., GDPR/BIPA-style rules)**.
* **Budgets per tier** (starting points): Low ≤ ~10k triangles, ≤ 25 bones, 1 material, 512 px textures (KTX2/ETC2/ASTC); Mid ≤ ~25k tris, ≤ 60
  bones, 1024 px; High ≤ ~50k tris, 2048 px. Facial expressions via ≤ 15–20 morph targets (visemes + basic emotions) on Low/Mid.

### 12.3 Rendering

* **Primary renderer**: `react-native-filament` (native thread) for avatar viewing/conversation; **Godot** adapter when richer scenes are needed;
  **2D fallback** on the Low tier (pre-rendered video/sprite avatar with audio-driven mouth frames or a lightweight Skia-based 2D rig).
* One avatar, one light setup, baked/simple lighting, no real-time shadows on Low/Mid; render scale and 30 fps cap from the governor; pause rendering
  when the app is backgrounded or the avatar is off-screen.
* Keep the scene's animation update on the **native/engine side**; RN sends high-level commands.

### 12.4 Voice pipeline

```text
Mic → AudioPort (echo cancel, noise suppress, VAD) ─► STT (cloud streaming | on-device, per tier/privacy) ─► text
text ─► backend conversation service (LLM + safety) ─► "performance script"
performance script ─► TTS (cloud neural voice with timing data | system TTS fallback) ─► audio + timeline
audio + timeline ─► PerformancePlayer (audio clock is master) ─► SceneEngine (visemes, gestures, emotion)
```

* **Latency budget** (conversational feel): capture→first partial transcript ≲ 300–500 ms, response start ≲ 1.0–1.5 s;
  stream everything (STT partials, LLM tokens, TTS chunks); barge-in support (interrupt the avatar when the user speaks).
* **Transport**: WebRTC (LiveKit or equivalent) for real-time audio on good networks; WebSocket streaming as the simpler
  fallback; HTTP for non-realtime features. Adaptive bitrate; graceful degradation to text chat.
* **Audio session management**: handle route changes (Bluetooth/headphones/speaker), interruptions (calls), background audio policy, and
  permissions; mute indicator; push-to-talk option.
* **Privacy**: show when the mic is live, never record by default; transcripts/audio retention per policy with user controls; voice data is
  sensitive (voiceprints): no speaker identification/cloning without explicit, revocable consent.
* **AI disclosure and safety**: clearly label the avatar as AI where it converses; content-safety filters server-side; report/block tools; age-appropriate
  modes; transparency obligations for AI systems may apply (EU AI Act timelines, **verify**).

### 12.5 Performance script (the contract that drives movement)

The backend emits a typed, versioned script; the client **plays it, it doesn't improvise**:

```json
{
  "v": 1, "id": "perf_…", "text": "…", "audio": { "url": "…", "codec": "opus", "durationMs": 4200 },
  "visemes": [ { "t": 0, "v": "sil" }, { "t": 120, "v": "aa", "w": 0.8 } ],
  "emotions": [ { "t": 0, "name": "happy", "w": 0.6, "rampMs": 300 } ],
  "gestures": [ { "t": 800, "name": "wave", "hand": "right" } ],
  "gaze": [ { "t": 0, "target": "camera" } ]
}
```

* **Lip-sync sources** (by quality/cost): (a) cloud TTS with viseme/alignment timestamps (best); (b) server-side phoneme alignment; (c)
  on-device amplitude/spectral estimation (cheap, lower fidelity) as the Low-tier fallback.
* **Gestures/emotions** come from a **fixed animation vocabulary** (named clips retargeted to the VRM/humanoid rig, blended with
  cross-fades); LLM output is constrained to this vocabulary (no free-form motion data from untrusted sources).
* The **audio clock is the master timeline**: visemes/gestures are scheduled against audio playback position; drift is corrected, late events dropped.
* Idle behaviors (blink, breathing, micro-movements, gaze) run locally and cheaply.

### 12.6 Optional camera-driven movement

* Face/pose tracking (head pose, blendshapes) is **Mid/High only**, opt-in, with the camera preview hidden or minimized, using on-device ML
  (TFLite/MediaPipe-class models via VisionCamera frame processors **(verify packages)**) at a low frame rate (e.g., 15–30 fps), mapped to
  VRM expressions. Native ARKit face tracking (iOS) can be added through a custom native module; no equivalent universal Android API.
* On Low devices or when thermal/battery constraints apply, disable tracking and use script-driven + idle animation only.
* Raw camera frames never leave the device; only derived parameters may be sent, with consent.

### 12.7 Sessions and entitlements

Session lifecycle (`POST /api/v1/app/avatar/sessions`), usage limits and entitlements enforced server-side, cost controls for STT/TTS/LLM, reconnect
and resume, push for scheduled sessions, wardrobe items as digital goods (IAP) with server-validated entitlements.

---

## 13. Scene engines, 3D assets and the asset pipeline

### 13.1 `SceneEnginePort` and tiers

| Tier | Adapter | When |
|---|---|---|
| **T0** | `TwoDFallbackAdapter` (sprites, flipbooks, Skia/expo-image) | Low devices, crash-safe mode, thermal emergency, unsupported GPU |
| **T1** | `FilamentAdapter` (`react-native-filament`) | Mid-range 3D viewers/encounters/avatars, simple scenes |
| **T2** | `GodotAdapter` (Compatibility renderer for low-end, Mobile renderer on capable GPUs) | Game scenes needing a real engine/physics/scripting |
| **T3** | `UnityAdapter` (AR Foundation) | AR-heavy high-end experiences only |

* Adapters implement the same commands/events; scene content is **data** (scene specs/assets), not logic in the shell.
* **Fallback chain on failure**: engine init error or repeated frame-time breach → step down a tier (persisted) and report.
* Engines run on **their own render thread**; the RN shell and engine communicate by **message passing** (commands in, events out), never per-frame bridging.
* Engines are loaded **lazily** when a scene screen opens and **disposed** on exit; keep one engine instance alive only while needed.
* Each engine package is its own optional module so variants without 3D don't ship it.

### 13.2 Engine notes

* **react-native-filament**: native Filament (physically based, Metal on iOS, Vulkan/OpenGL ES on Android) with its own render threads and
  Bullet physics; loads GLB; good fit for avatar and light creature scenes. Verify maintenance cadence and 16 KB page-size alignment before committing.
* **react-three-fiber/native + expo-gl**: convenient for teams with three.js skills, but WebGL calls are issued from the JS thread and Hermes has no
  JIT, so per-frame JS is expensive on low/mid devices; use only for light, mostly static scenes and never as the Low-tier solution.
* **Godot embedding**: runs on a separate thread and can render into RN views; the **Compatibility** (OpenGL ES 3) renderer is the right target for
  low-end Android; engine footprint is smaller than Unity's; verify export tooling, build times and library maintenance.
* **Unity as a library**: strong AR and tooling; larger binary and memory cost; integrates as a view with message passing; reserve for
  AR-first, high-tier experiences and keep it out of the Low path.
* **WebView 3D/Phaser**: not allowed on the Low/Mid path (large slowdowns on Android WebViews).

### 13.3 Asset pipeline (CI-enforced)

1. Source art (DCC) → export glTF/GLB/VRM.
2. **gltf-transform/gltfpack**: mesh simplification and **LOD chains**, meshopt/Draco compression, animation quantization, dedupe, prune.
3. **Textures → KTX2 (Basis Universal)** transcoded to ETC2/ASTC (Android) and ASTC/BC (iOS) at tiered resolutions; atlas where possible; mipmaps.
4. Validate with **glTF-Validator** and **budget checks** (triangles, bones, materials, texture sizes, draw calls) per tier; fail the build on violations.
5. Package into **versioned asset packs** with content hashes and a **signed manifest**; host on CDN; clients verify hash/signature.
6. Delivery: base pack in app; **on-demand packs** (Play Asset Delivery / iOS On-Demand Resources or CDN) per tier and region; resumable downloads, Wi-Fi preference, disk quota and eviction (LRU), integrity check, rollback to the previous pack.

### 13.4 Memory discipline

Texture memory dominates: use GPU-compressed formats, cap resolutions by tier, share materials, unload scenes when leaving, avoid duplicating
models in RN-side memory, watch iOS memory warnings and Android `onTrimMemory`, and keep peak process memory under the tier ceiling (leave
headroom for the OS low-memory killer).

---

## 14. Realtime, connectivity and background behavior

* Realtime follows the optional-transport model of `PLAYBOOK_DESKTOP_QT_PART2.md` §8: `RealtimeMode = auto | websocket | sse | polling | off`,
  snapshot + stream, at-least-once with dedupe by event ID, resume tokens, resync after gaps, per-topic authorization server-side.
* **Mobile specifics**: sockets are suspended/killed in background → reconnect on foreground; use **push as the wake-up channel**; use
  `NetInfo` for reachability and switch Wi-Fi/cellular; backoff with jitter; battery-aware (pause when the screen is off unless a feature requires it).
* **Background tasks**: use OS-sanctioned mechanisms only (`expo-task-manager`, background fetch with its limits, foreground services where
  justified); no polling loops; design for **no background execution** as the default.
* **Network quality adaptation**: detect slow/metered connections, lower image quality and disable prefetch, defer large asset packs to Wi-Fi.

---


---

> Continues in [`PLAYBOOK_FRONTEND_MOBILE_PART3.md`](PLAYBOOK_FRONTEND_MOBILE_PART3.md).
