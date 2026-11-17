---
id: MOBILE_IOS_SWIFT_PART3
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [MOBILE_IOS_SWIFT]
---

# PLAYBOOK_MOBILE_IOS_SWIFT_PART3 — Native iOS playbook (Swift 6.x · SwiftUI in code · Game · Market · Avatar) (part 3)

> Part 3 of 3. Main entry: [`PLAYBOOK_MOBILE_IOS_SWIFT.md`](PLAYBOOK_MOBILE_IOS_SWIFT.md). Covers: 19. Governance, compliance and working with Claude Code … Appendix G — Support matrix template.

## 19. Governance, compliance and working with Claude Code

* **Ownership:** CODEOWNERS for the project manifest, `Config/**`, entitlements/Info keys, `PrivacyInfo.xcprivacy`, `Package.resolved`, `Packages/Core/{Security,Scene*}`, push/auth packages, `docs/permissions-register.md`.
* **Documents:** ADRs, dependency and permissions registers, device pool/tiers, support matrix, threat model, data-flow diagrams, privacy review, App Store submission checklist, runbooks.
* **Compliance mapping** (`PLAYBOOK_AUDIT.md`): SDLC controls via CI gates; vendor management for SDKs/providers (maps, payments, voice/LLM, avatar, crash reporting); privacy evidence for location/voice/face data; change management via TestFlight + phased release; incident runbooks;
  evidence bundle per release (builds, SBOM, test/perf reports, entitlement/privacy diffs, approvals). CRA applicability for distributed apps: assess with counsel **(verify)**.
* **Claude Code** (`PLAYBOOK_CLAUDE_CODE.md`): path-scoped rules for `ios/**`, `Packages/**`, `Apps/**`; **rule: every view is Swift code; never create `.storyboard`, `.xib`, `.rcproject`, `.xcdatamodeld`**; the integrator role owns manifests, `.xcconfig`, entitlements, `Package.resolved` and CI;
  skills: `new-ios-feature` (package scaffold: Domain/Data/UI/Contracts + tests), `new-notification-type` (schema, category, deep link, handler, test), `new-scene-asset` (pipeline + budgets), `ios-perf-check`, `privacy-manifest-update`;
  specs list variants, entitlements/usage strings, tiers, budgets, push types, routes and test levels per AC. Xcode 26.3+ can host Claude Agent directly; prefer MCP/CLI-driven builds for reproducibility in CI.

---

## 20. Anti-patterns (reject in review)

| Anti-pattern | Why it fails |
|---|---|
| Storyboards/XIBs/Interface Builder, Reality Composer Pro scenes or `.xcdatamodeld` as source of truth | Unreviewable, merge-hostile, not agent-editable |
| Hand-editing `project.pbxproj`; committing a generated project | Merge conflicts and drift |
| Xcode Cloud GUI-only workflows | CI not reviewable as code |
| One app with all three products and all engines | Size, memory, entitlements and review surface |
| UI code importing `Data` or platform adapters; `Domain` importing SwiftUI/URLSession | Breaks layering and fast tests |
| Business logic in views; networking in `body` | Untestable, re-render cost |
| `ObservableObject` + broad `@Published` everywhere on hot screens | Over-invalidation on old CPUs |
| Unstructured `Task {}`/detached tasks without cancellation; `@unchecked Sendable` sprinkled around | Data races and leaks |
| Blocking the main actor (disk, network, JSON, crypto) | Hangs and watchdog kills |
| `AsyncImage` for lists; unbounded image caches; full-size bitmaps | Memory/jetsam |
| Many dynamic frameworks; heavy work in `App.init` or static initializers | Slow launch |
| SceneKit for new work; WKWebView 3D/games on Low/Mid | Deprecated/slow |
| Custom translucent/glass stacks over scrolling content without tier gating | GPU cost on older devices |
| Requiring ARKit/TrueDepth/Apple Intelligence for core flows | Excludes many devices |
| Using `AsyncBytes.lines` for SSE | Drops blank-line event delimiters |
| Tokens in `UserDefaults`/GRDB plaintext/logs; embedded login WebViews; custom crypto | Credential theft |
| Asking all permissions at first launch | Denials and review risk |
| Push payloads with sensitive data; push as the only sync path | Privacy leaks, missed state |
| Dependence on one avatar/voice vendor runtime | Shutdown risk (e.g., Ready Player Me closed in January 2026) |
| No Low-pool testing; trusting simulators | Unproven claims |

