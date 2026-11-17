---
id: CHROME_EXTENSION_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [CHROME_EXTENSION]
---

# PLAYBOOK_CHROME_EXTENSION_PART2 — Enterprise-grade Chrome extension playbook (TypeScript, Manifest V3) (part 2)

> Part 2 of 2. Main entry: [`PLAYBOOK_CHROME_EXTENSION.md`](PLAYBOOK_CHROME_EXTENSION.md). Covers: 12. Enterprise capabilities … Appendix H — Diagnostics bundle specification.

## 12. Enterprise capabilities

### 12.1 Admin configuration: `storage.managed`

Declare a **JSON Schema** (`managed-schema.json`) referenced by
`storage.managed_schema`. Chrome validates it strictly: the top-level must be an
object without `additionalProperties`, and each schema needs `$ref` or exactly
one `type`; if the schema is invalid Chrome won't load the extension, and values
that don't conform aren't published. Administrators set values through
policy (`3rdparty.extensions.<id>`); verify at `chrome://policy`. The extension
reads them with `chrome.storage.managed` and reacts to `storage.onChanged`.
It is the extension's job to **enforce** the policy.

Recommended policy surface:

| Policy | Type | Effect |
|---|---|---|
| `TenantUrl` / `ApiBaseUrl` | string | Backend endpoint (validated against allowlist) |
| `SsoMode`, `IdpIssuer`, `ClientId` | string | SSO configuration |
| `AllowedHosts` | string[] | Sites where content features run (drives dynamic injection and optional host requests) |
| `BlockedHosts` | string[] | Sites where nothing runs |
| `FeatureFlags` | object<string,bool> | Enable/disable features centrally |
| `KillSwitch` | boolean | Disable all page interaction and sync |
| `TelemetryLevel` | enum (`off|errors|full`) | Governs diagnostics and analytics |
| `LogLevel` | enum | Local log verbosity |
| `UpdateWindow` | object | When to apply pending updates |
| `ForceSignInOnStartup` | boolean | Session policy |
| `DataRetentionDays` | integer | Local cache retention |
| `AllowUserSettings` | boolean | Lock or unlock user-level preferences |
| `SupportContact` | string | Shown in diagnostics UI |

Schema and policy examples: Appendix B.

### 12.2 Installation and update policy

| Need | Mechanism |
|---|---|
| Force-install silently | `ExtensionInstallForcelist` (`<id>;<update_url>`) or `ExtensionSettings` with `installation_mode: force_installed` and `update_url` |
| Pin to toolbar | `ExtensionSettings.toolbar_pin` |
| Restrict permissions/hosts | `ExtensionSettings` (`blocked_permissions`, `runtime_blocked_hosts`, `runtime_allowed_hosts`) |
| Block other extensions | `ExtensionInstallBlocklist` / allowlist |
| Private distribution | Chrome Web Store **private/unlisted** (visible to a domain or group) or a **self-hosted update feed** (signed CRX + update manifest) |
| Staged rollout | Roll out the policy by organizational unit; use CWS staged publishing and trusted testers for canaries |
| Update timing | Honor browser auto-update; optionally defer reload via `onUpdateAvailable` + `UpdateWindow` |

Document for admins (in `docs/admin-guide.md`): required network allowlists
(Web Store/update endpoints, API origins, IdP), supported Chrome versions
(include Extended Stable), proxy/PAC and TLS inspection notes, example policy
for Windows (registry/GPO/ADMX), macOS (plist/MDM), Linux (managed policy
JSON), Google Admin console and Chrome Browser Cloud Management, how to
verify (`chrome://policy`, `chrome://extensions`), and troubleshooting.

### 12.3 Kill switch, remote config and incident control

* **Kill switch** from two sources: managed policy (`KillSwitch`) and signed
  remote config (data). When on: stop injection, clear in-memory state,
  disable network except config polling, show a banner.
* **Per-feature flags** and **per-tenant overrides** via remote config (data
  only, schema-validated, signed, with bundled safe defaults).
* **Minimum version enforcement**: backend can reject outdated clients with a
  typed `upgrade-required` error that the UI surfaces and the SW handles by
  checking for updates (`runtime.requestUpdateCheck`).
