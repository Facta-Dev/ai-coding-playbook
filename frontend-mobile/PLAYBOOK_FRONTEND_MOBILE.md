---
id: FRONTEND_MOBILE
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [FRONTEND, URLS, SECURITY]
---


# PLAYBOOK_FRONTEND_MOBILE.md — React Native mobile playbook (Game · Market · Avatar)

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_FRONTEND_MOBILE.md`](PLAYBOOK_FRONTEND_MOBILE.md) | 1. Decisions up front (record each as an ADR) … 7. Shared platform features: onboarding, login, registration, forgot password |
| 2 | [`PLAYBOOK_FRONTEND_MOBILE_PART2.md`](PLAYBOOK_FRONTEND_MOBILE_PART2.md) | 8. Push notifications (all three variants) … 14. Realtime, connectivity and background behavior |
| 3 | [`PLAYBOOK_FRONTEND_MOBILE_PART3.md`](PLAYBOOK_FRONTEND_MOBILE_PART3.md) | 15. Security, privacy and store compliance … Appendix F — Support matrix template |

Architecture and engineering contract for a **React Native (TypeScript)** mobile
product family with **three app variants** built from one monorepo:

| Variant | What it is | Core capabilities |
|---|---|---|
| **Game** | Location-based 3D game in the style of Pokémon GO | Real-world map, spawns and encounters, 3D creatures, optional AR, catching, collection, events, social |
| **Market** | Marketplace in the style of Amazon | Catalog, search and filters, product pages, reviews, cart, checkout, orders and tracking, wishlist, seller tooling |
| **Avatar** | 3D avatar with voice and movement | 3D character, speech in/out, lip-sync, gestures/emotions, optional camera-driven motion, live conversation |

**All three** share: **onboarding, login, registration, forgot/reset password,
push notifications**, the same SDK, design system, security model and release
pipeline. And all three must run well on **low- and mid-range phones**, not only
flagships.

It extends `PLAYBOOK_FRONTEND.md` (MVVM + SDK), `PLAYBOOK_URLS.md` (route and
permission model), `PLAYBOOK_BACKEND.md` (slices, realtime, idempotency),
`PLAYBOOK_SECURITY.md`, `PLAYBOOK_TESTS.md`, `PLAYBOOK_AUDIT.md`,
`PLAYBOOK_CLAUDE_CODE.md`, and reuses patterns from `PLAYBOOK_CHROME_EXTENSION.md` and
`PLAYBOOK_DESKTOP_QT.md` (managed config, kill switch, diagnostics, realtime).

The runnable, machine-checkable companion is the **React Native skill pack**:
three Agent Skills (write, review, port) and a drop-in eslint config that
enforces this contract.

The rules that carry the whole file:

1. **The app shell is React Native; heavy 3D is a replaceable module.** The shell
   (auth, onboarding, market, settings, push) never depends on a specific 3D
   engine; scenes plug in behind a `SceneEngine` port with tiered adapters.
2. **Design for the floor, enhance upward.** Every feature has a low-end path.
   High-end devices get more fidelity, never different logic.
3. **Capability tiers, not device lists.** Detect and measure; degrade at
   runtime (quality governor) instead of crashing.
4. **One variant = one binary.** Each app ships only the native code, permissions
   and assets it needs (a market app must not carry a game engine).
5. **Shared TypeScript ViewModels and SDK** with web/extension; mobile adds ports.
6. **Authorization stays on the server.** `{userType}` and client permissions
   shape UX only.
7. **Server-authoritative for anything that matters** (game state, prices,
   payments, avatar entitlements); the client is untrusted.
8. **Push is a channel, not a data path.** Payloads are minimal; the app fetches
   truth after a tap.
9. **No vendor lock-in for irreplaceable assets** (avatars, models, user data):
   open formats and your own storage.
10. **Measure on real low-end devices in CI.** Performance claims without a
    device lab are opinions.

> Verification note: the React Native ecosystem moves fast. Status below is
> as of November 2026: React Native **0.88** shipped in October 2026, Expo
> **SDK 58** is current, the **New Architecture is the only architecture** (legacy
> removed from RN 0.82/0.84 and Expo SDK 55), and **Hermes V1 is the default
> engine since RN 0.84**. Items marked **(verify)** depend on exact versions,
> store policy dates or library maintenance and must be re-checked before
> adoption. Budgets are starting points to calibrate on your own device pool.

---
## 1. Decisions up front (record each as an ADR)

| # | Decision | Recommendation | Rationale / alternatives |
|---|---|---|---|
| D1 | Framework | **Expo (current SDK, e.g., 58) with Continuous Native Generation + development builds**; escape to bare only for unsupported native needs | New Architecture only, Hermes V1 default, EAS Build/Submit/Update, config plugins, Expo Modules API for custom native code |
| D2 | Language | TypeScript `strict` | Same as web/extension; shared ViewModels and SDK |
| D3 | Variants | **Three apps from one monorepo** via `APP_VARIANT` (`game`, `market`, `avatar`), separate bundle IDs and store listings; a combined "super app" is **not** recommended | Binary size, memory, permissions and review surface stay minimal per product (critical on low-end) |
| D4 | Navigation | **Expo Router** (file-based, deep links by default); a plain app entry is valid when the typed route table is small | Routes mirror `PLAYBOOK_URLS.md`; the typed route table stays the source of truth either way (section 6); verify the router's `root` option for placing the routes folder **(verify)** |
| D5 | Server state | TanStack Query + the shared SDK | Same contract as other clients |
| D6 | Client state | Zustand (selector-based) + MMKV for tiny persisted prefs; no heavy global stores | Fewer re-renders on slow CPUs |
| D7 | Lists | **FlashList v2** | Virtualization with recycling; New Architecture only |
| D8 | Images | **expo-image** (WebP/AVIF, blurhash/thumbhash, disk cache) | Memory-safe image handling |
| D9 | 2D graphics/particles | **@shopify/react-native-skia** (only where needed) | GPU 2D; costs memory, use sparingly |
| D10 | 3D rendering | **Tiered, behind a `SceneEngine` port** (section 13): 2D/pre-rendered fallback → **react-native-filament** (native, separate render thread) → embedded **Godot** (Compatibility renderer for low-end) → embedded **Unity** (AR-heavy, high tier only) | No single engine fits all tiers; R3F on `expo-gl` issues GL calls from the JS thread (see 13.2) |
| D11 | Maps (Game) | **MapLibre** (`@maplibre/maplibre-react-native`) or **Mapbox** (`@rnmapbox/maps`), GL layers for entities | Native vector tiles; never render hundreds of RN Views over a map |
| D12 | Push | **expo-notifications** with **native device tokens (FCM/APNs)** and your backend sending through **FCM HTTP v1** (iOS via APNs); Expo Push Service optional | Control, data residency and no extra processor; see section 8 |
| D13 | Auth | First-party email/password + social + optional passkeys through the `identity` slice; OIDC with PKCE in the system browser for SSO; tokens in the OS keystore | `PLAYBOOK_SECURITY.md` §4 |
| D14 | Payments | **Stripe SDK** (PaymentSheet, Apple Pay/Google Pay) for physical goods/services; **StoreKit/Play Billing** (via `react-native-iap` or RevenueCat) for digital goods | Store rules differ by good type **(verify)** |
| D15 | Avatars | Open formats: **glTF/GLB + VRM 1.0**, your own asset storage, provider behind an `AvatarProviderPort` | Ready Player Me shut down on 31 Jan 2026, and other avatar platforms have disappeared since: never depend on a single vendor |
| D16 | Observability | Sentry (or Crashlytics) + OpenTelemetry-style correlation IDs + `react-native-performance` markers | Section 16 |
| D17 | Release | EAS Build/Submit, EAS Update (OTA) for JS-only, staged store rollouts, remote config + kill switch | Section 18 |
| D18 | Min OS | Derive from Expo SDK/RN minimums and your fleet data; document in `docs/support-matrix.md` | Re-check each SDK upgrade |
| D19 | CPU ABIs | Android **arm64-v8a** primary, **armeabi-v7a** only if your fleet requires it; iOS arm64 | Smaller downloads; many low-end Android phones are still 32-bit userland **(verify with fleet data)** |
| D20 | Android page size | All native libs (engines, ML, audio) must support **16 KB page sizes** | Google Play requirement for apps targeting recent Android versions **(verify date)** |

---

## 2. The product family

### 2.1 Variant matrix

| Capability | Game | Market | Avatar |
|---|---|---|---|
| Shared core (auth, onboarding, push, settings, design system, SDK) | ✔ | ✔ | ✔ |
| Location | **Foreground + optional background** | Optional (store locator, delivery estimate), approximate | No |
| Camera | Optional (AR mode) | Optional (barcode scan, photo reviews, visual search) | Optional (face/pose tracking, avatar from selfie) |
| Microphone | Optional (voice chat, later) | Optional (voice search) | **Core** |
| 3D rendering | **Core** | Optional (3D/AR product view, off by default) | **Core** |
| Realtime (WebSocket/SSE) | **Core** (events, nearby) | Order status, price alerts | **Core** (conversation/performance) |
| Payments | In-app purchases (digital) | **Core** (Stripe, wallets) | Subscriptions/items (digital) |
| Offline | Cached map tiles/collection | Cart, wishlist, recent items | Cached avatar and last sessions |
| Heaviest native deps | Map SDK + engine (Godot/Unity/Filament) | Stripe, scanner | Engine (Filament/Godot) + audio/WebRTC |
| Target download (low-end) | Base ≤ ~100 MB + on-demand packs **(verify limits)** | ≤ ~35 MB | ≤ ~80 MB + on-demand packs |

### 2.2 What must be identical across all three

* Login, registration, forgot/reset password, onboarding (section 7).
* Push notification registration, permission flow, categories, deep-link routing (section 8).
* Session/token handling, secure storage, account deletion, consent, i18n, accessibility.
* SDK, error taxonomy, correlation IDs, telemetry, kill switch, remote config.
* Design tokens and base UI kit (variant themes on top).

### 2.2.1 What may differ

Feature packs (`feature-game`, `feature-market`, `feature-avatar`), native modules, permissions, store
metadata, theme, and onboarding copy.

---

## 3. Device classes, budgets and the quality governor

### 3.1 Device classes (calibrate with your analytics)

| Class | Typical profile | Examples of traits |
|---|---|---|
| **Low** | ≤ 3 GB RAM, little-core CPUs (Cortex-A53/A55 class), entry GPUs, eMMC storage, small screens, aggressive OEM battery killers; iPhones from the oldest supported generation | Android "Go"-type devices, 5–6-year-old phones |
| **Mid** | 4–6 GB RAM, mid-tier SoCs (e.g., Snapdragon 6/7-series, Dimensity 700/800-class, A-series from ~3–4 years ago), UFS storage | Bulk of the global market |
| **High** | ≥ 8 GB, flagship SoC | Optional extras only |

Keep a **device pool** (real phones, not just emulators): at least two Low, two Mid,
one High per OS, plus a cloud device farm for breadth.

### 3.2 Budgets (Low-class device, release build; starting points)

| Metric | Budget |
|---|---|
| Cold start to interactive (JS shell) | ≤ 3.5 s (Low), ≤ 2.5 s (Mid) |
| JS frame rate in lists and forms | 60 fps target; no sustained JS thread > 16 ms work; ≥ 30 fps worst case |
| Touch response | ≤ 100 ms |
| Shell memory (no 3D) | ≤ ~180 MB resident |
| 3D scene memory (total process) | Low ≤ ~300 MB, Mid ≤ ~450 MB (leave headroom for the OS low-memory killer) |
| 3D frame rate | Low: stable 30 fps (capped, resolution scale ≤ 0.75); Mid: 30–60 fps; High: 60 fps |
| App download size (per-ABI) | Market ≤ ~35 MB; Game/Avatar base ≤ ~100 MB with heavy assets in on-demand packs |
| Battery (Game, active map session) | Track %/hour on the Low pool; no degradation release over release |
| Network | Works on slow 3G; request count and payload budgets per screen |
| Memory growth over 30 min of play/browsing | ≈ 0 |
| Crash-free sessions | ≥ 99.5% (Low pool measured separately) |

Budgets are enforced by CI performance jobs on the device pool (section 17.4).

### 3.3 Capability detection (tier selection)

Inputs, combined into a **`DeviceTier`** (`low | mid | high`) plus **feature capabilities**:

| Signal | Source |
|---|---|
| Total RAM, low-RAM flag, OS/API level, ABI | `react-native-device-info` / `expo-device` / a small native module (`ActivityManager.isLowRamDevice`) **(verify APIs)** |
| GPU/renderer support, GLES/Vulkan/Metal level | Engine adapter probe at first launch |
| ARCore/ARKit availability | Native availability checks (many low-end Android phones lack ARCore) |
| Thermal state, low-power mode, battery | Native thermal APIs (Android thermal status, iOS thermal state), `expo-battery` |
| Memory pressure | iOS memory warnings, Android `onTrimMemory` via a small native module |
| **Measured performance** | First-run micro-benchmark (render N frames of a reference scene, record p95 frame time) stored and refreshed |
| Remote overrides | Remote config keyed by device model/OS (blocklist/forced tier) |

Rules: the initial tier is a **hint**; the **measured** result and the runtime
governor win. Persist the tier, re-evaluate after OS/app updates and on repeated
frame-drop events.

### 3.4 Quality governor (runtime)

A `QualityGovernor` (application layer) adjusts a `QualityProfile` live:

| Knob | Low → High |
|---|---|
| Render scale | 0.6–0.75 → 1.0 |
| Frame cap | 30 → 60 |
| Shadows / post-processing / reflections | off → on |
| Texture resolution (mip bias / pack) | 512 → 2048 |
| Mesh LOD and max visible entities | aggressive → generous |
| Particle count, animation fidelity | minimal → full |
| Map layers (3D buildings, labels density) | off/simple → rich |
| Camera tracking / AR | off → on |

Triggers to **step down**: rolling p95 frame time over budget, thermal state ≥
"serious", battery saver, memory warning, repeated JS frame drops. Step **up**
only after a sustained healthy period with hysteresis to avoid flapping. Users
see a "Performance mode" setting (Auto / Battery saver / High quality); managed
policy and remote config can force a profile.

---

## 4. Architecture: hexagonal + MVVM + SDK on mobile

### 4.1 Layers

```text
┌───────────────────────────────────── mobile app (one variant) ─────────────────────────────────────┐
│ INBOUND ADAPTERS                                      OUTBOUND ADAPTERS                          │
│ Views (RN) + ViewModel hooks · Push events · Deep links    SDK/HTTP · Realtime (WS/SSE) · SQLite/MMKV │
│ Location/sensor events · Timers/background tasks           Secure store · Push provider · Location   │
│ Realtime events                                            Camera/Audio · SceneEngine · Payments     │
│            │                                                      ▲                                │
│            ▼                                                      │                                │
│      APPLICATION (use cases, ports, policy, sync, quality governor) ─┘                              │
│            ▼                                                                                        │
│      DOMAIN (entities, value objects, rules, events)                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Contains | May import | Must not import |
|---|---|---|---|
| **domain** | Entities, value objects, rules (pure TS) | `shared-kernel` | `react`, `react-native`, Expo modules, SDK |
| **application** | Use cases, ports, governor, sync/outbox | domain, `contracts`, `core` | RN/Expo native modules, UI |
| **viewmodels** (shared with web/extension) | Presentation state and commands as hooks | application ports/types, SDK types, `react` (hooks) | `react-native`, `expo-*`, router, `window` |
| **adapters/out** | SDK, realtime, storage, push, location, camera, audio, scene engines, payments | application ports, RN/Expo APIs | views |
| **views** | RN components, layout, styling | ViewModel hooks, `ui-kit` | SDK, storage, native modules directly |
| **contracts** | DTOs, error codes, notification payloads, route table | `shared-kernel` | everything else |