---

## 21. Definition of done and checklists

### 21.1 Feature DoD

- [ ] Spec lists variant(s), slice, routes, permissions, push types, tier behavior, budgets and test levels per AC.
- [ ] Views are Swift code with `#Preview`; no forbidden visual-builder files; ViewModels/use cases tested with fakes; all statuses covered; no logic in views.
- [ ] Low-tier path implemented and verified on the Low pool; governor behavior defined; Compatibility visual mode honored.
- [ ] Uses the generated Swift SDK; no hand-written paths/DTOs; error taxonomy handled; correlation IDs surfaced.
- [ ] Permissions requested in context with primer + degraded path; usage strings/entitlements and the permissions register updated.
- [ ] Accessibility verified (VoiceOver, Dynamic Type accessibility sizes, contrast, Reduce Motion/Transparency); strings in String Catalogs; RTL/pseudo-locale checked.
- [ ] Offline/slow-network behavior defined; outbox/idempotency for mutations.
- [ ] Swift 6 strict concurrency clean; no main-actor blocking (Instruments checked); launch and scroll metrics within budget.
- [ ] Telemetry and redaction verified; no sensitive data in logs/analytics/push.

### 21.2 Release checklist

- [ ] Reproducible builds per variant (generated project, pinned Xcode); binary size, entitlement, Info-key, privacy-manifest and dependency diffs reviewed; SBOM and scans green.
- [ ] Unit/architecture/contract/snapshot/UI/accessibility/security suites green on simulators and real devices.
- [ ] Low/Mid pool performance within budgets (launch, hangs, scroll, scene fps, memory, battery, crash-free).
- [ ] Push verified end to end (authorization states, foreground/background/killed, deep links, token lifecycle, sandbox vs production).
- [ ] Auth flows verified: register, verify, login (password/passkey/Sign in with Apple), MFA/step-up, forgot, reset, sign-out, deletion.
- [ ] App Store checklist verified (toolchain/SDK, guideline items, privacy manifests/labels, usage strings, age rating).
- [ ] Phased release, kill switch and rollback plan ready; runbooks current.

### 21.3 Architecture acceptance checklist

- [ ] Current Xcode/Swift toolchain, Swift 6 mode, deployment target decision recorded; `#Preview` everywhere.
- [ ] Text project manifest + `.xcconfig` + entitlements in files; generated project git-ignored; CI blocks storyboards/XIBs/RCP/`.xcdatamodeld`/hand-edited pbxproj.
- [ ] Three app targets; per-variant packages, entitlements and usage strings verified by CI.
- [ ] `Domain` targets import no UI/platform frameworks; `UI` never depends on `Data`; cross-slice only via `Contracts`; dependency-graph check green.
- [ ] Observation ViewModels with shared statuses; UI packages default to `@MainActor`; repositories are actors; no unstructured tasks leaking.
- [ ] Route table parity with `Route` enum; Universal Links verified; deep links validated and resumed after auth.
- [ ] Shared shell: onboarding, login (Sign in with Apple/passkeys/OIDC), registration, forgot/reset, session security, deletion.
- [ ] Push: APNs token auth, categories, authorization flow, token lifecycle, notification service extension, deep-link routing.
- [ ] `DeviceTier`, measured benchmark, `QualityGovernor` (thermal, Low Power Mode, memory, frame pacing), remote overrides, performance modes.
- [ ] `SceneEnginePort` with sprite, RealityKit, Metal/Godot, Unity adapters; lazy load/dispose; fallback chain; no SceneKit for new work.
- [ ] Asset pipeline (USDZ/ASTC, LODs, budgets), Background Assets or CDN delivery with signed manifests.
- [ ] Game: server-authoritative, GL-layer map, Core Location modes, ARKit optional with fallback, anti-cheat signals.
- [ ] Market: server-authoritative pricing, idempotent checkout, Apple Pay/Stripe, lazy lists + Nuke sizing.
- [ ] Avatar: open formats converted in the pipeline, provider port, voice pipeline with barge-in, performance-script contract, optional face tracking.
- [ ] MetricKit/os_signpost/crash reporting, remote config, kill switch, diagnostics bundle.
- [ ] Device-lab testing with Low/Mid pool and CI performance gates.