* **Rollback** = ship a higher version containing the revert (versions only go
  up) **plus** the kill switch for immediate containment.

### 12.4 Identity, device and multi-profile

* Support multiple Chrome profiles: state is per profile; never assume a
  single instance.
* Tie the extension session to the corporate identity (SSO), not the browser
  profile name.
* Incognito: decide per policy (`incognito` manifest key; default `not_allowed`
  for enterprise unless required).
* ChromeOS-only enterprise APIs (`chrome.enterprise.*`) are out of scope unless
  you target managed ChromeOS **(verify)**.

### 12.5 Supportability and audit

* **Diagnostics bundle** (options page, "Export diagnostics"): version, channel,
  manifest hash, permissions granted, policy snapshot (secrets redacted),
  effective config, storage usage, queue/DLQ stats, recent logs (ring buffer),
  last errors with correlation IDs. Generated locally, user-initiated.
* **Audit events** to the backend (if policy allows): sign-in/out, policy
  applied, feature toggled, data export, kill switch state, permission grants.
  Redacted, correlated, rate-limited.
* **Version and health reporting**: the SW reports version, channel, Chrome
  version and policy hash with each session refresh (so admins and support can
  see fleet state), subject to `TelemetryLevel`.
* **Admin documentation and runbooks** are release artifacts (section 18).

---

## 13. Security engineering

### 13.1 Threat model (extension-specific)

| Threat | Examples | Controls |
|---|---|---|
| **Hostile web page** | Spoofed messages, DOM tampering, stealing injected UI data, clickjacking | Sender validation, message permission table, Shadow DOM, validated bridge, no secrets in content world |
| **Compromised content script / renderer** | Calls privileged RPC | Content-script capability subset; SW enforces; sensitive actions need UI-confirmed user gesture in a trusted context |
| **XSS in extension pages** | Untrusted data rendered in popup/side panel | No `innerHTML`, sanitization, strict CSP, Trusted Types where practical, escape on render |
| **Token/session theft** | Malware, other extensions, devtools | `storage.session`, short TTL, server-side revocation, no tokens in logs |
| **Supply-chain compromise** | Malicious dependency, build tool, CI | Lockfile, pinned versions with release-age cooldown, SCA, provenance, reproducible build, signed artifacts |
| **Store account takeover / ownership transfer** | Malicious update pushed | 2-step verification, group publisher with least privilege, publish approval, monitoring of listing changes, kill switch |
| **Over-broad permissions** | Abuse if compromised | Permission register, optional permissions, admin host restrictions |
| **Malicious remote config** | Tampered selectors/flags | Signature verification, schema validation, bundled fallback, no executable content |
| **Update hijack (self-hosted)** | Tampered CRX or feed | Signed CRX, HTTPS update URL, pinned key, integrity checks, monitored feed |
| **Data exfiltration** | Capturing page data beyond purpose | Data minimization, allowlisted hosts, local redaction, purpose limitation, audit |
| **Malicious/insider admin config** | Pointing `TenantUrl` at attacker | Validate against allowlisted patterns baked into the build or signed config |
| **Side-channel via logs/telemetry** | PII leak | Redaction, `TelemetryLevel`, retention |

### 13.2 Controls checklist

* MV3 CSP with no `unsafe-eval`; no `eval`, `new Function`, string timers; CI
  bundle scanner fails on them (including in dependencies).
* **No remotely hosted code**; no dynamic script injection by URL.
* `chrome.runtime.onMessage` handlers all pass through the validation wrapper.
* Allowlist of origins for `externally_connectable` and bridges; no wildcards.
* HTML sanitization (DOMPurify-style allowlist) for any rich text; prefer text.
* No secrets in the bundle, manifest, source maps shipped to the store, or
  logs.
* Anti-tamper for configuration: validate `TenantUrl`/hosts against patterns.
* **Least-privilege APIs** per context: content scripts can't call
  privileged APIs by design (only `runtime.sendMessage` and a few others).
* Rate-limit and size-limit all inbound messages.
* Use `crypto.subtle`/`crypto.getRandomValues`, never `Math.random`, for
  security-relevant values.
