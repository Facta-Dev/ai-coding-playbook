---
id: MOBILE_ANDROID_KOTLIN_PART3
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [MOBILE_ANDROID_KOTLIN]
---

# PLAYBOOK_MOBILE_ANDROID_KOTLIN_PART3 — Native Android playbook (Kotlin · Jetpack Compose · Game · Market · Avatar) (part 3)

> Part 3 of 3. Main entry: [`PLAYBOOK_MOBILE_ANDROID_KOTLIN.md`](PLAYBOOK_MOBILE_ANDROID_KOTLIN.md). Covers: 19. Governance, compliance and working with Claude Code … Appendix H — Support matrix template.

## 19. Governance, compliance and working with Claude Code

* **Ownership:** CODEOWNERS for `build-logic/**`, `gradle/libs.versions.toml`, `gradle/verification-metadata.xml`, manifests, `network_security_config`, R8/keep rules, `:core:security`, `:core:scene`, push/auth modules, `docs/permissions-register.md`.
* **Documents:** ADRs, dependency and permissions registers, device pool/tiers, support matrix, threat model, data-flow diagrams, privacy review, Play submission checklist, runbooks.
* **Compliance mapping** (`PLAYBOOK_AUDIT.md`): SDLC controls via CI gates; vendor management for SDKs/providers (FCM, maps, payments, voice/LLM, avatar, ARCore); privacy evidence for location/voice/face data; change management via staged rollouts; incident runbooks;
  evidence bundle per release (builds, SBOM, test/perf reports, permission diffs, approvals). CRA applicability for distributed apps: assess with counsel **(verify)**.
* **Claude Code** (`PLAYBOOK_CLAUDE_CODE.md`): path-scoped rules for `core/**`, `shell/**`, `feature/**`, `core/scene/**`; integrator role owns Gradle build logic, version catalog, manifests and lockfiles; skills: `new-android-feature` (module scaffold: domain/data/ui/contracts + tests),
  `new-notification-type` (schema, channel, deep link, handler, test), `new-scene-asset` (pipeline + budgets), `baseline-profile-refresh`, `device-perf-check`; specs list variants, permissions, tiers, budgets, push types, routes and test levels per AC.

---

## 20. Anti-patterns (reject in review)