The ViewModel contract is exactly as in `PLAYBOOK_FRONTEND.md` §4: hooks that
return state + commands + a `status` enum
(`loading | ready | empty | forbidden | not-found | offline | error | policy-blocked`),
with platform effects behind ports (`Navigator`, `Notifier`, `Haptics`, `Analytics`).
Enforce with dependency-cruiser/ESLint boundaries; violations fail CI.

### 4.2 Mobile ports

```ts
export interface PushPort        { permissionState(): Promise<PermState>; requestPermission(): Promise<PermState>;
                                    registerDevice(): Promise<DeviceReg>; unregisterDevice(): Promise<void>;
                                    onNotification(cb: (n: IncomingNotification) => void): Unsub;
                                    onTap(cb: (n: IncomingNotification) => void): Unsub; }
export interface SecureStorePort { get(key: string): Promise<string | null>; set(key: string, v: string): Promise<void>; remove(key: string): Promise<void>; }
export interface BiometricsPort  { available(): Promise<boolean>; authenticate(reason: string): Promise<boolean>; }
export interface LocationPort    { current(opts: LocOpts): Promise<Fix>; watch(opts: LocOpts, cb: (f: Fix) => void): Unsub;
                                    startBackground(opts: BgLocOpts): Promise<void>; stopBackground(): Promise<void>; }
export interface DeviceCapabilityPort { tier(): Promise<DeviceTier>; capabilities(): Promise<Capabilities>; thermal(): ThermalState; }
export interface SceneEnginePort { init(cfg: SceneConfig): Promise<void>; load(scene: SceneSpec): Promise<void>;
                                    send(cmd: SceneCommand): void; onEvent(cb: (e: SceneEvent) => void): Unsub;
                                    setQuality(q: QualityProfile): void; dispose(): Promise<void>; }
export interface AudioPort       { startCapture(cfg: CaptureCfg): Promise<AudioStream>; play(clip: AudioSource): Promise<PlaybackHandle>; }
export interface PaymentsPort    { presentPaymentSheet(intent: PaymentIntentRef): Promise<PaymentResult>; }
export interface NetworkStatePort{ current(): NetState; onChange(cb: (s: NetState) => void): Unsub; }
export interface DeepLinkPort    { initial(): Promise<ParsedLink | null>; onLink(cb: (l: ParsedLink) => void): Unsub; }
export interface RealtimePort    { start(cfg: RtConfig): void; stop(): void; setTopics(t: Set<string>): void; /* events: state, event, resync */ }
```