* Dependency hygiene: minimal dependency count; review new packages (maintainer
  history, install scripts, size); disable lifecycle scripts by default;
  cooldown for fresh releases (e.g., 7–14 days) with a security-fix bypass;
  `npm audit`/OSV in CI; SBOM per release.
* Build integrity: CI builds from a clean checkout; the zip hash is recorded;
  artifacts signed/attested; the exact zip tested is the one published.

### 13.3 Secrets and keys

| Item | Handling |
|---|---|
| Manifest `key` private part / CRX signing key | KMS/HSM or offline vault; documented custody; rotation/recovery plan |
| Chrome Web Store API credentials | CI secret manager, scoped, rotated; publishing requires an approval gate |
| API client secrets | **None in the extension** (public client + PKCE) |
| Tenant provider keys | Never on the device |
| Sentry/telemetry DSN | Public-by-design but rate-limited and scoped; no PII |

### 13.4 Tooling gotchas under CSP

* Validators that compile code at runtime (some JSON-schema engines, template
  engines, `lodash.template`) violate CSP: use zod/valibot or precompiled
  standalone validators.
* Development builds may use `eval`-based source maps; production builds must
  not. Verify with a CSP-violation check in e2e.
* Third-party UI libraries that inject inline `<script>` or use
  `document.write` fail; vet them before adoption.

### 13.5 Security testing

Authz/permission tests of the message table (each type × each sender class);
fuzzing of message payloads and sender metadata; hostile-page e2e (spoofed
`postMessage`, DOM-injection, prototype pollution attempts); XSS payload suite
on all UIs and injected UI; CSP report/violation assertions; manifest
permission diff; dependency/bundle scans; periodic independent penetration test
of the extension and its backend integration.

---

## 14. Privacy and Chrome Web Store compliance

* **Single purpose**: the extension has one narrow, clearly described purpose;
  features outside it need a separate extension or strong justification.
* **Limited use / data minimization**: collect only what the feature needs;
  no selling data, no unrelated profiling; user-visible disclosure of what is
  collected, why and where it goes.
* **Privacy policy** linked in the listing and in the options page; the Web
  Store privacy/data-use declarations must match actual behavior (audit them
  each release).
* **Permission justifications** written for each permission in the listing
  (reuse the register).
* **No remote code**, no obfuscated code (minified is fine, obfuscation is not).
* **Consent and controls**: explicit onboarding explaining data access; admin
  policy can restrict (`TelemetryLevel`, `AllowedHosts`); user can pause
  features per site.
* **Data lifecycle**: retention limits, purge on sign-out/uninstall guidance,
  data-subject requests handled by the backend (see audit playbook).
* **Enterprise contracts**: processor role, sub-processor list, DPA; the
  extension reveals which hosts it reads and which backend it talks to in the
  admin guide.
* **Reviews and enforcement**: expect manual review for broad host
  permissions; keep a runbook for rejections, appeals and emergency
  takedowns; keep contact info current (publisher account).

---

## 15. Observability and diagnostics

| Signal | Implementation |
|---|---|
| **Logging** | `LoggerPort` with levels, structured JSON, redaction, correlation IDs shared with the backend; local **ring buffer** in IndexedDB (bounded); remote logging only per `TelemetryLevel` |
| **Errors** | Global handlers in every context; error reporter (e.g., Sentry-compatible) with PII scrubbing, release and channel tags, sourcemaps uploaded privately (not shipped in the store zip) |
| **Metrics** | SW cold-start time, event-to-response latency, RPC latency/error rate, queue depth/age/DLQ, content-script injection time and adapter match rate, storage usage, memory samples, update success |
| **Tracing** | `correlationId` generated at the edge of an action (UI click, content event) and propagated through RPC, SDK headers and logs |
| **Health** | `health` RPC and projection: policy valid, session valid, API reachable, adapters OK, versions |
| **Alerts** | Server-side alerts on spikes of `adapter-failed`, `rpc-error`, `upgrade-required`, update failures per version |
| **Privacy** | No page content or URLs in telemetry unless essential and allowed; hash/ truncate hosts; admin can set `off` |

---

## 16. Performance and reliability budgets

Set budgets in config and fail CI on regression (use measured baselines):

