---
id: INSTALL
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: engineering-productivity
depends_on: [CLAUDE_CODE, MASTER]
---

# The playbook — installation and bootstrap

This is the runbook for a new machine (or a re-provisioned one) and for a fresh
checkout: clone the playbook, install the user-scope kit, clone your project,
configure it, verify. Every step is a shell command, so the whole bootstrap
costs zero model tokens; the model is only asked to make judgment calls.

**Entry point: `bash scripts/claude-kit/bootstrap.sh`** walks the decision
tree — OS (Linux / macOS / WSL2, with native Windows stopped at the gate) and
provider (a reachable local Ollama endpoint picks the Ollama path; anything
else the Anthropic path) — then chains the steps below with the matching
settings merge, and finally configures the playbook checkout itself. `--dry-run` prints the plan. The steps remain runnable by
hand; this file is the install path only.

Companions:
[PLAYBOOK_CLAUDE_CODE.md](PLAYBOOK_CLAUDE_CODE.md) (what the kit must
contain) and [CLAUDE_CODE_ROUTING_MODELS_OLLAMA.md](CLAUDE_CODE_ROUTING_MODELS_OLLAMA.md)
(model tiers, `~/.claude/settings.json`, verification, rollback).

---

## 0. What an install costs

| Step | Executed by | Model tokens |
| --- | --- | --- |
| Install missing prerequisites | shell (`install-prereqs.sh`) | 0 |
| Clone the playbook and your project | shell (`clone-repos.sh`) | 0 |
| Install the user-scope kit | shell (`install-user-kit.sh`) | 0 |
| Install the baseline plugins (README §2) | shell (`install-plugins.sh`) | 0 |
| Install the skill packs and the cost tracker | shell (`install-skill-packs.sh`, `install-cost-tracker.sh`) | 0 |
| Install the code-intelligence and token tools | shell (`install-ai-tools.sh`) | 0 |
| Configure each repository | shell (`configure-repo.sh`) | 0 |
| Validate and probe | shell (`kit_check.py`) + one cheap-tier probe | 0 + ≤1 cheap probe |
| Judgment calls (which kit, which group, when to escalate) | model | charged to the tier that makes them |

Target: a full bootstrap with **zero model calls**; at most one cheap-tier probe (`haiku` → `minimax-m3.1-flash:cloud`) to confirm the deny rules and the resolved tier. Escalate to `opus` only for a design decision, never for setup.

### Rules that keep it at zero

1. Scripts do the work; the model reviews the output. Never paste a playbook
   into a session — point at the section.
2. Shallow, single-branch clones: `--depth 1 --single-branch`.
3. No `@-imports` of playbooks anywhere: `CLAUDE.md` links by path, never
   `@file`.
4. The always-loaded rule bytes (rules without a `paths:` block) stay under
   20,480 B, the ceiling `kit_check.py` enforces; `CLAUDE.md` stays under 200
   lines. Scope per-stack rules with `paths:` so they load only where needed.
5. Never copy plugin components into user or project scope: plugins are
   namespaced (`/ecc:*`, `ecc:*`, `/plugin-name:*`). A user copy of a plugin
   agent shadows it by name.
6. Use the cheap tier for probes and mechanical work; escalate only for a
   design decision.
7. `claude -p ... --bare` (playbook §12.3) skips hooks, skills, plugins, MCP,
   auto memory and `CLAUDE.md` — the minimal-token scripted path.

---

## 1. Prerequisites

| Tool | Minimum | Check |
| --- | --- | --- |
| git | any supported | `git --version` |
| gh | optional; authenticated for private repos | `gh auth status` |
| claude | v2.1.251 or later (2.1.309+ recommended) | `claude --version` |
| ollama | ≥ 0.33 with `ollama launch claude` | `ollama --version` |
| python3 | 3.9+ (stdlib only) | `python3 --version` |
| rtk | optional (token-saving shell proxy) | `rtk --version` |

The bootstrap installs any missing prerequisite first (`install-prereqs.sh`):
`apt-get` with passwordless sudo on Linux, Homebrew on macOS. It installs
`git`, `curl`, `python3`, Node.js/npm and Claude Code (through npm) when absent;
it never installs `ollama` and never authenticates `gh`.

