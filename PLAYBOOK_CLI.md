---
id: CLI
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: client-platform
depends_on: [URLS, SECURITY]
---


# PLAYBOOK_CLI.md — Cross-platform terminal CLI/TUI playbook (Linux · macOS · Windows)

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_CLI.md`](PLAYBOOK_CLI.md) | 1. Decisions up front (record each as an ADR) … 7. Backend integration |
| 2 | [`PLAYBOOK_CLI_PART2.md`](PLAYBOOK_CLI_PART2.md) | 8. Configuration and state … Appendix J — Default keybindings (data-driven; per-terminal overrides) |

Architecture and engineering contract for building, shipping and operating a
**command-line product in the style of Claude Code**: an interactive terminal UI
(TUI) with streaming output, slash commands and permission prompts, **and** a
fully scriptable headless mode (print/JSON/NDJSON), resource subcommands,
extensibility (skills, hooks, plugins, MCP) and managed enterprise
configuration, all running on **Linux, macOS and Windows**.

It follows the same architecture as the rest of the product family:
**hexagonal + vertical slices**, a generated **SDK** that mirrors the URL
contract, MVVM-style presentation, server-side authorization, spec/test-driven
workflow. It extends and must stay consistent with `PLAYBOOK_URLS.md` (routes,
permissions), `PLAYBOOK_BACKEND.md` (slices, realtime, idempotency),
`PLAYBOOK_FRONTEND.md` (MVVM + SDK, error taxonomy), `PLAYBOOK_SECURITY.md`,
`PLAYBOOK_TESTS.md`, `PLAYBOOK_AUDIT.md`, `PLAYBOOK_CLAUDE_CODE.md` (instruction,
skills, hooks, multi-session patterns), `PLAYBOOK_DESKTOP_QT.md` (realtime
state machine, policy, updater) and the mobile playbooks (device-code style
sign-in is new here; push is not applicable).

The runnable, machine-checkable companion is the CLI skill pack: three Agent
Skills (write, review, port) and a drop-in eslint config that enforces this
contract.

The rules that carry the whole file:

1. **One headless core, many frontends.** The engine (use cases, ports, event
   stream) knows nothing about terminals. The TUI, print mode, resource
   subcommands, the RPC server and IDE bridges are clients of the same core.
2. **Everything is scriptable.** Every feature works without a TTY. `stdout` is
   data, `stderr` is diagnostics and UI chrome; exit codes and JSON schemas are
   versioned contracts.
3. **Be TTY-aware.** Interactive features only when stdin/stdout are terminals;
   honor `NO_COLOR`, `CI`, `TERM=dumb`; degrade, never crash.
4. **Terminal state is sacred.** Raw mode, alternate screen, cursor, mouse,
   bracketed paste and keyboard protocols are always restored on exit, crash or
   signal.
5. **Untrusted text never reaches the terminal raw.** Model output, server
   content, file content and filenames are sanitized for escape sequences before
   rendering.
6. **Safe by default.** Workspace trust, explicit permission model, no secrets
   in logs or config, signed releases, verified updates.
7. **Cross-platform by construction.** OS differences live in `platform/`
   adapters; three-OS CI is mandatory; paths, shells, signals and encodings are
   tested, not assumed.
8. **Startup time is a feature.** Fast path for `--version`/`--help`, lazy loading,
   compiled single binary, budgets enforced in CI.
9. **Authorization is on the server.** The CLI never decides access; `{userType}`
   selects an experience, not a permission.
10. **Admins can govern it.** Managed policy, update channels, kill switch,
    diagnostics, audit trail.
11. **Releases are signed, reproducible and reversible.**

> Verification note: status as of November 2026. Reference implementations in
> this space include **Claude Code** (TypeScript, React with a forked Ink
> renderer; native per-platform binaries since v2.1.113; installable through a
> native installer, Homebrew, WinGet or npm), **Gemini CLI** (TypeScript, React
> 19 + Ink), **Codex CLI** (rewritten in Rust with ratatui in 2025) and **Crush**
> (Go, Bubble Tea v2; first released in 2025, rewritten on v2 in February 2026).
> Items marked **(verify)** depend on versions, terminal support or vendor
> behavior and must be re-checked before adoption. Budgets are starting points
> to calibrate on your own hardware.

---
## 1. Decisions up front (record each as an ADR)

| # | Decision | Recommendation | Rationale / alternatives |
|---|---|---|---|
| D1 | Language/runtime | **TypeScript (strict) on Node/Bun with Ink (React)** as the default | Reuses the generated TypeScript SDK, shared ViewModels and types with web/extension/mobile; React mental model; proven by Claude Code and Gemini CLI. **Rust + ratatui** or **Go + Bubble Tea v2** are valid when single-binary size/startup/memory dominate or the team lives in those languages; the architecture below is language-neutral (ports, events, contracts) |
| D2 | TUI renderer | **Ink** (React 19) with a thin `ui-kit`; incremental rendering, `Static` transcript region, synchronized output where supported | Fallback to plain line output when not a TTY; OpenTUI is an option if you need mouse/images/speed **(verify maturity)** |
| D3 | Packaging | **Single executable per OS/arch**: Bun `--compile` (fast startup, cross-compile; verify signing behavior on your Bun version), Node SEA (stability 1.1 "active development"; CommonJS by default via `mainFormat`, ESM supported but not combinable with `useSnapshot`; cross-target builds require `useCodeCache/useSnapshot` off), or Deno compile; **plus** an npm package that fetches the right native binary through optional platform dependencies | Users without Node; fast cold start; npm for developers and CI |
| D4 | Argument parsing | A typed command framework (e.g., Stricli/Commander/yargs, or clap/cobra in Rust/Go) with **generated help and shell completions**; commands registered from the **route table + OpenAPI** for resource subcommands | No drift with the backend |
| D5 | SDK | The same generated SDK as other clients (`sdk.app.funnels.leads.get(id)`); transport = `fetch`/undici with interceptors | `PLAYBOOK_FRONTEND.md` §3 |
| D6 | Output contracts | `text` (human), `json` (single envelope), `stream-json` (NDJSON events); schemas versioned in `contracts/` | Same pattern as Claude Code's print mode |
| D7 | Auth | **OAuth 2.0 device authorization grant** (RFC 8628) for headless/SSH and **authorization code + PKCE with loopback redirect** (RFC 8252) when a browser is available; tokens in the **OS keystore**; API tokens for CI | `PLAYBOOK_SECURITY.md` §4 |
| D8 | Local state | Files under OS-standard dirs (config/data/cache/state), JSON/JSONL, atomic writes, lock files for multi-instance safety; SQLite only if queries are needed | Debuggable, diffable |
| D9 | Realtime | SSE/WebSocket optional, same state machine and envelope as the desktop/mobile playbooks; polling fallback | `PLAYBOOK_DESKTOP_QT_PART2.md` §8 |
| D10 | Extensibility | Slash commands (markdown), skills, hooks, plugins, MCP client, all behind trust prompts and managed policy | `PLAYBOOK_CLAUDE_CODE.md` patterns applied to our own product |
| D11 | Telemetry | **Opt-in**, redacted, OpenTelemetry-compatible export; local debug logs always available | Privacy and enterprise trust |
| D12 | Updates | Signed manifest, channels (`stable`/`latest`/`canary`), staged rollout, atomic swap, rollback; admin can disable, pin or mirror | Section 12 |
| D13 | Supported platforms | Derive from the runtime's support matrix and your fleet: example floor used by a reference product is macOS 13+, Windows 10 1809+, Ubuntu 20.04+, Debian 10+, Alpine 3.19+ **(verify and document in `docs/support-matrix.md`)**; architectures x64 and arm64 on all three OSes; glibc and musl on Linux | Alpine/musl needs its own artifact |
| D14 | Shell execution | **Shell adapters per OS** (bash/zsh, PowerShell, cmd); no hard dependency on Git Bash on Windows | Reference products have required Git for Windows; avoid that coupling unless justified |
| D15 | Binary name | Short, unique, non-conflicting (check package managers and PATH collisions); example `myapp` | Collisions break installs |

---

## 2. Product surface

### 2.1 Modes

| Mode | Trigger | Behavior |
|---|---|---|
| **Interactive (TUI/REPL)** | TTY on stdin+stdout and no print flag | Conversation/command session, streaming transcript, slash commands, permission dialogs, status line |
| **Print / headless** | `-p, --print` (prompt or piped stdin) | Runs once and exits; `--output-format text\|json\|stream-json`, `--input-format text\|stream-json`, `--max-turns`, `--max-budget`, `--json-schema`, `--no-session-persistence` |
| **Resource subcommands** | `myapp <module> <resource> <verb>` | Deterministic CRUD and actions against the backend; table/JSON output; no TUI |
| **Serve (RPC)** | `myapp serve` | Headless engine over stdio JSON-RPC/NDJSON or a local socket for IDEs and other frontends |
| **MCP server (optional)** | `myapp mcp serve` | Expose selected capabilities as MCP tools **(verify product need)** |
| **Maintenance** | `doctor`, `update`, `install <channel\|version>`, `config`, `completion`, `version`, `auth login\|logout\|status` | Health, lifecycle and config |

`auth status` exits 0 when signed in and non-zero otherwise (scriptable).

### 2.2 Command taxonomy (aligned with `PLAYBOOK_URLS.md`)

```text
myapp [global flags] <module> <resource> <verb> [args]          # app experience (default userType)
myapp admin <module> <resource> <verb> --tenant <id> [args]     # admin experience (authorized server-side)
myapp partner <module> …                                        # partner experience

