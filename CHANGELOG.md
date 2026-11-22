# Changelog

All notable changes to the playbook set. The format follows Keep a Changelog;
the set uses semantic versioning per playbook and a dated entry per change.

## 2026-11-22 — 1.3.2

### Fixed
- Skill frontmatter `name` is now the kebab-case directory slug
  (`name: add-handler`), not the `<app> Add Handler` display title. Claude Code
  refuses a name holding `<`, `>`, hidden or blank-like characters or over 256
  chars, so a copy installed before `rename.sh` ran loaded as a refused name;
  the display title stays in the `# ` heading and the description.
- `scripts/lint-skills.sh` (all 13 kits) errors when `name` differs from the
  skill directory; `skills.schema.md` documents the mode.
- Mirror repos under `work/beautiful*` carry the same fix.

## 2026-11-22 — 1.3.1

### Added
- `scripts/claude-kit/install-cost-tracker.sh`: installs the cost tracker and
  merges its status line and per-event hooks into `settings.json`, appending
  hook entries instead of replacing existing ones (`rtk` stays) and keeping a
  status line that points elsewhere. Idempotent, backed up; `--settings-only`,
  `--no-settings` and `--dry-run`.
- `bootstrap.sh` runs it as the last install step, so a fresh machine wires
  the cost tracker with no manual settings edit.
- `scripts/claude-kit/install-prereqs.sh`: verifies `git`, `curl`, `python3`,
  Node.js/npm and Claude Code, installing what is missing with `apt-get`
  (passwordless sudo) or Homebrew; runs first in `bootstrap.sh`. `--dry-run`.
- `install-ai-tools.sh` installs npm when RTK needs it and npm is absent.
- `scripts/claude-kit/install-plugins.sh`: registers and installs the README §2
  baseline plugins (`ecc`, `ponytail`, `rust-analyzer-lsp`,
  `claude-model-router-hook`) at user scope, which writes the
  `enabledPlugins` entry; idempotent, with `--only=` and `--dry-run`.
  `nanobanana@creding-plugins` has no public source and stays per-user.
- `bootstrap.sh` runs it after the kit check.
- `scripts/claude-kit/install-ai-tools.sh`: installs and wires the
  code-intelligence and token tools — `rtk` (hook + `RTK.md`), `graphify`
  (skill), `understand-anything` (plugin) and `codegraph` (MCP server) —
  idempotently, with `--only=` and `--dry-run`. Runs Graphify before CodeGraph
  because `graphify install` rewrites `CLAUDE.md`.
- `bootstrap.sh` runs it after the cost tracker.
- `bootstrap.sh` configures the playbook checkout itself with
  `configure-repo.sh` (routing block, `.claude/README.md`, project deny list,
  `.gitignore` entries), so the checkout a user installs from is wired too.

### Changed
- The base settings fragment sets `"tui": "fullscreen"`, so the fullscreen
  renderer (and its right-side `/diff` panel) is the default on a new install.
- `install-user-kit.sh` locks `settings.json` to mode 600 after the merge.
- `kit_check.py`: an oversized vendor skill (`graphify`, installed by
  `install-ai-tools.sh`) warns instead of erroring, so the validator no longer
  blocks the bootstrap on a skill this kit does not author.

## 2026-11-22 — 1.3.0

### Added
- `PLAYBOOK_DESKTOP_ELECTRON.md` and its `_PART` companions: the Electron
  (TypeScript) playbook, from the two-process trust model and the typed IPC
  envelope to Forge packaging, fuses, signing and the per-platform test matrix.
- The `desktop-electron` kit: a runnable Electron 45 + Vite + TypeScript
  template mirroring the `desktop` kit (main/core/preload/renderer, hexagonal
  slices, contracts, evals, `.claude` plane, verify pipeline).
- The `beautifulelectron` Beautiful-series implementation: skills
  (`electron-best-practices`, `electron-review`, `electron-port`), the drop-in
  ESLint lint unit with the `lints/check/` violation harness, examples, tests
  and the five Beautiful gates.
- `verify-register.md`: V-ELECTRON-1/2/3 (Electron 45 stack, support cadence,
  `net.WebSocket`/startup snapshot/ASAR integrity and fuses), owner
  `client-platform`, due 2027-03-31.

### Changed
- The Beautiful-series registry counts thirteen implementations (was twelve).

## 2026-11-19 — 1.2.3

### Added
- `NEW_UPDATE_PLAYBOOK.md`: the delta-first runbook for adding a playbook,
  a kit or a Beautiful repository, and for refreshing the series when
  Anthropic changes Claude Code, the model line, the API or the Agent Skills
  standard. Includes the impact matrix, the token-budget context pack and the
  change-record template.

## 2026-11-19 — 1.2.0

### Changed
- The set is MIT-licensed: `LICENSE` now grants the standard MIT permissions
  instead of the previous proprietary terms.
- `PLAYBOOK_MASTER.md` §12 defines the 1:n relationship with the twelve
  Beautiful-series implementations. The rule is bidirectional: the playbook
  governs the implementations, and implementation gaps are reported back into
  the playbook. The registry lists all twelve.

## 2026-11-17 — 1.1.0

### Changed
- Split the eleven oversized reference playbooks into `PLAYBOOK_<NAME>_PART<n>.md`
  companions. Each main entry opens with a Parts index, keeps the original
  section numbers, and the manifest has one entry per part. `playbook-lint`
  is now warning-free; `check-playbook-copies.sh` includes the parts.

## 2026-11-17 — 1.0.0

### Added
- `PLAYBOOK_MASTER.md` promoted from draft: catalog, precedence, invariants,
  Claude Code operating model, maintenance loop and maturity ladder.
- `manifest.json`: machine-readable catalog with routing paths and keywords.
- `verify-register.md`: dated claims with owner and re-check date.
- `scripts/playbook-lint.py`: deterministic front-matter, cross-reference,
  manifest and size checks.
- `scripts/claude-kit/check-playbook-copies.sh`: fails when a kit copy drifts
  from the root playbook.
- `scripts/claude-kit/generate-playbook-rules.py`: generates the path-scoped
  `.claude/rules/playbooks.md` in every kit.
- `docs/adr/0001-playbook-copies-are-mirrors.md`: the copy policy.

### Changed
- Every kit now ships byte-identical copies of the shared contracts plus its
  stack playbook; backend kit copies are no longer hand-specialized.
- The canonical error envelope is nested `{error:{code,message,
  requiredPermission?,correlationId?}}`; Go, Node.js, Python, Rust, Java and
  the frontend SDK agree.
- The root frontend playbook uses framework-free ViewModels; React bindings
  live in the view layer.
- The extension playbook describes the shipped message-protocol SDK and the
  worker-side HTTP adapter.
- Tenant isolation is scoped to the multi-tenant profile; the outbox section
  separates the at-least-once target from weaker shipped baselines.
- Deny lists include `Bash(rm -rf *)` and the user credential paths.

### Fixed
- `install-user-kit.sh` no longer crashes on a fresh install (`$FRAGMENTS`).
- `make evals` is a real target in Go, Node.js, Extension and Rust.
- `make gen-check` in Go and Node.js no longer expands `<app>` into a shell
  redirection.
- The Java kit no longer ships Go-specialized playbooks.
