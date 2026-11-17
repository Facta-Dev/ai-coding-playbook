---
id: SECURITY
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 90
owner: security
depends_on: [URLS, BACKEND]
---


# PLAYBOOK_SECURITY.md — Backend cybersecurity playbook

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_SECURITY.md`](PLAYBOOK_SECURITY.md) | 1. Standards and how this playbook maps to them … 14. Logging, monitoring, detection and response (A09) |
| 2 | [`PLAYBOOK_SECURITY_PART2.md`](PLAYBOOK_SECURITY_PART2.md) | 15. Secure development lifecycle … 21. Checklist |
Security contract for every backend, whatever the language. The
**core rules are language-agnostic**; section 16 gives **profiles for
Node.js, Python, Go and Rust**, the four languages used. It hardens the
architecture in `PLAYBOOK_BACKEND.md`, enforces the authorization model of
`PLAYBOOK_URLS.md`, is verified by `PLAYBOOK_TESTS.md` and produces the
control evidence required by `PLAYBOOK_AUDIT.md`.

The rules that carry the whole file:

1. **Deny by default, fail closed.** No route, permission, network path, port,
   credential or outbound destination exists unless explicitly granted.
2. **Defense in depth.** Every layer assumes the layer in front of it failed:
   edge → gateway → controller → use case → domain → data → network.
3. **Authorization lives in the use case**, with identity, tenant, permission
   and ownership checked on every call. The URL prefix never authorizes.
4. **In the multi-tenant profile, tenant isolation is the primary security
   boundary.** Cross-tenant data exposure is the worst-case incident there.
   A single-tenant deployment still enforces identity, permission and
   ownership on every call; it has no tenant predicate to check.
5. **All input is hostile**: HTTP, queue messages, events, webhooks, provider
   responses and, above all, scraped lead data.
6. **Secrets never live in code, images, logs or client bundles**, and
   credentials are short-lived wherever possible.
7. **Assume breach.** Limit blast radius, detect fast, contain with prebuilt
   switches, recover from tested backups.
8. **Security is enforced by automation**, not by memory or good intentions:
   linters, scanners, architecture tests and CI gates.
9. **Same baseline in every language.** A control that exists in Node must
   exist in Python, Go and Rust; only the implementation differs.

> Scope note: this is a defensive engineering baseline. It lowers risk; it
> does not guarantee that a system cannot be breached. Numeric values (token
> lifetimes, limits, parameters) are starting points to tune with your threat
> model and measurements. Re-verify tool names and versions when adopting
> them.

## 1. Standards and how this playbook maps to them

| Standard | Use |
|---|---|
| **OWASP Top 10:2025** | Risk taxonomy for web applications (table below) |
| **OWASP API Security Top 10 (2023)** | API-specific risks: BOLA, broken auth, BOPLA, resource consumption, BFLA, sensitive business flows, SSRF, misconfiguration, inventory, unsafe consumption of APIs |
| **OWASP ASVS (current 5.x)** | Verification requirements. Target **Level 2 baseline**, **Level 3** for authentication, session, cryptography, tenant isolation and admin modules |
| **OWASP Cheat Sheet Series** | Implementation detail per topic |
| **CWE Top 25** | Weakness classes tracked by SAST rules |
| **RFC 8725 (JWT BCP), RFC 9700 (OAuth 2.0 Security BCP)** | Token and OAuth handling |
| **NIST SSDF (SP 800-218), SLSA** | Secure development and supply-chain levels |
| **CIS Benchmarks** | OS, container, Kubernetes and cloud baselines |

OWASP Top 10:2025 → where it is handled here:

| ID | Risk | Section |
|---|---|---|
| A01 | Broken Access Control (includes SSRF) | 5, 7 |
| A02 | Security Misconfiguration | 9, 12, 13 |
| A03 | Software Supply Chain Failures | 11 |
| A04 | Cryptographic Failures | 8 |
| A05 | Injection | 6 |
| A06 | Insecure Design | 2, 15 |
| A07 | Authentication Failures | 4 |
| A08 | Software or Data Integrity Failures | 10, 11 |
| A09 | Security Logging and Alerting Failures | 14 |
| A10 | Mishandling of Exceptional Conditions | 9.4 |

## 2. Threat model

### 2.1 Assets and actors

| Assets (by priority) | Threat actors |
|---|---|
| Tenant lead data (personal data), tenant provider API keys (external providers, telephony, LLM), credentials and tokens, session store, embeddings, billing data, source code and CI secrets, signing keys | External attacker, credential stuffer/bot, malicious or compromised tenant user, malicious tenant (cross-tenant), compromised vendor or dependency, insider, compromised employee device, hostile content source (scraped pages/leads) |

### 2.2 Service-specific threats

| Threat | Why it matters here |
|---|---|
| Cross-tenant read/write (IDOR/BOLA, missing tenant filter, cache or vector leakage) | Multi-tenant SaaS; the highest-impact failure |
| Privilege confusion via `{userType}` (using `/admin` with an `/app` token) | Route prefix is an experience namespace only |
| Theft or misuse of tenant provider keys | Keys let an attacker spend money and read leads |
| SSRF through webhook URLs, scraping targets, redirect following | Features that fetch arbitrary URLs |
| Stored injection from scraped content (XSS, template, SQL, prompt injection) | Lead data originates from the open internet |
| Queue/batch abuse: forged jobs, replay, poisoned messages, queue flooding, lock key tampering | Redis/Dragonfly is a coordination plane |
| Account takeover and credential stuffing | Employee consoles expose lead data |
| Abuse of outreach features (spam, harassment, fraud) | Reputational and legal exposure |
| Supply-chain compromise (npm, PyPI, crates, Go modules, CI actions, extension store) | Four ecosystems = four attack surfaces |
| Denial of service and resource exhaustion (large payloads, expensive queries, extraction loops) | Costly operations are exposed behind APIs |
| Insider or support-staff over-access | Administrative tooling and production access |

### 2.3 Process

- Every new slice, externally reachable route, queue, webhook, provider
  integration or data category requires a **threat model** (STRIDE or
  equivalent) committed at `docs/threat-models/{slice}.md` and reviewed in the
  PR. Minimum content: data-flow diagram, trust boundaries, threats, controls,
  residual risk and tests that prove the controls.
- Threat models are revisited on major change and at least annually; findings
  feed the risk register (`PLAYBOOK_AUDIT.md`).
- Each slice has a **security champion** responsible for its threat model and
  security tests.

## 3. Layers of defense mapped to the hexagon

```text
Internet
  → Edge: DDoS protection, WAF, TLS termination, bot controls, geo/IP rules
    → Gateway/ingress: TLS 1.2+ (1.3 preferred), global rate limits, size limits, routing allow-list
      → Presentation adapter (adapters/in/http): authentication, schema validation,
        RequestContext construction, security headers, CORS, error envelope
        → Application (use case): AUTHORIZATION (permission + tenant + ownership), policies,
          idempotency, audit events
          → Domain: invariants (state machines, limits)
            → Data adapters: parameterized access, RLS, field encryption, least-privilege DB roles
