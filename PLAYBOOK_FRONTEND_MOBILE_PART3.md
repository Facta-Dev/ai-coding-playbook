---
id: FRONTEND_MOBILE_PART3
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [FRONTEND_MOBILE]
---

# PLAYBOOK_FRONTEND_MOBILE_PART3 — React Native mobile playbook (Game · Market · Avatar) (part 3)

> Part 3 of 3. Main entry: [`PLAYBOOK_FRONTEND_MOBILE.md`](PLAYBOOK_FRONTEND_MOBILE.md). Covers: 15. Security, privacy and store compliance … Appendix F — Support matrix template.

## 15. Security, privacy and store compliance

### 15.1 Baseline (mobile)

Follow `PLAYBOOK_SECURITY.md` and **OWASP MASVS** (verification levels) with MASTG-style tests:

| Area | Controls |
|---|---|
| Storage | Secrets only in Keychain/Keystore (SecureStore); Android `allowBackup=false` (or targeted backup rules); no secrets in MMKV/SQLite/logs; encrypt sensitive local DB fields (SQLCipher or field-level keys in the keystore) |
| Network | TLS 1.2+; Android network security config (no cleartext, no user-CA trust in release unless needed); optional certificate pinning with a rotation plan (pin a backup key; kill switch) |
| Auth | Section 7; refresh rotation; biometric gate; step-up; session list/revoke |
| Code/binary | R8/ProGuard for native/Java layers; Hermes bytecode is not a secret store; no API keys or secrets in the bundle; license-restricted keys (Maps) are scoped and rotatable |
| Platform trust | Play Integrity API / App Attest as risk signals, evaluated server-side; root/jailbreak signals are advisory; never block solely on client-side checks |
| Deep links/IPC | Allowlisted routes, validated params, no exported components without need; intent/URL scheme hijack protection (App Links/Universal Links) |
| UI | `FLAG_SECURE`/privacy overlays on sensitive screens; clipboard minimization; hide content in app switcher where needed |
| Third-party SDKs | Inventory, minimal permissions, privacy manifests, vendor review (see `PLAYBOOK_AUDIT.md` §12) |
| Supply chain | Lockfile, frozen installs, release-age cooldown for new package versions, SCA, SBOM, signed builds, EAS secrets management, CI hardening (`PLAYBOOK_SECURITY.md` §11) |
| Native engines | Review engine/plugin sources and licenses; keep versions current; scan binaries |

### 15.2 Privacy

* Data minimization per variant; **location, microphone, camera, voice and face-derived data are sensitive**: explicit consent, purpose
  limitation, retention limits, deletion on account removal, regional rules (GDPR/CCPA/LGPD/others) **(verify)**.
* **Children/teens**: age gate and age-appropriate design for Game and Avatar; parental consent where required; restrict chat/voice and purchases by age.
* **Store privacy artifacts**: iOS privacy manifests and nutrition labels, Play Data safety forms: generated from the dependency register and kept in sync with actual SDK behavior.
* Analytics/telemetry: opt-out/consent as required; no precise location or content in analytics; hashed identifiers; retention limits.

### 15.3 Store policy checklist (verify each release)

| Topic | Requirement to confirm |
|---|---|
| Sign in with Apple | Offered when other third-party social logins exist (iOS) |
| Account deletion | In-app initiation and web/support path |
| Permissions rationale | Accurate usage strings; background location justification (Game) |
| Payments | Digital goods via store billing; physical goods via external processors; correct disclosures |
| UGC/AI content | Reporting, blocking, moderation, AI disclosure |
| Age rating | Questionnaire reflects chat, voice, purchases, location |
| Android targets | Target API level currency; edge-to-edge; 16 KB page size; foreground-service types; notification permission |
| Privacy forms | Data safety and privacy manifests match reality |
| Loot boxes | Odds disclosure/regional restrictions if applicable |

---

## 16. Observability

| Signal | Implementation |
|---|---|
| Crashes/ANRs | Sentry RN or Crashlytics with source maps/debug symbols uploaded privately; native crash handlers for engines; release/variant/tier tags |
| Performance | `react-native-performance` markers (startup phases, screen TTI), frame-drop counters, JS thread stalls, scene frame-time p50/p95, memory samples, thermal and battery state, governor decisions |
| Network | Request latency/error rates by endpoint and network type; realtime state transitions and lag; asset pack download success |
| Product | Funnels: onboarding → registration → verification → first value; checkout; encounter; session start; push opt-in and open rates |
| Tracing | `X-Correlation-Id` generated per user action; propagated through SDK/realtime/push payloads and shown on error screens |
| Diagnostics bundle | User-initiated, redacted: app/variant/version, device tier and capabilities, renderer/engine, governor profile history, permissions, push status, recent logs, recent errors with correlation IDs |
| Privacy | Sampling and consent aware; redaction filters; no PII/precise location in logs |

