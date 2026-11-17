---
id: CLI_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [CLI]
---

# PLAYBOOK_CLI_PART2 — Cross-platform terminal CLI/TUI playbook (Linux · macOS · Windows) (part 2)

> Part 2 of 2. Main entry: [`PLAYBOOK_CLI.md`](PLAYBOOK_CLI.md). Covers: 8. Configuration and state … Appendix J — Default keybindings (data-driven; per-terminal overrides).

## 8. Configuration and state

### 8.1 Layers and precedence

```text
managed policy (OS-level; can lock keys)  >  CLI flags  >  environment  >  project local (.myapp/settings.local.json, gitignored)
   >  project (.myapp/settings.json, committed)  >  user (config dir)  >  defaults
```

* Schema-validated (JSON Schema/zod), versioned with migrations, `myapp config list|get|set|unset|path|edit` showing the **source layer** of each effective value.
* **No secrets in config files**; tokens only in the keystore or env.
* **Project config is untrusted until trusted**: hooks, plugins, MCP servers, custom commands and shell-executing settings from a repository require a **workspace trust** confirmation (remembered per path/hash); `-p` mode must not silently trust arbitrary repos (explicit `--trust-workspace` or a policy).
* Instruction files for the product's own assistant features (`MYAPP.md`, `.myapp/rules/*.md`) follow `PLAYBOOK_CLAUDE_CODE.md`: short, scoped, versioned.

### 8.2 State and housekeeping

| Data | Location | Retention |
|---|---|---|
| Sessions/transcripts (JSONL, append-only) | state dir | Configurable (default ~30 days); `--no-session-persistence`; plaintext on disk, so offer encryption/redaction options and document it |
| Logs | state/log dir | Rotated, size-capped, redacted |
| Cache | cache dir | TTL/LRU, safe to delete |
| Update staging | data dir | Cleaned after apply |
| Locks/PIDs | runtime dir | Auto-cleaned (stale detection) |

`myapp purge`/`myapp project purge` remove local state for a project; atomic writes; file locks make **multiple simultaneous CLI instances** safe (see `PLAYBOOK_CLAUDE_CODE.md` multi-session patterns).

### 8.3 Managed settings (enterprise)

