---
id: SECURITY_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 90
owner: security
depends_on: [SECURITY]
---

# PLAYBOOK_SECURITY_PART2 — Backend cybersecurity playbook (part 2)

> Part 2 of 2. Main entry: [`PLAYBOOK_SECURITY.md`](PLAYBOOK_SECURITY.md). Covers: 15. Secure development lifecycle … 21. Checklist.

## 15. Secure development lifecycle

| Stage | Required |
|---|---|
| Design | Threat model, security requirements (ASVS level), architecture review for new slices and integrations |
| Code | Secure-coding standard (this file), language profile rules, pre-commit secret scan and linters, mandatory review with the security checklist below |
| Build | SAST, SCA, secrets, IaC and container scans as PR gates; architecture tests (`PLAYBOOK_TESTS.md`) |
| Test | Authz matrix, tenant isolation, SSRF, injection, fuzzing of parsers and message handlers, abuse-case tests, DAST on staging |
| Release | Signed artifacts, SBOM, provenance, change record, rollback plan |
| Operate | Monitoring, vulnerability SLAs, patching, key rotation, access reviews, backups, game days |
| Retire | Credential revocation, data deletion, DNS/route removal, dependency removal |

Additional practices: security training at onboarding and annually, role-based
modules for engineers, **fuzzing** for parsers, importers, and event/webhook
handlers (language-native fuzzers), periodic **independent penetration test**
(annual and on major change), optional bug bounty after the baseline is
stable, and tracking of runtime/framework support dates (upgrade before end of
life).

### 15.1 Security review checklist for every PR touching a boundary

- [ ] New/changed route has a declared permission and an `authz-matrix` row.
- [ ] Tenant and ownership are in every query predicate.
- [ ] Input validated by schema with unknown fields rejected; limits set.
- [ ] No string-built queries, shell calls, unsafe deserialization or path
      joins with user input.
- [ ] Outbound calls use the SSRF-safe client with timeouts and size caps.
- [ ] Errors are caught centrally, fail closed, and leak nothing.
- [ ] No secrets, tokens or personal data in logs, payloads or responses.
- [ ] New dependency justified, pinned, scanned and past the cooldown.
- [ ] Security events emitted for privileged or sensitive actions.
- [ ] Tests added (positive and abuse cases); threat model updated if needed.

## 16. Language profiles

The core rules apply identically; these profiles list the traps and the
native tooling. Tool names are examples; choose equivalents your team
maintains.

### 16.1 Cross-language equivalence table

| Control | Node.js | Python | Go | Rust |
|---|---|---|---|---|
| Schema validation (reject unknown) | zod / Ajv strict / TypeBox | Pydantic v2 (`extra="forbid"`) | struct decoding + `DisallowUnknownFields` + validator lib | `serde` with `deny_unknown_fields` + validator crates |
| Parameterized queries | Prisma, Drizzle, Knex bindings | SQLAlchemy bind params, Django ORM | `database/sql` placeholders, sqlc | SQLx (compile-time checked), Diesel |
| Password hashing (Argon2id) | `argon2` | `argon2-cffi` | `golang.org/x/crypto/argon2` | `argon2` (RustCrypto) |
| CSPRNG | `crypto.randomBytes`, `crypto.randomUUID` | `secrets` | `crypto/rand` | `rand::rngs::OsRng` / `getrandom` |
| Constant-time compare | `crypto.timingSafeEqual` | `hmac.compare_digest` | `crypto/subtle.ConstantTimeCompare` | `subtle` crate |
| HTTP server timeouts | `server.headersTimeout`, `requestTimeout`, `keepAliveTimeout` | ASGI/WSGI server and proxy timeouts | `http.Server{ReadHeaderTimeout, ReadTimeout, WriteTimeout, IdleTimeout}` | `tokio::time::timeout`, tower `TimeoutLayer` |
| Body-size limit | framework `limit` option | server/framework limit | `http.MaxBytesReader` | tower-http `RequestBodyLimit` / axum `DefaultBodyLimit` |
| Outbound client with timeout + SSRF guard | `undici` with custom `connect`/lookup guard | `httpx`/`requests` with explicit timeouts + resolver guard | `http.Client{Timeout}` + `Dialer.Control` guard | `reqwest` with timeouts + custom resolver/connector |
| Rate limiting | `rate-limiter-flexible` (Redis store) | `slowapi`, `limits` (Redis) | `x/time/rate`, Redis-backed limiters | `tower-governor`, Redis-backed limiters |
| SAST | Semgrep, CodeQL, `eslint-plugin-security` | Semgrep, CodeQL, Bandit, Ruff `S` rules | Semgrep, CodeQL, gosec, staticcheck | Semgrep, CodeQL, Clippy |
| SCA | `npm audit`, OSV-Scanner, Socket-style analyzers | `pip-audit`, OSV-Scanner, Safety | `govulncheck`, OSV-Scanner | `cargo-audit`, `cargo-deny`, `cargo-vet` |
| Secret wiping | Best effort (GC; use short-lived values, avoid logging) | Best effort (immutable `str`; use `bytearray` where possible) | Best effort (overwrite `[]byte`) | `zeroize` + `secrecy` crates |
| Race / memory checks in CI | — | — | `go test -race` | Miri on `unsafe`, sanitizers, `cargo-geiger` |

