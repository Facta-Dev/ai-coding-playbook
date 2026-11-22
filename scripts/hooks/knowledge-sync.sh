#!/usr/bin/env bash
# knowledge-sync.sh (PostToolUse) — after Write/Edit, refresh codegraph + graphify
# fire-and-forget so indexes never go stale; upgrade path: per-repo locks if stampede.
set -u
input=$(cat)
c=$(printf '%s' "$input" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("cwd") or "")' 2>/dev/null) || c=""
{ [ -n "$c" ] && [ -d "$c" ]; } || exit 0
git -C "$c" rev-parse --is-inside-work-tree 2>/dev/null | grep -q true || exit 0
(
  nohup flock -n /tmp/knowledge-sync.lock bash -c '
    sleep 2
    d="$1"
    if [ -d "$d/.codegraph" ]; then timeout 120 codegraph sync -q "$d" >/dev/null 2>&1; fi
    if [ -f "$d/graphify-out/graph.json" ]; then timeout 240 graphify update "$d" >/dev/null 2>&1; fi
  ' bash "$c" >/dev/null 2>&1 &
) 2>/dev/null
exit 0