Ports return `Promise<Result<T,E>>` or typed events; errors are values. Platform libraries are
confined to `adapters/out`.

### 4.3 State and data

| Concern | Choice |
|---|---|
| Server state | TanStack Query keyed `[userType, module, resource, tenantId?, params]` (same as web) |
| Client state | Small Zustand stores with selectors; derive, don't duplicate |
| Persisted prefs | MMKV (synchronous JSI KV) for non-sensitive; **SecureStore** for secrets |
| Offline DB | `expo-sqlite` (WAL) for cart, wishlist, collection cache, outbox |
| Forms | react-hook-form + zod schemas shared with web |
| Re-render control | Memoized selectors, stable props, React Compiler where validated on the Low pool (**verify** benefit and regressions), no giant context providers |

### 4.4 Offline, outbox and sync

* The local DB is a **projection**; the backend is the authority.
* Mutations while offline go to an **outbox** with `Idempotency-Key`, retry with
  backoff and per-entity ordering, mirroring the backend idempotency contract.
* Conflicts return typed results and are resolved in the ViewModel.
* Version/schema gates prevent old clients from corrupting newer data.

---

## 5. Monorepo layout and variant configuration

```text
apps/
├── mobile-game/      app.config.ts  eas.json  src/routes (thin)   # APP_VARIANT=game
├── mobile-market/    app.config.ts  eas.json  src/routes (thin)   # APP_VARIANT=market
└── mobile-avatar/    app.config.ts  eas.json  src/routes (thin)   # APP_VARIANT=avatar
packages/
├── sdk/                 # TS SDK (generated from OpenAPI; shared with web/extension)
├── viewmodels/          # shared ViewModels (all clients)
├── core/                # ports, route builders, permission helpers, error taxonomy
├── tokens/  ui-kit/     # design tokens; RN components (variant theming)
├── mobile-core/         # shell: auth, onboarding, push, settings, device capability, governor, telemetry, deep links
├── scene-engine/        # SceneEnginePort + adapters: 2d-fallback, filament, godot, unity (each its own package/entry)
├── feature-game/        # map, spawns, encounters, inventory, events (+ native deps declared here)
├── feature-market/      # catalog, search, product, cart, checkout, orders, reviews, wishlist, seller
└── feature-avatar/      # avatar creator/viewer, voice, lip-sync, gestures, sessions
tests/<slice>/mobile/{unit,component,integration,contract,e2e,perf,a11y,security}/
tests/_platform/{architecture,device-perf,push,auth,store-readiness}/
docs/{adr,support-matrix.md,dependency-register.md,permissions-register.md,device-pool.md,runbooks/}
```