| Area | Budget (starting points) |
|---|---|
| SW bundle size | Small enough for cold start of a few tens of ms of parse; track KB per release |
| SW cold start to first handled event | Track p50/p95; investigate regressions |
| Content script size (per site family) | Keep minimal (tens of KB gzip); lazy-load UI |
| Injection cost on page | Negligible main-thread time; no layout thrash; observers throttled |
| Popup time to interactive | Under a few hundred ms |
| Memory | Stable over a 24-hour soak; no growth from observers/ports |
| Storage | Bounded; alerts at thresholds |
| RPC round trip | p95 tracked per message type |
| Battery/CPU | No background polling beyond alarms; idle SW |

Reliability: handle SW restarts at any point, orphaned content scripts after
updates, offline mode, API outages (degraded UI with cached projections),
quota exhaustion, corrupted storage (reset path with user/admin message),
policy changes mid-flow, and multi-profile/multi-window usage.

---

## 17. Testing strategy

Follows `PLAYBOOK_TESTS.md` with extension specifics.

| Level | Scope | Tooling (examples) |
|---|---|---|
| Unit | domain, application use cases with fake ports; pure functions (policy resolver, migrations, matchers) | Vitest/Jest |
| ViewModel | states and commands with fake RPC | `renderHook` |
| Platform adapters | `chrome.*` wrappers against a fake browser | `@webext-core/fake-browser` or hand fakes |
| Contract | message protocol (both ends use the same schemas), SDK vs OpenAPI, managed schema vs examples, storage schema versions | schema tests, MSW |
| Component / a11y | Views per status; axe | RTL, axe |
| **Integration** | SW + storage + queue with fake timers; migration from every released fixture | Vitest |
| **E2E (real Chrome)** | Load the built extension in a persistent context with the extension flags; drive popup/side panel/options; hostile test pages; content scripts on fixture sites; OAuth against a mock IdP | Playwright (extension-capable, new headless mode **(verify)**) |
| **SW lifecycle** | Terminate the worker mid-flow (via devtools protocol or restart) and assert resumption | Playwright + CDP |
| **Policy** | Launch Chrome with a managed policy file; assert `storage.managed` values, locked UI, kill switch, host restrictions, invalid values ignored | Playwright + OS policy directory |
| Security | message permission table, fuzzing, XSS payloads, CSP violations, bundle scan for `eval`, manifest permission diff | Custom + Semgrep |
| Performance | cold start, injection cost, memory soak | Playwright traces, custom harness |
| Upgrade | Install vN-1, populate data, update to vN, verify migrations and orphan handling | Scripted e2e |
| Cross-version | Min supported Chrome, Stable, Beta; Edge | CI matrix |
| Store readiness | Manifest lint, listing assets, privacy declarations check | Script + checklist |

Rules: tests never use real customer data or real IdP/production endpoints;
fixtures for host pages are static HTML snapshots; e2e keeps to critical
journeys (sign-in, capture, admin policy, kill switch, update); every message
type has a contract test and a sender-class permission test.

---

## 18. Build, release and operations

### 18.1 Tooling and configuration

* Package manager with lockfile and frozen installs; Node LTS; TypeScript
  strict; ESLint (type-aware) + dependency-cruiser; Prettier; Vitest;
  Playwright.
* Build per channel: `dev` (local), `staging` (internal), `canary`
  (pilot group), `stable` (all). Each has its own extension ID, name suffix,
  icon badge, API base URL and telemetry project.
* `wxt.config.ts` (or equivalent) generates the manifest from typed config;
  **manifest and permission snapshots** are committed and diffed in PRs.
* Source maps: generated, uploaded to the error tracker privately, excluded
  from the published zip.

### 18.2 CI pipeline