### 16.2 Node.js

- Use an **active LTS** release and track its end-of-life; update promptly for
  security releases.
- **TypeScript `strict`**; no `any` at boundaries; validate with a runtime
  schema because types vanish at runtime.
- **Prototype pollution**: strip/reject `__proto__`, `constructor`,
  `prototype` keys; use schema validation that drops unknown keys; use
  `Map`/`Object.create(null)` for dictionaries keyed by user input; consider
  `--disable-proto=delete`; avoid unsafe deep-merge helpers.
- **No `eval`, `new Function`, or `vm` as a sandbox** (`vm` is not a security
  boundary).
- **Subprocesses**: `execFile`/`spawn` with an argument array and
  `shell: false`; never `exec` with interpolated strings.
- **Event-loop safety**: DoS by blocking the loop. Offload CPU-heavy work to
  worker threads or batch jobs; cap JSON size and depth; avoid synchronous
  crypto/fs on request paths; beware catastrophic regexes (use RE2 bindings
  for user-controlled patterns).
- **Unhandled rejections and exceptions**: handle centrally; on
  `uncaughtException`/`unhandledRejection` log, fail the request, and let the
  supervisor restart the process rather than continuing in an unknown state.
- **Framework hardening**: `helmet`-style headers, trusted-proxy
  configuration so `req.ip` and protocol are correct only behind your proxy,
  strict CORS config, cookie flags, disable `x-powered-by`.
- **Path traversal**: `path.resolve` + prefix check against the allowed root.
- **Randomness**: never `Math.random()` for anything security-related.
- **Supply chain**: `npm ci`, `--ignore-scripts`, `npm audit signatures`,
  provenance checks, lockfile linting, scoped private packages, pnpm's
  default blocking of dependency build scripts with an explicit allow-list,
  and Node's permission model where it is stable for your LTS (restrict
  filesystem, child-process and network access).
- **ORM raw-query escape hatches** (`$queryRawUnsafe` and equivalents) are
  forbidden by lint rule.

### 16.3 Python

- Supported CPython version; virtual environments; dependencies locked with
  hashes (`uv`/`pip-tools` + `--require-hashes`); one configured index to
  avoid dependency confusion.
- **Never**: `pickle`/`marshal`/`shelve` on untrusted data, `yaml.load`
  (use `safe_load`), `eval`/`exec` on input, `subprocess(..., shell=True)`
  with interpolation, `assert` for security checks (stripped under `-O`).
- **XML**: `defusedxml`. **Archives**: guard against path traversal
  ("zip slip"); use `tarfile` extraction filters (`filter="data"`) and
  size/ratio limits.
- **Templates**: Jinja2 autoescape on; user-authored templates only in a
  sandboxed environment with no access to objects that expose secrets.
- **HTTP clients**: `requests` has no default timeout, so always set one;
  keep TLS verification on; bound response size; use the SSRF resolver guard.
- **Frameworks**: Django (`DEBUG=False`, `ALLOWED_HOSTS`, CSRF, secure
  cookies, `SECURE_*` settings, no `mark_safe` on untrusted data), FastAPI
  (Pydantic models for every body, dependency-injected `RequestContext`,
  explicit response models to prevent over-exposure), SQLAlchemy `text()`
  only with bound parameters.
- **Async/GIL**: do not block the event loop with CPU or sync I/O; use
  executors/batch jobs; cap concurrency.