Rules:

* **Each variant app imports only its own feature pack**; the Metro/dependency graph
  and config plugins must make it impossible for the market app to pull engine code.
  CI checks the installed native modules per variant against an allowlist.
* Slice names match backend slices and URL modules: `identity`, `notifications`,
  `devices`, `game`, `market`, `avatar` (and finer slices inside each pack).
* `app.config.ts` selects variant-specific name, bundle IDs, icons, permissions,
  plugins, associated domains and push settings from `APP_VARIANT` (Appendix A).
* Native dependencies are declared **in the feature package** and included by
  config plugins only for the variant that needs them.

**Workspace and bundler rules (pnpm + Metro).** The apps and the shared packages
live in one pnpm workspace, and React Native has one non-negotiable invariant:
**exactly one copy of `react` and `react-native` in the tree**. pnpm's default
isolated layout nests a second copy under the app and Metro does not resolve a
nested duplicate the way a bundler would — the renderer breaks at runtime, and
the export dies with Metro's `Invariant Violation: Failed to collapse`
(metro-file-map cannot collapse a workspace symlink that resolves above the
project root). Two settings prevent it, and both belong in the repository:

```text
.npmrc               node-linker=hoisted                 # flat node_modules, like npm
app/metro.config.js  watchFolders = [workspaceRoot]
                      resolver.nodeModulesPaths = [app/node_modules, root/node_modules]
                      resolver.disableHierarchicalLookup = true
```