---

## Appendix A — Package manifest for a slice (sketch)

```swift
// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MarketCart",
    platforms: [.iOS(.v18)],
    products: [
        .library(name: "CartContracts", targets: ["CartContracts"]),
        .library(name: "CartDomain",    targets: ["CartDomain"]),
        .library(name: "CartData",      targets: ["CartData"]),
        .library(name: "CartUI",        targets: ["CartUI"]),
    ],
    dependencies: [ .package(path: "../../Core/Kernel"), .package(path: "../../Core/SDK"), .package(path: "../../Core/DesignSystem"), .package(path: "../../Core/UICore") ],
    targets: [
        .target(name: "CartContracts", dependencies: ["Kernel"]),
        .target(name: "CartDomain",    dependencies: ["Kernel", "CartContracts"]),                         // PURE: no UI/platform imports
        .target(name: "CartData",      dependencies: ["CartDomain", "SDK", "Kernel"]),
        .target(name: "CartUI",        dependencies: ["CartDomain", "DesignSystem", "UICore"],
                swiftSettings: [.defaultIsolation(MainActor.self)]),                                      // UI code is @MainActor by default
        .testTarget(name: "CartDomainTests", dependencies: ["CartDomain"]),                              // Swift Testing
        .testTarget(name: "CartUITests",     dependencies: ["CartUI"]),                                  // snapshot/ViewModel tests
    ],
    swiftLanguageModes: [.v6]
)
```

## Appendix B — Tuist manifest for the three variants (sketch; verify the Tuist API version you adopt)

```swift
import ProjectDescription

func app(_ name: String, bundleId: String, features: [TargetDependency], entitlements: Path) -> Target {
    .target(
        name: name, destinations: .iOS, product: .app, bundleId: bundleId,
        deploymentTargets: .iOS("18.0"),
        infoPlist: .extendingDefault(with: [
            "UILaunchScreen": [:],                                           // code-defined launch screen, no storyboard
            "NSLocationWhenInUseUsageDescription": "…specific, honest purpose…",
        ]),
        sources: ["Apps/\(name)/Sources/**"], resources: ["Apps/\(name)/Resources/**"],
        entitlements: .file(path: entitlements),
        dependencies: features,
        settings: .settings(configurations: [.debug(name: "Debug", xcconfig: "Config/Debug.xcconfig"), .release(name: "Release", xcconfig: "Config/Release.xcconfig")])
    )
}

let project = Project(
    name: "Mobile",
    targets: [
        app("Game",   bundleId: "com.example.mobile.game",   features: [.package(product: "GameMapUI")],  entitlements: "Config/Game.entitlements"),
        app("Market", bundleId: "com.example.mobile.market", features: [.package(product: "CartUI")],     entitlements: "Config/Market.entitlements"),
        app("Avatar", bundleId: "com.example.mobile.avatar", features: [.package(product: "AvatarSessionUI")], entitlements: "Config/Avatar.entitlements"),
    ]
)
```

## Appendix C — Device tier from native signals (sketch)

```swift
struct DeviceCapabilities: DeviceCapabilityPort {
    func hintTier() -> DeviceTier {
        let gb = Double(ProcessInfo.processInfo.physicalMemory) / 1_073_741_824
        let gpu = MTLCreateSystemDefaultDevice()
        let apple7 = gpu?.supportsFamily(.apple7) ?? false      // A14-class GPU and newer
        let apple9 = gpu?.supportsFamily(.apple9) ?? false      // A17/M3-class and newer
        switch (gb, apple7, apple9) {
        case (..<3.5, _, _), (_, false, _): return .low         // 3 GB class or pre-A14 GPU family
        case (_, _, true) where gb >= 7:    return .high
        default:                            return .mid
        }
    }
    func thermal() -> AsyncStream<Thermal> {
        AsyncStream { c in
            let t = NotificationCenter.default.addObserver(forName: ProcessInfo.thermalStateDidChangeNotification, object: nil, queue: nil) { _ in
                c.yield(Thermal(ProcessInfo.processInfo.thermalState)) }
            c.onTermination = { _ in NotificationCenter.default.removeObserver(t) }
        }
    }
}
// Memory guard before loading a scene: refuse or step the tier down if os_proc_available_memory() < required budget.
```