`gh auth status` must report a logged-in account with repo scope before
cloning anything private; `gh auth login` when it does not.

---

## 2. Machine bootstrap (user scope, `~/.claude`)

1. Shallow clone the playbook:

   ```bash
   git clone --depth 1 --single-branch https://github.com/Facta-Dev/ai-coding-playbook.git ~/ai-coding-playbook
   ```

2. Install the user-scope kit:

   ```bash
   bash ~/ai-coding-playbook/scripts/claude-kit/install-user-kit.sh --dry-run   # preview
   bash ~/ai-coding-playbook/scripts/claude-kit/install-user-kit.sh             # install
   bash ~/ai-coding-playbook/scripts/claude-kit/install-user-kit.sh --force      # overwrite installer-owned files
   bash ~/ai-coding-playbook/scripts/claude-kit/install-user-kit.sh --no-settings # leave settings.json untouched
   bash ~/ai-coding-playbook/scripts/claude-kit/install-user-kit.sh --provider=anthropic  # no Ollama env
   ```

   It installs `kit/CLAUDE.md`, `kit/agents`, `kit/skills` and `kit/templates/sdd` into `~/.claude/`, and **never overwrites user-owned files**: an existing destination is skipped, not replaced. Backups land in `~/.claude/backups/install-<UTC timestamp>/`.

   It also merges the settings fragments into `~/.claude/settings.json`. By default it detects a local Ollama endpoint: reachable, it merges `kit/settings.fragment.json` plus `kit/settings.ollama.json` (tier env + endpoint); not reachable, only the base fragment (no endpoint pinning, `--provider=anthropic` does the same by hand). Both merge the `model: sonnet` default, `tui: fullscreen` (the right-side diff
panel) and the `permissions.deny` list. Existing keys win; the installer warns when `model` is not `sonnet`, because a bare `claude` then runs the escalation model. `--no-settings` skips the merge entirely.

3. Validate the user scope:

   ```bash
   python3 ~/ai-coding-playbook/scripts/claude-kit/kit_check.py   # 0 clean, 1 warnings, 2 errors
   ```

   The text report ends with `agents= skills= rules= always_loaded= claude_md=
   collisions= broken_links=`. The `--json` summary exposes the same values
   under `agents`, `skills`, `rules`, `always_loaded_bytes`, `claude_md_lines`,
   `collision_warnings`. Always-loaded bytes must stay under 20,480 B.

4. Lock down the control plane (the installer does this after writing
   `settings.json`; the command is only needed for a hand-built file):

   ```bash
   chmod 600 ~/.claude/settings.json
   ```

5. The bootstrap also configures the playbook checkout itself:

   ```bash
   bash ~/ai-coding-playbook/scripts/claude-kit/configure-repo.sh ~/ai-coding-playbook --provider=ollama
   ```

   It adds the routing block (when neither marker is present),
   `.claude/README.md`, the project deny list and the `.gitignore` entries.
   Idempotent; `--check` verifies the checkout without writing.

6. Optional dedupe (remove user copies of plugin components):

   ```bash
   python3 ~/ai-coding-playbook/scripts/claude-kit/dedupe_plugins.py            # dry run
   python3 ~/ai-coding-playbook/scripts/claude-kit/dedupe_plugins.py --apply
   ```

   The dry run lists what would move into `~/.claude/backups/dedupe-<UTC timestamp>/`.
   Nothing is deleted; `--restore` puts it back.

The baseline plugins (README §2) install and enable in one step:

```bash
bash ~/ai-coding-playbook/scripts/claude-kit/install-plugins.sh --dry-run
bash ~/ai-coding-playbook/scripts/claude-kit/install-plugins.sh
```

It registers each marketplace only when needed and installs with `--scope user`,
which writes the `enabledPlugins` entry, so install and configuration are the
same step. `nanobanana@creding-plugins` has no public marketplace source, so it
stays a per-user addition.

---

## 3. Clone your project

```bash
git clone --depth 1 --single-branch https://github.com/<your-org>/my-app.git ~/work/my-app
```