* `.npmrc` sets `node-linker=hoisted`, so the committed lockfile resolves the flat
  layout: the app and the shared packages install from the same tree.
* `metro.config.js` (in the app package) watches the **workspace root**, not only
  the app folder — the shared packages live outside it and pnpm links them as
  symlinks. `nodeModulesPaths` lists the app's `node_modules` first and the
  workspace root's second; `disableHierarchicalLookup` stops Metro from walking
  up from a file and finding a nested duplicate of React Native.
* The reference kit ships exactly this pair (`frontend-mobile/.npmrc`,
  `frontend-mobile/app/metro.config.js`). `expo export` is the gate that proves
  it: a workspace that resolves is the only way to know before a store build.

### 5.1 Directory inside a feature pack

```text
packages/feature-<x>/src/<slice>/{domain,application,adapters/{in,out},viewmodels,views,contracts}/
```

---

## 6. Navigation, routes and deep links (URL playbook)

The mobile app uses the **same path grammar** as web and desktop:

```text
/{userType}/{module}/{resource}[/{resourceId}[/{subresource}]]

/app/market/products/{productId}            /app/market/cart
/app/game/map                                /app/game/encounters/{encounterId}
/app/avatar/sessions/{sessionId}             /app/avatar/avatars/{avatarId}
/app/notifications/preferences
Session-less (public experience):  /onboarding  /login  /register  /forgot-password  /reset-password  /verify-email
```