| Stage | Gate |
|---|---|
| Install | Frozen lockfile; lifecycle scripts disabled by default; registry allowlist |
| Static | Typecheck, lint, architecture rules, `chrome` global restriction, forbidden-API scan (`eval`, remote scripts) |
| Unit/integration/contract | Must pass; coverage floor on domain/application |
| Build | Reproducible build; record zip hash; SBOM |
| Manifest checks | Permission/host diff vs. register; CSP check; `minimum_chrome_version`; locale completeness |
| Security | SAST, SCA, secrets scan, bundle scan |
| E2E | Real Chrome (min + stable), policy and upgrade suites on release branches |
| Package | Zip (store) and optional signed CRX (self-hosted); attestation |
| Publish | **Manual approval gate**, then upload via the Chrome Web Store API to the target channel (canary/trusted testers → stable with staged percentage) |
| Post-release | Monitor error rate, adapter match rate, update adoption; auto-alert to rollback criteria |

### 18.3 Versioning

* Semantic versioning mapped to Chrome's numeric `version` (for example
  `MAJOR.MINOR.PATCH.BUILD`); `version_name` carries the human/prerelease
  label.
* Storage migrations and protocol versions are versioned independently.
* A changelog (user-facing and admin-facing: permission changes, policy
  additions, deprecations) ships with every release.

### 18.4 Rollout and rollback

1. Internal channel (staging ID) for every merge to main.
2. **Canary** to a pilot group (trusted testers / pilot OU) for a fixed soak.
3. **Staged** public/enterprise rollout in increasing percentages with
   automated health checks.
4. **Rollback**: publish a fixed higher version; use the **kill switch** or
   feature flags for immediate containment; for self-hosted feeds, point the
   update manifest to the fixed build.
5. Permission increases are batched, announced in the admin changelog ahead of
   time, and never bundled with urgent fixes.

### 18.5 Environments and data

Staging and canary never use production tenant data; test tenants are
synthetic. Production synthetic monitoring uses a dedicated test tenant with
read-only operations.

### 18.6 Runbooks (required)

Store rejection/takedown and appeal · compromised publisher account · leaked
signing key or manifest key · malicious dependency discovered · broken release
(rollback + kill switch) · adapter breakage after a target site change · policy
misconfiguration at a customer · mass sign-out/IdP outage · data incident
(privacy) · Chrome version regression.

---

## 19. Cross-browser strategy

* **Edge** (Chromium) works with the same package; publish to Edge Add-ons if
  required; enterprise force-install uses Edge's own policy hives.
* **Firefox/Safari**: use the build adapter (WXT) and keep browser differences
  behind `platform/` ports (`browser` vs `chrome` namespaces, event-page vs
  service-worker background, `sidePanel` vs `sidebar_action`, missing APIs).
  Treat as separate release channels with their own tests.
* Keep a **capability matrix** (feature → required API → supported browsers)
  and degrade gracefully where an API is absent.

---

## 20. Governance and compliance

* **Ownership**: CODEOWNERS for `manifest/config`, `managed-schema.json`,
  `src/security/**`, `src/platform/**`, `docs/permissions-register.md`,
  release workflows; security review required for permission or host changes.
* **Documents** (versioned): ADRs, permission register, data-flow diagrams,
  threat model, privacy review, admin guide, runbooks, release checklist.
* **Compliance mapping** (SOC 2 / ISO 27001 / ISO 9001, per
  `PLAYBOOK_AUDIT.md`): secure SDLC (CI gates, reviews), change management
  (release approvals, permission diffs), access control (publisher accounts,
  keys), logging/monitoring (telemetry, audit events), vendor management
  (store, error tracker), privacy (declarations, retention), availability
  (kill switch, staged rollout), evidence (CI artifacts, SBOM, release bundle).
* **Release evidence bundle** per version: zip hash, SBOM, test reports,
  permission diff, security scan results, approvals, rollout log.
* **Periodic**: quarterly permission-register review, annual pen test, DR drill
  for key/account loss, dependency refresh cadence, store-policy review after
  each policy update.

---

## 21. Working with Claude Code on this project

Per `PLAYBOOK_CLAUDE_CODE.md`:

* A **path-scoped rule** for `apps/extension/**` carrying the layer rules, the
  messaging/sender-validation rule, the "no `chrome.*` outside `platform/`" and
  "no remote code" rules, and links to this playbook (not `@`-imported).
* **Role policy**: only the integrator edits `wxt.config.ts`, manifest
  snapshots, `managed-schema.json`, lockfiles and release workflows; the
  security reviewer agent checks permission changes; the control plane (hooks,
  settings) stays human-owned.