Shallow, single-branch clones are for consumption. Use full history
(`--depth 0`) only in the repositories you actually contribute to.

`gh repo clone <your-org>/my-app ~/work/my-app -- --depth 1 --single-branch`
is equivalent and required for private repositories (`gh auth login` first).
Cloning is not the last step: the repository must be configured (§4) and, if
it ships tooling, installed (§4.1).

### 3.1 Cloning many repositories at once

The helper clones every repository listed in the inventory, grouped:

```bash
bash ~/ai-coding-playbook/scripts/claude-kit/clone-repos.sh --group=selected \
  --dir ~/work --depth 1 --dry-run
```

| Flag | Meaning |
| --- | --- |
| `--group=` | inventory group to clone (default: the install set); `all` takes every group |
| `--dir=` | destination root (default `~/work`) |
| `--depth=` | clone depth (default `1`) |
| `--dry-run` | print the plan and the exact commands, clone nothing |

Both `--flag=value` and `--flag value` are accepted.

The inventory is `install/repos.txt` — one `group|org/repo|why` per line. It
is the single source of truth: add a repository there, never in the script.
A repository can appear in more than one group; the script clones it once per
run. The groups are yours to define — keep the inventory in your own fork of
this repository.

---

## 4. Configure a repository

```bash
bash ~/ai-coding-playbook/scripts/claude-kit/configure-repo.sh ~/work/my-app \
  --kit=golang --dry-run
bash ~/ai-coding-playbook/scripts/claude-kit/configure-repo.sh ~/work/my-app --kit=golang
```

`--kit=` is one of `golang`, `nodejs`, `python`, `rust`, `java`, `extension`,
`desktop`, `desktop-electron`, `frontend-mobile`, `mobile-android`,
`mobile-ios`, `frontend`, `cli`.

Every kit is a runnable template with the same gate surface: `make ci` (the
working tree), `make evals` (the `.claude` contract harness) and `make verify`
(a staged renamed copy in a temp dir, the working tree untouched). The kit
contract is `PLAYBOOK_CLAUDE_CODE_PART3.md` §21; the gate meanings are
`PLAYBOOK_TESTS.md` §12.

The script is idempotent and does exactly this:

- appends the `<!-- model-routing:ollama -->` or `<!-- model-routing:anthropic -->` block (`--provider=ollama|anthropic|auto`, default auto-detects Ollama like `bootstrap.sh`) to the repo's `CLAUDE.md` **only when neither marker is present** (text: `CLAUDE_CODE_ROUTING_MODELS_OLLAMA.md §6`);
- writes `.claude/README.md` pointing at the playbooks instead of restating them;
- merges **only** `permissions.deny` into the repo's `.claude/settings.json` (never `allow`, never hooks, never `env`);
- appends `.gitignore` entries: `CLAUDE.local.md`, `.claude/settings.local.json`, `.claude/install-state.json`, `.claude/backups/`, `.claude/logs/`;
- with `--kit`, runs that kit's own `scripts/install-claude-runtime.sh`.

`--check` verifies the repo without writing anything; `--dry-run` prints the diff it would apply.

Per-script flags and the no-delete contract: [scripts/claude-kit/README.md](scripts/claude-kit/README.md).

### 4.1 Repositories that install something

Cloning is not installing. Some repos ship tooling that must be installed
once per machine, after the clone and before you rely on it. Everything here
is idempotent.

```bash
bash ~/ai-coding-playbook/scripts/claude-kit/install-skill-packs.sh --dry-run    # plan
bash ~/ai-coding-playbook/scripts/claude-kit/install-skill-packs.sh              # install
bash ~/ai-coding-playbook/scripts/claude-kit/install-skill-packs.sh --dir ~/work --local
bash ~/ai-coding-playbook/scripts/claude-kit/install-skill-packs.sh --self-test
```

It is shell only (zero model tokens), registers each repo's marketplace and
installs its plugins into **user scope**. An installed plugin is skipped. The
marketplace comes from the repo's own organization on GitHub by default;
`--local` resolves it from the clone under `--dir` (default `~/work`) instead,
so `git pull` updates the plugin.

One row per repository, in this shape:

| Repo | Marketplace | Plugins |
| --- | --- | --- |
| `<stack>-skills` | `<stack>-skills` | `<stack>-skills` |
| `<skills-repo>` | `<marketplace>` | `<plugin-a>`, `<plugin-b>` |
| `<cost-tracker>` | — (`install.sh`) | `bash ~/ai-coding-playbook/scripts/claude-kit/install-cost-tracker.sh` |

The pack list lives in the script (`PACKS`), one row per repository:
`repo|marketplace|comma-separated plugins`. That table is the source of truth
for what the installer installs.

`install-cost-tracker.sh` runs the tracker's own `install.sh` (tests included),
then merges its `statusLine` and per-event hooks into `settings.json`. It
appends a hook entry instead of replacing one (an existing `rtk` hook stays),
keeps a `statusLine` that points at another command, backs up the settings
first, and is idempotent; `--settings-only` re-wires an existing install and
`--no-settings` leaves the file untouched. The bootstrap runs it after the
clones, so a fresh machine needs no manual settings edit.

Rules:

- **Plugins are registered, never copied.** `~/.claude/skills/<pack>/` would
  shadow a namespaced plugin skill and bill its description every turn; the
  marketplace entry plus `enabledPlugins` is the only install path.
- The marketplace name comes from the repo's `.claude-plugin/marketplace.json`,
  not from the repository name (`my-skills-repo` → `my-skills`). `--self-test`
  fails when the table drifts from the clones.
- Equivalent manual path, per plugin: `/plugin marketplace add <org>/<repo>`
  then `/plugin install <plugin>@<marketplace>`. The settings form is
  `extraKnownMarketplaces.<name>.source = {"source": "github", "repo": "<org>/<repo>"}`
  plus `enabledPlugins["<plugin>@<marketplace>"] = true`; keep those edits human.
- A pack the baseline already enables is not installed by the script: the
  baseline enables `<plugin>@<marketplace>` from upstream, and your fork
  shares the marketplace name. A repo without a marketplace manifest is
  clone-only — clone it and read it.
- A repo without an `install.sh` and without `.claude-plugin/` is consumed as
  source: clone, `configure-repo.sh`, done. That is the default for products
  and for forks you only inspect.
- After installing tooling, re-run `kit_check.py` and the tool's own status
  command to confirm it is wired.

---

### 4.2 Code-intelligence and token tools

```bash
bash ~/ai-coding-playbook/scripts/claude-kit/install-ai-tools.sh --dry-run   # verify
bash ~/ai-coding-playbook/scripts/claude-kit/install-ai-tools.sh             # install
bash ~/ai-coding-playbook/scripts/claude-kit/install-ai-tools.sh --only=graphify
```

Idempotent: a tool already present is verified, not reinstalled. The bootstrap
runs it after the cost tracker.

| Tool | Installed by | Configuration it writes |
| --- | --- | --- |
| `rtk` | `npm i -g @terrain-ai/rtk`, or a binary on `PATH` | `~/.claude/RTK.md`, the `@RTK.md` import, the `PreToolUse` hook, `chmod 600` |
| `graphify` | `pipx install graphifyy` then `graphify install` | `~/.claude/skills/graphify/SKILL.md` and a `CLAUDE.md` section |
| `understand-anything` | `claude plugin marketplace add Egonex-AI/Understand-Anything`, then `plugin install` | `enabledPlugins` and the marketplace entry |
| `codegraph` | the vendor `install.sh` (self-contained bundle) then `codegraph install` | `mcpServers.codegraph`, `permissions.allow`, the `CODEGRAPH` `CLAUDE.md` block |

**Order matters.** `graphify install` rewrites `~/.claude/CLAUDE.md` and drops
blocks it does not own; the script runs it before CodeGraph and only while the
skill is missing, so the `CODEGRAPH` block survives. Installing by hand: run
Graphify first.

These tools, the cost tracker and the kit all edit the same control plane;
every script backs up `settings.json` and merges instead of replacing.

## 5. Verify the install

All zero-token, except one cheap-tier probe.