Batch/event adapters (adapters/in/jobs, events): authenticate the broker, validate message schema,
  verify tenant context, then call the same use cases as a system actor with minimal permissions
Outbound adapters (clients/): egress allow-list, SSRF-safe HTTP client, timeouts, response validation
Network: default-deny segmentation, private data plane, mTLS between services
Platform: secrets manager, KMS, logging, monitoring, backups
```

## 4. Authentication

### 4.1 Passwords and MFA

- Hash passwords with **Argon2id** (OWASP minimum: 19 MiB memory, 2
  iterations, 1 lane; prefer higher cost tuned to roughly 100–500 ms on your
  hardware). `bcrypt`/`scrypt` only for legacy compatibility, with migration
  on login.
- Salt unique per hash (library default), optional server-side pepper held in
  the secrets manager/KMS.
- Accept long passphrases (at least 64 chars), block known-breached and
  trivial passwords, no composition gymnastics, no periodic forced rotation
  without a compromise signal.
- **MFA**: WebAuthn/passkeys preferred, TOTP as fallback, SMS only as last
  resort. **Mandatory MFA** for `/admin` experience users, tenant owners,
  anyone who can read provider keys or export data, and all production access.
- Enterprise tenants: SSO through OIDC or SAML; enforce MFA at the IdP;
  provisioning via SCIM; just-in-time role mapping to permissions.

### 4.2 Credential-stuffing and abuse defenses

- Rate limit by IP, account and device fingerprint with progressive delays;
  global login anomaly detection; bot challenge on suspicious patterns.
- Uniform responses and timing for "unknown user" and "wrong password";
  generic account-recovery messages.
- Account recovery requires verified factor; recovery events notify the user;
  sensitive changes (email, password, MFA, API key) require re-authentication.
- Lockout is soft (delay + challenge) to avoid denial-of-service by lockout.

### 4.3 Sessions and tokens

| Item | Rule |
|---|---|
| Access token | Short-lived (5–15 minutes), audience- and issuer-bound, signed with **asymmetric keys** (RS256/ES256/EdDSA), `kid` header with rotation |
| Refresh token | Opaque, **rotating**, single use with **reuse detection** (reuse revokes the whole family), bound to client/device where possible, stored hashed server-side |
| JWT validation | Pin the allowed algorithm list, **reject `none`**, verify signature, `iss`, `aud`, `exp`, `nbf`, and token type; never trust `alg` from the header to pick the key; no sensitive data in claims; follow RFC 8725 |
| Claims | Carry `sub`, `tenant` (active), `session id`, role; **permissions are resolved server-side** from the session or a cache keyed by session, so revocation is immediate |
| Revocation | Session list and deny-list in the datastore/Dragonfly; logout, password change, role change, user suspension and detected compromise revoke immediately |
| Cookies (web) | `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`, `__Host-` prefix, minimal scope; CSRF protection for cookie-authenticated mutations (double-submit or synchronizer token, plus `Origin`/`Sec-Fetch-Site` checks) |
| Bearer tokens (mobile, extension, API) | OAuth 2.0/OIDC with **authorization code + PKCE** for public clients; no implicit flow, no password grant; follow RFC 9700 |
| Idle and absolute timeouts | Enforced server-side per policy |
| Tenant switch / role switch | New token, cache cleared, permissions re-resolved |

### 4.4 Service and machine authentication

- Service-to-service: **mTLS** or workload identity (for example SPIFFE/SPIRE,
  cloud workload identity) or short-lived signed service tokens. Never shared
  static passwords between services.
- Each service has its own identity and its own least-privilege access to
  datastores and queues.
- **Customer API keys** (if offered): random, high entropy, shown once, stored
  **hashed**, with a visible non-secret prefix, scopes, expiry, rotation,
  last-used timestamp and per-key rate limit; revocable instantly; never
  accepted in URLs (headers only).
- CI/CD authenticates to the cloud with OIDC federation, not stored keys.

## 5. Authorization

Implements `PLAYBOOK_URLS.md`; verified by `authz-matrix` and
`tenant-isolation` suites in `PLAYBOOK_TESTS.md`.

1. **Every use case authorizes**: permission (`module.resource.action`),
   **resource ownership** and state-based rules; in the multi-tenant profile,
   a **tenant match** as well. Controller checks are an early reject, not the
   authority.
2. **Deny by default**: a route or use case without a declared permission
   fails startup/CI.
3. **Tenant context comes from the token/session** in the multi-tenant
   profile, never from the body or an unvalidated header. `X-Tenant-Id` and
   path `{tenantId}` are validated against the caller's membership or the
   admin permission scope.
4. **Object-level (BOLA)**: every load by ID includes the tenant (and owner
   where applicable) in the query predicate. Return `404` rather than `403`
   when existence would leak.
5. **Property-level (BOPLA)**: explicit input DTOs (no mass assignment of
   `role`, `tenantId`, `ownerId`, `isAdmin`, prices) and explicit output DTOs
   (no returning internal fields, hashes, secrets).
6. **Function-level (BFLA)**: admin and partner functions require their own
   permissions even when the route name looks harmless.
7. **Centralized policy**: one policy module per slice (or a policy engine
   such as OPA, Cedar or Casbin if complexity grows). No scattered `if role ==
   admin`.
8. **Identifiers**: use unpredictable IDs (UUIDv4/v7, ULID) as defense in
   depth; never as the control.
9. **Second line of defense in the database**: row-level security keyed by
   `tenant_id`, with the application connecting as a role that **cannot
   bypass it** (not the table owner unless `FORCE ROW LEVEL SECURITY` is set,
   not a superuser, not a `BYPASSRLS` role).
10. **Impersonation and support access**: explicit, time-boxed, approved,
    fully audited, shown to the customer if policy requires; never silent.
11. **Sensitive business flows** (launch campaign, bulk export, send messages,
    spend credits) have quotas, step-up authentication where appropriate, and
    anomaly alerts.
12. **Batch jobs authorize too**: run as a system actor with explicit minimum
    permissions, always scoped to the message's verified `tenantId`.

Pseudocode of the required shape (language-agnostic):

```text
useCase.execute(ctx, input):
    require ctx.authenticated
    require policy.allows(ctx, "funnels.leads.update")           # permission
    lead = repo.findById(ctx.tenantId, input.leadId)              # tenant in predicate
    if lead is null: return NotFound                              # no existence leak
    require policy.canModify(ctx, lead)                           # ownership / state
    lead.apply(validated(input))                                  # explicit DTO, domain invariants
    repo.save(lead); outbox.add(LeadStageChanged(...)); audit.record(ctx, "lead.update", lead.id)