myapp funnels leads get <leadId>              ↔ GET   /api/v1/app/funnels/leads/{leadId}
myapp funnels leads list --stage won --limit 50 ↔ GET /api/v1/app/funnels/leads?stage=won&limit=50
myapp projects launch <projectId>             ↔ POST  /api/v1/app/projects/{projectId}/launch   (202 → --wait)
myapp admin tenants users suspend <tenantId> <userId> ↔ POST /api/v1/admin/tenants/{tenantId}/users/{userId}/suspend
```

Rules: commands are **generated from the route table and OpenAPI**, then wrapped with UX (flags, output shaping); the `admin` prefix never grants access, the backend validates token,
tenant, RBAC and ownership; verbs are `list|get|create|update|delete` plus action verbs; plural resources and IDs as positional arguments mirror the URL grammar.

### 2.3 Slash commands (inside the TUI)

Built-ins (examples): `/help`, `/status`, `/config`, `/doctor`, `/login`, `/logout`, `/clear`, `/compact` (if agentic), `/resume`, `/model`, `/permissions`, `/hooks`, `/skills`, `/plugins`, `/mcp`, `/tasks`, `/exit`.
Custom commands are markdown files (user/project scope) with frontmatter and are surfaced in autocomplete; each slash command is a thin adapter over a use case (same use case a subcommand calls).

---

## 3. Architecture: hexagonal + vertical slices + MVVM

### 3.1 Layers

```text
┌──────────────────────────────────────── CLI process ─────────────────────────────────────────┐
│ INBOUND ADAPTERS                                      OUTBOUND ADAPTERS                       │
│ argv parser · slash commands · TUI Views+ViewModels    SDK/HTTP · Realtime (SSE/WS/poll)       │
│ stdio RPC server · signal handlers · timers            Filesystem · OS keystore · Shell/process │
│                                                        Browser opener · Clipboard · Terminal   │
│            │                                           Telemetry · Updater · MCP · Plugins     │
│            ▼                                                   ▲                               │
│     APPLICATION (use cases, ports, policy, permission engine, session/context, event bus) ─────┘ │
│            ▼                                                                                   │
│     DOMAIN (entities, value objects, rules, domain events)                                     │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Contains | May depend on | Must not depend on |
|---|---|---|---|
| **domain** | Entities, value objects, rules, domain events | `shared-kernel` | Node/Bun APIs, Ink/React, SDK, filesystem, terminal |
| **application** | Use cases, **ports**, permission engine, config resolver, session manager, event bus | domain, `contracts`, `shared-kernel` | adapters, `process`, `fs`, Ink |
| **adapters/in** | argv/command handlers, slash handlers, TUI ViewModels+Views, RPC server, signal handlers | application, contracts | other slices' internals, SDK directly |
| **adapters/out** | SDK client, realtime transports, storage, keystore, shell executor, updater, MCP client, plugin loader, telemetry | application ports, `platform`, SDK | views |
| **platform** | Per-OS code behind interfaces (paths, signals, shell quoting, keychain, clipboard, terminal modes) | OS APIs | domain/application |
| **contracts** | DTOs, error codes, exit codes, event schemas, policy schema, route table | `shared-kernel` | everything else |