* **Skills**: `new-extension-feature` (scaffold slice with ports, RPC types,
  ViewModel, tests), `new-message-type` (schema + sender-class entry +
  handler + contract test), `new-site-adapter` (adapter + HTML fixtures +
  tests), `permission-change` (register entry + justification + test).
* **Specs** for every feature include: contexts involved, messages added,
  permissions touched, policy keys, data collected, and test levels per AC.

---

## 22. Anti-patterns (reject in review)

| Anti-pattern | Why it fails |
|---|---|
| State in service-worker globals | Lost on termination |
| `setTimeout`/`setInterval` for scheduling | Worker dies; use alarms/queue |
| Keep-alive pings to prevent termination | Fragile, discouraged; redesign |
| Calling the API from content scripts | CORS, token exposure; route via SW |
| Tokens/secrets in content world or `storage.local` | Page/malware exposure |
| `<all_urls>` and broad `matches` by default | Review friction, risk, admin rejection |
| Trusting `window.postMessage`/`sendMessage` without sender checks | Page-driven privilege escalation |
| `innerHTML` with extracted data | XSS |
| `eval`/`new Function`/remote scripts/obfuscation | CSP + store policy violations |
| Business logic in React components or content scripts | Untestable, duplicated |
| Hand-edited manifest, no permission diff | Silent privilege creep |
| Listeners registered after `await` | Missed wake-up events |
| One giant bundle for all pages | Slow cold start and injection |
| Policy ignored in UI | Admin controls bypassed |
| No migration tests | Data loss on update |
| Shipping source maps/debug code to the store | Leak and size |
| Shared extension ID across channels | Cross-environment contamination |
| Silent catch-all error handling | Invisible breakage |

---

## 23. Definition of done and checklists

### 23.1 Feature DoD

- [ ] Spec lists contexts, messages, permissions, policy keys, data, test levels.
- [ ] Domain/application tested with fake ports; ViewModel statuses covered.
- [ ] New message types have schema, sender-class permission entry, handler, contract test.
- [ ] No new permission, or register entry + security review + justification text.
- [ ] Works after SW termination at any step; idempotent handlers.
- [ ] Respects policy (locked controls, kill switch, allowed/blocked hosts).
- [ ] Telemetry: correlation ID, errors, metrics, redaction verified.
- [ ] i18n keys, a11y checks, performance budget respected.
- [ ] Storage changes have schema version + migration + fixture.

### 23.2 Release checklist

- [ ] Reproducible build; zip hash recorded; SBOM and scans green.
- [ ] Manifest/permission diff reviewed; register updated; admin changelog written.
- [ ] Unit, integration, contract, e2e (min + stable Chrome), policy, upgrade suites green.
- [ ] Privacy declarations and listing text match behavior.
- [ ] Canary soak complete; health metrics within thresholds.
- [ ] Approval gate passed; staged rollout configured; rollback and kill switch verified.
- [ ] Runbooks and admin guide current.

### 23.3 Architecture acceptance checklist

- [ ] MV3, TypeScript strict, generated manifest per channel with stable IDs.
- [ ] Layers enforced by tooling; `chrome` only in `platform/`.
- [ ] SW is the sole owner of session, SDK, durable writes and queue.
- [ ] All listeners top-level and synchronous; no durable globals.
- [ ] Typed, validated messaging with sender validation and permission table.
- [ ] Typed storage with versions, migrations, locks, quota guards.
- [ ] Content scripts minimal, isolated, adapter-based, no secrets, orphan-safe.
- [ ] UIs follow MVVM + SDK port via RPC; routes mirror the URL playbook.
- [ ] Managed schema, policy resolver, kill switch, remote config (data only), diagnostics export.
- [ ] CSP clean; no remote/eval code; dependency and supply-chain controls in CI.
- [ ] Observability: logs, metrics, errors, correlation IDs, health.
- [ ] Test pyramid including SW lifecycle, policy, upgrade, hostile-page suites.
- [ ] Release pipeline with approval gate, staged rollout, rollback, runbooks.
- [ ] Permission register, ADRs, threat model, privacy review, admin guide current.

---

## Appendix A — Manifest template (generated; shown for review)