Server-side alerts watch crash-free rate per device class, startup time p95 on Low devices, checkout failures, push delivery failures, auth error spikes.

---

## 17. Testing strategy

Follows `PLAYBOOK_TESTS.md`; adds a `mobile` side:

```text
tests/<slice>/mobile/{unit,component,integration,contract,e2e,perf,a11y,security}/
tests/_platform/{architecture,device-perf,push,auth,store-readiness}/
```

### 17.1 Levels

| Level | Scope | Tooling |
|---|---|---|
| Unit | domain, application, ViewModels with fake ports | Vitest or Jest in a node environment — the domain and application layers hold no JSX and need no renderer; a ViewModel needs one only when it uses React hooks (`renderHook`, `@testing-library/react-native`), so prefer a plain state machine plus a hook in the views layer (section 4.1) |
| SDK/contract | SDK vs OpenAPI, notification payload schema, performance-script schema, route table parity, permission catalog | schema tests, MSW |
| Component | Views per ViewModel status; accessibility roles/labels | RNTL |
| Integration | ViewModel + SDK + SQLite/outbox, realtime transport conformance, push handling state machine (foreground/background/killed) with fakes | Vitest or Jest + fakes |
| **E2E** | Onboarding → register → verify → login → forgot → reset; permission denial paths; push tap deep links; market checkout; game encounter (mock GPS); avatar session (mock audio/script) | Maestro or Detox on emulators **and** real devices |
| Device performance | Cold start, list scroll (FlashList), scene frame time/memory/thermal on the Low/Mid pool | Flashlight (Android), Reassure (render regressions), Perfetto/Instruments traces, custom scene harness |
| Scene/asset | Asset budgets, GLB validity, tier fallback behavior, engine init failure injection | CI scripts, harness |
| Location/anti-cheat | Mock routes (walk, drive, teleport), poor GPS, permission changes | simulators, test server |
| Audio/voice | Latency measurements, barge-in, route changes, interruptions, lip-sync drift | harness with recorded audio |
| Push | FCM/APNs sandbox, token refresh, permission states, OEM-kill scenarios on pool devices, collapse/ttl behavior | device farm + test sender |
| Accessibility | TalkBack/VoiceOver flows, large text, contrast, reduce motion | manual + automated |
| Security | MASTG-style checks, storage inspection, deep-link fuzzing, TLS config, secrets scan, dependency/SBOM scan | MobSF-class tools, custom |
| Compatibility | OS versions, screen sizes, languages/RTL, offline/slow networks | matrix |
| Upgrade | Install N-1 → update → data/migration and token continuity | scripts |
| Store readiness | Permissions, privacy forms, listing assets, 16 KB alignment, target API | checklist/CI |

### 17.2 Rules

* **Tests run on the Low pool**, not only emulators or flagships.
* No production data; synthetic tenants/users; payment tests use provider test modes.
* Flaky tests are quarantined with owner and expiry (tests playbook).
* Every notification type and every route has a contract/e2e test.

### 17.3 CI matrix

Unit/integration on every PR; emulator e2e on PR (smoke) and nightly (full); **device-farm runs** nightly/pre-release; Low-pool performance suite
nightly and per release candidate; asset budget checks on every asset change.

### 17.4 Performance gates

Per release: cold start, TTI, list scroll jank %, scene p95 frame time, memory plateau, battery drain/hour (Game), crash-free rate on the Low pool.
Regression threshold (e.g., +10%) fails the build; results are stored as release evidence.

---

## 18. Build, release and operations

### 18.1 Builds and variants

* **EAS Build** profiles per variant × environment (`dev`, `staging`, `prod`); `APP_VARIANT` selects name, bundle IDs, icons, plugins, permissions,
  associated domains and push credentials.
* Android: AAB with per-ABI/density splits; arm64 primary; R8 shrinking; 16 KB-aligned native libs; on-demand asset packs for Game/Avatar.
* iOS: separate app records/capabilities per variant; privacy manifests; phased release.
* **Continuous Native Generation** (prebuild) keeps native projects reproducible; custom native code via the Expo Modules API/config plugins.