* Expo Router file layout mirrors this (route groups for layouts; `app/` vs `public`
  experiences; place the routes under a folder that yields the exact URL paths **(verify
  router `root` and typed-routes behavior)**). The router is an implementation
  detail, not the contract: the typed route table below is. A file-based
  convention is acceptable only while it cannot contradict that table — the
  reference kit ships a plain `App.tsx` entry and resolves every path against the
  table (`frontend-mobile/docs/adr/0001-expo-with-a-plain-app-entry.md`).
* **Universal/App Links and custom scheme:** `https://<domain>/app/...` and
  `<scheme>://app/...`, associated domains / `assetlinks.json` per variant.
* Route builders are generated from the shared route table; no hand-written paths.
* The **typed route table is the source of truth for the paths the app ships**: the
  optional `{subresource}` segment is part of the grammar, and a client whose table
  declares no subresource route **refuses a five-segment path as unknown** — it never
  guesses a route.
* Guards (`RequireAuth`, `RequireUserType`, `RequirePermission`) only shape UX (redirect to
  `/login`, `/403`, allowed home); **the server authorizes every call**.
* Deep-link/notification parameters are **untrusted**: validate IDs, never trigger
  state-changing actions from a link without UI confirmation, require a session.
* Cold-start deep links and notification taps are queued until auth/bootstrap completes,
  then routed (so a tap while signed out lands on login, then continues).

