#!/usr/bin/env bash
#
# install-cost-tracker.sh — install the cost tracker and wire its status line.
#
# Shell only (no model tokens). Runs the tracker's own install.sh (tests
# included) and merges its statusLine and per-event hooks into settings.json.
# Idempotent: a wired key or hook is left alone, and a statusLine that points
# at another command is kept. The tracker's own install.sh never edits
# settings, so this wrapper owns the merge.
#
# Usage:
#   bash scripts/claude-kit/install-cost-tracker.sh [--dir=DIR]
#        [--settings-only] [--no-settings] [--dry-run]
#     --dir=DIR        working-set root (default ~/work)
#     --settings-only  skip install.sh; only merge the settings
#     --no-settings    install the files, leave settings.json untouched
#     --dry-run        print the plan, change nothing
#
# Exit 0 = installed/skipped, 1 = install or settings merge failed.

set -euo pipefail

DIR="$HOME/work"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS_ONLY=0
MERGE_SETTINGS=1
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir=*)        DIR="${1#--dir=}"; shift;;
    --dir)          DIR="${2:-}"; shift 2;;
    --settings-only) SETTINGS_ONLY=1; shift;;
    --no-settings)  MERGE_SETTINGS=0; shift;;
    --dry-run)      DRY_RUN=1; shift;;
    -h|--help)      sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "install-cost-tracker: unknown arg '$1'" >&2; exit 1;;
  esac
done

say() { echo "install-cost-tracker: $*"; }

TRACKER="$DIR/claude-code-cli-cost-tracker"
TARGET="$CLAUDE_DIR/settings.json"

if [[ ! -f "$TRACKER/install.sh" ]]; then
  say "skip — no tracker at $TRACKER (clone the selected group first)"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  [[ "$SETTINGS_ONLY" -eq 0 ]] && echo "+ bash $TRACKER/install.sh"
  [[ "$MERGE_SETTINGS" -eq 1 ]] && echo "+ merge statusLine + hooks -> $TARGET"
  exit 0
fi

if [[ "$SETTINGS_ONLY" -eq 0 ]]; then
  say "install $TRACKER/install.sh"
  bash "$TRACKER/install.sh"
fi

if [[ "$MERGE_SETTINGS" -eq 0 ]]; then
  say "settings untouched (--no-settings)"
  exit 0
fi

command -v python3 >/dev/null 2>&1 || {
  echo "install-cost-tracker: ERROR — python3 is required for the settings merge" >&2
  exit 1
}
mkdir -p "$CLAUDE_DIR"

RENDERED="$(mktemp)"
STATE="$(python3 - "$TARGET" "$CLAUDE_DIR" "$RENDERED" <<'PY'
import json, sys

target_path, claude_dir, out_path = sys.argv[1:4]
try:
    with open(target_path) as fh:
        target = json.load(fh)
except FileNotFoundError:
    target = {}
except (OSError, ValueError) as exc:
    sys.exit("install-cost-tracker: ERROR — invalid settings.json: %s" % exc)

claude_dir = claude_dir.rstrip("/")
statusline_cmd = "python3 %s/statusline.py" % claude_dir
hook_cmd = "python3 %s/hooks/session_status.py" % claude_dir
events = ["PreToolUse", "PostToolUse", "Notification", "PermissionRequest",
          "SessionStart", "SessionEnd", "Stop", "StopFailure",
          "SubagentStop", "UserPromptSubmit"]

changed = False

statusline = target.get("statusLine")
if statusline is None:
    target["statusLine"] = {"type": "command", "command": statusline_cmd,
                            "refreshInterval": 5}
    changed = True
elif not (isinstance(statusline, dict)
          and statusline.get("command") == statusline_cmd):
    sys.stderr.write("install-cost-tracker: WARN — statusLine points at "
                     "another command; leaving it alone\n")

hooks = target.setdefault("hooks", {})
if not isinstance(hooks, dict):
    sys.exit("install-cost-tracker: ERROR — settings.json hooks is not an object")

for event in events:
    groups = hooks.setdefault(event, [])
    if not isinstance(groups, list):
        sys.exit("install-cost-tracker: ERROR — hooks.%s is not a list" % event)
    present = any(
        entry.get("command") == hook_cmd
        for group in groups if isinstance(group, dict)
        for entry in group.get("hooks", []) if isinstance(entry, dict)
    )
    if not present:
        # A new entry, never a replacement: an existing hook (e.g. rtk) stays.
        groups.append({"hooks": [{"type": "command", "command": hook_cmd}]})
        changed = True

if not changed:
    print("unchanged")
    sys.exit(0)

with open(out_path, "w") as fh:
    json.dump(target, fh, indent=2)
    fh.write("\n")
print("changed")
PY
)"

if [[ "$STATE" == "changed" ]]; then
  if [[ -f "$TARGET" ]]; then
    BK="$CLAUDE_DIR/backups/install-$(date -u +%Y%m%d-%H%M%SZ)"
    mkdir -p "$BK" && cp -p "$TARGET" "$BK/settings.json"
    say "backup $TARGET -> $BK/settings.json"
  fi
  mv "$RENDERED" "$TARGET"
  chmod 600 "$TARGET" 2>/dev/null || true
  say "merged statusLine + hooks -> $TARGET"
else
  rm -f "$RENDERED"
  say "settings already wired $TARGET"
fi

exit 0