- **Tools**: Bandit and Ruff `S` rules, mypy/pyright strict, `pip-audit`.
- Randomness via `secrets`, never `random`; compare secrets with
  `hmac.compare_digest`.
- Logging: structured; never `logging` raw request bodies; avoid logging
  exceptions that embed secrets (connection strings).

### 16.4 Go

- **Set all `http.Server` timeouts** (`ReadHeaderTimeout` to stop slowloris,
  `ReadTimeout`, `WriteTimeout`, `IdleTimeout`), limit headers, wrap bodies
  with `http.MaxBytesReader`, propagate `context` cancellation everywhere.
- **`html/template`** for HTML (never `text/template` with user data);
  `database/sql` placeholders or `sqlc`; `os/exec` with discrete arguments,
  never via `sh -c`.
- **`encoding/json`** with `DisallowUnknownFields` for strict inputs;
  validate after decoding.
- **Filesystem**: `filepath.Clean` is not enough; use rooted access (`os.Root`
  in recent Go versions) for user-influenced paths.
- **Outbound HTTP**: custom `http.Client` with `Timeout`, and a
  `net.Dialer.Control` hook that rejects internal addresses at connect time
  (this covers DNS rebinding and redirects).
- **Crypto**: `crypto/rand` (never `math/rand`) for secrets;
  `subtle.ConstantTimeCompare`; `x/crypto` for Argon2id; prefer the standard
  TLS config with minimum TLS 1.2.
- **Concurrency safety**: run `go test -race` in CI; avoid goroutine leaks
  (context + bounded worker pools); `recover` at request/job boundaries so a
  panic does not take down the process or leak details.
- **Integer conversions** and slice bounds: explicit checks on untrusted
  sizes (gosec rules catch common overflows).
- Avoid `unsafe` and cgo in application code; forbid via lint unless reviewed.
- **Do not expose** `pprof`, `expvar` or debug handlers on public listeners.
- **Supply chain**: `go.sum` committed, `-mod=readonly`, private
  `GOPROXY`/`GONOSUMDB`/`GOPRIVATE` configuration, `govulncheck` in CI,
  static builds (`CGO_ENABLED=0`, `-trimpath`) on distroless images.

### 16.5 Rust

- Memory safety is the baseline, not a complete defense: logic bugs, panics,
  integer issues, injection, SSRF, auth and supply-chain risks all remain.
- **`unsafe` policy**: `#![forbid(unsafe_code)]` in application crates;
  anywhere `unsafe` is unavoidable (FFI, performance) it is isolated in a
  small reviewed module with `// SAFETY:` justification and tests under Miri;
  track dependencies' `unsafe` with `cargo-geiger`.
- **Panics are availability bugs**: deny `unwrap`, `expect`, `panic!`,
  indexing and arithmetic panics in non-test code with Clippy lints; handle
  task failures at spawn boundaries so one bad request or job cannot crash the
  service; set a supervisor and alert on restarts.
- **Integer overflow**: release builds wrap silently by default; enable
  `overflow-checks = true` for services or use `checked_`/`saturating_`
  arithmetic on untrusted sizes.
- **Async safety**: timeouts on all I/O (`tokio::time::timeout`), bounded
  channels and queues, request body limits, concurrency limits, and care with
  cancellation (a dropped future may leave invariants half-done: design for
  cancellation safety, use transactions/guards).
- **Data handling**: `serde` with `deny_unknown_fields`; SQLx compile-time
  checked or parameterized queries; `secrecy` + `zeroize` for secrets;
  `subtle` for constant-time comparisons; `rustls` preferred; RustCrypto or
  `ring` for primitives.
- **Supply chain**: `Cargo.lock` committed, builds with `--locked`;
  `cargo-deny` (advisories, licenses, banned crates, allowed registries/git
  sources), `cargo-audit`, `cargo-vet` for reviewed dependency trust; review
  `build.rs` and procedural macros (they run arbitrary code at build time);
  `cargo auditable` to embed dependency data in binaries.
- Release builds: `panic` strategy chosen deliberately, symbols stripped in
  images, static or distroless runtime.

## 17. Security requirements by slice

