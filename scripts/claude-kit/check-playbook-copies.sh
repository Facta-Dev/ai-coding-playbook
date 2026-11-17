#!/usr/bin/env bash
# check-playbook-copies.sh — every kit ships byte-identical playbook copies.
#
# Policy (PLAYBOOK_CLAUDE_CODE §21.4): the shared contracts and each kit's
# stack playbook are mirror copies of the root files, never hand-edited.
# A stack-specific rule belongs in the root playbook; the kit copy is
# replaced, not patched. This gate is the enforcement.
#
# Usage:
#   bash scripts/claude-kit/check-playbook-copies.sh
#   bash scripts/claude-kit/check-playbook-copies.sh --self-test
#
# Exit: 0 clean, 1 drift or a missing/extra copy.
set -euo pipefail

SELF_TEST=0
case "${1:-}" in
  --self-test) SELF_TEST=1 ;;
  -h|--help) sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  '') ;;
  *) echo "check-playbook-copies: unknown arg '$1'" >&2; exit 1 ;;
esac

SHARED=(
  PLAYBOOK_SECURITY.md
  PLAYBOOK_TESTS.md
  PLAYBOOK_URLS.md
  PLAYBOOK_AUDIT.md
  PLAYBOOK_CLAUDE_CODE.md
)

CLIENT_KITS=(extension desktop frontend-mobile mobile-android mobile-ios frontend cli)
BACKEND_KITS=(golang rust nodejs python java)

# The stack playbook each kit ships next to the shared contracts. Frontend and
# cli specialize PLAYBOOK_FRONTEND/PLAYBOOK_CLI instead of a separate stack file.
stack_for() {
  case "$1" in
    extension)       echo PLAYBOOK_CHROME_EXTENSION.md ;;
    desktop)         echo PLAYBOOK_DESKTOP_QT.md ;;
    frontend-mobile) echo PLAYBOOK_FRONTEND_MOBILE.md ;;
    mobile-android)  echo PLAYBOOK_MOBILE_ANDROID_KOTLIN.md ;;
    mobile-ios)      echo PLAYBOOK_MOBILE_IOS_SWIFT.md ;;
    frontend)        echo PLAYBOOK_FRONTEND.md ;;
    cli)             echo PLAYBOOK_CLI.md ;;
    golang)          echo PLAYBOOK_GOLANG.md ;;
    rust)            echo PLAYBOOK_RUST.md ;;
    nodejs)          echo PLAYBOOK_NODEJS.md ;;
    python)          echo PLAYBOOK_PYTHON.md ;;
    java)            echo PLAYBOOK_JAVA_J2EE.md ;;
    *)               echo "" ;;
  esac
}

expected_for() {
  local kit="$1" root="${2:-}" stack
  stack="$(stack_for "$kit")"
  emit() {
    local f="$1"
    printf '%s\n' "$f"
    if [[ -n "$root" ]]; then
      local stem="${f%.md}"
      (cd "$root" && ls "${stem}_PART"*.md 2>/dev/null || true)
    fi
  }
  local name
  for name in "${SHARED[@]}"; do emit "$name"; done
  if [[ " ${BACKEND_KITS[*]} " == *" $kit "* ]]; then
    emit PLAYBOOK_BACKEND.md
  fi
  # The visual client kits ship the shared frontend contract in addition to
  # their own platform playbook.
  case "$kit" in
    extension|desktop|frontend-mobile|mobile-android|mobile-ios) emit PLAYBOOK_FRONTEND.md ;;
  esac
  [[ -n "$stack" ]] && emit "$stack"
}

check_tree() {
  local root="$1" failures="$2"
  local kit f stack expected

  for kit in "${CLIENT_KITS[@]}" "${BACKEND_KITS[@]}"; do
    [[ -d "$root/$kit" ]] || continue
    while IFS= read -r f; do
      if [[ ! -f "$root/$kit/$f" ]]; then
        echo "MISSING: $kit/$f" >&2
        echo "missing" >> "$failures"
      elif ! cmp -s "$root/$f" "$root/$kit/$f"; then
        echo "DRIFT:   $kit/$f (must be byte-identical to $f)" >&2
        echo "drift" >> "$failures"
      fi
    done < <(expected_for "$kit" "$root")

    # Any other PLAYBOOK_*.md is an unmanaged copy: it will drift silently.
    local expected
    expected="$(expected_for "$kit" "$root")"
    while IFS= read -r f; do
      [[ -n "$f" ]] || continue
      if ! grep -qxF "$f" <<< "$expected"; then
        echo "EXTRA:   $kit/$f (not in the managed copy set)" >&2
        echo "extra" >> "$failures"
      fi
    done < <(cd "$root/$kit" && ls PLAYBOOK_*.md 2>/dev/null || true)
  done
}

if [[ "$SELF_TEST" -eq 1 ]]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  mkdir -p "$tmp/root"
  for k in "${CLIENT_KITS[@]}" "${BACKEND_KITS[@]}"; do mkdir -p "$tmp/root/$k"; done
  for k in "${CLIENT_KITS[@]}" "${BACKEND_KITS[@]}"; do
    while IFS= read -r f; do
      printf 'source %s\n' "$f" > "$tmp/root/$f"
      cp "$tmp/root/$f" "$tmp/root/$k/$f"
    done < <(expected_for "$k" "$tmp/root")
  done

  : > "$tmp/failures"
  check_tree "$tmp/root" "$tmp/failures" 2>/dev/null
  [[ ! -s "$tmp/failures" ]] || { echo "self-test: clean tree reported drift" >&2; exit 1; }

  printf 'tampered\n' >> "$tmp/root/golang/PLAYBOOK_SECURITY.md"
  : > "$tmp/failures"
  check_tree "$tmp/root" "$tmp/failures" 2>/dev/null
  [[ -s "$tmp/failures" ]] || { echo "self-test: drift was not detected" >&2; exit 1; }

  rm -rf "$tmp/root/java"/*.md
  : > "$tmp/failures"
  check_tree "$tmp/root" "$tmp/failures" 2>/dev/null
  [[ -s "$tmp/failures" ]] || { echo "self-test: missing copies were not detected" >&2; exit 1; }

  echo "self-test: OK"
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
failures="$(mktemp)"
trap 'rm -f "$failures"' EXIT

check_tree "$ROOT" "$failures"

if [[ -s "$failures" ]]; then
  echo "check-playbook-copies: FAIL — $(wc -l < "$failures" | tr -d ' ') copy problem(s)." >&2
  echo "Fix: re-copy the root playbook into the kit; never edit a kit copy." >&2
  exit 1
fi

echo "check-playbook-copies: OK — $((${#CLIENT_KITS[@]} + ${#BACKEND_KITS[@]})) kits mirror their playbooks."
