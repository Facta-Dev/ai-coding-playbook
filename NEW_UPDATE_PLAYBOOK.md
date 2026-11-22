# NEW_UPDATE_PLAYBOOK.md — add a playbook, add a Beautiful repo, refresh the series

This is the operating runbook for changing the playbook set without
re-reading the whole repository. It covers three jobs:

1. **Add a playbook** — a new platform contract or a new stack profile.
2. **Add a Beautiful repository** — the `n` implementation for a stack.
3. **Refresh the series** — when Anthropic changes Claude Code, the Agent
   Skills standard, the model line, the API, or the product surface.

The rule is **delta, not corpus**: open the source that changed, the one
playbook section mapped to it, and the affected kit or Beautiful skill. Do not
read all 41 playbooks or all 13 Beautiful repositories to make one change.

## 0. The context pack (read this, then stop)

| File | What to read | Why |
|---|---|---|
| [`manifest.json`](manifest.json) | the entry for the playbook you touch | id, file, version, layer, owner, dependencies, `appliesTo` |
| [`PLAYBOOK_MASTER.md`](PLAYBOOK_MASTER.md) | §1 catalog, §3 invariants; §12 is in [`PLAYBOOK_MASTER_PART3.md`](PLAYBOOK_MASTER_PART3.md) | what exists and what wins in a conflict |
| [`README.md`](README.md) | §3, §3.2, §3.4 | the public table, the kit table, the Beautiful registry |
| [`verify-register.md`](verify-register.md) | the rows for the changed fact | the dated source, owner and due date |
| [`CHANGELOG.md`](CHANGELOG.md) | the current version line | what changed and how to describe it |
| [`scripts/playbook-lint.py`](scripts/playbook-lint.py) | the error output only | the mechanical truth; do not read the script unless it fails |
| [`scripts/claude-kit/generate-playbook-rules.py`](scripts/claude-kit/generate-playbook-rules.py) | `KITS` map only | the kit → stack → Beautiful mapping |
| `scripts/claude-kit/check-playbook-copies.sh` | the final `OK`/drift line | byte-identical kit copies |

For one stack, add only:

- `PLAYBOOK_<STACK>.md` (the stack contract);
- `<kit>/README.md` + `<kit>/.claude/rules/playbooks.md` (the kit);
- `beautiful<stack>/skills/*/SKILL.md` (the implementation).

If a task needs a file not on this list, name the reason in the change record
(§7). That is the guard against re-exploring the repository.

## 1. The 1:n model (the contract in one screen)

- **1** = this repository, `ai-coding-playbook`. It owns the normative
  contract: the master, the platform playbooks, the shared contracts, the
  kits and the reference implementations.
- **n** = the thirteen `Beautiful*` repositories, one per stack. Each one
  implements the contract and never redefines it.
- The normative rule is [`PLAYBOOK_MASTER_PART3.md` §12](PLAYBOOK_MASTER_PART3.md);
  the registry is §12.3.
- The Beautiful side mirrors the rule in `.claude/rules/playbooks.md` and
  `README.md`; the kit side mirrors it in `<kit>/.claude/rules/playbooks.md`.
- A contract change is **1 → n**: it lands here first, then in the
  implementations. A gap is **n → 1**: it is reported upstream, not patched
  silently in a Beautiful repo.

## 2. Add a new playbook

### 2.1 Decide the kind

| Kind | Belongs in | Needs a kit? | Needs a Beautiful repo? |
|---|---|---|---|
| **Platform contract** (new domain, e.g. data) | root `PLAYBOOK_<ID>.md` | only if it ships a runnable template | only if it has a stack implementation |
| **Stack profile** (new language/framework) | root `PLAYBOOK_<STACK>.md` + a kit | yes | yes |
| **Shared contract** (security, tests, URLs, audit, Claude Code) | root + every kit | no new kit | no |

Do not create a new playbook for a few paragraphs that fit an existing one;
add a section and bump that playbook instead. A new file is for a new contract
surface with its own owner and review cadence.

### 2.2 Create the file

1. Copy the shape of the closest existing playbook. Required front matter
   (the linter enforces it):

   ```yaml
   ---
   id: NEW_ID
   version: 0.1.0
   status: draft
   last_reviewed: 2026-11-19
   review_cadence_days: 60
   owner: <role>
   depends_on: [MASTER, URLS, BACKEND, SECURITY, TESTS, AUDIT, CLAUDE_CODE]
   ---
   ```

2. Sections: scope, when to load it, invariants, controls/tests, checklist,
   references. Cite primary sources; do not invent a count or a date. Every
   dated or vendor-specific claim gets a `(verify)` marker.