---

## 7. Shared platform features: onboarding, login, registration, forgot password

### 7.1 Backend contract (identity slice; session-less `/public` experience)

| Purpose | Endpoint (examples; follow `PLAYBOOK_URLS.md`) |
|---|---|
| Register | `POST /api/v1/public/auth/register` |
| Verify email / phone | `POST /api/v1/public/auth/verify` · `POST /api/v1/public/auth/verify/resend` |
| Login | `POST /api/v1/public/auth/login` (+ MFA challenge step) |
| Social/OIDC exchange | `POST /api/v1/public/auth/oidc/callback` (code + PKCE verifier) |
| Passkey | `POST /api/v1/public/auth/passkey/options` · `.../verify` |
| Refresh / logout | `POST /api/v1/public/auth/token/refresh` · `POST /api/v1/app/auth/logout` |
| Forgot password | `POST /api/v1/public/auth/password/forgot` |
| Reset password | `POST /api/v1/public/auth/password/reset` |
| Change password / sessions | `POST /api/v1/app/auth/password/change` · `GET/DELETE /api/v1/app/auth/sessions` |
| Account deletion | `DELETE /api/v1/app/account` (re-auth + grace period) |
| Consent | `POST /api/v1/app/account/consents` (versioned ToS/Privacy/marketing) |
| Device registration (push) | `POST /api/v1/app/devices` · `DELETE /api/v1/app/devices/{deviceId}` |

All requests carry `X-Client: mobile/<variant>/<version> (<os>; <model class>)`,
`X-Correlation-Id`, and `Idempotency-Key` where applicable. Errors use the shared
envelope and `SdkError` taxonomy.

### 7.2 Onboarding

* **3–5 screens maximum**, skippable, content from remote config (copy, images, order) with
  bundled fallback; shown once per install/account; resumable.
* **Value first, permissions later**: never ask for location, camera, mic or notifications on
  the first screen. Use **permission primers** at the moment of need (see 7.6).
* Variant-specific steps: Game (safety notice, age gate, choose starter), Market (country,
  language, interests), Avatar (create/choose avatar, voice consent, AI disclosure).
* Low-end: static images (WebP/AVIF), no heavy video/Lottie loops; respect "reduce motion".
* Funnel analytics (privacy-safe) per step; A/B via remote config.
* Accessible: screen-reader order, large-text support, RTL.

### 7.3 Registration

* Minimal fields (email or phone + password, or social), **password policy** shown inline
  (length-first policy, breached-password check server-side), show/hide password, paste allowed,
  password-manager friendly (`textContentType`, `autoComplete`).