```

## 6. Input handling and injection (A05)

### 6.1 Rules for every boundary

- **Validate at the edge with a schema** (allow-list of fields, types, ranges,
  lengths, formats). Reject unknown fields by default. Validate again where a
  value enters the domain (value objects).
- **Canonicalize before validating** (Unicode normalization, trimming, path
  and URL normalization), then validate the canonical form.
- Strict `Content-Type`; only the formats you serve. Maximum body size, header
  size, field count, array length, nesting depth and string length.
- **Parameterize everything**: SQL, NoSQL, search, LDAP, XPath, GraphQL,
  shell, templates. Never build queries or commands by string concatenation,
  even with "escaped" input.
- **No shell**: execute subprocesses with an argument array, absolute binary
  path, minimal environment, timeouts and resource limits; prefer libraries
  over spawning processes.
- **Path handling**: never join user input to a filesystem path directly;
  resolve to an absolute path and verify it stays inside the allowed root;
  prefer generated names and object storage keys.
- **Deserialization**: only data formats (JSON) with schema validation. No
  native object deserialization of untrusted data (pickle, unsafe YAML,
  language-native serializers). XML: disable external entities and DTDs.
- **Regular expressions**: avoid catastrophic patterns; use linear-time
  engines (RE2-style) or timeouts for user-influenced patterns.
- **Output encoding by context** (HTML, attribute, JS, URL, SQL, log).
  Prefer JSON APIs that never render HTML server-side.
- **Mass assignment**: map DTOs to domain objects explicitly.

### 6.2 Scraped and third-party content is untrusted

- Lead fields extracted via an external provider or any source are **data,
  never code**: no templating, no evaluation, no HTML rendering without
  sanitization, no use as filenames, query fragments or URLs without validation.
- Sanitize on output for each sink (UI, email, CSV export — neutralize formula
  prefixes `=`, `+`, `-`, `@` for spreadsheet exports).
- Enforce length and charset limits at ingestion; store the raw payload
  separately from normalized fields.
- If an LLM processes lead content: treat prompts as an injection surface;
  separate instructions from data, restrict tool access, validate model output
  against a schema, never let model output decide authorization, and log
  prompts/responses per policy (see OWASP guidance for LLM applications).

### 6.3 File uploads

Allow-list extensions and sniffed MIME types, enforce size limits, generate
random storage names, store outside any executable or public path, scan for
malware, strip active content, serve with `Content-Disposition` and a
non-executing content type from a separate origin, and use pre-signed,
short-lived, scoped URLs.

## 7. SSRF and outbound traffic

Applies to webhooks, scraping targets, "fetch this URL" features, image and
avatar fetchers, provider callbacks and redirects.

1. **Prefer allow-lists** of destination hosts (external provider API, payment
   provider, telephony, LLM, object storage). For tenant-supplied URLs
   (webhooks), use a strict validator plus the network controls below.
2. **Validate after DNS resolution**: resolve the hostname, reject private,
   loopback, link-local, multicast, carrier-grade NAT and metadata ranges
   (IPv4 and IPv6, including IPv4-mapped IPv6 and `169.254.169.254`), then
   **connect to the validated IP** (pin it) to defeat DNS rebinding.
3. Only `https` (and `http` if explicitly justified); no `file`, `gopher`,
   `ftp`, `data` or custom schemes; reject credentials in URLs and unusual
   ports.
4. **Redirects**: disabled by default; if needed, cap the count and
   re-validate every hop.
5. Timeouts (connect, TLS, total), response size cap, content-type check,
   limited concurrency per tenant.
6. **Network-level enforcement**: workloads that fetch tenant URLs run in a
   segment with an **egress proxy/firewall** that blocks internal ranges and
   the cloud metadata service; require IMDSv2 or disable instance metadata for
   workloads that do not need it.
7. Never reflect raw upstream errors to the caller.
8. Tests: the `security` suites include SSRF cases (private ranges, rebinding,
   redirect-to-internal, IPv6 forms, alternative IP encodings).

## 8. Cryptography and data protection (A04)

- **TLS everywhere**: 1.2 minimum, 1.3 preferred, modern cipher suites,
  HSTS with preload for public domains, certificate automation and expiry
  monitoring. Internal traffic encrypted too (mTLS preferred).
- **Never implement your own crypto.** Use vetted libraries and high-level
  APIs. Prefer AEAD (AES-256-GCM or ChaCha20-Poly1305/XChaCha20-Poly1305);
  never reuse a nonce with the same key; use a CSPRNG for every random value
  that matters (tokens, IDs used for secrecy, salts, nonces).
- **Constant-time comparison** for secrets, MACs, tokens and hashes.
- **Encryption at rest**: disk/volume and managed-database encryption for
  everything, plus **application-level envelope encryption** for Restricted
  fields (tenant provider API keys, refresh tokens at rest if stored, highly
  sensitive personal data). Data-encryption keys wrapped by KMS keys; consider
  per-tenant data keys for high-assurance tenants and cryptographic erasure.
- **Key management**: keys in KMS/HSM, separate keys per environment and
  purpose, rotation schedule, key-use audit logs, no key material in
  application memory longer than needed, break-glass procedure.
- **Tenant provider keys** are write-only through the API and UI, decrypted
  only inside the outbound adapter that calls the provider, never logged,
  never returned, never placed in job payloads (pass an ID, resolve at use).
- **Data minimization and retention**: collect only what the feature needs;
  enforce retention with scheduled jobs that cascade to the vector index,
  caches and exports; backups follow the same retention.
- **Masking** in logs, analytics, error reports and non-production data.
- **Backups**: encrypted, access-restricted, immutable copies, restore tested
  (`PLAYBOOK_TESTS.md` DR suite).
- Embeddings and vector payloads are personal data when derived from personal
  data: same tenant scoping, encryption and deletion rules.

## 9. API and application hardening

### 9.1 Rate limiting and resource consumption

- Layered limits: edge (per IP), gateway (per route), application (per user,
  **per tenant**, per API key, per sensitive business flow).
- Token-bucket counters in Dragonfly/Redis (key convention in
  `PLAYBOOK_BACKEND.md`), with fail-safe behavior defined when the store is
  down (fail closed for sensitive flows, degraded local limits for others).
- Hard maximums: page size, request body, upload size, batch size, query
  complexity, concurrent jobs per tenant, run duration, export row count.
- Timeouts on every handler, query (`statement_timeout`) and outbound call;
  cancellation propagates.
- Expensive operations return `202` and run as batch jobs with per-tenant
  quotas (cost caps for provider usage).

### 9.2 CORS, CSRF and headers

- CORS: explicit origin allow-list (never `*` together with credentials), only
  needed methods/headers, short preflight cache.
- Response headers on every response: `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `Cache-Control: no-store` on authenticated/sensitive responses,
  `Content-Security-Policy` with `frame-ancestors` for anything that serves
  HTML; remove `Server`/framework version banners.