Rules:

* **`process.platform` branching appears only under `platform/`** (and build scripts).
* `application` talks only to ports; `adapters/in` never calls the SDK directly (always through use cases).
* A **typed event bus** carries engine events (`session.started`, `message.delta`, `tool.requested`, `permission.requested`, `tool.result`, `progress`, `result`, `error`). The TUI renders them; print mode serializes them; the RPC server forwards them.
* Enforce with dependency-cruiser/ESLint boundaries and a `no-restricted-globals`/import rule for `process`, `fs`, `child_process` outside adapters; violations fail CI.

### 3.2 Ports (examples)

```ts
export interface SessionStorePort   { append(sessionId: string, e: SessionEvent): Promise<void>; load(sessionId: string): AsyncIterable<SessionEvent>; list(): Promise<SessionInfo[]>; purge(opts: PurgeOpts): Promise<void>; }
export interface SecretStorePort    { get(key: string): Promise<string | null>; set(key: string, v: string): Promise<void>; remove(key: string): Promise<void>; }
export interface ConfigPort         { resolve(): Promise<EffectiveConfig>; set(scope: Scope, key: string, value: unknown): Promise<void>; onChange(cb: () => void): Unsubscribe; }
export interface ShellPort          { run(cmd: ShellCommand, opts: RunOpts): Promise<ShellResult>; kill(handle: ProcHandle): Promise<void>; }   // per-OS: bash/zsh/PowerShell/cmd
export interface TerminalPort       { caps(): TerminalCaps; enterRaw(): void; restore(): void; write(s: string): void; onResize(cb: (c: Size) => void): Unsubscribe; }
export interface OpenerPort         { openUrl(url: string): Promise<boolean>; openPath(p: string): Promise<boolean>; }
export interface ClipboardPort      { write(text: string): Promise<boolean>; }
export interface PermissionPort     { decide(req: ToolRequest, ctx: PermCtx): Promise<Decision>; }     // allow | deny | ask
export interface RealtimePort       { start(cfg: RtConfig): void; stop(): void; setTopics(t: Set<string>): void; /* state, events, resync */ }
export interface UpdaterPort        { check(channel: Channel): Promise<UpdateInfo | null>; apply(u: UpdateInfo): Promise<ApplyResult>; rollback(): Promise<void>; }
export interface TelemetryPort      { event(name: string, props?: Record<string, unknown>): void; flush(): Promise<void>; }
export interface ClockPort          { now(): number; }
```