| Slice | Top threats | Required controls beyond the baseline |
|---|---|---|
| `identity` | Credential stuffing, token theft, session fixation, privilege escalation | Argon2id, mandatory MFA for admin, refresh rotation + reuse detection, per-account/IP throttling, ASVS L3, audit of all auth events |
| `tenants` | Cross-tenant access, API key theft, malicious membership changes | RLS + tenant predicate, envelope-encrypted write-only provider keys, key-use audit, step-up auth for key changes, approval flow for ownership transfer |
| `projects` | BOLA, mass assignment | Ownership checks, explicit DTOs, quotas |
| `extraction` | SSRF, malicious scraped content, provider key misuse, queue forgery, cost abuse | SSRF-safe client, content sanitization pipeline, per-tenant concurrency and spend caps, signed/authenticated jobs, lease + fencing, provider key resolved only in adapter |
| `funnels` | IDOR on leads, stored XSS, CSV injection, vector cross-tenant leakage | Tenant+owner predicates, output encoding, export neutralization, tenant-scoped vector queries (impossible to omit via the port), deletion cascades |
| `campaigns` | Abuse (spam/harassment/fraud), webhook forgery, unauthorized launch | `campaigns.launch` permission + step-up, rate/volume caps, opt-out/suppression enforcement, signed provider webhooks with replay protection, anomaly alerts |
| `usage` | Tampering with metering | Append-only metering events, server-side computation only |
| `billing` | Webhook forgery, price tampering, invoice IDOR | Signature verification, server-side pricing, tenant-scoped invoices, payment data never touches the service (hosted fields/redirect) |
| `platform` (shared) | Misconfiguration, secret leakage, log exposure | Config validation at startup, secrets manager only, log redaction, hardened base images |

## 18. Starting baseline values

Tune with threat modeling and measurements.

| Item | Starting value |
|---|---|
| TLS | 1.2 minimum, 1.3 preferred, HSTS 1 year + `includeSubDomains` |
| Access token lifetime | 10 minutes |
| Refresh token | Rotating, 7–30 days idle/absolute per risk, reuse = revoke family |
| Admin session | Shorter idle timeout (for example 15 minutes) and MFA step-up for sensitive actions |
| Argon2id | ≥ 19 MiB, t = 2, p = 1 (tune upward) |
| Login throttle | Progressive delay after 5 failures per account/IP; challenge after 10 |
| Request body | 1 MiB default; larger only on specific upload routes |
| Page size | Default 50, maximum 200 |
| Outbound timeouts | Connect 3 s, total 10–30 s, response cap per endpoint |
| API rate limits | Per user 60/min, per tenant 600/min, sensitive flows lower; tune per route |
| Webhook timestamp tolerance | 5 minutes |
| DB statement timeout | 5–30 s per workload class |
| Vulnerability SLAs | Set in policy (for example critical days, high weeks) |
| Secret rotation | Dynamic/short-lived preferred; static secrets at least annually and on any exposure |

## 19. Verification map to `PLAYBOOK_TESTS.md`

| Control area | Test suite |
|---|---|
| Authorization, BOLA, BFLA, `{userType}` prefix not authorizing | `authz-matrix`, `<slice>/backend/security` |
| Tenant isolation (API, jobs, events, cache, vector) | `tenant-isolation`, `queue`, `vector` integration |
| Input validation and injection | `<slice>/backend/security`, fuzzing |
| SSRF and outbound controls | `<slice>/backend/security`, `external` contracts |
| Auth/session/token behavior | `identity/backend/security`, `http` integration |
| Webhook signature and replay | `contract/external`, `security` |
| Queue security and idempotency | `queue`, `concurrency` |
| Secrets and log hygiene | `_platform/security/secrets`, `_platform/observability` |
| Dependencies, containers, IaC | `_platform/security` (SCA, container, IaC, SBOM) |
| Resilience and fail-closed behavior | `_platform/resilience` |
| Privacy and retention | `_platform/privacy` |
| Audit trail of security events | `_platform/audit-log` |

Control IDs for audit evidence follow `PLAYBOOK_AUDIT.md` (domains `ACC`,
`CRY`, `SDL`, `VUL`, `LOG`, `INC`, `BCP`, `VND`).

## 20. Concrete example: external-provider run-completion webhook

Feature: the external provider calls
`POST /api/v1/app/projects/{projectId}/runs/{runId}/complete` (or a
platform-level webhook route) when an extraction run finishes.