- API endpoints that use cookies require CSRF defenses; bearer-token APIs are
  not CSRF-prone but still validate `Origin` on browser clients.

### 9.3 Webhooks and callbacks (inbound)

- Verify a **signature** (HMAC-SHA256 or provider-specified scheme) over the
  raw body with a per-endpoint secret, compare in constant time, require a
  **timestamp** within a short window (for example 5 minutes), and store
  event IDs to reject **replays**.
- Respond fast, process asynchronously and idempotently; treat the payload as
  untrusted input (validate schema, verify IDs belong to the tenant).
- Restrict by provider IP ranges only as an additional layer, never as the
  only control.
- Outbound webhooks to tenants are signed the same way and sent through the
  SSRF-safe client.

### 9.4 Errors and exceptional conditions (A10)

- **Fail closed**: on any error in authentication, authorization, validation
  or crypto, deny the request.
- A global handler converts all unexpected errors to the standard envelope
  with a `correlationId`; no stack traces, SQL, file paths, versions or
  internal hostnames leave the process.
- No empty catch blocks, no swallowed errors, no "default to allow".
- Consistent behavior under failure of dependencies: circuit breakers,
  bounded retries with jitter, bulkheads, defined degraded modes; **a failing
  security dependency (token introspection, policy cache, rate limiter) must
  not silently open access**.