3. Keep the file under 40,000 characters. If it passes the advisory limit,
   split it deterministically:

   ```bash
   python3 scripts/split-playbook.py --dry-run
   python3 scripts/split-playbook.py
   ```

   The split keeps section numbers, creates `PLAYBOOK_<ID>_PART<n>.md`, and
   updates the manifest. Do not hand-edit a part boundary.
4. Set `status: active` only when the contract has a control (test, lint,
   script or gate); otherwise keep it `draft`.

### 2.3 Register the playbook

In one change:

- add the `manifest.json` entry (one per main and, after a split, one per
  part);
- add the ID to `PLAYBOOK_MASTER.md` §1 and the routing matrix in §7;
- add the file to `README.md` §3;
- add the stack row to `README.md` §3.2 only if it has a kit;
- add any new dated claim to `verify-register.md`;
- add a `CHANGELOG.md` entry with the version bump.

Run:

```bash
python3 scripts/playbook-lint.py
```

Fix the lint errors before touching a kit or a Beautiful repo. The lint also
checks cross-references and the manifest; a broken anchor is cheaper to fix
here than in thirteen downstream repositories.

### 2.4 If it is a shared contract

- Copy it **byte-identically** into every kit. Do not specialize the copy.
- Add the filename to `SHARED` in
  `scripts/claude-kit/generate-playbook-rules.py`, then regenerate:

  ```bash
  python3 scripts/claude-kit/generate-playbook-rules.py
  python3 scripts/claude-kit/generate-playbook-rules.py --check
  bash scripts/claude-kit/check-playbook-copies.sh
  ```

- If the file has parts, copy the parts too; the copy check includes them.

### 2.5 Definition of done — playbook

- [ ] Front matter complete and `last_reviewed` inside cadence.
- [ ] Manifest entry (and part entries) present.
- [ ] Master §1, README §3 and, if applicable, §3.2 updated.
- [ ] Cross-references resolve; `playbook-lint` is clean.
- [ ] Kit copies are byte-identical; copy check is clean.
- [ ] `verify-register` and `CHANGELOG` updated.
- [ ] If it is a new stack: kit, Beautiful repo and §12.3 row exist in the
      same change (see §3 and §4).

## 3. Add a new kit (only for a new stack)

Use the closest kit as the mold: a backend stack from `golang/`, a client
from `extension/`, a frontend from `frontend/`, a CLI from `cli/`.

A kit carries:

- `AGENTS.md`, `MEMORY.md`, `CLAUDE.md` (symlink to `AGENTS.md`);
- `.claude/` with `agents/`, `commands/`, `schemas/`, `skills/`,
  `manifest.json`, `settings.json` and `rules/playbooks.md`;
- `scripts/` with the budget checker, linters and `verify-template.sh`;
- `evals/` with valid and invalid fixtures;
- `docs/00-14`;
- a runnable template and, where the mold has one, `specs/`.

Steps:

1. Copy the mold; rename the stack-specific identifiers and the template.
2. Add the kit to `KITS` in
   `scripts/claude-kit/generate-playbook-rules.py` with `paths`, `arch`,
   `stack` and `implementation` (the Beautiful repo).
3. Copy the shared contracts and the stack playbook; never hand-specialize a
   shared copy.
4. Add the kit row to `README.md` §3.2 and the install pointer to
   `PLAYBOOK_INSTALL.md`.
5. Run the kit gates (`make ci` or `scripts/verify-template.sh`), the budget
   checker, and `kit_check.py`.
6. Add the Beautiful repo per §4 and the §12.3 row in the same change.

## 4. Add a new Beautiful repository

One Beautiful repo per stack. Three Agent Skills, a linter config proven to
fire, tests, examples, the `.claude/` plane and the 1:n rule.

### 4.1 Scaffold

Copy the closest Beautiful repo. The minimum tree:

```
skills/<stack>-best-practices/SKILL.md
skills/<stack>-review/SKILL.md
skills/<stack>-port/SKILL.md
lints/<linter-config>
tests/                  # every lint rule has a failing and a passing case
examples/               # valid and invalid examples used by the skills
scripts/check-skill.py
scripts/check-lints.sh
scripts/check-examples.py
scripts/package-openai-plugin.py
.claude/agents/ .claude/commands/ .claude/skills/
.claude/rules/playbooks.md
plugin.json
LICENSE                 # MIT
README.md
CHANGELOG.md
CONTRIBUTING.md
PRIVACY.md
.github/workflows/check.yml
docs/architecture/      # only if the repo ships diagrams
```