Ports return `Result<T, E>`/typed errors; no exceptions across layers.

### 3.3 Presentation in the TUI (MVVM)

* **ViewModel** = a hook (or reducer) exposing state + commands, no Ink imports; where a screen exists in other clients (e.g., lead detail), reuse the shared TypeScript ViewModel from `packages/viewmodels`; CLI-specific ones live in the slice.
* **View** = Ink components (`Box`, `Text`) rendering ViewModel state; no business logic. Statuses are the shared set: `loading | ready | empty | forbidden | not-found | offline | error | policy-blocked`.
* For Rust/Go variants map to **Elm architecture** (model → message → update → view); ports and events stay identical.
* **Single source of truth** for the screen is the ViewModel/store; the transcript is derived from the event log.

### 3.4 Vertical slices

CLI slices mirror backend slices and URL modules: `auth`, `config`, `projects`, `funnels`, `campaigns`, `tenants` (admin), `usage`, `billing`, `session` (conversation/agent), `extensions` (skills/hooks/plugins/MCP), `update`. Each slice has
`domain/ application/ adapters/{in,out}/ contracts/ viewmodels/ views/`. Cross-slice access only via `contracts/`.

---

## 4. CLI UX contract (scriptable by design)

### 4.1 Streams and TTY behavior

| Situation | stdout | stderr | Interactivity |
|---|---|---|---|
| Resource subcommand, TTY | Result (table/text) | Warnings, progress | Prompts allowed (`--yes` skips) |
| Resource subcommand, piped | Result only (JSON if `--json`) | Warnings/errors | **No prompts**; fail with an actionable message |
| `-p` print mode | Final text / JSON / NDJSON | Diagnostics | None |
| Interactive TUI | UI (inline or fullscreen) | Debug logs go to file, not terminal | Full |
| `CI=true` or `TERM=dumb` | Plain text | Plain text | None; no spinners/animation |