### 18.2 OTA updates (EAS Update)

* JS/asset-only changes; **never** change native dependencies or permissions via OTA; strict **runtime version** policy per variant.
* Channels per environment with staged rollout (percentage) and automatic rollback on health regression; Hermes bytecode diffing keeps updates small.
* Respect store rules on OTA usage; OTA is not a way to bypass review for functionality changes.

### 18.3 Release pipeline

| Stage | Gate |
|---|---|
| PR | Typecheck, lint, architecture rules, unit/component/contract tests, dependency/SBOM and secrets scans, asset budgets |
| Main | Variant builds (all three), emulator e2e smoke, size diff per variant, permission diff vs register |
| Nightly | Full e2e, device-farm run, Low-pool performance, soak (30-min sessions), push suite |
| Release candidate | All above + store-readiness checks, accessibility pass, security tests, evidence bundle |
| Release | Staged rollout (Play staged release, iOS phased release), health gates, remote kill switch ready |
| Post-release | Crash/ANR, startup p95 on Low, checkout/auth/push metrics; rollback plan (halt rollout, OTA fix, kill switch, higher version) |

### 18.4 Remote config and kill switch

Remote config (data only, schema-validated, signed or served from a trusted origin) controls: feature flags, device-tier overrides and blocklists,
quality profile defaults, onboarding content, realtime mode, push categories, minimum supported app version (force-upgrade screen),
and emergency kill switches per feature (AR, background location, voice, 3D, checkout provider).

### 18.5 Runbooks

Crash spike on a device model (blocklist + tier override), OEM push delivery failure, FCM/APNs outage or credential expiry, store rejection/appeal, bad OTA
(rollback), engine regression, asset pack corruption (rollback), payment provider incident, auth/IdP outage, location-policy review, privacy incident,
avatar-provider loss (switch provider), voice/LLM provider outage (degrade to text).

---

## 19. Governance, compliance and working with Claude Code

* **Ownership:** CODEOWNERS for `app.config.ts`, `eas.json`, native-module declarations, `packages/scene-engine/**`, push/auth adapters,
  `docs/permissions-register.md`, store metadata; security review for permission, SDK-inventory and auth/push changes.
* **Documents:** ADRs, dependency register, permissions register (each permission: why/variant/feature/fallback), device pool and tiers,
  support matrix, threat model, data-flow diagrams, privacy review, store submission checklist, runbooks.
* **Compliance mapping** (`PLAYBOOK_AUDIT.md`): SDLC controls via CI gates and reviews; vendor management for SDKs/providers (push, maps, payments,
  voice/LLM, avatar); privacy (location/voice/face data) and consent evidence; change management via staged rollouts; incident response runbooks; evidence
  bundle per release (builds, SBOM, test and performance reports, permission diffs, approvals). CRA applicability for distributed apps: assess with counsel
  **(verify)**.
* **Claude Code** (`PLAYBOOK_CLAUDE_CODE.md`): path-scoped rules for `packages/mobile-core/**`, `packages/feature-*/**`, `packages/scene-engine/**`;
  integrator role owns `app.config.ts`, native deps, lockfiles, CI; skills: `new-mobile-feature` (slice scaffold with ports, ViewModel, View, tests),
  `new-notification-type` (schema, category/channel, deep link, handler, test), `new-scene-asset` (pipeline + budgets), `device-perf-check`;
  specs list variants affected, permissions, tiers, budgets, push types, routes and test levels per AC.

---

## 20. Anti-patterns (reject in review)

| Anti-pattern | Why it fails |
|---|---|
| One fat app containing all three products and all engines | Download size, memory and review surface on low-end devices |
| Assuming flagship GPUs/RAM; no Low-tier path | Crashes and unplayable frame rates for much of the market |
| Hard-coded device lists instead of capability detection + measurement | Stale, wrong, unmaintainable |
| 3D via WebView or per-frame JS-thread rendering for the Low tier | Order-of-magnitude slowdowns |
| Game entities/products as hundreds of positioned RN Views | JS/UI thread overload |
| Client-authoritative game state or prices | Cheating/fraud |
| Asking for all permissions at first launch | Denials, store rejection |
| Push payloads with sensitive data; push as the only sync path | Privacy leaks, missed state |
| Depending on a single avatar/voice vendor runtime | Shutdown risk (e.g., Ready Player Me) |
| Storing tokens in AsyncStorage/MMKV/logs | Credential theft |
| Embedded login WebViews, custom crypto | Phishing and weak security |
| Unbounded image/asset caches, uncompressed textures | OOM kills |
| OTA changes to native deps/permissions | Crashes and policy violations |
| Reanimated-everything on Low devices without measurement | Memory/CPU regressions |
| Account enumeration in login/forgot flows | Privacy and abuse |
| Ignoring OEM battery killers for push | Silent delivery failures |
| No device-farm/Low-pool performance testing | Unproven claims |
| Shipping an unpatched SDK with known memory regressions | Field crashes |