```json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "description": "__MSG_extDescription__",
  "default_locale": "en",
  "version": "1.0.0.0",
  "version_name": "1.0.0",
  "minimum_chrome_version": "120",
  "key": "<public key per channel>",
  "incognito": "not_allowed",
  "background": { "service_worker": "background.js", "type": "module" },
  "action": { "default_title": "__MSG_actionTitle__", "default_popup": "popup.html" },
  "side_panel": { "default_path": "sidepanel.html" },
  "options_ui": { "page": "options.html", "open_in_tab": false },
  "permissions": ["storage", "alarms", "sidePanel", "scripting", "identity"],
  "optional_permissions": ["notifications", "downloads"],
  "host_permissions": ["https://api.<product>.example/*"],
  "optional_host_permissions": ["https://*/*"],
  "content_scripts": [
    {
      "matches": ["https://app.<site>.example/*"],
      "js": ["content-scripts/site.js"],
      "run_at": "document_idle",
      "all_frames": false,
      "world": "ISOLATED"
    }
  ],
  "storage": { "managed_schema": "managed-schema.json" },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; base-uri 'none'"
  },
  "web_accessible_resources": [],
  "externally_connectable": { "matches": ["https://app.<product>.example/*"] }
}
```

## Appendix B — Managed schema and policy examples

**`managed-schema.json`** (constraints: object at top level, no
`additionalProperties`, one `type` per property)

```json
{
  "type": "object",
  "properties": {
    "TenantUrl": { "title": "Tenant URL", "description": "Base URL of your organization's tenant.", "type": "string" },
    "AllowedHosts": { "title": "Allowed sites", "type": "array", "items": { "type": "string" } },
    "BlockedHosts": { "title": "Blocked sites", "type": "array", "items": { "type": "string" } },
    "FeatureFlags": { "title": "Feature flags", "type": "object", "additionalProperties": { "type": "boolean" } },
    "KillSwitch": { "title": "Disable the extension's page features", "type": "boolean" },
    "TelemetryLevel": { "title": "Telemetry", "type": "string", "enum": ["off", "errors", "full"] },
    "DataRetentionDays": { "title": "Local data retention (days)", "type": "integer", "minimum": 0 },
    "AllowUserSettings": { "title": "Let users change preferences", "type": "boolean" }
  }
}
```

**Policy delivery (Linux managed JSON shown; equivalent in registry/plist/Admin console)**

```json
{
  "ExtensionSettings": {
    "<extension-id>": {
      "installation_mode": "force_installed",
      "update_url": "https://clients2.google.com/service/update2/crx",
      "toolbar_pin": "force_pinned"
    }
  },
  "3rdparty": {
    "extensions": {
      "<extension-id>": {
        "TenantUrl": "https://acme.<product>.example",
        "AllowedHosts": ["https://crm.acme.example/*"],
        "TelemetryLevel": "errors",
        "FeatureFlags": { "leadCapture": true, "bulkExport": false }
      }
    }
  }
}
```

## Appendix C — Typed messaging contract (sketch)

```ts
// src/contracts/protocol.ts
import { z } from 'zod';

export const Envelope = z.object({
  v: z.literal(1),
  id: z.string(),
  correlationId: z.string(),
  type: z.string(),
  payload: z.unknown(),
});

export const protocol = {
  'session.get':  { req: z.object({}).strict(), res: SessionSummary, senders: ['ui'] },
  'lead.capture': { req: LeadCaptureInput,       res: LeadCaptureResult, senders: ['ui', 'content'] },
  'policy.get':   { req: z.object({}).strict(), res: EffectivePolicySummary, senders: ['ui', 'content'] },
} as const;

export type Protocol = typeof protocol;
export type Req<K extends keyof Protocol> = z.infer<Protocol[K]['req']>;
export type Res<K extends keyof Protocol> = z.infer<Protocol[K]['res']>;
```