* **Never** write progress bars, spinners or color to stdout when it is not a TTY. Progress goes to stderr only if stderr is a TTY; otherwise emit plain periodic lines or nothing.
* Respect `NO_COLOR`, `FORCE_COLOR`, `--no-color`, `--color=auto|always|never`.
* Read piped stdin when present (`cat log | myapp -p "summarize"`), with size limits and streaming.

### 4.2 Flags and environment

| Flag/env | Meaning |
|---|---|
| `-h/--help`, `-v/--version` | Standard; help is generated, includes examples and exit codes |
| `-p/--print` | Headless mode |
| `--output-format text\|json\|stream-json`, `--output <file>` | Output control |
| `--json`, `--query <expr>`, `--fields a,b` | Machine output shaping for subcommands |
| `--profile <name>`, `--tenant <id>` | Profile/tenant selection (tenant is sent as `X-Tenant-Id` and validated server-side) |
| `--yes/-y`, `--dry-run`, `--no-input` | Non-interactive control; destructive commands require `--yes` or confirmation |
| `--limit`, `--cursor`, `--all` | Pagination (`--all` streams pages, bounded) |
| `--wait`, `--timeout`, `--no-wait` | Long operations (`202` → poll/stream until terminal state) |
| `--idempotency-key <k>` | Safe retries for mutations |
| `--debug [categories]`, `--verbose`, `--quiet` | Diagnostics |
| `--config <path>`, `--settings <file>` | Config overrides |
| `--permission-mode`, `--allowedTools`, `--disallowedTools` | Permission control (agentic mode) |
| `MYAPP_TOKEN`, `MYAPP_API_URL`, `MYAPP_PROFILE` | Auth/config via env (token never printed) |
| `HTTP_PROXY/HTTPS_PROXY/NO_PROXY`, `SSL_CERT_FILE`/`NODE_EXTRA_CA_CERTS` | Corporate networking |

### 4.3 Exit codes (stable contract; documented in `--help`)

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments/usage |
| 3 | Authentication required/failed |
| 4 | Permission denied (`forbidden`; `requiredPermission` in the error output) |
| 5 | Not found |
| 6 | Conflict (version/idempotency) |
| 7 | Validation failed |
| 8 | Rate limited (honor `Retry-After`) |
| 9 | Network/timeout/offline |
| 10 | Server error |
| 11 | Upgrade required (`minVersion`) |
| 130 | Interrupted (SIGINT) |
| 143 | Terminated (SIGTERM) |

Scripts rely on these; changing them is a breaking change.

### 4.4 Output formats and schemas

* **Human text**: concise, aligned tables (width-aware, truncation with ellipsis, wide-character aware), never relies on color alone.
* **`--json`/`--output-format json`**: one envelope `{ "v": 1, "ok": true, "data": …, "meta": { "correlationId", "requestId", "pagination" } }` or `{ "ok": false, "error": { "code", "message", "requiredPermission?", "correlationId" } }` (same error envelope as the backend).
* **`stream-json`**: newline-delimited JSON, one event per line, versioned (`v`), ordered, flushed per event, no other text on stdout; partial-message events are opt-in; hook-lifecycle events opt-in.
* **`--json-schema`** (print mode): validates the final output against a user schema and exits non-zero on mismatch.
* Output schemas live in `contracts/`, have golden tests, and follow semver.

### 4.5 Help, completions and docs

Generated `--help` (usage, examples, flags, env vars, exit codes, links), `myapp completion bash|zsh|fish|powershell`, man pages/markdown reference generated from the command registry, "did you mean" suggestions, concise errors with next steps and a docs URL.

### 4.6 Accessibility and localization

`--accessible`/`MYAPP_ACCESSIBLE=1` mode: no spinners/animations, stable linear output, descriptive text instead of glyphs; no color-only meaning; ASCII fallback for box-drawing/emoji when the terminal or locale can't render them;
message keys with `Intl`-based formatting; correct width for CJK/emoji (grapheme-aware); RTL awareness for text output where applicable; honor `LANG/LC_*` and UTF-8 requirements (Windows code page handled).

---

## 5. Interactive TUI design

### 5.1 Layout and behavior

```text
┌ transcript (scrollback-friendly, streaming) ────────────────────────────────┐
│ user / assistant / tool blocks, diffs, tables, markdown (incremental render) │
├ permission / dialog region (modal, keyboard-first) ──────────────────────────┤
├ input (multiline, history, @-file mentions, / autocomplete, paste handling) ─┤
└ status line (profile · tenant · mode · tokens/cost · connection · version) ──┘
```