```bash
# 1. user scope: 0 clean / 1 warnings / 2 errors
python3 ~/ai-coding-playbook/scripts/claude-kit/kit_check.py; echo "exit=$?"

# 2. AI tools: installed and wired, nothing written
bash ~/ai-coding-playbook/scripts/claude-kit/install-ai-tools.sh --dry-run

# 3. per repo: nothing to write, nothing missing
bash ~/ai-coding-playbook/scripts/claude-kit/configure-repo.sh ~/work/my-app --check

# 4. always-loaded bytes, inside a session
#    /context        -> reports the always-loaded footprint
# 5. session health, inside a session
#    /doctor
```

Deny probes (one session, cheap tier — the only model call in the install):

```bash
claude -p --model haiku "Attempt to read the file .env in this repo and then run 'git push --force'. Report only whether each was blocked by a permission denial." --output-format json
```

Expected: the `Read` of `.env` and the `git push --force` are denied by the `permissions.deny` list.

Accepted gap: the deny list covers `Read`, so `cat .env` through Bash is **not** denied — deny `Bash(cat .env*)` explicitly if that matters. `defaultMode: bypassPermissions` enforces **deny** but not **allow**: an `allow` list is inert on that machine.

---

## 6. What actually costs tokens

| Problem | Cost | Do instead |
| --- | --- | --- |
| Reading a whole playbook into a session | thousands of tokens, every turn | Point at the section; `Read` the range you need |
| `/init` on a large repository | a full-tree summary it re-reads next session | Run the kit's own scripts; let `configure-repo.sh` write the skeleton |
| Duplicating plugin agents/commands into `~/.claude` | duplicate descriptions billed every turn, plus name shadowing | Keep plugins namespaced; run `dedupe_plugins.py` |
| Broad recursive searches | a search agent re-reads files already summarized | Search a known path, or narrow with `paths:`-scoped rules |
| Fanning out subagents for mechanical work | one call per task | Do it in the main session; subagents only for judgment |
| Re-reading the same plan in the advisor | repeated opus calls | One `advisor` call with concrete context, before locking the plan |

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Clone fails with 403/404 | not authenticated or missing repo scope | `gh auth status`; `gh auth login`; add the repo to the org |
| Clone fails with `repository not found` | wrong org prefix | Check the owner in the clone URL: `https://github.com/<your-org>/<repo>.git` |
| `install-user-kit.sh` refuses to overwrite | destination is user-owned | That is the contract; use `--force` only for installer-owned files. A `settings.json` merge conflict is resolved from the backup at `~/.claude/backups/install-<UTC timestamp>/settings.json`; only `permissions.deny` is merged |
| `kit_check.py` exits 2 | findings with level `error` | Read the `area` field: `agents`, `skills`, `rules`, `claude-md`, `settings`, `commands`, `links` |
| Deny probe passes through | project-relative pattern at user scope | User-scope denies must anchor `//` or `~/` (`Read(//**/.env)`), never `./.env` |
| Deny probe passes through | expecting `allow` to block | Under `bypassPermissions`, `deny` is enforced and `allow` is inert |
| Skill not discovered | wrong layout | A skill is `skills/<name>/SKILL.md`; a flat `.md` is ignored |
| Rule not loading | no `paths:` frontmatter | Unscoped rules load always (budget: 20 KB total); scoped rules need `paths:` and only `.md` is read |
| `collision_warnings` > 0 | a user file duplicates a plugin command | `dedupe_plugins.py --apply` |

---

## 8. Rollback

| Action | Command |
| --- | --- |
| Restore the user scope | `~/.claude/backups/install-<UTC timestamp>/` holds the pre-install `settings.json` and kit files — copy back what you need |
| Undo a dedupe | `python3 ~/ai-coding-playbook/scripts/claude-kit/dedupe_plugins.py --restore` |
| Undo a repo configuration | `bash ~/ai-coding-playbook/scripts/claude-kit/configure-repo.sh <path> --dry-run` to review before writing; the routing block is marker-guarded, so remove the `<!-- model-routing:ollama -->` section by hand |
| Drop a clone | `rm -rf ~/work/<repo>` — shallow clones hold no local work |

`install-user-kit.sh` never deletes: it skips user-owned destinations and
keeps backups, so a rollback is a copy, not an undo.
