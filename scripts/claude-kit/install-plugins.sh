#!/usr/bin/env bash
#
# install-plugins.sh — register and install the baseline plugin set (README §2).
#
# Shell only (no model tokens). Idempotent: an installed plugin is skipped and
# a registered marketplace is not added twice. Installing with `--scope user`
# writes the `enabledPlugins` entry, so this is also the configuration step.
#
# Source of truth: README §2 (baseline, every machine) and each repository's
# `.claude-plugin/marketplace.json`. The marketplace name is the one the
# manifest declares, not the repository name.
#
# `nanobanana@creding-plugins` is not installed here: the README lists no
# public marketplace source for `creding-plugins`, so it stays a per-user
# addition.
#
# Usage:
#   bash scripts/claude-kit/install-plugins.sh [--only=LIST] [--dry-run]
#     --only=   comma list of marketplace names (ecc, ponytail,
#               claude-plugins-official, claude-model-router-hook)
#     --dry-run print the install commands, change nothing
#
# Exit 0 = installed/skipped, 1 = an install failed.

set -euo pipefail

ONLY=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --only=*)  ONLY="${1#--only=}"; shift;;
    --only)    ONLY="${2:-}"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    -h|--help) sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "install-plugins: unknown arg '$1'" >&2; exit 1;;
  esac
done

say() { echo "install-plugins: $*"; }

command -v claude >/dev/null 2>&1 || {
  echo "install-plugins: ERROR — claude not on PATH" >&2
  exit 2
}

# plugin id | marketplace | marketplace source (org/repo)
PACKS=(
  "ecc@ecc|ecc|affaan-m/ECC"
  "ponytail@ponytail|ponytail|DietrichGebert/ponytail"
  "rust-analyzer-lsp@claude-plugins-official|claude-plugins-official|anthropics/claude-plugins-official"
  "claude-model-router-hook@claude-model-router-hook|claude-model-router-hook|tzachbon/claude-model-router-hook"
)

list_ids() {
  claude plugin list --json 2>/dev/null \
    | python3 -c 'import json,sys; print("\n".join(p["id"] for p in json.load(sys.stdin)))' \
    2>/dev/null || true
}
list_markets() {
  claude plugin marketplace list --json 2>/dev/null \
    | python3 -c 'import json,sys; print("\n".join(m["name"] for m in json.load(sys.stdin)))' \
    2>/dev/null || true
}

INSTALLED="$(list_ids)"
MARKETS="$(list_markets)"
install=0
skip=0
fail=0

for row in "${PACKS[@]}"; do
  IFS='|' read -r plugin market source <<<"$row"
  if [[ -n "$ONLY" && ",$ONLY," != *",$market,"* ]]; then continue; fi

  if grep -qxF "$plugin" <<<"$INSTALLED"; then
    say "skip     $plugin (installed)"
    skip=$((skip + 1))
    continue
  fi

  if ! grep -qxF "$market" <<<"$MARKETS"; then
    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "+ claude plugin marketplace add $source"
    elif claude plugin marketplace add "$source"; then
      MARKETS="$MARKETS"$'\n'"$market"
    else
      say "FAIL     $plugin (marketplace add $source)"
      fail=$((fail + 1))
      continue
    fi
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "+ claude plugin install $plugin --scope user -y"
  elif claude plugin install "$plugin" --scope user -y --json; then
    say "install  $plugin"
    install=$((install + 1))
  else
    say "FAIL     $plugin (install)"
    fail=$((fail + 1))
  fi
done

say "done — installed=$install skipped=$skip failed=$fail"
[[ "$fail" -eq 0 ]]