1. **Edge**: WAF + rate limit per source; TLS 1.2+; body ≤ 1 MiB.
2. **Authentication**: verify the HMAC signature over the raw body with the
   per-project webhook secret (stored encrypted, constant-time compare);
   reject if the timestamp is outside 5 minutes; reject duplicate `eventId`
   (replay) using a database unique constraint, Dragonfly only as a fast path.
3. **Validation**: schema with unknown fields rejected; `runId` must belong to
   `projectId`, and `projectId` to the tenant resolved from the **stored** run,
   never from the payload.
4. **Authorization**: the handler runs as a **system actor** with only
   `extraction.runs.update` for that tenant.
5. **Processing**: `202` immediately; enqueue a job carrying only IDs; the
   worker fetches results from the external provider using the tenant key
   resolved inside the outbound adapter, through the SSRF-safe client with
   timeouts and size caps.
6. **Content handling**: scraped fields are length-limited, sanitized,
   stored as data, written idempotently (unique key on
   `tenantId + externalResultId`); embeddings indexed per tenant.
7. **Failure behavior**: invalid signature → `401` with the standard envelope
   and a security event; parsing errors fail closed; poison payloads go to the
   DLQ after max attempts with admin-only access.
8. **Observability**: events logged with `correlationId` and `tenantId`;
   alert on repeated signature failures; metrics on lag and DLQ size.
9. **Tests**: forged signature, stale timestamp, replay, mismatched
   `projectId`, cross-tenant `runId`, oversize body, malformed JSON, scraped
   payload with HTML/formula/prompt-injection strings, duplicate delivery
   (`PLAYBOOK_TESTS.md` suites).
10. **Same behavior in every language**: the steps are identical for the
    Node.js, Python, Go and Rust implementations; only the library calls
    differ (section 16.1).

## 21. Checklist

- [ ] Threat model exists for every slice, route group, queue and integration
      and is reviewed at least annually.
- [ ] Every route/use case declares a permission; deny by default; authz is in
      the use case; tenant and ownership are in every query.
- [ ] `{userType}` is never used for authorization; the `/admin`-with-`/app`-token
      case is tested.
- [ ] RLS enabled with an application role that cannot bypass it.
- [ ] Argon2id, MFA for privileged users, rotating refresh tokens with reuse
      detection, asymmetric short-lived access tokens validated per RFC 8725.
- [ ] Schema validation with unknown fields rejected; limits on size, depth
      and counts; parameterized queries; no shell; no unsafe deserialization.
- [ ] Scraped and third-party content is sanitized per sink; exports
      neutralize formulas.
- [ ] SSRF-safe outbound client with post-resolution IP checks, no or
      re-validated redirects, timeouts, size caps and network egress controls.
- [ ] TLS everywhere; envelope encryption for Restricted data; KMS-managed
      keys with rotation; provider keys write-only and decrypted only in the
      adapter.
- [ ] Rate limits and quotas per IP, user, tenant, key and sensitive flow;
      timeouts on every handler, query and outbound call.
- [ ] Webhooks verified by signature + timestamp + replay protection.
- [ ] Errors fail closed; no stack traces or internals leak; a failing
      security dependency never opens access.
- [ ] Broker (Dragonfly/Redis) with TLS, ACLs per slice prefix, no public
      exposure, dangerous commands restricted; messages treated as untrusted.
- [ ] Lockfiles, pinned versions, release cooldown, install scripts disabled
      by default, private registry proxy, SCA/SAST/secrets/IaC/container scans
      as gates; actions pinned by SHA; signed artifacts, SBOM, provenance.
- [ ] Containers non-root, read-only, minimal; network default-deny;
      datastores private; IaC scanned; least-privilege IAM; no long-lived keys.
- [ ] Secrets only in the secrets manager; scanning in pre-commit, CI and
      history; rotation tested.
- [ ] Security events logged without secrets or PII; tamper-evident
      centralized logs; detection rules and on-call runbooks exist.
- [ ] Containment switches (token revocation, tenant/feature kill switch,
      queue pause, key rotation) are implemented and rehearsed.
- [ ] Language profile rules for Node.js, Python, Go and Rust are enforced by
      linters, SAST and CI.
- [ ] Penetration test at least annually and after major change; findings
      tracked to closure; vulnerability disclosure policy published.
- [ ] Security tests mapped in `PLAYBOOK_TESTS.md` pass and produce evidence
      for the controls in `PLAYBOOK_AUDIT.md`.