## Appendix D — Push delegate, payload and routing (sketch)

```swift
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ app: UIApplication, didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self; return true
    }
    func application(_ app: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
        Task { await environment.devices.upload(tokenHex: token.map { String(format: "%02x", $0) }.joined()) }   // idempotent, includes sandbox/production
    }
    func userNotificationCenter(_ c: UNUserNotificationCenter, didReceive r: UNNotificationResponse) async {
        guard let payload = PushPayload(userInfo: r.notification.request.content.userInfo) else { return }       // versioned schema
        await environment.router.handle(deepLink: payload.deepLink)                                              // allowlist + resume after auth
    }
    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification) async -> UNNotificationPresentationOptions {
        environment.foregroundPolicy.options(for: n)                                                            // by category and current screen
    }
}
```

## Appendix E — SSE over `URLSession.bytes` (sketch; parse raw bytes, not `.lines`)

```swift
func stream(url: URL, lastID: String?) -> AsyncThrowingStream<SSEEvent, Error> {
    AsyncThrowingStream { continuation in
        let task = Task {
            var req = URLRequest(url: url, timeoutInterval: 45)               // > server heartbeat (15 s)
            req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
            req.setValue("Bearer \(await session.accessToken())", forHTTPHeaderField: "Authorization")
            if let lastID { req.setValue(lastID, forHTTPHeaderField: "Last-Event-ID") }
            var parser = SSEParser(maxLine: 64 * 1024, maxEvent: 256 * 1024)   // spec-compliant: CR/LF/CRLF, comments, retry, id
            do {
                let (bytes, resp) = try await dedicatedSession.bytes(for: req)
                try validate(resp)
                for try await byte in bytes { for e in parser.feed(byte) { continuation.yield(e) } }
                continuation.finish()
            } catch { continuation.finish(throwing: error) }
        }
        continuation.onTermination = { _ in task.cancel() }
    }
}
```

## Appendix F — Info.plist/entitlements checklist per variant

| Item | Game | Market | Avatar |
|---|---|---|---|
| `NSLocationWhenInUseUsageDescription` | ✔ | optional | ✘ |
| `NSLocationAlwaysAndWhenInUseUsageDescription` + `UIBackgroundModes: location` | only if background play | ✘ | ✘ |
| `NSCameraUsageDescription` | AR | scan/photos | tracking |
| `NSMicrophoneUsageDescription` | optional | optional | ✔ |
| `NSSpeechRecognitionUsageDescription` | optional | optional | if Speech framework |
| `NSFaceIDUsageDescription` | optional | optional | optional |
| `UIBackgroundModes: remote-notification / processing / audio` | remote-notification, processing | remote-notification, processing | remote-notification, processing (+ audio only if needed) |
| Capabilities | Push, Associated Domains, Sign in with Apple, Game Center (opt.), In-App Purchase | Push, Associated Domains, Sign in with Apple, Apple Pay, Live Activities (opt.) | Push, Associated Domains, Sign in with Apple, In-App Purchase |
| `UILaunchScreen` | code-defined (no storyboard) | same | same |
| `PrivacyInfo.xcprivacy` | app + SDKs | app + SDKs | app + SDKs |

## Appendix G — Support matrix template

```markdown
# Support matrix (per release)
| Item | Value |
| Toolchain | Xcode 27.x (Swift 6.4) · App Store floor: Xcode 26 / iOS 26 SDK |
| Deployment target | iOS 18.0 (iOS 17 only with fleet data) |
| Devices | iPhone XS/XR and later on iOS 18; iPhone 11/SE 2+ on iOS 26/27 · Low/Mid/High tiers · device pool: <list> |
| Capabilities by tier | AR, face tracking (TrueDepth), on-device speech, Foundation Models (Apple Intelligence devices only), ProMotion |
| Known limitations per tier | background location, camera tracking, voice features, 3D fidelity |
```