- Resource cleanup on all paths (connections, locks, temp files, leases);
  transactions rolled back on error.
- Crashes: supervisor restarts the process, alerts on crash loops, no secrets
  in core dumps (disable dumps in production or encrypt).

### 9.5 Inventory and exposure

- Maintain an inventory of **all** routes, versions and environments (from the
  OpenAPI spec and route table); deprecated versions have sunset dates and
  are removed.
- No debug, profiling, metrics, health-detail or admin endpoints on public
  listeners; internal ports bound to private interfaces.
- Non-production environments are not internet-open by default and never
  contain production data.

## 10. Batch, queue and event security

- **Authenticate and authorize broker access** per service: Redis/Dragonfly
  ACL users per slice limited to their key prefix (`{app}:{env}:{slice}:*`)
  and to the commands they need, where the engine supports key-pattern ACLs;
  TLS on connections; never exposed to the internet; dangerous commands
  (`FLUSHALL`, `FLUSHDB`, `CONFIG`, `DEBUG`, `KEYS`, scripting if unused)
  disabled or ACL-denied.
- **Messages are untrusted input**: validate the schema and version, verify
  that the `tenantId` is real and consistent with the referenced entity, and
  re-authorize as a system actor. Do not assume that "internal" means safe.
- **Integrity**: for cross-service or cross-trust-zone events, sign messages
  (HMAC or asymmetric signature) or rely on authenticated broker identities;
  protect the outbox table with the same least-privilege rules as business
  tables.