* **Inline mode by default**: render in the normal screen buffer so native scrollback, selection and copy/paste work; optional **fullscreen** mode (alternate screen) for dashboards/watch views. Never trap the user.
* **Flicker-free rendering**: differential updates, a static region for completed output, a dynamic region for the live area; **synchronized output** (DEC mode 2026) when supported; throttle redraws (≤ 30–60 fps); coalesce streaming deltas.
* **Streaming markdown**: render incrementally (append-only parsing, no full re-parse per token), code blocks with syntax highlighting (lazy-loaded), tables, links via OSC 8 when supported.
* **Long sessions**: window/virtualize the transcript, cap in-memory history, spill older entries to the session file, bounded diff rendering.
* **Resize**: handle size changes (`SIGWINCH` on POSIX; resize events on Windows), reflow wrapping, never crash on tiny terminals (minimum viable layout).
* **Input**: multiline editing, bracketed paste (large pastes summarized, never executed), history with search (Ctrl+R), word/line navigation, optional vim mode, IME and grapheme-correct cursor, `@` file mention with fuzzy search (respecting ignore files), `/` command palette.
* **Keybindings** are data (`keybindings.json`) with sane defaults and per-terminal fixes (Shift+Enter, Alt+Enter, Ctrl+Space issues on Windows/ConPTY, kitty keyboard protocol when available); document conflicts with multiplexers.
* **Interrupt semantics**: `Esc` cancels the current operation; first `Ctrl+C` cancels, second (or `Ctrl+D` on empty input) exits; never lose unsent input silently; background tasks continue only if designed (`/tasks`).
* **Permission dialogs**: show action, target, diff/preview, scope choices (allow once / always for this project / deny / deny and tell the assistant why), keyboard-first, timeouts configurable; every decision is logged to the session file.
* **Themes**: light/dark auto-detected (OSC 11 query with short timeout or `COLORFGBG`), high-contrast and colorblind-safe themes, 16-color fallback; no hard-coded absolute colors in components (theme tokens).
* **Notifications**: terminal bell/OSC 9 only if enabled and supported; completion sounds off by default.
* **Title and status**: set the terminal title (restore on exit) when supported.

### 5.2 Terminal capability negotiation

Never assume a feature; **detect, then enable, then fall back**.

| Capability | Detection (in order) | Used for | Fallback |
|---|---|---|---|
| TTY / size | `isatty`, `columns/rows`, resize events | Interactivity | Plain mode |
| Color depth | `NO_COLOR`, `COLORFGBG`, `COLORTERM`, `TERM`, terminfo | Themes | 16-color → monochrome |
| Unicode/emoji width | Locale/code page, grapheme width tables | Layout | ASCII symbols |
| Synchronized output (2026) | DECRQM query or `TERM_PROGRAM`/known list **(verify per terminal)** | Flicker-free redraw | Throttled redraw |
| Kitty keyboard | `CSI ? u` query with timeout, then progressive-enhancement flags | Disambiguated keys | Legacy key decoding |
| modifyOtherKeys / win32-input-mode | Terminal identity or behavioral detection (no query exists) | Disambiguated keys | Legacy key decoding |
| OSC 8 hyperlinks | Known terminals/env; no reliable query | Clickable links | Print URL |
| OSC 52 clipboard | Terminal identity; **write-only**, size-capped | Copy to clipboard | Native clipboard tool / print |
| OSC 11 background | Query with timeout | Theme | `COLORFGBG`/default dark |
| Mouse | Opt-in | Click/scroll in fullscreen | Keyboard only |
| Multiplexers (tmux/screen/zellij), SSH, containers | `TMUX`, `STY`, `ZELLIJ`, `SSH_TTY` | Conservative feature set | Disable risky protocols |

Rules: queries have **short timeouts (≈100–200 ms)** and never block; never query when not a TTY; cache the result; allow overrides (`MYAPP_TERMINAL_CAPS=…`) and a `doctor` report; support documentation of known-bad terminals. Terminal support claims vary across sources and versions, so keep a **tested matrix** instead of trusting tables.

### 5.3 Terminal lifecycle guard (mandatory)

