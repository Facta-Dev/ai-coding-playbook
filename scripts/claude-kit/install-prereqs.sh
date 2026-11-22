#!/usr/bin/env bash
#
# install-prereqs.sh — verify the prerequisites and install what is missing.
#
# Runs first in the bootstrap, before any kit step. Installs with apt when it
# has passwordless sudo (Linux) or Homebrew (macOS); it never prompts, never
# installs `ollama`, and never authenticates `gh`. A present tool is only
# verified. `claude` installs through npm once npm exists.
#
# Usage:
#   bash scripts/claude-kit/install-prereqs.sh [--dry-run]
#     --dry-run  print the install commands, change nothing
#
# Exit 0 = every required tool is present (or was installed), 1 = one is still
# missing or an install failed.

set -euo pipefail

DRY_RUN=0
FAILED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift;;
    -h|--help) sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "install-prereqs: unknown arg '$1'" >&2; exit 1;;
  esac
done

say()  { echo "install-prereqs: $*"; }
warn() { echo "install-prereqs: WARN — $*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "+ $*"
  else
    say "run: $*"
    "$@" || FAILED=1
  fi
}

OS="$(uname -s)"
APT_UPDATED=0

pkg_install() {
  if [[ "$OS" == "Linux" ]] && have apt-get && sudo -n true 2>/dev/null; then
    if [[ "$APT_UPDATED" -eq 0 ]]; then
      run sudo env DEBIAN_FRONTEND=noninteractive apt-get update -qq
      APT_UPDATED=1
    fi
    run sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
  elif [[ "$OS" == "Darwin" ]] && have brew; then
    run brew install "$@"
  else
    warn "cannot install $* — need apt with passwordless sudo, or brew"
    FAILED=1
  fi
}

# --- git, curl, python3 --------------------------------------------------------
for tool in git curl python3; do
  if have "$tool"; then
    say "$tool present ($(command -v "$tool"))"
  else
    pkg_install "$tool"
  fi
done

if have python3; then
  PY_OK="$(python3 -c 'import sys; print(1 if sys.version_info >= (3, 9) else 0)')"
  [[ "$PY_OK" == "1" ]] || { warn "python3 >= 3.9 is required"; FAILED=1; }
  PY_G="$(python3 -c 'import sys; print(1 if sys.version_info >= (3, 11) else 0)')"
  [[ "$PY_G" == "1" ]] || warn "graphify needs Python 3.11.5–3.14; this python3 is older"
fi

# --- node + npm (RTK and Claude Code install through npm) ---------------------
if have node && have npm; then
  say "node $(node --version), npm $(npm --version)"
else
  if [[ "$OS" == "Darwin" ]]; then
    pkg_install node
  elif have node; then
    pkg_install npm            # keep the existing nodejs, add npm
  else
    pkg_install nodejs npm
  fi
  if [[ "$DRY_RUN" -eq 0 ]] && ! { have node && have npm; }; then
    warn "node/npm still missing — install Node.js and re-run"
    FAILED=1
  fi
fi

# --- claude -------------------------------------------------------------------
if have claude; then
  say "claude $(claude --version 2>/dev/null | awk '{print $1}')"
elif have npm; then
  run npm install -g @anthropic-ai/claude-code
else
  warn "claude missing and npm unavailable — install Claude Code first"
  FAILED=1
fi

# --- required tools must exist after this step --------------------------------
for tool in git python3 claude; do
  if ! have "$tool"; then
    warn "$tool is still missing"
    FAILED=1
  fi
done

[[ "$FAILED" -eq 0 ]] || exit 1
say "prerequisites OK"