- **No secrets or personal data in payloads**: pass IDs and resolve inside the
  authorized handler; payloads in DLQs are therefore less sensitive but still
  access-controlled and retained per policy.
- **Abuse controls**: per-tenant enqueue quotas and concurrency caps,
  maximum payload size, deduplication, backpressure; a flooding tenant cannot
  starve others.
- **Lock and lease keys** use unpredictable tokens and fencing so a forged or
  stale holder cannot overwrite state (`PLAYBOOK_BACKEND.md` section 5).
- **Replay**: idempotency keys and unique constraints make replays harmless;
  security-relevant jobs also check freshness.
- DLQ and replay tools are admin-only, audited and cannot change the
  `tenantId`.

## 11. Supply chain (A03, A08)

### 11.1 Dependencies (all languages)

- **Lockfiles are mandatory and committed**; CI installs strictly from them
  (`npm ci`, `pip install --require-hashes`, `go` with `-mod=readonly`,
  `cargo --locked`). A change to a lockfile is reviewed like code.
- **Pin versions** (exact or lock-resolved); upgrade through automated PRs
  that run the full pipeline.
- **Cooldown for new releases**: do not adopt a version published in the last
  7–14 days unless it is an urgent security fix reviewed by hand; malicious
  versions are usually detected within days.