---

## 21. Definition of done and checklists

### 21.1 Feature DoD

- [ ] Spec lists variant(s), slice, routes, permissions, push types, device-tier behavior, budgets and test levels per AC.
- [ ] ViewModels tested with fake ports; all statuses covered; shared with other clients where applicable.
- [ ] Low-tier path implemented and verified on the Low pool; governor behavior defined.
- [ ] Uses the shared SDK; no hand-written paths/DTOs; error taxonomy handled; correlation IDs shown.
- [ ] Permissions requested in context with primer and degraded path; register updated.
- [ ] Accessibility verified (TalkBack/VoiceOver, large text, reduce motion); strings are keys; RTL checked.
- [ ] Offline/slow-network behavior defined; outbox/idempotency for mutations.
- [ ] Telemetry and redaction verified; no sensitive data in logs/analytics/push.

### 21.2 Release checklist

- [ ] Variant builds reproducible; size, permission and dependency diffs reviewed; SBOM and scans green.
- [ ] Unit, contract, e2e (emulator + real devices), accessibility, security suites green.
- [ ] Low/Mid pool performance within budgets (start, scroll, scene fps, memory, battery, crash-free).
- [ ] Push verified end to end (permission states, foreground/background/killed, deep links, token lifecycle).
- [ ] Auth flows verified: register, verify, login, MFA/step-up, forgot, reset, sign-out, deletion.
- [ ] Store checklist verified (Sign in with Apple, deletion, privacy forms, target API, 16 KB alignment, permissions text).
- [ ] Staged rollout, remote kill switch and rollback plan ready; runbooks current.

### 21.3 Architecture acceptance checklist

- [ ] Expo/RN current SDK, New Architecture, Hermes V1, patched for known regressions.
- [ ] Three variants from one monorepo with per-variant native deps, permissions, bundle IDs and EAS profiles.
- [ ] Layered architecture enforced (domain/application/viewmodels/adapters/views) with shared ViewModels and SDK.
- [ ] Route table mirrors the URL playbook; deep links validated; guards are UX only.
- [ ] Shared onboarding, login, registration, forgot/reset password, session security and account deletion in `mobile-core`.
- [ ] Push: expo-notifications + FCM v1/APNs, channels/categories, token lifecycle, deep-link contract, OEM guidance.
- [ ] `DeviceTier`, measured benchmark, `QualityGovernor`, remote overrides, performance modes.
- [ ] `SceneEnginePort` with 2D fallback, Filament, Godot, Unity adapters; lazy load/dispose; fallback chain.
- [ ] Asset pipeline with KTX2, LODs, budgets, signed manifests, on-demand packs.
- [ ] Game: server-authoritative, map via GL layers, location/battery modes, anti-cheat signals, AR optional.
- [ ] Market: server-authoritative pricing, idempotent checkout, Stripe PaymentSheet, FlashList, CDN-resized images.
- [ ] Avatar: open formats, provider port, voice pipeline with barge-in, performance-script contract, camera tracking optional.
- [ ] Observability, remote config, kill switch, diagnostics bundle.
- [ ] Device-lab testing with Low/Mid pool and CI performance gates.

---

## Appendix A — Variant-aware `app.config.ts` (sketch)

