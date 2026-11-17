---
id: CHROME_EXTENSION
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [FRONTEND, SECURITY]
---


# PLAYBOOK_CHROME_EXTENSION.md — Enterprise-grade Chrome extension playbook (TypeScript, Manifest V3)

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_CHROME_EXTENSION.md`](PLAYBOOK_CHROME_EXTENSION.md) | 1. Decisions up front … 11. Networking, authentication and SDK integration |
| 2 | [`PLAYBOOK_CHROME_EXTENSION_PART2.md`](PLAYBOOK_CHROME_EXTENSION_PART2.md) | 12. Enterprise capabilities … Appendix H — Diagnostics bundle specification |

Architecture and engineering contract for building, shipping and operating a
**Chrome extension at enterprise grade**: strict TypeScript, layered
(hexagonal) architecture, MVVM UIs, a typed SDK, hardened security,
administrator-controlled configuration, observable and testable, released
through a governed pipeline.

It extends `PLAYBOOK_FRONTEND.md` (MVVM + SDK, extension section),
`PLAYBOOK_URLS.md` (route/permission model), `PLAYBOOK_SECURITY.md`,
`PLAYBOOK_TESTS.md`, `PLAYBOOK_AUDIT.md` and `PLAYBOOK_CLAUDE_CODE.md`. It is
project-agnostic: replace `<product>`, `<tenant>` and `<api>` with your own.

The runnable, machine-checkable companion is the Chrome extension skill pack:
three Agent Skills (write, review, port) and a drop-in eslint config that
enforces this contract.

The rules that carry the whole file:

1. **Manifest V3 only.** Event-driven service worker, no remote code, no
   persistent background page.
2. **The service worker is the brain; everything else is a client of it.**
   It owns the session, the SDK, storage writes, queues and policy. UIs and
   content scripts are thin.
3. **The page is hostile.** Content scripts and any message from a web page
   are untrusted input; tokens never reach them.
4. **Layers do not leak.** `domain` and `application` never touch `chrome.*`
   or the DOM; platform access goes through ports.
5. **State is durable and the worker is mortal.** Nothing important lives in
   a global variable; every handler is resumable and idempotent.
6. **Least privilege, provably.** Every permission has a justification, an
   owner and a test; host access is narrow and admin-restrictable.
7. **Administrators are first-class users.** Configuration, rollout, kill
   switches, diagnostics and audit are designed in, not bolted on.
8. **Everything is typed at the boundary.** Messages, storage, policy and API
   payloads are validated schemas.
9. **Releases are boring.** Reproducible builds, permission diffs, staged
   rollout, rollback by kill switch.

> Verification note: the Chrome extension platform changes frequently. Facts
> below come from Chrome's documentation and engineering practice as of
> November 2026; items marked **(verify)** are version- or limit-dependent and
> must be re-checked against <https://developer.chrome.com/docs/extensions>
> and the Chrome Web Store developer policies before relying on them. Numeric
> limits (storage quotas, timers, review times) change; keep them as
> configuration constants with a source link, not as magic numbers.

---
## 1. Decisions up front

| Decision | Choice | Rationale |
|---|---|---|
| Manifest version | **MV3** (MV2 is no longer a supported path for new or existing listings) | Platform requirement |
| Language | **TypeScript**, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | Compile-time safety at every boundary |
| Build tool | **WXT** (Vite-based; maintained, cross-browser, generates manifest from conventions) as default; **plain Vite + CRXJS** if you need full control of the Vite config; avoid Plasmo for new projects (reported to be in maintenance mode) | Keeps the build a replaceable adapter; architecture below is tool-independent |
| UI | React + TypeScript, **MVVM** (shared ViewModels from the frontend playbook), Tailwind or CSS modules | Same pattern as web/mobile |
| Validation | **zod** (or valibot) schemas for messages, storage, policy, API | Avoid libraries that compile validators with `eval`/`new Function` under CSP (see 13.4) |
| API access | Shared **SDK** package, executed **only in the service worker** | Single place for tokens, retry, tenant headers |
| IPC | Typed RPC + events over `chrome.runtime` messaging/ports | One contract, validated both sides |
| State | SW as source of truth; `storage.local/session/sync/managed` + IndexedDB by purpose | Survives worker termination |
| Remote code | **Never**. Remote *data* (config, selectors) only, schema-validated and signed | Store policy + security |
| Distribution | Chrome Web Store (public or private/unlisted) **and** enterprise force-install via policy; optional self-hosted CRX feed | Enterprise reach |
| Config for admins | `storage.managed` with a JSON Schema + `ExtensionSettings` guidance | Policy over user choice |
| Browsers | Chrome first; Edge works (Chromium); Firefox/Safari through the build adapter if required | Section 19 |

---

## 2. Platform model

### 2.1 Execution contexts

| Context | Purpose | DOM | Lifetime | Can call SDK/API? | Trust level |
|---|---|---|---|---|---|
| **Service worker** (`background`) | Event router, session, SDK, jobs, policy, orchestration | No | Event-driven; terminated when idle | **Yes (only here)** | Trusted |
| **Popup** | Quick actions | Yes | Destroyed on close | Through SW | Trusted (extension origin) |
| **Side panel** | Persistent workspace per tab or global | Yes | While open | Through SW | Trusted |
| **Options page** | Settings, diagnostics | Yes | While open | Through SW | Trusted |
| **Offscreen document** | DOM/audio/clipboard/parsing tasks the worker can't do | Yes (hidden) | Independent of the worker | Through SW | Trusted |
| **Content script** (isolated world) | Read/augment host pages | Page DOM | Page lifetime | **No** | **Untrusted surroundings** |
| **Injected main-world script** | Access page JS objects (rare) | Page | Page lifetime | **No** | **Hostile** |
| **Web-accessible page/iframe** | Embeddable extension UI in a page | Yes | Frame lifetime | Through SW | Trusted code, hostile embedder |
| **Native messaging host** (optional) | Desktop integration | n/a | Process | n/a | Separate trust domain |

### 2.2 Service worker lifetime (design consequences)

Documented behavior **(verify limits)**: Chrome terminates an idle extension
service worker after about 30 seconds without events or extension API calls;
a single event handler can run roughly five minutes at most; a single fetch
response wait is also bounded (about 30 seconds). Consequences enforced by
this playbook:

* **Register every event listener synchronously at the top level** of the
  worker entry file. Listeners added after an `await` or inside a callback miss
  the event that woke the worker.
* **No state in module globals** that must outlive an event. Persist it
  (`storage.session` for volatile, `storage.local`/IndexedDB for durable).
* **No `setTimeout`/`setInterval` for durations that matter.** Use
  `chrome.alarms` (minimum period is bounded, currently 30 seconds **(verify)**).
* **Long work** is chunked into resumable steps with persisted checkpoints, or
  moved to an offscreen document, or delegated to the backend.
* **No keep-alive hacks** (pinging ports to stay alive). If a flow needs
  minutes of continuous execution, redesign it.
* **Dynamic `import()` is not available in service workers**; bundle
  statically and keep the worker small for fast cold start **(verify)**.
* **No DOM, `window`, `XMLHttpRequest`, `localStorage`.** Use `fetch`,
  `chrome.storage`, IndexedDB, `navigator.locks`.
* The worker may start **cold on any event**, including while the user is
  mid-flow; every handler must rebuild its dependencies from storage.

### 2.3 Storage areas

| Area | Persistence | Typical limits **(verify)** | Use for |
|---|---|---|---|
| `storage.session` | In memory; cleared on browser restart/extension reload | ~10 MB | Access tokens, caches, ephemeral flow state; keep access level to trusted contexts |
| `storage.local` | Disk, per profile | ~10 MB (more with `unlimitedStorage`) | Settings, queues, last-known projections |
| `storage.sync` | Synced across the user's devices | ~100 KB total, small per-item and rate limits | Tiny user preferences (and only if policy allows sync) |
| `storage.managed` | Read-only, from admin policy | Schema-defined | **Enterprise configuration** |
| IndexedDB | Disk, large | Quota-based | Large datasets, offline queues, diagnostics ring buffer |
| `navigator.locks` | n/a | n/a | Cross-context mutual exclusion |

---

## 3. Architecture: hexagonal layers + MVVM + SDK

### 3.1 Layers

```text
┌──────────────────────────────── extension ────────────────────────────────┐
│  INBOUND ADAPTERS (drive the app)             OUTBOUND ADAPTERS (driven)  │
│  runtime messages · alarms · commands         storage · identity · tabs   │
│  context menus · webNavigation · action       scripting · sidePanel       │
│  content-script DOM observers · UI Views      offscreen · notifications   │
│              │                                 downloads · native msg     │
│              ▼                                          ▲                 │
│        APPLICATION (use cases, ports, policy)  ─────────┘                 │
│                 │            SDK port ──► [SDK] ──► backend API           │
│                 ▼                                                         │
│        DOMAIN (entities, value objects, rules, domain events)             │
└───────────────────────────────────────────────────────────────────────────┘
```

| Layer | Contains | May import | Must not import |
|---|---|---|---|
| **domain** | Entities, value objects, invariants, domain events, pure services | `shared-kernel` | `chrome`, DOM, React, SDK, zod-less I/O |
| **application** | Use cases, **ports** (interfaces), policy resolver, job definitions, orchestration | domain, shared-kernel, `contracts` | adapters, `chrome`, DOM |
| **adapters/in** | RPC handlers, alarm/command/menu/navigation listeners, content-script observers, UI Views | application, contracts, platform | other adapters' internals |
| **adapters/out** | Storage, identity, tabs, scripting, notifications, offscreen, SDK client, clock, logger | application ports, platform, SDK | domain internals beyond the port types |
| **platform** | Thin typed, promise-based wrappers over `chrome.*` (the only place `chrome` is referenced) | `chrome` types | application/domain |
| **contracts** | Message schemas, DTOs, error codes, policy schema types | zod, shared-kernel | everything else |
| **ui (View)** | React components, layouts, styling | ViewModel hooks, `ui-*` kit | SDK, `chrome`, storage |
| **viewmodels** | Presentation state/commands | SDK port types, `core` ports | `react-dom`, `chrome`, router libs |

Enforce with `dependency-cruiser` or `eslint-plugin-boundaries` plus
`no-restricted-globals` for `chrome`/`browser` outside `platform/`. A
violation fails CI.

### 3.2 Ports (examples)

Ports are owned by the application layer, named in domain language:

```ts
export interface SessionPort      { current(): Promise<Session | null>; signIn(): Promise<void>; signOut(): Promise<void>; }
export interface PolicyPort       { get(): Promise<EffectivePolicy>; onChange(cb: () => void): Unsubscribe; }
export interface KeyValueStore<T> { get(): Promise<T>; update(fn: (v: T) => T): Promise<T>; }
export interface TabsPort         { active(): Promise<TabInfo | null>; send<M>(tabId: number, m: M): Promise<void>; }
export interface InjectorPort     { ensureInjected(tabId: number): Promise<void>; }
export interface JobQueuePort     { enqueue(job: JobSpec): Promise<void>; drain(budgetMs: number): Promise<void>; }
export interface NotifierPort     { notify(n: Notice): Promise<void>; }
export interface ClockPort        { now(): number; }
export interface LoggerPort       { log(level: Level, msg: string, ctx?: Record<string, unknown>): void; }
export interface ApiPort          { /* generated from the SDK: leads, funnels, ... */ }
```

### 3.3 Composition roots

Each execution context has one composition root that wires ports to adapters;
business code never instantiates infrastructure:

| Context | Root | Wires |
|---|---|---|
| Service worker | `entrypoints/background.ts` | Full container: storage, SDK, session, policy, queue, tabs, injector, RPC server |
| Popup / side panel / options | `entrypoints/<surface>/main.tsx` | RPC **client** adapters as ports for ViewModels |
| Content script | `entrypoints/content/*.content.ts` | DOM adapters, RPC client, site adapters |
| Offscreen | `entrypoints/offscreen/main.ts` | The specific capability + RPC client |

### 3.4 Vertical slicing

Follow the product's slice names: `src/features/<slice>/{domain,application,adapters,ui,viewmodels}`.
Cross-slice access only through each slice's `contracts/`. Cross-cutting
infrastructure (platform, messaging, storage, policy, telemetry) lives in
`src/platform/` and `src/shared-kernel/`.

---

## 4. Directory structure

```text
apps/extension/
├── wxt.config.ts                     # build adapter: manifest, env, per-channel config
├── tsconfig.json                     # strict; path aliases; types limited per folder
├── entrypoints/                      # THIN: composition roots only (framework conventions)
│   ├── background.ts
│   ├── content/                      # one file per matched site family
│   │   └── <site>.content.ts
│   ├── popup/{index.html, main.tsx}
│   ├── sidepanel/{index.html, main.tsx}
│   ├── options/{index.html, main.tsx}
│   └── offscreen/{index.html, main.ts}
├── public/_locales/<lang>/messages.json   # chrome.i18n
├── public/icons/…
├── managed-schema.json               # storage.managed schema (admin policy)
├── src/
│   ├── shared-kernel/                # ids, Result, errors, time, branded types
│   ├── contracts/                    # zod: messages, DTOs, policy, storage schemas, error codes
│   ├── platform/                     # ONLY place that touches chrome.*
│   │   ├── runtime.ts  storage.ts  tabs.ts  scripting.ts  identity.ts
│   │   ├── alarms.ts   sidepanel.ts  offscreen.ts  notifications.ts  locks.ts
│   ├── messaging/                    # typed RPC client/server, ports, sender validation
│   ├── storage/                      # typed stores, schema versions, migrations
│   ├── policy/                       # managed policy reader + resolver (admin > user)
│   ├── telemetry/                    # logger, redaction, ring buffer, error reporter, metrics
│   ├── security/                     # sender allowlist, URL/host matchers, sanitizers, CSP helpers
│   ├── jobs/                         # persisted queue, retry/backoff, scheduler
│   └── features/
│       └── <slice>/
│           ├── domain/  application/  adapters/{in,out}/  contracts/  ui/  viewmodels/
packages/                              # shared with web/mobile (see frontend playbook)
├── sdk/            # typed API client (no React, no chrome)
├── core/           # ports + route builders + permission helpers
├── viewmodels/     # shared ViewModels
├── ui-web/         # design system (DOM)
└── tokens/
tests/<slice>/frontend/{unit,component,integration,contract,e2e/extension,a11y,security,performance}/
tests/_platform/{architecture,security,policy,resilience,performance}/
docs/{adr,permissions-register.md,data-flows.md,admin-guide.md,runbooks/}
```

Rules: entrypoints stay under ~50 lines each; everything else is imported
from `src/`. Slice names match backend slices, URL `{module}` and permission
prefixes (`funnels.leads.read`).

---

## 5. Manifest and permission engineering

### 5.1 Manifest rules

* Generated from code (WXT config) per **channel** (dev, staging, prod) with
  distinct names, icons, `key` (extension IDs) and API base URLs. **Never edit
  the generated manifest by hand.**
* Mandatory fields: `manifest_version: 3`, `name`/`description` via
  `__MSG_…__`, `default_locale`, `version` (up to four dot-separated integers)
  and optional `version_name`, `minimum_chrome_version` (the oldest Chrome you
  support under enterprise channels), `key` (stable ID, see 5.4),
  `content_security_policy`, `storage.managed_schema`, `incognito`
  (decide explicitly: `not_allowed` is the safe default for enterprise).
* Declare **only** the entrypoints used; every `content_scripts` entry has the
  narrowest `matches`, `all_frames: false` unless justified, explicit
  `run_at`, and an explicit `world`.
* `web_accessible_resources` only for assets a page genuinely needs, with
  specific `matches` (and dynamic URLs where supported **(verify)**).
* `externally_connectable` only for the product's own origins. Omit if the web
  app talks to the extension through a content-script bridge instead.

### 5.2 Permission design

| Principle | Practice |
|---|---|
| Minimal | Start with `storage`, and add APIs only when a use case needs them |
| Optional first | Features that need extra APIs or hosts use `optional_permissions` / `optional_host_permissions` and request at runtime with a user gesture |
| Narrow hosts | `host_permissions` limited to the product API origin(s); customer sites via `activeTab`, programmatic injection, or `optional_host_permissions` driven by admin policy |
| No `<all_urls>` by default | If unavoidable, justify in the register, gate behind policy, and expose admin `runtime_blocked_hosts` guidance |
| Justified | Each permission appears in `docs/permissions-register.md`: why, which feature, data touched, owner, review date, alternative considered |
| Diffed | CI fails on any permission/host change without an updated register entry and a CODEOWNERS security review (permission increases can disable the extension until the user accepts, or require admin re-approval) |

Typical permission map:

| Capability | Permission | Notes |
|---|---|---|
| Settings, queues | `storage` | `unlimitedStorage` only if proven necessary |
| Scheduled work | `alarms` | Replaces timers |
| Side panel UI | `sidePanel` | `open()` requires a user gesture |
| Programmatic injection | `scripting` + host access or `activeTab` | Preferred over broad static matches |
| SPA navigation signals | `webNavigation` | Narrow with URL filters |
| Offscreen tasks | `offscreen` | One document at a time **(verify)**; choose the specific `reason` |
| Identity/SSO | `identity` | `launchWebAuthFlow` with PKCE |
| Notifications | `notifications` (optional) | |
| Downloads/diagnostics export | `downloads` (optional) | |
| Header changes | `declarativeNetRequest` | Static rulesets reviewed like code |
| Passive network observation | `webRequest` (non-blocking) | Blocking `webRequest` is reserved for policy-installed extensions **(verify)** |

### 5.3 Content Security Policy

* Keep the default extension-pages policy (`script-src 'self'; object-src
  'self'`); never add `unsafe-eval` or `unsafe-inline` (not allowed anyway).
* Consider adding `connect-src` limited to the API origin(s) for extension
  pages (and verify it also constrains the service worker in your Chrome
  versions) and `base-uri 'none'`.
* WebAssembly requires `wasm-unsafe-eval`; add it only if a wasm module is
  essential, and review the module's provenance.

### 5.4 Stable extension ID

Pin the ID with the manifest `key` (public key) per channel. Needed for:
OAuth redirect URIs (`https://<id>.chromiumapp.org/`), `externally_connectable`
allowlists, enterprise policies keyed by ID, and native messaging allowlists.
Keep the private key under custody (HSM/KMS or offline vault) with documented
recovery; losing it, or leaking it, is an incident (runbook in 18.6).

---

## 6. Messaging and IPC

### 6.1 Principles

* **One typed protocol** in `contracts/`; both ends validate with the same
  schemas. No ad-hoc `sendMessage` calls in feature code.
* **Request/response (RPC)**, **events** (SW → UIs/tabs), and **streams**
  (long-lived `runtime.connect` ports, for progress). Ports must tolerate
  disconnects, since the worker can terminate.
* Envelope: `{ v, id, type, correlationId, payload }`; `v` is the protocol
  version; unknown versions/types are rejected with a typed error.
* **Errors are values** (`Result<T, RpcError>`), never thrown across contexts.
  Error codes align with the SDK's `SdkError` kinds.
* Encapsulate the platform's callback quirks (`sendResponse` + `return true`
  for async replies) in one transport adapter.

### 6.2 Sender validation (mandatory)

Every `onMessage`/`onConnect` handler first checks:

| Check | Rule |
|---|---|
| `sender.id` | Equals `chrome.runtime.id` (reject other extensions unless explicitly allowlisted) |
| Origin/URL | Extension pages: `chrome-extension://<id>/…`; content scripts: `sender.tab` present and `sender.url` matches the content-script allowlist; web pages (`onMessageExternal`): exact allowlisted origins only |
| Frame | `sender.frameId` expected (top frame vs iframe) per message type |
| Capability | A **message permission table** maps each `type` to allowed sender classes (`ui`, `content`, `external`). Content scripts can call only a small subset (for example `lead.capture`, never `session.get`) |
| Payload | Parse with the zod schema; reject unknown fields; size-limit |

Never accept commands from a page that would change policy, tokens or
settings. Treat every content-script message as untrusted data from a
compromised renderer.

### 6.3 Projections and subscriptions

The SW publishes **read projections** (session summary, queue status, policy
summary). UIs fetch them via RPC and subscribe through `storage.onChanged`
(simple) or a port (streams). UIs never reconstruct state from raw storage
keys.

### 6.4 Page ↔ extension bridging

If the product's web app needs to talk to the extension:

* Prefer `externally_connectable` with exact origins; otherwise a content-script
  bridge using `window.postMessage` with a per-page **nonce handshake**, strict
  `event.origin`/`event.source` checks and a tiny allowed message set.
* The bridge never exposes tokens or generic RPC; it exposes named, validated
  commands.

---

## 7. State, storage and migrations

### 7.1 Typed stores

All storage goes through typed adapters (`KeyValueStore<T>`): zod schema,
default value, **schema version**, namespaced keys (`<slice>:<name>`), and
size accounting. Rules:

* **Single writer**: mutate durable state in the service worker. If another
  context must write, it asks the SW.
* **Atomic read-modify-write** under `navigator.locks.request(key, …)`.
* **Never store secrets in `storage.local`** (not encrypted at rest by the
  extension platform). Access tokens: `storage.session`; long-lived credentials:
  avoid on-device; if unavoidable, wrap with WebCrypto using a non-extractable
  key held in IndexedDB and accept the residual risk in the threat model.
* **Quota guard**: stores check size before write; eviction policy for caches;
  alerts via telemetry when usage exceeds a threshold.
* **Retention**: clear user data on sign-out, tenant switch and when policy
  requires; `runtime.setUninstallURL` for off-boarding surveys/cleanup guidance.

### 7.2 Migrations

* Each store has `version` and a list of pure migration functions
  `(vN) → (vN+1)`.
* Run in `runtime.onInstalled` (`reason: update`) **and** lazily on first read
  (belt and braces: the SW may start without `onInstalled`).
* Migrations are idempotent, tested against **fixtures of every released
  version**, and never delete data without a backup key for one release cycle.
* Downgrades are unsupported: store a `minReaderVersion` to avoid old code
  misreading new data.

### 7.3 Policy-over-user precedence

Effective settings = `managed policy` > `user settings (local/sync)` >
`defaults`. A pure `PolicyResolver` in the application layer computes the
effective configuration and flags which user controls are locked. UIs render
locked controls read-only with a "managed by your organization" notice.

---

## 8. Service worker engineering

### 8.1 Entry file contract

```text
1. Synchronously, at top level: build container (cheap), register ALL listeners.
2. Listener bodies: await container deps lazily, rebuild state from storage, run use case.
3. Never start unawaited long work; schedule via alarms/queue.
```

### 8.2 Lifecycle events

| Event | Responsibilities |
|---|---|
| `runtime.onInstalled` (`install`, `update`) | Run migrations; create alarms and context menus (they persist across restarts but must be created once); set uninstall URL; first-run onboarding; inject into already-open matching tabs (`scripting.executeScript`); apply policy |
| `runtime.onStartup` | Reconcile queues, refresh policy and session projections |
| `runtime.onUpdateAvailable` | Defer reload until idle; enterprise: honor admin update window |
| `storage.onChanged` (managed) | Recompute effective policy, notify UIs and tabs, apply kill switches |
| `alarms.onAlarm` | Drain job queue, refresh tokens, poll config, flush telemetry |
| `webNavigation.*`, `tabs.*` | Narrowly filtered; feed content-script lifecycle (SPA route changes) |
| `commands`, `contextMenus`, `action` | Thin handlers calling use cases |

### 8.3 Jobs, queues and alarms

* Persisted **job queue** (storage/IndexedDB): `{id, type, payload, attempts,
  nextRunAt, idempotencyKey}`; handlers are idempotent; exponential backoff with
  jitter; dead-letter store with admin-visible counts.
* A single alarm (e.g., every minute or the minimum allowed) drains due jobs
  within a **time budget** (e.g., 20 s) and re-arms; heavier work goes to the
  backend.
* **Resumability**: long flows checkpoint after each step; on cold start the
  queue picks up where it left off.
* **Concurrency control**: one drain at a time (lock); per-job-type caps.
* **Offline**: failures classified as retryable (network, 5xx, 429) vs
  terminal; queue survives browser restarts.

### 8.4 Offscreen documents

Use only for what the worker cannot do (DOM parsing, audio, clipboard, canvas)
with the precise `reason` and a clear justification string. Create on demand,
close when done, and treat as a stateless capability behind a port
(`HtmlParserPort`). Communicate through the typed RPC; they have a lifetime
independent of the worker. At most one may exist at a time **(verify)**; use a
dispatcher inside it for multiple tasks.

### 8.5 Resilience

* `self.addEventListener('unhandledrejection'|'error')` report to telemetry
  (redacted) without crashing silently.
* Circuit breaker around the API; fail closed for security decisions
  (unknown policy → most restrictive).
* **Extension-update orphaning**: after an update or reload, old content scripts
  lose their extension context (`Extension context invalidated`). The SW
  re-injects on `onInstalled`, and content scripts detect invalidation
  (`chrome.runtime.id` undefined / port disconnect) and **tear down cleanly**.

---

## 9. Content scripts and page integration

### 9.1 Injection strategy

| Strategy | Use when |
|---|---|
| Declarative (`content_scripts` in manifest) | Fixed, small, well-known host set |
| **Programmatic** (`scripting.executeScript`, `registerContentScripts`) | Hosts come from admin policy/tenant config; `activeTab` flows; need conditional injection |
| MAIN world | Only to read page-defined JS objects; keep to a minimal, audited shim that talks via `postMessage` |

Inject the smallest bundle possible; split by site family; lazy-load heavy UI
only after the user acts.

### 9.2 Structure of a content script

```text
content entry (composition root, <50 lines)
  ├── Guards: matches policy? kill switch? extension context valid?
  ├── Site adapters: detect page type, observe DOM, emit domain events
  ├── Rpc client: send validated events to the SW (never tokens, never secrets)
  └── UI mount (optional): Shadow DOM root + React, closed mode where possible
```

* **Site adapter pattern**: `SiteAdapter { id; matches(url); observe(ctx): Disposable }`.
  Selectors and heuristics live in versioned adapter modules; unit-tested with
  saved HTML fixtures. Page changes are the #1 maintenance cost: add telemetry
  for "adapter failed to match" to detect breakage early.
* **Remote selector config** is allowed as **data**, never code: JSON fetched
  by the SW, validated by schema, signed (or served from a trusted origin with
  integrity metadata), cached with TTL, with a bundled fallback.
* **SPA navigation**: use `webNavigation.onHistoryStateUpdated` (SW) or the
  Navigation API in the page to re-run adapters; debounce `MutationObserver`s;
  disconnect observers on `pagehide` and teardown.
* **Performance**: avoid layout thrash, cap observed subtree, no polling loops,
  budget per page (see 16).
* **Isolation**: UI in Shadow DOM; no global CSS; no `innerHTML` with page or
  extracted data; use `textContent`/safe templating; sanitize any HTML with an
  allowlist sanitizer; never evaluate page-provided strings.
* **Never trust the DOM**: text, attributes and URLs read from the page are
  attacker-controlled; validate and size-limit before sending to the SW.
* **Never expose secrets to the page**: no tokens, tenant keys, internal URLs
  in the content-script world, `window`, or injected UI.
* **CORS**: content-script network requests are subject to the page's
  restrictions; **route all API calls through the SW**.
* **Frames**: set `all_frames` only when needed; check `frameId` in messages.

---

## 10. UI surfaces (popup, side panel, options)

* **MVVM** exactly as in `PLAYBOOK_FRONTEND.md`: Views render; ViewModels hold
  state and commands; the SDK port is implemented by an RPC adapter that calls
  the SW. The same ViewModels run in web, mobile and the extension.
* **Routing**: in-memory router with the same paths as the web app
  (`/app/funnels/leads/:leadId`); `{userType}` never authorizes; guards shape
  the UI only; the backend decides.
* **Popup**: ephemeral; do not hold state; fetch projections on open; keep it
  under a few hundred ms to first paint.
* **Side panel**: persistent surface for workflows; use `sidePanel.setOptions`
  for per-tab or per-site panels and `setPanelBehavior` for open-on-click;
  `sidePanel.open()` needs a user gesture; handle tab switches by re-reading the
  active-tab projection.
* **Options page**: settings (only unlocked ones), policy status, account and
  tenant info, **diagnostics export**, version and channel info, links to the
  admin guide.
* **Statuses**: every ViewModel exposes `loading | ready | empty | forbidden |
  not-found | offline | error | policy-blocked`.
* **i18n**: all strings are message keys via `chrome.i18n` (`_locales`), no
  literals; plan for RTL and text expansion.
* **Accessibility**: keyboard-first, focus management on panel open/close,
  WCAG 2.2 AA, `prefers-reduced-motion`, high-contrast; axe checks in CI.
* **Theming**: follow `prefers-color-scheme`; tokens shared with web.
* **Error boundaries** per surface; show the `correlationId` and a
  "copy diagnostics" action.

---

## 11. Networking, authentication and SDK integration

### 11.1 SDK in the service worker

The extension's SDK (`packages/sdk`) is a **typed client of the extension's
own message protocol**, not an HTTP client. It is created with an injected
transport (`SdkTransport.send`) and returns a `SdkResult` value; it imports no
React and no `chrome.*`, so the same code runs in a page, in the worker and in
tests. UIs and content scripts never touch the SDK directly: they call RPC use
cases, and the service worker is the only context that talks to the backend.

The backend-facing HTTP client is a **worker platform adapter**, not the
shared SDK: it mirrors the URL contract, adds `Authorization`, `X-Tenant-Id`,
`X-Correlation-Id`, `Idempotency-Key`, retry and error mapping, and its
resources are exposed to the rest of the extension through RPC use cases.

### 11.2 Authentication

| Flow | Use |
|---|---|
| **OIDC with PKCE via `chrome.identity.launchWebAuthFlow`** | Default for enterprise SSO; redirect `https://<id>.chromiumapp.org/`; state/nonce validated; no embedded password forms |
| `chrome.identity.getAuthToken` | Google-account-only products |
| Sign-in through the web app | Extension receives a short-lived, audience-restricted exchange code through a verified channel |

Rules: access tokens in `storage.session` (trusted contexts only), short TTL,
refresh handled by the SW with single-flight; **prefer a backend that issues
extension-scoped, revocable tokens** over holding third-party refresh tokens
on the device; sign-out revokes server-side and clears all stores; tenant
switch purges caches; handle `401` by one refresh attempt then a `signed-out`
projection. Device/session binding and anomaly detection are server-side.

### 11.3 Network rules

* Only the SW calls the backend; every call has a timeout, abort signal,
  correlation ID and bounded retries on idempotent operations.
* API origins are constants from build config **and** validated against policy
  (`TenantUrl` must match an allowed pattern; reject plain HTTP and unexpected
  hosts).
* TLS errors are never bypassed. Respect corporate proxies and custom roots
  (the browser handles them; test behind a proxy).
* `declarativeNetRequest` rulesets (if any) are static, reviewed, and minimal;
  dynamic rules come only from validated policy/config.
* Never fetch and execute remote scripts; validate every remote JSON with
  schemas and size limits.
* Rate-limit client-side (queue) to respect backend quotas.

---

---

> Continues in [`PLAYBOOK_CHROME_EXTENSION_PART2.md`](PLAYBOOK_CHROME_EXTENSION_PART2.md).