```ts
export function installTerminalGuard(term: TerminalPort, onFatal: (e: unknown) => void) {
  let restored = false;
  const restore = () => { if (restored) return; restored = true; term.restore(); };   // raw off, cursor on, alt screen off, mouse/paste/kitty/sync off, title restored
  process.once('exit', restore);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.once(sig, () => { restore(); process.exit(128 + SIGNAL_NUM[sig]); });
  process.once('uncaughtException',  (e) => { restore(); onFatal(e); process.exit(1); });
  process.once('unhandledRejection', (e) => { restore(); onFatal(e); process.exit(1); });
}
```

Windows has no real `SIGTERM`/`SIGHUP` semantics (console close and Ctrl+Break map to events); the platform adapter normalizes them. Test crash paths: terminal must be usable after any exit.

---

## 6. Platform specifics (Linux · macOS · Windows)

### 6.1 Differences that must live in `platform/`

| Concern | Linux | macOS | Windows |
|---|---|---|---|
| Config/data/cache/state dirs | XDG (`$XDG_CONFIG_HOME`, `~/.config`, `~/.local/share`, `~/.cache`, `~/.local/state`) | `~/Library/Application Support`, `~/Library/Caches`, `~/Library/Logs` | `%APPDATA%`, `%LOCALAPPDATA%`, `%PROGRAMDATA%` (managed) |
| Managed policy | `/etc/<tool>/managed-settings.json` | `/Library/Application Support/<Tool>/managed-settings.json` or configuration profile | `%PROGRAMDATA%\<Tool>\managed-settings.json` or registry policy |
| Keystore | Secret Service/libsecret (D-Bus), KWallet; headless fallback = encrypted file 0600 | Keychain | Credential Manager (DPAPI) |
| Shell for commands | `$SHELL`/bash/zsh/sh | zsh (default)/bash | PowerShell (primary), cmd; Git Bash/WSL optional |
| Quoting/escaping | POSIX | POSIX | PowerShell/cmd rules differ; **never build command strings from untrusted input**; use argument arrays; special-case `.cmd/.bat` argument injection |
| Process tree kill | Process groups + `SIGTERM`→`SIGKILL` | Same | `taskkill /T`/Job Objects |
| Signals | POSIX signals, `SIGWINCH` | Same | Ctrl+C/Ctrl+Break events; no `SIGWINCH` |
| Paths | `/`, case-sensitive | `/`, usually case-insensitive FS | `\`, drive letters, UNC, case-insensitive, 260-char legacy limit, reserved names (`CON`, `NUL`) |
| Symlinks | Normal | Normal | Require privilege/developer mode; junctions differ |
| Executables | Mode bits | Mode bits + quarantine xattr | Extensions/PATHEXT |
| Line endings/encoding | LF, UTF-8 | LF, UTF-8 | CRLF in places; set UTF-8 handling; BOM awareness |
| Clipboard | `wl-copy`/`xclip`/`xsel`, OSC 52 | `pbcopy` | `clip.exe`, PowerShell, OSC 52 |
| Open URL/path | `xdg-open` | `open` | `start`/`rundll32` (via safe API) |
| File locking | `flock`/`fcntl` | same | `LockFileEx`/exclusive open semantics differ |
| Replace running binary | Allowed (unlink/rename) | Allowed | **Cannot overwrite a running .exe**: stage new file, swap on next launch via helper |
| Terminal host | Many emulators, multiplexers, SSH | Terminal.app, iTerm2, etc. | Windows Terminal/ConPTY, legacy conhost, VS Code terminal |

### 6.2 Windows-specific rules

* Enable virtual-terminal processing on Windows consoles; handle legacy conhost limits (no alternate-screen behavior in some hosts, limited keyboard protocols).
* Keyboard input arrives through VT sequences or Win32 input records depending on terminal/ConPTY mode; some key combos (Shift+Enter, Ctrl+Space) need the terminal's enhanced mode; keep keybindings configurable.
* Test in **Windows Terminal, conhost, PowerShell 5.1/7, cmd.exe, Git Bash and WSL**; document supported hosts.
* Never rely on Git for Windows being installed unless the ADR (D14) says so; provide PowerShell/cmd shell adapters.
* Long paths: enable `\\?\` handling where needed; avoid reserved names in generated files; case-insensitive collisions in generated paths.
* Antivirus/SmartScreen: signed binaries, stable install locations, avoid self-modifying behavior that looks like malware.

### 6.3 macOS and Linux rules

* macOS: Developer ID signing + hardened runtime + notarization; first-run Gatekeeper checks; Apple silicon and Intel builds (or universal); respect Full Disk Access boundaries; quarantine attribute on downloads.
* Linux: glibc **and** musl artifacts (Alpine); minimum glibc baseline by building on an older distro; Wayland/X11 clipboard tooling; container-friendly (no TTY, read-only FS, non-root user).

### 6.4 Paths and filesystem rules

All path handling goes through `PathPort` (normalization, containment checks with `realpath`, case rules, long-path support). **Containment check before any read/write** of user-supplied paths: resolve symlinks, reject escapes from allowed roots,
treat Windows drive/UNC specially. Atomic writes (temp file + rename), `0600`/`0700` permissions for state/config on POSIX and restricted ACLs on Windows, lock files for concurrent instances.

---

## 7. Backend integration

### 7.1 SDK and transport

* Generated SDK mirrors the URL contract; interceptors: auth (single-flight refresh), tenant (`X-Tenant-Id` validated server-side), correlation (`X-Correlation-Id`), client info (`X-Client: cli/<version> (<os>; <arch>; <runtime>)`), idempotency (`Idempotency-Key`), retry with backoff/jitter (network/429/5xx on idempotent calls, honor `Retry-After`), error mapping to the shared taxonomy
  (`unauthenticated | forbidden(requiredPermission) | not-found | conflict | validation | rate-limited | network | server | upgrade-required`) → **exit codes** (section 4.3).
* HTTP: keep-alive, HTTP/2 where available, explicit timeouts, abort on Ctrl+C, proxy env support, custom CA bundle support, TLS verification always on.
* **Pagination**: cursor-based; `--all` streams pages with bounded memory and a hard cap; backpressure-aware writes to stdout (`EPIPE` handled when piped into `head`).
* **Long operations** (`202`): `--wait` polls or subscribes to realtime until a terminal state with backoff and `--timeout`; progress to stderr; `Ctrl+C` stops waiting without cancelling the server operation unless `--cancel-on-interrupt`.
* **Version gate**: `upgrade-required` → exit 11 with a message and (if allowed) offer `myapp update`.

### 7.2 Authentication flows

| Flow | When | Notes |
|---|---|---|
| **Device authorization (RFC 8628)** | SSH, containers, no browser/TTY-limited | Print URL + user code; poll with `interval`, back off on `slow_down`; QR optional |
| **Auth code + PKCE with loopback (RFC 8252)** | Local desktop sessions | Random port on `127.0.0.1`, single-use state, short timeout, system browser (never an embedded webview) |
| **API token / service account** | CI | `MYAPP_TOKEN` env or `--token-file`; scoped, revocable; **never echo or log**; prefer OIDC federation in CI when available |
| **SSO/enterprise** | Managed fleets | IdP issuer/client from managed policy |

* Tokens live in the **OS keystore** (`SecretStorePort`); if none exists, require an explicit opt-in to an encrypted file with restrictive permissions and show a warning in `doctor`.
* Refresh rotation with reuse detection (server), single-flight refresh, `auth logout` revokes server-side and wipes local copies; multiple profiles/tenants (`--profile`).
* `auth status` prints identity, tenant, scopes, expiry (no secrets) and exits 0/non-zero.

### 7.3 Realtime in the CLI

`myapp events tail`, `myapp runs watch <id>`, live `--wait` use the same transports and state machine as `PLAYBOOK_DESKTOP_QT_PART2.md` §8 (SSE via streaming `fetch`, WebSocket, polling fallback), snapshot + stream, dedupe by event ID, resume (`Last-Event-ID`), heartbeats,
backoff with jitter, bounded buffers, output coalescing so a burst never floods the terminal. Parse SSE from the raw byte stream with a spec-compliant parser; token in the `Authorization` header only.

### 7.4 Offline and caching

Optional read cache with TTL for slow lookups (`--no-cache`, `myapp cache clear`); never cache secrets; outbox for mutations is **not** the default in a CLI (fail fast with a clear message) unless a spec requires it.

---

---

> Continues in [`PLAYBOOK_CLI_PART2.md`](PLAYBOOK_CLI_PART2.md).
