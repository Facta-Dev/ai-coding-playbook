#!/usr/bin/env bash
#
# install-ai-tools.sh — install the code-intelligence and token-saving tools.
#
# Shell only (no model tokens). Idempotent: a tool already installed is
# verified, not reinstalled, and a configured hook is left alone.
#
#   rtk                  shell output compression (hook + RTK.md)
#   graphify             knowledge graph skill (/graphify)
#   understand-anything  Claude Code plugin (/understand)
#   codegraph            MCP code graph (codegraph_explore)
#
# Order matters: `graphify install` rewrites ~/.claude/CLAUDE.md and drops
# blocks it does not own, so Graphify runs before CodeGraph and only while its
# skill is missing. CodeGraph then appends its marker-guarded section last.
#
# Usage:
#   bash scripts/claude-kit/install-ai-tools.sh [--only=LIST] [--dry-run]
#     --only=    comma list of rtk,graphify,understand-anything,codegraph
#                (default: all four)
#     --dry-run  print the commands, change nothing
#
# Exit 0 = installed/verified, 1 = an install or the settings merge failed.

set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ONLY="rtk,graphify,understand-anything,codegraph,knowledge-sync"
DRY_RUN=0
FAILED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --only=*)   ONLY="${1#--only=}"; shift;;
    --only)     ONLY="${2:-}"; shift 2;;
    --dry-run)  DRY_RUN=1; shift;;
    -h|--help)  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "install-ai-tools: unknown arg '$1'" >&2; exit 1;;
  esac
done

say()  { echo "install-ai-tools: $*"; }
warn() { echo "install-ai-tools: WARN — $*" >&2; }
want() { [[ ",$ONLY," == *",$1,"* ]]; }

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "+ $*"
  else
    say "run: $*"
    "$@" || FAILED=1
  fi
}

merge_rtk_hook() {
  # RTK's non-interactive `init` prints the hook instead of writing it.
  python3 - "$SETTINGS" <<'PY' || FAILED=1
import json, os, shutil, sys, datetime
path = sys.argv[1]
try:
    with open(path) as fh:
        target = json.load(fh)
except FileNotFoundError:
    target = {}
except (OSError, ValueError) as exc:
    sys.exit("install-ai-tools: ERROR — invalid settings.json: %s" % exc)

groups = target.setdefault("hooks", {}).setdefault("PreToolUse", [])
if any(entry.get("command") == "rtk hook claude"
       for group in groups if isinstance(group, dict)
       for entry in group.get("hooks", []) if isinstance(entry, dict)):
    print("install-ai-tools: rtk hook already configured")
    sys.exit(0)

groups.append({"matcher": "Bash",
               "hooks": [{"type": "command", "command": "rtk hook claude"}]})
if os.path.exists(path):
    stamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d-%H%M%SZ")
    backup = os.path.join(os.path.dirname(path), "backups",
                          "install-" + stamp, "settings.json")
    os.makedirs(os.path.dirname(backup), exist_ok=True)
    shutil.copy2(path, backup)
with open(path, "w") as fh:
    json.dump(target, fh, indent=2)
    fh.write("\n")
print("install-ai-tools: merged the rtk hook into %s" % path)
PY
  [[ -f "$SETTINGS" ]] && chmod 600 "$SETTINGS" 2>/dev/null || true
}

install_rtk() {
  if command -v rtk >/dev/null 2>&1; then
    say "rtk $(rtk --version 2>/dev/null | awk '{print $2}') on PATH"
  else
    if ! command -v npm >/dev/null 2>&1; then
      if command -v apt-get >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
        run sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y npm
      elif command -v brew >/dev/null 2>&1; then
        run brew install node
      else
        warn "rtk missing and npm unavailable — install Node.js/npm, then re-run"
        return
      fi
    fi
    if ! command -v npm >/dev/null 2>&1; then
      warn "npm still missing after install — rtk not installed"
      return
    fi
    run npm install -g @terrain-ai/rtk
  fi

  if grep -q '"rtk hook claude"' "$SETTINGS" 2>/dev/null; then
    say "rtk hook configured"
    return
  fi
  if [[ ! -f "$CLAUDE_DIR/RTK.md" ]] && command -v rtk >/dev/null 2>&1; then
    run rtk init -g   # writes RTK.md and the @RTK.md import
  fi
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "+ merge the rtk hook into $SETTINGS"
  else
    merge_rtk_hook
  fi
}

install_graphify() {
  if ! command -v graphify >/dev/null 2>&1; then
    if ! command -v pipx >/dev/null 2>&1; then
      if command -v apt-get >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
        run sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y pipx
      elif command -v brew >/dev/null 2>&1; then
        run brew install pipx
      else
        warn "graphify needs pipx — install pipx (apt/brew) and re-run"
        return
      fi
    fi
    run pipx install graphifyy
  fi
  if ! command -v graphify >/dev/null 2>&1; then
    warn "graphify not on PATH — run: pipx ensurepath, then open a new shell"
    return
  fi
  if [[ -f "$CLAUDE_DIR/skills/graphify/SKILL.md" ]]; then
    say "graphify skill registered"
  else
    run graphify install
  fi
}