```ts
import type { ExpoConfig } from 'expo/config';

const VARIANTS = {
  game:   { name: 'Mobile Go',      slug: 'mobile-game',    id: 'com.example.mobile.game',
            plugins: ['./plugins/with-maplibre', './plugins/with-godot', 'expo-location'],
            permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'] },
  market: { name: 'Mobile Market',  slug: 'mobile-market',  id: 'com.example.mobile.market',
            plugins: ['@stripe/stripe-react-native', 'expo-camera'],
            permissions: ['CAMERA', 'POST_NOTIFICATIONS'] },
  avatar: { name: 'Mobile Avatar',  slug: 'mobile-avatar',  id: 'com.example.mobile.avatar',
            plugins: ['react-native-filament', 'expo-audio', '@livekit/react-native-expo-plugin'],
            permissions: ['RECORD_AUDIO', 'CAMERA', 'POST_NOTIFICATIONS'] },
} as const;

const v = VARIANTS[(process.env.APP_VARIANT ?? 'market') as keyof typeof VARIANTS];

export default (): ExpoConfig => ({
  name: v.name, slug: v.slug, scheme: v.slug,
  ios:     { bundleIdentifier: v.id, associatedDomains: [`applinks:${process.env.LINK_DOMAIN}`] },
  android: { package: v.id, permissions: [...v.permissions], blockedPermissions: [] },
  plugins: ['expo-router', // only when the variant uses the file-based router (section 6)
            'expo-secure-store', 'expo-notifications', ...v.plugins],
  extra:   { variant: process.env.APP_VARIANT, apiBaseUrl: process.env.API_BASE_URL },
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: process.env.EAS_UPDATE_URL },
});
```

## Appendix B — Device tier and quality governor (sketch)

```ts
type DeviceTier = 'low' | 'mid' | 'high';

async function resolveTier(cap: DeviceCapabilityPort, bench: BenchmarkPort, rc: RemoteConfig): Promise<DeviceTier> {
  const forced = rc.tierOverride(await cap.modelId());           // remote override wins
  if (forced) return forced;
  const hint = await cap.hintTier();                              // RAM, OS level, low-RAM flag, GPU probe
  const measured = await bench.lastOrRun();                       // p95 frame time of a reference scene
  return combine(hint, measured);                                 // measurement can only lower or confirm the hint
}

class QualityGovernor {
  constructor(private sensors: Sensors, private scene: SceneEnginePort, private profile: QualityProfile) {}
  tick(): void {
    const s = this.sensors.snapshot();                            // frame p95, thermal, memory pressure, battery saver
    if (s.frameP95 > this.profile.frameBudget || s.thermal >= 'serious' || s.memoryWarning) this.stepDown();
    else if (s.healthyForMs > 30_000) this.stepUp();              // hysteresis
    this.scene.setQuality(this.profile);
  }
}
```

## Appendix C — Notification routing (sketch)

```ts
function handleTap(n: IncomingNotification, nav: Navigator, session: SessionPort) {
  const link = parseDeepLink(n.data.deepLink);                    // allowlist of routes, validated params
  if (!link) return nav.go(routes.home());
  if (!session.isAuthenticated()) return queueAfterLogin(link);   // resume after bootstrap/login
  nav.go(link);                                                   // never perform state changes from the payload
}
```

## Appendix D — Auth flow summary

```text
Onboarding → Register (consent, age gate) → Verify (link/OTP) → Login → [MFA/step-up] → Home
Forgot: /forgot-password (generic response) → email link/code → /reset-password (token) → sessions revoked → Login
Sign-out: revoke server-side, wipe tokens, unregister device (push), clear caches per policy
Delete account: re-auth → confirm → grace period → server cascades → local wipe
```

## Appendix E — Asset budget table (starting points)

| Asset | Low | Mid | High |
|---|---|---|---|
| Character/creature triangles | ≤ 5–10k | ≤ 15–25k | ≤ 40–60k |
| Bones | ≤ 25 | ≤ 60 | ≤ 75+ |
| Materials per model | 1 | 1–2 | 2–4 |
| Texture size (KTX2, GPU-compressed) | 512 | 1024 | 2048 |
| Morph targets (face) | 10–15 | 15–20 | 20–52 |
| Scene draw calls | ≤ 50 | ≤ 100 | ≤ 200 |
| Concurrent animated models | 1–2 | 3–5 | 6–10 |
| Real-time shadows/post | off | simple | on |
| Peak scene memory | ≤ 300 MB total process | ≤ 450 MB | ≤ 700 MB |

## Appendix F — Support matrix template

```markdown
# Support matrix (per release)
| Platform | Min OS | ABIs | Notes |
| Android | <API> | arm64-v8a (+armeabi-v7a if needed) | 16 KB page-size aligned; target API <N> |
| iOS | <min> | arm64 | Xcode <N>, privacy manifest |
Device tiers: Low (≤3 GB RAM) · Mid (4–6 GB) · High (≥8 GB). Device pool: <list>
Known limitations per tier: <AR availability, background location, voice features>
```