### 4.2 The three skills

Each skill is a standard Agent Skill:

- `SKILL.md` with `name`, `description`, version and the trigger;
- references to the stack playbook and the shared contracts;
- a rule catalog that maps every enforced lint to its playbook section;
- examples and anti-examples;
- a port procedure for moving an existing codebase onto the contract.

The `review` skill must be able to reject a diff with a specific rule and
citation. The `port` skill must produce a staged migration, not a rewrite.

### 4.3 The 1:n rule

Add a `## Cross-repo relationship (1:n)` section to
`.claude/rules/playbooks.md` and a short paragraph to `README.md`:

- this repo is one of the **n**; `ai-coding-playbook` is the **1**;
- **n → 1**: this repo implements, never redefines; a gap is reported
  upstream;
- **1 → n**: a contract change in the playbook requires an impact check here
  and in the other implementations;
- link to `PLAYBOOK_MASTER_PART3.md` §12.

### 4.4 Register the implementation

In the playbook repo, in the same change:

- add the repo to `PLAYBOOK_MASTER_PART3.md` §12.3;
- add it to `README.md` §3.4;
- add it to `install/repos.txt` and, if it is in the default working set,
  `scripts/claude-kit/clone-repos.sh`;
- mention it in `PLAYBOOK_INSTALL.md` only if it changes the install path.

### 4.5 Validate

```bash
python3 scripts/check-skill.py
bash scripts/check-lints.sh
python3 scripts/check-examples.py
```

Then run the skill on a small real project, not only on the fixtures. A skill
that passes the checker but cannot review a real diff is not done.

### 4.6 Definition of done — Beautiful

- [ ] Three skills, linter config, tests and examples.
- [ ] Every lint rule has a failing and a passing test.
- [ ] `.claude/rules/playbooks.md` has the 1:n section.
- [ ] README has the playbook set, the 1:n paragraph and the install path.
- [ ] `plugin.json` and `LICENSE` (MIT) present; `CREDITS.md` if adapted.
- [ ] `check-skill`, `check-lints`, `check-examples` and CI are green.
- [ ] §12.3 row, README §3.4 row and `install/repos.txt` entry exist.
- [ ] Version, changelog, release and repository About/topics updated.

## 5. Refresh on Anthropic changes

### 5.1 Watch list

Read the primary source, not a summary:

- Claude Code release notes / changelog.
- Claude Code docs: best practices, subagents, skills, hooks, memory,
  settings, permissions, worktrees, plugins, MCP.
- Anthropic model release and deprecation notes.
- Anthropic engineering posts (methodology, design, evaluation).
- The Agent Skills standard and the plugin/skill manifest format.
- The API/SDK changelog when a backend playbook is affected.

Record the URL, the retrieval date and the exact claim in
`verify-register.md`. Do not trust a model's memory for a vendor fact; verify
it at the source.

### 5.2 Cadence

| Cadence | Job | Output |
|---|---|---|
| Weekly (15 min) | scan the Claude Code changelog and the model notes | a one-line delta or “no change” |
| Monthly | re-check the `verify-register` rows due this month | confirmed/changed/retired rows |
| Per major release | run §5.3 for the changed surface | playbook + n impact review |
| Quarterly | full cross-repo audit | exceptions and drift closed |

### 5.3 Impact matrix

Find the changed surface in the left column; touch only the mapped files.

| Change | 1 — playbook files | n — Beautiful files |
|---|---|---|
| Model IDs, tiers, pricing, context window | `CLAUDE_CODE_ROUTING_MODELS_OLLAMA.md`, `PLAYBOOK_CLAUDE_CODE` model sections, kit `settings.fragment.json` / `settings.ollama.json`, agent front matter | `.claude/agents/*`, model names in skills, `README` routing claims |
| Hooks, permissions, settings, worktrees | `PLAYBOOK_CLAUDE_CODE` control/coordination sections, kit `settings`, hooks, role/ownership guards | `.claude/settings`, `.claude/hooks`, agent permissions |
| Skills/agents/commands format | `PLAYBOOK_CLAUDE_CODE` capability section, every kit's agents/skills/commands, `check-skill` | `skills/*/SKILL.md`, `.claude/agents`, `.claude/skills`, `.claude/commands`, `plugin.json` |
| Memory, context, compaction, instruction budget | `PLAYBOOK_CLAUDE_CODE` memory section, `PLAYBOOK_MASTER` §3, kit `CLAUDE.md`/`AGENTS.md`/rules | `.claude/rules/playbooks.md`, `CLAUDE.md`, skill descriptions |
| MCP, plugins, install | `PLAYBOOK_INSTALL`, `PLAYBOOK_CLAUDE_CODE` capability, `kit/`, `install/` | `plugin.json`, `.claude-plugin/`, install docs |
| API/SDK/tool use | `PLAYBOOK_BACKEND`, the stack playbook, contract tests | the matching backend skill (Go/Node/Python/Rust/Java) |
| Frontend/design guidance | `PLAYBOOK_FRONTEND`, the client playbooks | the matching frontend/client Beautiful repo |
| Security guidance | `PLAYBOOK_SECURITY`, `PLAYBOOK_AUDIT`, every kit | lints, tests and review skill in every repo |
| Testing guidance | `PLAYBOOK_TESTS`, every kit | `tests/`, `examples/`, review skill |
| Language/framework release | the stack playbook + kit | the stack's Beautiful repo |