Policy keys (examples): `apiBaseUrl` (allowlisted patterns), `idp` (issuer/clientId), `updates` (`disabled`, `channel`, `pinnedVersion`, `mirrorUrl`, `window`), `telemetry` (`off|errors|full`), `allowedPlugins`/`allowedMcpServers`/`deniedMcpServers`,
`permissions` (deny rules that users can't override), `disableBypassPermissionsMode`, `allowManagedHooksOnly`, `proxy`, `caBundle`, `killSwitch`, `featureFlags`, `retentionDays`, `supportContact`. Delivered by MDM/GPO/config management;
`myapp status`/`doctor` shows active sources. Managed settings **win over** user and project settings for the keys they set.

---

## 9. Extensibility and agentic capabilities (optional modules)

If the CLI includes an assistant/agent loop in the style of Claude Code, implement it as a **slice** (`session`) with the same hexagon; if not, skip to section 10. Components:

| Component | Design |
|---|---|
| **Model port** | `ModelPort` streaming events (text, tool calls, usage); provider adapters behind the port; cancellation, retries, budgets (`--max-turns`, `--max-budget`) |
| **Tools** | Registry of typed tools (JSON Schema/zod): read-only vs mutating classification; each tool declares required permission, path/command arguments and output size cap; results are **untrusted data** |
| **Permission engine** | Modes (`default`, `acceptEdits`, `plan`, `bypass` gated by policy); allow/deny rules with patterns (`Shell(git status *)`, `Read(./.env)`); deny wins; managed rules immutable; every decision logged |
| **Sandbox (optional)** | OS adapters (macOS Seatbelt, Linux bubblewrap/Landlock, Windows Job Objects/AppContainer or WSL) restricting filesystem/network for shell tools **(verify per OS)**; permissions are the policy layer, sandbox is containment |
| **Sessions** | JSONL event log, `--continue`, `--resume <id\|name>`, naming, fork, retention; resume rebuilds state from events |
| **Context management** | Token accounting, compaction (`/compact`), instruction files loaded on demand (scoped), file mentions, ignore files |
| **Skills** | Directories of instructions (`SKILL.md` + files) discovered from user/project scope, description-matched or invoked by slash command; trust and size budgets |
| **Hooks** | Lifecycle events (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`, …) running commands/HTTP with JSON in/out; exit-code semantics; fail-closed option for policy hooks; trust-gated |
| **Plugins** | Versioned bundles (commands, skills, hooks, MCP servers) from allowlisted marketplaces, signed, with explicit trust prompts and managed allowlists |
| **MCP client** | stdio/HTTP/SSE servers; per-server auth tokens in the keystore; tool names prefixed by server; timeouts and output caps; managed allow/deny; no automatic trust of project-defined servers |
| **Background tasks** | Long commands/agents tracked in `/tasks` with logs and cancellation |
| **Headless/stream-json** | The same event bus serialized as NDJSON for IDEs and automation |

Security rules for this module: tool output and file contents may contain **prompt injection**: never let them change permissions, config or trust; require user approval for sensitive operations; redact secrets before sending to any model; log denials.

---

## 10. Security

### 10.1 Threat model (CLI-specific)

| Threat | Controls |
|---|---|
| **Malicious repository** (hooks, plugins, MCP, commands, config executing on open) | Workspace trust gate; managed allowlists; no auto-execution before trust; clear prompts showing what will run |
| **Terminal escape injection** (ANSI/OSC/CSI in server/LLM/file/filename content: title changes, fake prompts, clipboard writes, cursor tricks, hyperlink spoofing) | **Sanitize all untrusted text** before rendering (strip C0/C1 control chars and 7-bit ESC-prefixed CSI/OSC/DCS sequences; re-emit only sequences generated by the renderer); OSC 52 write-only and size-capped; OSC 8 URLs validated and shown |
| **Command injection** | Argument arrays, no shell interpolation of untrusted input; per-shell quoting adapters; `.cmd/.bat` special handling on Windows; allowlisted executables where possible |
| **Path traversal / symlink escape** | Containment checks with `realpath` against allowed roots; refuse writes outside; handle junctions/UNC |
| **Secret leakage** (logs, transcripts, telemetry, `ps`, env of child processes, crash dumps) | Redaction filters; never pass secrets in argv; scrub child-process environments (allowlist); mask token patterns in output; `doctor` warnings |
| **Token theft** | OS keystore, short-lived tokens, refresh rotation, `auth logout` revocation, file permissions 0600/ACLs |
| **Update hijack/downgrade** | Signed manifest + signed binaries, HTTPS, monotonic version, rollback protection, pinned update key distinct from the code-signing key |
| **Installer tampering (`curl \| sh`)** | Hash/signature verification, versioned URLs, offline installers, package-manager channels, documented checksum verification |
| **Supply chain** (npm/crates/go deps, build tooling) | Lockfiles, frozen installs, cooldown for new versions, SCA/SBOM, provenance attestations, hermetic CI, minimal dependency tree (`PLAYBOOK_SECURITY.md` §11) |
| **Privilege misuse** | Never require root/admin; user-writable install dir; no silent PATH/rc-file edits; no setuid |
| **Malicious plugin/MCP server** | Signing, allowlists, per-server permissions, timeouts/output caps, sandboxing where available |
| **Network interception** | TLS verification, proxy/CA support without disabling checks, no `--insecure` by default (if provided, loud warning and policy-gated) |
| **Local IPC abuse** (RPC socket) | Per-user permissions, random socket path in the runtime dir, auth token, schema validation |

### 10.2 Controls checklist

* Strict TypeScript, no `eval`/`new Function`, prototype-pollution-safe parsing, `child_process` only via `execFile`/`spawn` with argument arrays (language profiles in `PLAYBOOK_SECURITY_PART2.md` §16 for Node/Python/Go/Rust).
* All inbound data validated by schemas (API responses, event streams, config, plugin manifests, MCP messages) with size limits.
* No telemetry or crash upload without consent/policy; transcripts and logs are plaintext at rest unless encryption is enabled: documented.
* Secrets scanning of output before it leaves the process for shell tools or models (optional but recommended).
* `--dangerously-*` style bypass flags exist only if needed, are named loudly, disabled by managed policy and refused in untrusted workspaces.

### 10.3 Privacy

Opt-in telemetry with a clear schema, no file contents/prompts/paths in telemetry by default, retention limits for local transcripts, `purge` commands, data-subject requests handled by the backend, `doctor` explains what is stored where.

---

## 11. Performance and resource budgets

| Metric | Budget (starting points; calibrate) |
|---|---|
| `--version`/`--help` | ≤ 50 ms (compiled/fast path), ≤ 150 ms worst case on Node |
| Interactive cold start to first frame | ≤ 500 ms (Ink/Node-class), ≤ 150 ms (Rust/Go-class) |
| Time to first streamed token/line after sending | Dominated by network; client overhead ≤ 20 ms |
| Keypress to echo | ≤ 16–30 ms |
| Redraw cost during streaming | Bounded; ≤ 30–60 fps; no full-screen repaint per token |
| Idle CPU | ≈ 0% (no timers/animations when idle) |
| Memory | Idle ≤ ~150 MB (Ink/Node-class) / ≤ ~40 MB (Rust/Go-class); no growth across a 4-hour session; transcript windowed |
| Large outputs | Stream to terminal/file with backpressure; handle 100 MB piped input without buffering everything |
| Binary size | Track per release; compiled JS runtimes are large (tens to ~100+ MB); budgets and trends in CI |
| Install/update download | Delta or compressed artifacts; resumable |

Techniques: split the **entrypoint** so print/subcommand paths don't load Ink/React/markdown/highlighters; lazy-load heavy modules; precompiled bytecode/snapshots where the runtime supports them (verify stability and signing impact); avoid synchronous I/O in render paths; cache terminal capability results;
use streaming JSON/NDJSON parsers; avoid regex backtracking on untrusted input; keep dependency count low. Old/low-end machines: no GPU, small RAM budgets, slow disks (lazy file scanning, bounded watchers).

---

## 12. Distribution, install and update

### 12.1 Channels

| Channel | Notes |
|---|---|
| **Native installer script** (`curl -fsSL … \| sh`, PowerShell `irm … \| iex`) | Convenient but high-trust: HTTPS only, versioned URLs, published checksums/signatures, non-root install into a user dir, no silent rc edits; offer manual download + verify instructions |
| **Homebrew** (formula/cask), **WinGet**, **Scoop**, **Chocolatey** | Preferred by many users/admins; manifests generated by CI |
| **apt/dnf repos**, `.deb`/`.rpm` | Signed repos for Linux fleets |
| **npm** (`npm i -g`) with **optional platform dependencies** pulling the right native binary | Developers and CI; package provenance enabled |
| **MSI/pkg** | Managed deployment, silent install, per-machine policy |
| **Container image** | CI usage; non-root, minimal base |
| **GitHub Releases** | Archives + checksums + SBOM + provenance attestation |

### 12.2 Signing and trust

| OS | Requirement |
|---|---|
| Windows | **Authenticode** signing (key in HSM/cloud signing), timestamping, signed MSI; SmartScreen reputation planning |
| macOS | **Developer ID + hardened runtime + notarization** for CLI binaries (distribute as a .pkg or .dmg so the notarization ticket can be stapled; a ZIP can be notarized but never stapled, and a bare Mach-O binary cannot carry a stapled ticket, so it relies on Apple's online lookup at first launch) **(verify current Apple tooling)**; arm64 binaries must be (at least ad-hoc) signed to run |
| Linux | GPG-signed repositories; `cosign`/minisign signatures for archives; checksums |
| All | SLSA-style provenance, SBOM (CycloneDX/SPDX), reproducible builds as far as practical |

Signing happens in a **dedicated CI job** with isolated credentials and approval for releases; keys never on developer machines. Runtime toolchains can regress signing (a 2026 report mentions a Bun version producing macOS arm64 binaries killed at launch **(verify)**): add a **post-build smoke test on a clean machine** per OS/arch.

### 12.3 Updates

* **Channels**: `stable` (default), `latest`, `canary`; `myapp install <channel|version>` pins a specific version; staged rollout by cohort with halt on regression.
* **Manifest**: signed (Ed25519), lists version, channel, platform/arch/libc, URLs, hashes, size, min OS, release notes, `minSupportedVersion`, cohort; clients verify signature, hash and **monotonic version** before applying.
* **Mechanism**: background check (throttled, opt-out by policy), download to a staging dir, verify, **atomic swap**; on Windows swap on next launch or via a small helper because a running executable can't be replaced; keep the previous version for **rollback** (`myapp update --rollback`); never update while a long operation is running without consent.
* **Admin controls**: `updates.disabled`, `pinnedVersion`, `channel`, `mirrorUrl` (internal artifact server), update windows; air-gapped bundles with offline verification.
* **No update without trust**: unsigned, mismatched or downgrade manifests are rejected and reported.
* **Uninstall**: documented per channel; leaves user data unless `--purge`.

### 12.4 Support matrix

Publish `docs/support-matrix.md`: OS and minimum version, architectures, libc, terminals tested, shells, runtime requirements, known limitations (for example legacy consoles), end-of-support dates.

---

## 13. Observability and diagnostics

| Signal | Implementation |
|---|---|
| `myapp doctor` | Checks: version/channel, install method and path, PATH shadowing, runtime, auth state, API reachability (proxy/TLS/CA), config validity and sources, terminal capabilities report, shell detection, dir permissions, disk space, update status, plugin/MCP health; exit non-zero on failures; machine-readable `--json` |
| Debug logging | `--debug [categories]` (`api`, `mcp`, `render`, `permissions`, `updater`), written to a rotating file (path printed), redacted; never to stdout |
| Crash handling | Terminal guard + friendly message with log path and correlation ID; optional crash report upload (opt-in, scrubbed) |
| Diagnostics bundle | `myapp bug-report` (user-initiated): version, OS, terminal, caps, effective config (secrets removed), recent logs, last errors with correlation IDs |
| Metrics (opt-in) | Startup time, first-frame time, render stalls, API latency/error rates, realtime reconnects, update outcomes, command usage counts (no arguments/content) |
| Tracing | `X-Correlation-Id` per command/turn, printed on errors and included in logs |
| Server-side | Error rates by CLI version/OS, `upgrade-required` rates, update failures, auth failures |

---

## 14. Testing strategy

Follows `PLAYBOOK_TESTS.md`; adds a `cli` side:

```text
tests/<slice>/cli/{unit,integration,contract,e2e,perf,security}/
tests/_platform/{architecture,terminal-matrix,installer,updater,policy,realtime,security}/
```

| Level | Scope | Tooling (examples) |
|---|---|---|
| Unit | domain, use cases, permission engine, config resolver with fake ports | Vitest/Jest (or `cargo test`/`go test`) |
| ViewModel/TUI | State/commands; Ink rendering to a virtual terminal; keybinding handling | `ink-testing-library`, snapshot of rendered frames |
| Adapter integration | SDK vs mock server, SSE/WebSocket conformance (reconnect, resume, duplicates, slow consumer), keystore adapters per OS, config layering, file locking, shell adapters | local test servers, OS runners |
| Contract | OpenAPI/route-table parity (commands ↔ endpoints), exit-code mapping, `stream-json` schema, JSON envelope, policy schema | schema tests, golden files |
| Golden output | `--help`, tables, JSON, error messages (width variants, no-color, ASCII fallback) | snapshot tests |
| **PTY e2e** | Real terminal sessions: spawn the binary in a pseudo-terminal (ConPTY on Windows), type keys, assert screen content via a headless terminal emulator; permission dialogs, interrupts, resize, paste | `node-pty`/`pexpect`-style drivers + xterm-headless |
| Cross-OS matrix | Ubuntu (glibc), Alpine (musl), macOS (x64/arm64), Windows (x64/arm64) | CI runners |
| Terminal matrix | Windows Terminal, conhost, PowerShell 5.1/7, cmd, Git Bash, WSL; macOS Terminal.app, iTerm2; GNOME Terminal/Konsole/xterm; Kitty/WezTerm/Alacritty/Ghostty; tmux/screen/zellij; SSH; VS Code terminal; CI (no TTY) | scripted + manual smoke |
| Encoding/locale | UTF-8, CJK/emoji widths, RTL, non-UTF-8 locales, Windows code pages | fixtures |
| Paths/filesystem | Spaces, Unicode, UNC, drive letters, long paths, symlinks/junctions, permissions, read-only FS | fixtures |
| Signals/lifecycle | SIGINT/SIGTERM/SIGHUP, Windows Ctrl+C/Break, crash → terminal restored, piped `EPIPE` | process tests |
| Concurrency | Multiple instances: config/session locking, no corruption | stress tests |
| Security | Escape-sequence injection corpus, path traversal/symlink escape, command injection (incl. `.cmd`), secrets-in-logs scans, update tamper/downgrade, workspace-trust bypass attempts, fuzzing of parsers (SSE, NDJSON, config, manifests) | custom + fuzzers |
| Performance | Startup, first frame, render throughput, memory soak, large pipe | benchmark harness, regression thresholds |
| Install/upgrade | Clean VM install, upgrade N-1 → N, rollback, uninstall, PATH, per-channel | VM images per OS |
| Policy | Managed settings per OS (registry/plist/JSON), locked keys, kill switch, update pinning | scripted |
| Accessibility | `--accessible`, `NO_COLOR`, screen-reader-friendly output, ASCII fallback | snapshot + manual |
| Authorization parity | Each command maps to a route/permission; authz matrix rows exist | `PLAYBOOK_TESTS.md` §8 |

Rules: no production data or real tenants; deterministic PTY tests (wait on screen conditions, never sleeps); flaky tests quarantined with owner/expiry; every command has contract + golden tests; every exit code has a test.

### 14.1 TDD loop with Claude Code

The TDD runner (`PLAYBOOK_CLAUDE_CODE_PART2.md` §10) detects the CLI package and runs unit/contract tests per slice; PTY/e2e suites run in CI; roles stay separate (test-writer edits tests, implementer edits source). Golden files are reviewed like code.

---

## 15. Build and release engineering

| Stage | Gate |
|---|---|
| Pre-commit | Format, lint, typecheck, secrets scan |
| PR | Unit/ViewModel/contract/golden tests, architecture rules, SAST/SCA, command ↔ route-table parity, size/startup smoke on Linux |
| Main | Three-OS matrix (build + integration + PTY smoke), SBOM, license report |
| Nightly | Full PTY/terminal matrix, perf suite, soak, installer/upgrade, fuzzing, dependency refresh |
| Release candidate | All above + signing (isolated job), notarization, update manifest dry run, install tests on clean VMs, evidence bundle |
| Release | Staged rollout (canary → latest → stable), health gates, auto-halt |
| Post-release | Crash/update/auth metrics, rollback plan (higher version + kill switch) |

Build rules: lockfile + frozen install; pinned runtime/toolchain versions; per-target builds (linux x64/arm64 × glibc/musl, macOS x64/arm64, Windows x64/arm64); reproducible archives; release smoke test executes the produced binary (`--version`, `doctor`, a PTY hello) on each target;
generate checksums, SBOM, provenance; publish manifests to every channel from one pipeline.

---

## 16. Governance and compliance

* **Ownership**: CODEOWNERS for `src/platform/**`, `src/infrastructure/{updater,config,auth}/**`, permission engine, `contracts/**`, packaging, signing workflows, `docs/permissions-register.md`; security review for those paths.
* **Documents**: ADRs (D1–D15…), support matrix, threat model, data-flow diagrams, admin guide (managed settings per OS), runbooks, command reference (generated).
* **Compliance mapping** (`PLAYBOOK_AUDIT.md`): secure SDLC (CI gates, reviews, analysis), change management (release approvals, staged rollout), cryptography/key custody (signing and update keys), vulnerability management (SBOM, scanning, SLAs), logging (telemetry/audit), vendor management (runtime, dependencies, crash/telemetry services), availability (kill switch, rollback), privacy (telemetry policy, retention, purge).
* **CRA**: a distributed CLI is a product with digital elements for EU purposes; reporting obligations for manufacturers apply from 11 September 2026 and most other obligations from 11 December 2027 **(confirm applicability with counsel)**; maintain a vulnerability disclosure policy, SBOM and a security-update support period.
* **Runbooks**: broken release/rollback, signing key compromise, update server outage, malicious plugin/MCP server report, auth/IdP outage, terminal-corruption bug, Windows AV false-positive wave, notarization failure.
* **Quality KPIs**: crash-free sessions, startup p50/p95 per OS, update success rate, command error rate by exit code, support tickets per release, defect escape rate.

---

## 17. Working with Claude Code on this project

Per `PLAYBOOK_CLAUDE_CODE.md`:

* A path-scoped rule for `apps/cli/**` carrying the layer rules, the stdout/stderr contract, exit codes, "no `process.platform` outside `platform/`", terminal-sanitization and trust rules (linked, not `@`-imported).
* **Role policy**: the integrator owns `packaging/**`, signing/release workflows, dependency baselines and generated contracts/route table; the security reviewer checks permission engine, updater, auth and sanitizer changes; hooks/settings stay human-owned.
* **Skills**: `new-cli-command` (command + route-table entry + use case + tests + help golden), `new-slash-command`, `new-tui-view` (ViewModel + View + frame snapshot), `new-policy-key` (schema + per-OS delivery + UI/doctor display + test), `cli-perf-check` (startup/render budgets).
* **Specs** for each command list: usage, flags, positional args, output schemas, exit codes, permissions/route, platform notes, TTY vs piped behavior, and test levels per AC.

---

## 18. Anti-patterns (reject in review)

| Anti-pattern | Why it fails |
|---|---|
| Business logic in the TUI/Ink components or in argv handlers | Untestable, not scriptable |
| Printing UI chrome, spinners or color to stdout when piped | Breaks scripts |
| Prompting in non-TTY contexts | Hangs CI |
| Writing raw server/LLM/file text to the terminal | Escape-sequence injection |
| Leaving the terminal in raw/alt-screen state after errors | Unusable shell |
| `process.platform` checks scattered through code | Platform drift |
| Building shell command strings from untrusted input; ignoring `.cmd/.bat` quirks on Windows | Command injection |
| Assuming Git Bash/WSL/Unix tools on Windows | Breaks native Windows users |
| Hard-coding terminal features (OSC 8, 2026, kitty keys) without negotiation/fallback | Garbage output in other terminals |
| Full-screen repaint per streamed token | Flicker and CPU burn |
| Alternate-screen-only UI by default | Loses scrollback/copy-paste |
| Auto-executing hooks/plugins/MCP from a freshly cloned repo | Remote code execution |
| Tokens/secrets in config files, argv, logs or transcripts | Credential leaks |
| `curl \| sh` installer without verification, or editing shell rc files silently | Supply-chain risk |
| Update that can downgrade or applies unsigned artifacts; overwriting a running `.exe` | Takeover/corruption |
| Heavy imports at startup for `--version`/`--help` | Slow CLI |
| Hand-written API paths/DTOs and commands | Contract drift |
| Undocumented/unstable exit codes and JSON shapes | Breaks automation |
| Testing only on the developer's OS/terminal | Field failures on others |
| Telemetry on by default or without redaction | Privacy/enterprise rejection |

---

## 19. Definition of done and checklists

### 19.1 Command/feature DoD

- [ ] Spec lists usage, flags, args, output schemas, exit codes, permissions/route, TTY vs piped behavior, platform notes, and test levels per AC.
- [ ] Logic lives in use cases; adapters thin; works headless; `--json`/`stream-json` schema and golden tests exist.
- [ ] Errors map to the shared taxonomy and documented exit codes; `requiredPermission` and correlation ID surfaced.
- [ ] No prompts when not a TTY; `--yes`/`--dry-run` for destructive actions; `Ctrl+C` handled; terminal restored.
- [ ] Output sanitized; widths/Unicode handled; `NO_COLOR`/`--accessible` verified.
- [ ] Works on Linux, macOS and Windows (paths, shells, signals); covered by CI matrix.
- [ ] Policy-aware (managed settings, kill switch); telemetry opt-in and redacted.
- [ ] Help/completions/docs generated; startup budget unaffected (lazy imports verified).

### 19.2 Release checklist

- [ ] Frozen builds for every target; checksums, SBOM and provenance generated.
- [ ] Unit/contract/golden/PTY/security/perf suites green on the OS/terminal matrix.
- [ ] Binaries signed (Authenticode/Developer ID+notarization/GPG), post-build smoke tests pass on clean machines.
- [ ] Update manifest signed; rollback tested; staged rollout and halt criteria configured.
- [ ] Install/upgrade/uninstall tested per channel; admin guide and support matrix updated.
- [ ] Canary soak complete; crash/update/auth metrics healthy.

### 19.3 Architecture acceptance checklist

- [ ] Headless core with ports; TUI, print, subcommands, RPC as separate adapters over the same use cases and event bus.
- [ ] Dependency rules enforced in CI; `platform/` is the only OS-specific code.
- [ ] stdout/stderr, exit-code and output-schema contracts documented and tested.
- [ ] Terminal capability negotiation with fallbacks; terminal guard; sanitization of untrusted text.
- [ ] SDK-generated commands mirroring the URL contract; auth via device code/PKCE; tokens in the keystore.
- [ ] Config layers with managed policy, workspace trust, schema validation; state locking for multi-instance use.
- [ ] Realtime optional with the shared state machine; long operations with `--wait`.
- [ ] Extensibility (skills/hooks/plugins/MCP) trust-gated and policy-controlled (if included).
- [ ] Single-binary packaging per OS/arch, signed and notarized, auto-update with rollback and admin controls.
- [ ] `doctor`, debug logging, bug-report bundle, opt-in telemetry.
- [ ] Three-OS CI, PTY e2e, terminal matrix, installer/updater and security suites.

---

## Appendix A — Directory structure (TypeScript variant)

```text
apps/cli/
├── bin/myapp.ts                      # fast path: --version/--help; lazy-loads the rest
├── src/
│   ├── app/                        # composition root, mode router (interactive | print | subcommand | serve)
│   ├── shared-kernel/              # Result, ids, errors, time, branded types
│   ├── contracts/                  # DTOs, error codes, exit codes, event schemas (stream-json), policy schema, route table
│   ├── platform/                   # ONLY OS-specific code
│   │   ├── common/  linux/  macos/  windows/
│   │   │   paths  signals  shell  process-tree  keystore  clipboard  opener  terminal-modes  fs-lock  console-encoding
│   ├── infrastructure/
│   │   ├── sdk/ (adapter over packages/sdk)   realtime/ (sse, websocket, polling)   storage/ (sessions, cache, locks)
│   │   ├── config/  auth/  telemetry/  updater/  mcp/  plugins/  sandbox/  terminal/ (caps, renderer helpers, sanitizer)
│   ├── features/<slice>/
│   │   ├── domain/ application/ adapters/{in/{cli,slash,tui,rpc}, out}/ contracts/ viewmodels/ views/
│   └── ui-kit/                     # Ink components, themes, markdown renderer, table, diff view, dialogs
├── packaging/{npm,homebrew,winget,scoop,deb,rpm,msi,pkg,docker}/
packages/{sdk,core,viewmodels}/     # shared with other clients
tests/<slice>/cli/{unit,integration,contract,e2e,perf,security}/    tests/_platform/{architecture,terminal-matrix,installer,updater,policy,realtime,security}/
docs/{adr,support-matrix.md,admin-guide.md,runbooks/,permissions-register.md}
```

## Appendix B — Fast-path entrypoint and mode router (sketch)

```ts
// bin/myapp.ts — keep imports minimal so --version/--help stay instant
const argv = process.argv.slice(2);
if (argv[0] === '--version' || argv[0] === '-v') { process.stdout.write(`${VERSION}\n`); process.exit(0); }

const { run } = await import('../src/app/main.js');                  // lazy: parser, container, adapters
process.exitCode = await run(argv, {
  stdin: process.stdin, stdout: process.stdout, stderr: process.stderr,
  env: process.env, platform: process.platform, isTTY: !!process.stdout.isTTY && !!process.stdin.isTTY,
});
```

```ts
// src/app/main.ts
export async function run(argv: string[], io: Io): Promise<number> {
  const container = await buildContainer(io);                        // wires ports → adapters per OS
  const cmd = parse(argv, container.commandRegistry);                // generated from route table + hand-written commands
  switch (selectMode(cmd, io)) {                                     // interactive | print | subcommand | serve
    case 'interactive': return (await import('./modes/interactive.js')).start(container, cmd);   // loads Ink only here
    case 'print':       return (await import('./modes/print.js')).start(container, cmd);
    case 'serve':       return (await import('./modes/serve.js')).start(container, cmd);
    default:            return (await import('./modes/subcommand.js')).start(container, cmd);
  }
}
```

## Appendix C — Stream-JSON event envelope (v1)

```json
{"v":1,"type":"session.started","ts":"2026-11-10T12:00:00Z","sessionId":"s_01","correlationId":"c_01","payload":{"cwd":"/work/app","version":"1.8.0","mode":"print"}}
{"v":1,"type":"message.delta","sessionId":"s_01","payload":{"role":"assistant","text":"Analyzing…"}}
{"v":1,"type":"tool.requested","sessionId":"s_01","payload":{"id":"t_1","tool":"Read","input":{"path":"src/a.ts"}}}
{"v":1,"type":"permission.requested","sessionId":"s_01","payload":{"id":"p_1","tool":"Shell","summary":"git status","options":["allow_once","allow_always","deny"]}}
{"v":1,"type":"tool.result","sessionId":"s_01","payload":{"id":"t_1","ok":true,"truncated":false}}
{"v":1,"type":"progress","sessionId":"s_01","payload":{"phase":"running","percent":40}}
{"v":1,"type":"result","sessionId":"s_01","payload":{"ok":true,"exitCode":0,"usage":{"turns":2}}}
{"v":1,"type":"error","sessionId":"s_01","payload":{"code":"FORBIDDEN","message":"…","requiredPermission":"funnels.leads.update","correlationId":"c_01"}}
```

Rules: one JSON object per line on stdout; unknown event types are ignored by consumers; additive changes only within `v`; breaking changes bump `v`; partial-message and hook events are opt-in flags.

## Appendix D — Output sanitizer (sketch; prefer a vetted library plus this control-character pass)

```ts
const CSI = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const OSC = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;                 // includes OSC 8/52/0 etc.
const DCS_PM_APC_SOS = /\u001b[PX^_][\s\S]*?(?:\u001b\\)/g;
const OTHER_ESC = /\u001b[@-Z\\-_]/g;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;                   // keep \n \t; strip \r (line overwrite)

export const toSafeTerminalText = (s: string): string =>
  s.replace(OSC, '').replace(DCS_PM_APC_SOS, '').replace(CSI, '').replace(OTHER_ESC, '').replace(CONTROL, '');
// The renderer re-adds its own styling/hyperlinks AFTER sanitizing; URLs are validated (scheme allowlist) and displayed.
```

## Appendix E — Device-code sign-in (sketch)

```ts
export async function deviceLogin(idp: IdpPort, ui: UiPort, clock: ClockPort): Promise<Tokens> {
  const d = await idp.deviceAuthorize({ scope: 'openid offline_access myapp.api' });          // POST …/device_authorization
  ui.info(`Open ${d.verificationUri} and enter code: ${d.userCode}`);
  let interval = d.interval ?? 5;
  const deadline = clock.now() + d.expiresIn * 1000;
  while (clock.now() < deadline) {
    await sleep(interval * 1000);
    const r = await idp.pollToken(d.deviceCode);
    if (r.ok) return r.tokens;                                                              // store in SecretStorePort, never print
    if (r.error === 'slow_down') interval += 5;
    else if (r.error !== 'authorization_pending') throw new AuthError(r.error);             // access_denied, expired_token, …
  }
  throw new AuthError('expired_token');
}
```

## Appendix F — Config precedence resolver (sketch)

```ts
export function resolveConfig(layers: { managed: Cfg; flags: Cfg; env: Cfg; projectLocal: Cfg; project: Cfg; user: Cfg; defaults: Cfg }): EffectiveConfig {
  const order = [layers.defaults, layers.user, layers.project, layers.projectLocal, layers.env, layers.flags] as const;   // low → high
  const merged = mergeWithSources(order);                    // records the source layer of every key
  return applyManagedLocks(merged, layers.managed);          // managed values win and mark keys as locked
}
```

## Appendix G — Managed settings example (JSON; same keys via registry/plist)

```json
{
  "apiBaseUrl": "https://acme.example.com",
  "idp": { "issuer": "https://login.acme.example/", "clientId": "myapp-cli" },
  "updates": { "channel": "stable", "disabled": false, "mirrorUrl": "https://mirror.acme.example/myapp" },
  "telemetry": "errors",
  "permissions": { "deny": ["Shell(curl * | sh*)", "Read(./.env)"] },
  "allowManagedHooksOnly": true,
  "allowedMcpServers": ["acme-internal"],
  "proxy": { "mode": "system" },
  "killSwitch": false
}
```

## Appendix H — Update manifest example

```json
{
  "v": 1, "channel": "stable", "version": "1.8.2", "minSupportedVersion": "1.6.0", "rollout": { "cohort": "stable", "percent": 25 },
  "artifacts": [
    { "os": "linux", "arch": "x64", "libc": "glibc", "url": "https://dl.example.com/myapp/1.8.2/myapp-linux-x64.tar.gz", "sha256": "…", "size": 62914560 },
    { "os": "darwin", "arch": "arm64", "url": "https://dl.example.com/myapp/1.8.2/myapp-darwin-arm64.zip", "sha256": "…", "size": 60817408 },
    { "os": "win32", "arch": "x64", "url": "https://dl.example.com/myapp/1.8.2/myapp-win32-x64.zip", "sha256": "…", "size": 66060288 }
  ],
  "notes": "https://example.com/myapp/changelog#1.8.2",
  "signature": "<ed25519 over canonical JSON>"
}
```

## Appendix I — CI matrix (sketch)

```yaml
strategy:
  matrix:
    include:
      - { os: ubuntu-latest,  target: linux-x64-glibc }
      - { os: ubuntu-latest,  target: linux-x64-musl, container: alpine }   # musl artifact tested in Alpine
      - { os: ubuntu-24.04-arm, target: linux-arm64-glibc }
      - { os: macos-13,       target: darwin-x64 }
      - { os: macos-latest,   target: darwin-arm64 }
      - { os: windows-latest, target: win32-x64 }
      - { os: windows-11-arm, target: win32-arm64 }
steps: [checkout, setup-runtime (pinned), frozen-install, lint+typecheck, unit+contract+golden, build-binary, smoke(--version, doctor, PTY hello), upload-artifact]
```

## Appendix J — Default keybindings (data-driven; per-terminal overrides)

| Action | Default | Notes |
|---|---|---|
| Submit | `Enter` | |
| Newline | `Shift+Enter` / `Alt+Enter` / `\` + `Enter` | Shift+Enter needs enhanced keyboard modes in some terminals/ConPTY |
| Cancel current operation | `Esc` / first `Ctrl+C` | |
| Exit | second `Ctrl+C` / `Ctrl+D` on empty input | |
| History search | `Ctrl+R` | |
| Slash palette | `/` at start of input | |
| File mention | `@` | respects ignore files |
| Clear screen | `Ctrl+L` | |
| Toggle detail view | `Ctrl+O` | |
| Scroll (fullscreen mode) | `PageUp/PageDown`, mouse wheel (opt-in) | |