- **Disable install-time code execution by default**: npm `--ignore-scripts`
  (or pnpm's allow-list of build scripts), review `build.rs`/proc-macros in
  Rust, avoid `setup.py` execution in Python by using wheels from trusted
  indexes.
- **Single trusted registry path**: an internal proxy/mirror (Artifactory,
  Nexus, Verdaccio, devpi, Athens/GOPROXY, crates mirror) with allow-listed
  upstreams; private package names are reserved on public registries to
  prevent **dependency confusion**; scoped/namespaced packages.
- **Minimize dependencies**; justify each new one (maintainers, activity,
  license, size, install scripts, transitive count); prefer the standard
  library for small tasks.
- **Typosquatting and impersonation checks** on every new dependency; verify
  publisher and provenance (npm provenance, Sigstore attestations, PyPI
  trusted publishing, crates.io ownership).
- **Continuous SCA** on PRs and nightly with the vulnerability SLAs from
  `PLAYBOOK_AUDIT.md`; track end-of-life runtimes and frameworks.
- **License policy** enforced by tooling.

### 11.2 Build and release integrity

- CI hardened: pin third-party actions/plugins **by commit SHA**, minimal
  token permissions, ephemeral runners, no secrets to untrusted forks/PRs,
  protected branches, required reviews, signed commits/tags for releases.
- **Reproducible, hermetic builds** where feasible; build in a clean
  environment; no network at build time beyond the proxy.
- Produce an **SBOM** (CycloneDX/SPDX), **build provenance** (SLSA) and
  **sign artifacts and images** (for example Sigstore/cosign); deployment
  admission verifies signatures and digests; deploy by **digest**, not mutable
  tags.
- Base images: minimal (distroless or slim), pinned by digest, rebuilt
  regularly; run as non-root.
- Secrets are never baked into images or build args.

### 11.3 Developer environment

Managed devices with disk encryption and EDR, hardware-key MFA on the code
host and registries, least-privilege publishing tokens, and no long-lived
registry credentials on laptops.

## 12. Infrastructure, network and platform (A02)

### 12.1 Network

- **Default-deny segmentation**: public edge, application subnet, data
  subnet. Databases, Dragonfly/Redis, vector stores and queues have **no
  public endpoints**.
- Service-to-service only through allowed paths (security groups / network
  policies); east-west mTLS; egress restricted to the proxy and allow-listed
  destinations.
- Administrative access without open inbound ports (identity-aware access,
  session recording); no shared bastion passwords; break-glass is monitored.
- WAF and DDoS protection at the edge; managed DNS with DNSSEC where
  appropriate; CAA records.

### 12.2 Containers and Kubernetes

Run as non-root with a read-only root filesystem, drop all capabilities,
`allowPrivilegeEscalation: false`, seccomp `RuntimeDefault`, no host
namespaces or privileged containers, resource requests/limits, restricted Pod
Security level, network policies default-deny, secrets mounted from the
secrets manager (not baked into manifests), admission policies (signature,
registry, no `latest`), and regular node/OS patching.

### 12.3 Cloud and IaC

Least-privilege IAM per workload, no long-lived access keys, MFA on human
accounts, separate accounts/projects per environment, private storage by
default, KMS key policies, audit logging on, drift detection, **everything in
IaC** scanned in CI, and guardrails/SCPs that prevent disabling logging or
making data stores public.

### 12.4 Datastores

- **PostgreSQL**: separate roles for migration (DDL), application
  (DML on the slice schema only) and read-only reporting; no superuser for
  the app; `sslmode=verify-full`; row-level security; `statement_timeout`,
  `idle_in_transaction_session_timeout`; extensions allow-listed; audit
  logging for privileged actions.
- **Dragonfly/Redis**: `requirepass`/ACL, TLS, private network only, ACLs per
  slice, memory limits and eviction policy chosen so locks and queues are not
  evicted, persistence configured per criticality, no data of one tenant
  retrievable by key patterns shared across tenants.
- **Vector database**: authenticated, tenant filter enforced in the adapter,
  private network, encrypted, same retention/deletion as relational data.
- **Object storage**: private, per-tenant prefixes, pre-signed URLs with short
  expiry, versioning and object lock for evidence buckets.

### 12.5 Configuration hygiene

Secure defaults in code; configuration validated at startup (fail fast on
unsafe values such as debug mode, wildcard CORS, disabled TLS verification);
no default credentials; feature flags cannot disable security controls;
configuration drift detected.

## 13. Secrets management

- Single source: a secrets manager (Vault, cloud secret manager); apps fetch
  at startup or on demand with workload identity.
- **No secrets** in the repository, `.env` files committed, container images,
  CI logs, client bundles, the Chrome extension, tickets or chat.
- Prefer **short-lived dynamic credentials** (database creds, cloud tokens);
  otherwise rotate on schedule and on any suspicion; support **zero-downtime
  rotation** (two active versions).
- Environment variables are acceptable for non-sensitive config; for secrets
  prefer files mounted in memory-backed volumes or API retrieval, because
  environment variables leak into process listings, crash reports and
  child processes.
- Separate secrets per environment and per service; least-privilege read
  policies; every read audited.
- **Secret scanning** at pre-commit, in CI and across history; a verified
  leaked secret is rotated immediately, not just removed.
- Memory hygiene: avoid logging or serializing secret-bearing objects; clear
  buffers where the language allows (section 16).

## 14. Logging, monitoring, detection and response (A09)

### 14.1 What to log

Structured security events with `timestamp` (system clock), `correlationId`,
`tenantId`, `userId` or system actor, `ip`/`userAgent` (per privacy policy),
`action`, `resource`, `outcome`, `reason`:

- Authentication: success, failure, MFA events, lockouts, token refresh reuse.
- Authorization: every denial with the required permission.
- Privileged actions: role/permission changes, user suspension, impersonation,
  API key creation/rotation/revocation, exports, configuration changes,
  retention/deletion runs, DLQ replays.
- Tenant-boundary anomalies, SSRF blocks, WAF blocks, rate-limit hits,
  webhook signature failures, validation floods.
- Never log secrets, tokens, full card data, raw credentials or unnecessary
  personal data; neutralize newline/control characters to prevent log
  injection.

### 14.2 Platform

- Centralized, append-only/tamper-evident log pipeline separate from the
  application's own credentials; retention per policy; time-synchronized
  hosts (NTP).
- **Detection rules / alerts**: brute force and credential stuffing, sudden
  403/404 patterns across many tenant or object IDs (enumeration), new
  admin or privileged role, key creation outside change windows, mass export,
  access from new geographies for privileged users, DLQ or outbox growth,
  unusual egress, spikes in provider spend, repeated webhook signature
  failures, tenant-isolation anomalies.
- Honeytokens/canary credentials and records to detect unauthorized access.
- On-call with runbooks; alerts have owners and severity.

### 14.3 Incident readiness

Runbooks (in `compliance/procedures`, referenced by `PLAYBOOK_AUDIT.md`) for:
compromised user, leaked API/provider key, cross-tenant exposure, dependency
or CI compromise, ransomware/data destruction, DDoS, insider misuse, extension
store compromise.

Prebuilt **containment switches** (tested): global token revocation and key
rotation, per-tenant kill switch, per-feature kill switch (for example disable
campaign launch), route-level blocks at the edge, queue pause, read-only mode,
credential rotation automation, network isolation of a workload. Preserve
evidence before destroying anything; follow legal notification clocks.

### 14.4 Vulnerability disclosure

Public policy and `security.txt`, a monitored security mailbox, triage and
response SLAs, safe-harbor language, and CVE handling when appropriate.

---

> Continues in [`PLAYBOOK_SECURITY_PART2.md`](PLAYBOOK_SECURITY_PART2.md).