| Anti-pattern | Why it fails |
|---|---|
| One APK with all three products and all engines | Size, memory, permissions and review surface |
| Product flavors that only hide code (still compiling other variants' deps) | Leaks engines/permissions into the wrong binary |
| Android imports in domain modules | Breaks testability and layering |
| An `androidx.*` dependency in a pure JVM module whose artifact has no JVM variant | The module stops being pure; the desktop/JVM build breaks |
| Business logic in composables or in Activities | Untestable, recomposition cost |
| Blocking the main thread (disk, network, JSON, crypto) | Jank/ANR on low-end |
| Reflection-heavy libs at startup (Gson/reflection DI), kapt | Slow startup and builds |
| Unbounded image caches, full-size bitmaps, uncompressed textures | OOM/limiter kills |
| Game entities/products as hundreds of composables over a map | Recomposition/overdraw overload |
| WebView-hosted 3D/games on the Low/Mid path | Order-of-magnitude slowdowns |
| Requiring ARCore/GMS in the manifest for installability | Excludes much of the market |
| SMS permissions to read OTP; trampoline notification taps; per-item Keystore keys | Blocked/limited by modern Android |
| Tokens/secrets in SharedPreferences/DataStore plaintext/logs | Credential theft |
| Embedded login WebViews; custom crypto | Phishing/weak security |
| Asking all permissions at first launch | Denials and policy risk |
| Push payloads with sensitive data; push as the only sync path | Privacy leaks, missed state |
| Dependence on one avatar/voice vendor runtime | Shutdown risk (e.g., Ready Player Me closed in January 2026) |
| Ignoring OEM battery killers and Doze | Silent delivery failures |
| No baseline/startup profile, R8 compat mode, no macrobenchmarks | Slow startup, unproven performance |
| Ignoring 16 KB alignment, target-API and edge-to-edge changes | Upload rejection/UI breakage |
| No Low-pool testing; trusting emulators | Unproven claims |
| A linter the project ships but the gate does not run | It finds nothing until a review finds it for it |
| An instantiation/rename script that mutates the tree before validating its arguments | A half-renamed tree or an unbuildable namespace, discovered far from its cause |

---

## 21. Definition of done and checklists

### 21.1 Feature DoD

- [ ] Spec lists variant(s), slice, routes, permissions, push types, tier behavior, budgets and test levels per AC.
- [ ] Domain/use cases/ViewModels unit-tested with fakes; all `UiStatus` values covered; no logic in composables.
- [ ] Low-tier path implemented and verified on the Low pool; governor behavior defined.
- [ ] Uses the Kotlin SDK; no hand-written paths/DTOs; error taxonomy handled; correlation IDs surfaced.
- [ ] Permissions requested in context with primer + degraded path; register and merged-manifest diff updated.
- [ ] Accessibility verified (TalkBack, 200% font scale, contrast, touch targets); strings are resources — every module owns its own `strings.xml` and no user-visible literal lives in Kotlin; RTL/pseudo-locale checked.
- [ ] Offline/slow-network behavior defined; outbox/idempotency for mutations.
- [ ] Baseline profile journeys updated; macrobenchmark within budget; no main-thread violations (StrictMode clean).
- [ ] Telemetry and redaction verified; no sensitive data in logs/analytics/push.

### 21.2 Release checklist

- [ ] Reproducible builds per variant; APK/AAB size, permission, native-lib (ABI, 16 KB) and dependency diffs reviewed; SBOM and scans green.
- [ ] Unit/architecture/contract/Compose/e2e (emulator + real devices)/accessibility/security suites green.
- [ ] Low/Mid pool performance within budgets (start, jank, scene fps, memory, battery, crash/ANR rates).
- [ ] Push verified end to end (permission states, foreground/background/killed, deep links, token lifecycle, Doze/OEM).
- [ ] Auth flows verified: register, verify, login (password/passkey/Google), MFA/step-up, forgot, reset, sign-out, deletion.
- [ ] Play checklist verified (target API, billing library, Data safety, permissions, deletion, content rating, 16 KB).
- [ ] Staged rollout configured, vitals gates and kill switch ready, runbooks current.

### 21.3 Architecture acceptance checklist

- [ ] Kotlin 2.x, Compose (current BOM), Navigation 3, Hilt/KSP; `compileSdk 37`/AGP 9.1.1+ (or a documented hold) and `targetSdk 37` (36 is Play's floor, not the target — see D18).
- [ ] Three thin app modules; per-variant dependencies, permissions and native libs verified by CI.
- [ ] Domain modules are pure Kotlin; `ui` never depends on `data`; cross-slice access only via `contracts`; Konsist/graph checks green.
- [ ] Pure JVM modules import no `android.*`; an `androidx.*` dependency is legal only where the artifact publishes a JVM variant (the multiplatform Navigation3 runtime in `contracts`).
- [ ] The build runs on a pinned full JDK (`javac`), and the PR gate runs every linter the project ships — Android Lint, Detekt, the architecture check and the contract tests.
- [ ] UDF with immutable UiState, effects channel, shared statuses; Compose compiler reports reviewed.
- [ ] Route table parity with `NavKey` set; App Links verified; deep links validated and resumed after auth.
- [ ] Shared shell: onboarding, login (Credential Manager/AppAuth), registration, forgot/reset, session security, deletion.
- [ ] Push: FCM v1, channels/categories, permission flow, token lifecycle, direct-activity PendingIntents, OEM guidance.
- [ ] `DeviceTier`, measured benchmark, `QualityGovernor` (thermal, ADPF, memory pressure), remote overrides, performance modes.
- [ ] `SceneEnginePort` with 2D, Filament, Godot, Unity adapters in dynamic feature modules; lazy load/dispose; fallback chain.
- [ ] Asset pipeline (KTX2, LODs, budgets), PAD delivery with texture format targeting, signed manifests.
- [ ] Game: server-authoritative, GL-layer map, location/battery modes, FGS-type compliance, ARCore optional, anti-cheat signals.
- [ ] Market: server-authoritative pricing, idempotent checkout, Stripe/Google Pay, Paging 3 + Coil sizing.
- [ ] Avatar: open formats, provider port, voice pipeline with barge-in, performance-script contract, optional tracking.
- [ ] R8 full mode, baseline + startup profiles, macrobenchmarks in CI, `ApplicationExitInfo` telemetry.
- [ ] Device-lab testing with Low/Mid pool and CI performance gates; Android 17 checklist run.

---

## Appendix A — Convention plugin and module snippets (sketch)

```kotlin
// build-logic/convention: AndroidAppConventionPlugin
class AndroidAppConventionPlugin : Plugin<Project> {
  override fun apply(target: Project) = with(target) {
    pluginManager.apply("com.android.application")            // AGP 9: Kotlin support is built in (no kotlin-android plugin)
    pluginManager.apply("org.jetbrains.kotlin.plugin.compose")
    extensions.configure<ApplicationExtension> {
      compileSdk = 37
      defaultConfig { minSdk = 24; targetSdk = 37 }
      buildTypes { release { isMinifyEnabled = true; isShrinkResources = true
        proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro") } }
      packaging { jniLibs { useLegacyPackaging = false } }     // uncompressed, aligned native libs
    }
  }
}
```

```kotlin
// feature/market/cart/domain/build.gradle.kts  (PURE KOTLIN)
plugins { id("mobile.jvm.library") }
dependencies { implementation(projects.core.kernel); implementation(libs.kotlinx.coroutines.core) }

// feature/market/cart/ui/build.gradle.kts
plugins { id("mobile.android.library"); id("mobile.compose"); id("mobile.hilt") }
dependencies { implementation(projects.feature.market.cart.domain); implementation(projects.core.designsystem); implementation(projects.core.uiCore) }
```

## Appendix B — Device tier from native signals (sketch)

```kotlin
class AndroidDeviceCapabilities @Inject constructor(@ApplicationContext private val ctx: Context) : DeviceCapabilityPort {
  override suspend fun hintTier(): DeviceTier {
    val am = ctx.getSystemService<ActivityManager>()!!
    val mem = ActivityManager.MemoryInfo().also(am::getMemoryInfo)
    val gb = mem.totalMem / 1_073_741_824.0                      // reported RAM is lower than marketing RAM (4 GB ≈ 3.5–3.8)
    val perfClass = if (Build.VERSION.SDK_INT >= 31) Build.VERSION.MEDIA_PERFORMANCE_CLASS else 0
    return when {
      am.isLowRamDevice || gb < 3.2                            -> DeviceTier.Low
      perfClass >= Build.VERSION_CODES.TIRAMISU || gb >= 7.0   -> DeviceTier.High
      else                                                     -> DeviceTier.Mid
    }
  }
  override val thermal: StateFlow<Thermal> = callbackFlow {
    val pm = ctx.getSystemService<PowerManager>()!!
    val l = PowerManager.OnThermalStatusChangedListener { trySend(it.toThermal()) }
    pm.addThermalStatusListener(l); awaitClose { pm.removeThermalStatusListener(l) }
  }.stateIn(appScope, SharingStarted.Eagerly, Thermal.None)
}
```

## Appendix C — FCM service skeleton

```kotlin
@AndroidEntryPoint
class PushService : FirebaseMessagingService() {
  @Inject lateinit var tokens: DeviceTokenUploader      // enqueues WorkManager job (only when signed in)
  @Inject lateinit var router: NotificationPresenter    // validates payload, picks channel, builds PendingIntent to MainActivity

  override fun onNewToken(token: String) = tokens.enqueue(token)

  override fun onMessageReceived(message: RemoteMessage) {
    val payload = PushPayload.parseOrNull(message.data) ?: return   // versioned schema; unknown types ignored + counted
    router.present(payload)                                          // no PII on lock screen; deep link validated on tap
  }
}
```

## Appendix D — Manifest and network config snippets

```xml
<!-- optional AR: do not exclude non-AR devices -->
<uses-feature android:name="android.hardware.camera.ar" android:required="false" />
<meta-data android:name="com.google.ar.core" android:value="optional" />

<!-- Game background tracking only -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<service android:name=".tracking.TrackingService" android:exported="false" android:foregroundServiceType="location" />

<!-- Verified App Links -->
<activity android:name=".MainActivity" android:exported="true">
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="app.example.com" android:pathPrefix="/app" />
  </intent-filter>
</activity>

<application android:allowBackup="false" android:dataExtractionRules="@xml/data_extraction_rules"
             android:networkSecurityConfig="@xml/network_security_config" android:usesCleartextTraffic="false" />
```

```xml
<!-- res/xml/network_security_config.xml -->
<network-security-config>
  <base-config cleartextTrafficPermitted="false"><trust-anchors><certificates src="system"/></trust-anchors></base-config>
  <!-- optional pinning with backup pins + expiration; coordinate with the remote kill switch -->
</network-security-config>
```

## Appendix E — Credential Manager login (sketch)

```kotlin
suspend fun signIn(activityContext: Context, passkeyRequestJson: String?, googleServerClientId: String): Outcome<AuthResult> {
  val options = buildList {
    add(GetPasswordOption())
    passkeyRequestJson?.let { add(GetPublicKeyCredentialOption(it)) }               // options from POST /api/v1/public/auth/passkey/options
    add(GetGoogleIdOption.Builder().setServerClientId(googleServerClientId).setFilterByAuthorizedAccounts(false).build())
  }
  val result = credentialManager.getCredential(activityContext, GetCredentialRequest(options))
  return when (val c = result.credential) {
    is PasswordCredential        -> authApi.login(c.id, c.password)
    is PublicKeyCredential       -> authApi.verifyPasskey(c.authenticationResponseJson)
    is CustomCredential          -> GoogleIdTokenCredential.createFrom(c.data).let { authApi.oidcExchange(it.idToken) }
    else                         -> Outcome.Failure(AppError.Unsupported)
  }
}
```

## Appendix F — SDK transport and SSE (sketch)

```kotlin
val api = OkHttpClient.Builder()
  .addInterceptor(CorrelationInterceptor()).addInterceptor(TenantInterceptor(session)).addInterceptor(ClientInfoInterceptor(variant, versionCode))
  .authenticator(SingleFlightRefreshAuthenticator(session))                // Mutex-guarded refresh, replay once
  .callTimeout(30, SECONDS).build()

val sseClient = api.newBuilder().readTimeout(45, SECONDS).build()            // > server heartbeat (15 s); dedicated client
val source = EventSources.createFactory(sseClient).newEventSource(
  Request.Builder().url(streamUrl).header("Accept", "text/event-stream").header("Last-Event-ID", lastId ?: "").build(),
  object : EventSourceListener() {
    override fun onEvent(es: EventSource, id: String?, type: String?, data: String) = pipeline.accept(id, type, data) // validate, dedupe, route
    override fun onFailure(es: EventSource, t: Throwable?, r: Response?) = state.reconnectWithBackoff(t, r)
  })
```

## Appendix G — R8, Baseline Profile and Startup Profile setup (checklist)

1. `isMinifyEnabled = true`, R8 full mode (remove any compatibility-mode flag), resource shrinking, keep rules via consumer rules; test reflection paths (serialization uses generated serializers).
2. `:baselineprofile` module (Macrobenchmark + Baseline Profile Gradle plugin) generating profiles for the real journeys per variant: cold start → login → home; market: home → search → product → cart → checkout; game: map → encounter; avatar: session start.
3. Enable **Startup Profile** generation so R8 lays out startup classes together; include library profiles; keep `profileinstaller` for sideload/older paths.
4. CI: generate on a real device, verify via Macrobenchmark `CompilationMode.Partial` vs `None` comparisons; fail on regression.
5. Instrument `reportFullyDrawn()` at the true "usable" point; track TTID/TTFD in production with JankStats and Play vitals.

## Appendix H — Support matrix template

```markdown
# Support matrix (per release)
| Item | Value |
| minSdk / targetSdk / compileSdk | 24 / 37 / 37 (AGP 9.1.1+) |
| ABIs | arm64-v8a (+armeabi-v7a if required) · 16 KB page-size aligned |
| GMS policy | Required | Optional (fallback providers: push/location/integrity) |
| Device tiers | Low (≤3 GB, Go) · Mid (4–6 GB) · High (≥8 GB) · device pool: <list> |
| Form factors | Phone, foldable, tablet, ChromeOS (resizable; orientation locks ignored ≥600dp at target 36) |
| Known limitations per tier | AR availability, background location, on-device ML, camera tracking, voice features |
```