* Capture **consent** with versioned documents (ToS, Privacy), marketing opt-in separate and
  unticked; **age gate** where required (Game especially; COPPA/age-appropriate design rules
  **(verify per market)**).
* Email/phone **verification** via link (universal link) or OTP code; resend with cooldown;
  unverified accounts have limited capabilities.
* **Username/handle availability** checks are rate-limited and don't leak account existence of emails.
* Abuse controls: rate limits, device attestation signals (Play Integrity / App Attest **(verify)**),
  CAPTCHA/risk challenge only when risk is high.
* After registration: restore intended deep link, start onboarding, request push at a good moment.

### 7.4 Login

* Methods: email/password; **Sign in with Apple** (required on iOS when other third-party
  social logins are offered, with equivalent privacy-preserving options **(verify guideline)**);
  Google; optional **passkeys** (platform authenticators) **(verify library maturity)**;
  enterprise SSO via **OIDC Authorization Code + PKCE in the system browser** (`expo-auth-session` +
  `expo-web-browser`), never an embedded WebView.
* **MFA**: TOTP/passkey/push-approval for sensitive roles and actions; step-up for payments,
  account deletion, password change.
* Throttling and lockout are server-side; the client shows generic errors
  ("check your credentials") and `Retry-After` hints; uniform timing.
* **Biometric app lock** (optional): `expo-local-authentication` gates the *app UI/tokens*
  (unlock to use the stored refresh token); biometrics never replace server authentication.
* **Session storage**: access token in memory; **refresh token in SecureStore**
  (Keychain/Keystore) with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`-class accessibility on iOS and
  non-backed-up storage on Android; single-flight refresh, rotation with reuse detection (server),
  immediate local wipe on sign-out/suspension.
* **Multiple accounts/roles** (market seller vs buyer): active role switch resets caches and
  subscriptions; `{userType}` selects the experience only.

### 7.5 Forgot password and reset

| Step | Behavior |
|---|---|
| Request | `/forgot-password`: user enters email; **always show the same confirmation** (no account enumeration); rate-limit per IP/device/account; cooldown on resend |
| Delivery | Email contains a **short-lived, single-use link** (universal/app link to `/reset-password?token=…`) and/or a numeric code for in-app entry; link works if the app is installed, otherwise lands on a web fallback |
| Reset screen | Token validated server-side on submit; new password with policy feedback; confirm field optional; success → **all sessions revoked**, user signed in or sent to login; notify by email |
| Security | Token never logged or stored; clipboard/deep-link input treated as untrusted; reset tokens bound to the account and expire quickly; MFA required if enabled; passkeys remain valid |
| UX | Handles app cold start from the link, expired/used token states, offline, and keyboard avoidance; accessible error messaging |

### 7.6 Permission primers (all variants)

Show a short in-context explanation **before** the OS prompt, only when the feature is about to
be used; if denied, provide a settings deep link and a degraded path:

| Permission | Trigger moment | Degraded path |
|---|---|---|
| Notifications | After first valuable event (order placed, first catch, first avatar chat) or via onboarding opt-in | In-app inbox; periodic refresh |
| Location (Game) | When opening the map | Manual region selection / browse-only mode |
| Background location (Game) | Only if the user enables a feature that needs it | Foreground-only play |
| Camera | AR mode, barcode scan, selfie avatar | Non-AR mode, manual entry, preset avatars |
| Microphone | First voice interaction | Text chat |
| Photos/files | Review photos, avatar upload | Camera or skip |

### 7.7 Account lifecycle and compliance

* **In-app account deletion** (initiate, re-authenticate, grace period, confirmation) is
  required by the stores **(verify)** and by privacy law; deletion cascades server-side to
  devices/push tokens, avatar assets, location history and caches.
* **Data export** and consent management in settings; marketing opt-out honored in push.
* Terms/privacy version changes trigger re-consent flows.

---

---

> Continues in [`PLAYBOOK_FRONTEND_MOBILE_PART2.md`](PLAYBOOK_FRONTEND_MOBILE_PART2.md).