install_understand_anything() {
  local installed
  installed="$(claude plugin list --json 2>/dev/null \
    | python3 -c 'import json,sys; print("yes" if any(p["id"]=="understand-anything@understand-anything" for p in json.load(sys.stdin)) else "no")' \
    2>/dev/null || echo no)"
  if [[ "$installed" == "yes" ]]; then
    say "understand-anything plugin installed"
    return
  fi
  if ! claude plugin marketplace list --json 2>/dev/null | grep -q 'understand-anything'; then
    run claude plugin marketplace add Egonex-AI/Understand-Anything
  fi
  run claude plugin install understand-anything@understand-anything --scope user -y
}

install_codegraph() {
  if ! command -v codegraph >/dev/null 2>&1; then
    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "+ curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh"
    else
      local tmp; tmp="$(mktemp)"
      if curl -fsSL --max-time 60 \
           https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh \
           -o "$tmp" && sh "$tmp"; then
        :
      else
        FAILED=1
      fi
      rm -f "$tmp"
    fi
  fi
  if ! command -v codegraph >/dev/null 2>&1; then
    [[ "$DRY_RUN" -eq 1 ]] || warn "codegraph not on PATH — add ~/.local/bin and re-run"
    return
  fi
  if python3 -c "import json,sys; d=json.load(open('$HOME/.claude.json')); sys.exit(0 if 'codegraph' in d.get('mcpServers',{}) else 1)" 2>/dev/null; then
    say "codegraph MCP wired"
  else
    run codegraph install --target=claude --location=global --yes
  fi
}

merge_knowledge_sync_hook() {
  # Append the knowledge-sync PostToolUse hook; idempotent on the exact
  # command string. The hook script must exist before this runs — kit_check
  # flags settings hook commands that point at a missing file.
  python3 - "$SETTINGS" <<'PY' || FAILED=1
import json, os, shutil, sys, datetime, time
path = sys.argv[1]
cmd = "bash " + os.path.expanduser("~/.claude/hooks/knowledge-sync.sh")
try:
    with open(path) as fh:
        target = json.load(fh)
except FileNotFoundError:
    target = {}
except (OSError, ValueError) as exc:
    sys.exit("install-ai-tools: ERROR — invalid settings.json: %s" % exc)

groups = target.setdefault("hooks", {}).setdefault("PostToolUse", [])
if any(entry.get("command") == cmd
       for group in groups if isinstance(group, dict)
       for entry in group.get("hooks", []) if isinstance(entry, dict)):
    print("install-ai-tools: knowledge-sync hook already configured")
    sys.exit(0)

if not os.path.exists(os.path.expanduser("~/.claude/hooks/knowledge-sync.sh")):
    sys.exit("install-ai-tools: ERROR — ~/.claude/hooks/knowledge-sync.sh missing; "
             "install the hook script before merging settings")

groups.append({"matcher": "Write|Edit|MultiEdit|NotebookEdit",
               "hooks": [{"type": "command", "command": cmd}]})
if os.path.exists(path):
    stamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d-%H%M%SZ")
    backup = os.path.join(os.path.expanduser("~/.claude"), "backups",
                          "settings-pre-knowledge-sync-%d.json" % int(time.time()))
    os.makedirs(os.path.dirname(backup), exist_ok=True)
    shutil.copy2(path, backup)
    os.chmod(backup, 0o600)
with open(path, "w") as fh:
    json.dump(target, fh, indent=2)
    fh.write("\n")
print("install-ai-tools: merged the knowledge-sync hook into %s" % path)
PY
  [[ -f "$SETTINGS" ]] && chmod 600 "$SETTINGS" 2>/dev/null || true
}

# install_knowledge_sync — memory-first rule + post-edit codegraph/graphify sync hook.
install_knowledge_sync() {
  mkdir -p "$CLAUDE_DIR/rules" "$CLAUDE_DIR/hooks"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "+ cp -f $ROOT_DIR/kit/rules/memory-ops.md $CLAUDE_DIR/rules/"
    echo "+ cp -f $ROOT_DIR/scripts/hooks/knowledge-sync.sh $CLAUDE_DIR/hooks/"
    echo "+ merge the knowledge-sync hook into $SETTINGS"
    return
  fi
  if [[ -f "$ROOT_DIR/kit/rules/memory-ops.md" ]]; then
    cp -f "$ROOT_DIR/kit/rules/memory-ops.md" "$CLAUDE_DIR/rules/memory-ops.md"
    say "install-knowledge-sync: rule installed"
  else
    warn "install-knowledge-sync: kit/rules/memory-ops.md missing — rule not installed"
    FAILED=1
  fi
  if [[ -f "$ROOT_DIR/scripts/hooks/knowledge-sync.sh" ]]; then
    cp -f "$ROOT_DIR/scripts/hooks/knowledge-sync.sh" "$CLAUDE_DIR/hooks/knowledge-sync.sh"
    chmod +x "$CLAUDE_DIR/hooks/knowledge-sync.sh"
    say "install-knowledge-sync: hook installed"
  else
    warn "install-knowledge-sync: scripts/hooks/knowledge-sync.sh missing — hook not installed"
    FAILED=1
  fi
  if grep -q '"bash .*hooks/knowledge-sync.sh"' "$SETTINGS" 2>/dev/null; then
    say "install-knowledge-sync: settings merged (already present)"
  else
    merge_knowledge_sync_hook
    say "install-knowledge-sync: settings merged"
  fi
}

want rtk                 && install_rtk
want graphify            && install_graphify
want understand-anything && install_understand_anything
want codegraph           && install_codegraph
want knowledge-sync      && install_knowledge_sync

exit "$FAILED"