```ts
// src/messaging/server.ts (service worker; platform wrapper hides chrome.*)
export function registerRpc(container: Container, rt: RuntimePort) {
  rt.onMessage(async (raw, sender) => {
    const env = Envelope.safeParse(raw);
    if (!env.success) return err('bad-envelope');
    const def = protocol[env.data.type as keyof Protocol];
    if (!def) return err('unknown-type');
    const klass = classifySender(sender, rt.id());              // 'ui' | 'content' | 'external' | 'unknown'
    if (!(def.senders as readonly string[]).includes(klass)) return err('forbidden-sender');
    const parsed = def.req.safeParse(env.data.payload);
    if (!parsed.success) return err('validation');
    return handlers[env.data.type as keyof Protocol](container, parsed.data, ctxFrom(env.data, sender));
  });
}
```

## Appendix D — Typed store with version, schema and lock (sketch)

```ts
export function createStore<T>(opts: {
  area: StorageAreaPort; key: string; version: number;
  schema: z.ZodType<T>; fallback: T; migrate?: Record<number, (v: unknown) => unknown>;
}): KeyValueStore<T> {
  const read = async () => { /* load {v, data}; run migrations v→v+1; parse; fallback on failure */ };
  return {
    get: read,
    update: (fn) => locks.run(opts.key, async () => {
      const next = fn(await read());
      await opts.area.set(opts.key, { v: opts.version, data: opts.schema.parse(next) });
      return next;
    }),
  };
}
```

## Appendix E — Service worker entry and content-script entry (sketch)

```ts
// entrypoints/background.ts
export default defineBackground(() => {
  const container = buildContainer();           // cheap: wires ports → adapters lazily
  registerRpc(container, platform.runtime);     // top-level, synchronous
  registerLifecycle(container);                 // onInstalled / onStartup / onUpdateAvailable
  registerAlarms(container);                    // drain queue, refresh session/policy
  registerNavigation(container);                // narrow filters
  registerPolicyWatcher(container);             // storage.onChanged(managed)
});
```

```ts
// entrypoints/content/site.content.ts
export default defineContentScript({
  matches: ['https://app.<site>.example/*'],
  runAt: 'document_idle',
  async main(ctx) {
    if (!(await guards.allowed())) return;           // policy, kill switch, context valid
    const rpc = createRpcClient(platform.runtime);
    const adapter = siteAdapters.select(new URL(location.href));
    const stop = adapter?.observe({ emit: (e) => rpc.call('lead.capture', toDto(e)) });
    ctx.onInvalidated(() => stop?.());               // extension updated/unloaded: clean teardown
  },
});
```

## Appendix F — Architecture rules (dependency-cruiser sketch)

```text
forbidden:
  - domain/** → anything except shared-kernel
  - application/** → adapters/**, platform/**, chrome (global), react
  - viewmodels/** → react-dom, chrome, platform/**, adapters/**
  - ui/** (views) → sdk, platform/**, storage/**
  - features/<a>/** → features/<b>/** except via <b>/contracts
  - content entrypoints → sdk, storage (tokens), platform/identity
eslint:
  - no-restricted-globals: chrome, browser (allowed only in src/platform/**)
  - no-restricted-syntax: eval, new Function, setTimeout(string), innerHTML assignments
```

## Appendix G — Permissions register entry

```markdown
### scripting
- Why: inject the capture UI into customer-approved CRM pages programmatically.
- Feature(s): lead capture (F-012), side-panel assist (F-020).
- Data touched: visible text of the active page region, only after user action.
- Alternatives considered: static content_scripts (rejected: host list is tenant-specific).
- Host access: optional_host_permissions + admin AllowedHosts.
- Owner: <name>   Security reviewer: <name>   Last review: <date>   Next: <date>
- Store justification text: "<copy for listing>"
- Tests: e2e/hostile-page, permission-diff gate.
```

## Appendix H — Diagnostics bundle specification

```text
diagnostics-<version>-<timestamp>.json (user-initiated export, redacted)
 - extension: version, channel, manifest hash, id, chrome version, platform
 - permissions: granted (required/optional), host permissions granted
 - policy: managed snapshot (values validated, secrets removed), effective config, locked controls
 - state: session summary (no tokens), tenant id, queue depth/age/DLQ counts, storage usage
 - health: API reachability, last config fetch, adapter match stats, last 50 error events with correlation IDs
 - logs: ring-buffer tail (redacted), limited to N KB
```