If the change is not in the table, stop: it is not a playbook change until
the owner classifies it.

### 5.4 The delta loop

1. **Capture** the source URL, date and quote in `verify-register.md`.
2. **Classify** with §5.3; write the impact class in the change record.
3. **Locate**: `rg -n '<exact token>'` over the mapped files only.
4. **Update 1 first**: the playbook, then the kit copies (byte-identical),
   then the generator (`generate-playbook-rules.py --check`).
5. **Propagate to n** only for the repos in the impact row. For a mechanical
   change, use one scripted replacement across the n and run each repo's
   checker; for a judgment change, do one repo as the reference, review it,
   then apply the same diff to the other affected repos.
6. **Record**: `CHANGELOG.md`, `verify-register.md`, the change record.
7. **Release** only when the change is user-facing (§6).

### 5.5 Do not

- Do not read all 38 playbooks to answer one Anthropic change.
- Do not read all 13 Beautiful repos for a stack-specific change.
- Do not patch a contract in a Beautiful repo and leave the playbook behind.
- Do not copy a shared contract into a kit by hand; copy it byte-identically
  and let the check prove it.
- Do not raise the 40k warning instead of splitting; see ADR 0002.
- Do not treat a vendor blog as a control; a control is a test, a lint, a hook
  or a script.

## 6. Versioning and release

1. Bump the affected playbook's front matter and `manifest.json` version;
   update `last_reviewed`.
2. Add the `CHANGELOG.md` entry with the date and the set version.
3. Run the full gates:

   ```bash
   python3 scripts/playbook-lint.py
   python3 scripts/claude-kit/generate-playbook-rules.py --check
   bash scripts/claude-kit/check-playbook-copies.sh
   ```

4. Build the docs bundle and create the release with the install-tree assets:

   ```bash
   tar -czf /tmp/facta-playbook-vX.Y.Z-docs.tar.gz \
     PLAYBOOK_*.md manifest.json CHANGELOG.md LICENSE verify-register.md \
     README.md CLAUDE_CODE_ROUTING_MODELS_OLLAMA.md \
     docs/architecture/install-decision-tree.workflow.{json,html,png} \
     docs/adr/*.md
   gh release create vX.Y.Z --target main \
     --notes-file /tmp/release-notes.md \
     /tmp/facta-playbook-vX.Y.Z-docs.tar.gz \
     docs/architecture/install-decision-tree.workflow.html \
     docs/architecture/install-decision-tree.workflow.png
   ```

5. Update `install/repos.txt`, the README tables and the repository
   About/topics when the surface or the registry changed.

## 7. Change record (append one row per job)

Keep this table in the pull request or the release notes; it is the cache
that stops the next session from re-exploring.

| Date | Source (URL + date) | Change | Class | 1 — files | n — repos | Gates | Release |
|---|---|---|---|---|---|---|---|
| 2026-11-19 | Anthropic docs / changelog | example: new hook event | hooks | `PLAYBOOK_CLAUDE_CODE` §7, 12 kit settings | all 12 `.claude` planes | lint, copies, kit CI | vX.Y.Z |

The row is the handoff: the next agent reads the row and the mapped files,
not the whole repository.

## 8. One-screen checklist

**New playbook:** file + front matter → manifest → master §1/§7 → README §3 →
verify-register → changelog → lint → shared? copy to kits + `SHARED` → release.

**New Beautiful:** three skills + lints + tests + examples → `.claude` +
1:n rule → README → §12.3 + README §3.4 + `install/repos.txt` → check-skill /
check-lints / check-examples → CI → release + About/topics.

**Anthropic refresh:** source + date in verify-register → impact matrix row →
`rg` exact token → update 1 → copy to kits → update the affected n → gates →
record → release.
