#!/usr/bin/env python3
"""PreToolUse gate: route source reads and symbol greps through CodeGraph.

Read:  the first read of an indexed file is denied once per session with the
       exact `codegraph node -f` call, which returns the same line-numbered
       source plus dependents. The retry passes, so nothing can loop.
Bash:  `rg`/`grep`/`ag` for a bare identifier that exists in the index is
       denied once with the `codegraph explore` call.

Fail-open everywhere: no index, unknown tool, timeout, any error -> allow.
Kill switch: CODEGRAPH_GATE=off.
"""

import hashlib
import json
import os
import re
import shlex
import sqlite3
import sys

DENY_CAP = 60
STATE_ROOT = os.path.join(os.path.expanduser("~"), ".cache", "codegraph-gate")
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{2,}$")
GREP_LIKE = re.compile(r"^\s*(?:sudo\s+)?(rg|grep|ag)\b(.*)$", re.S)


def allow():
    sys.exit(0)


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def find_index(start):
    path = os.path.abspath(start or ".")
    for _ in range(6):
        db = os.path.join(path, ".codegraph", "codegraph.db")
        if os.path.isfile(db):
            return path, db
        parent = os.path.dirname(path)
        if parent == path:
            return None, None
        path = parent
    return None, None


def state_file(session_id):
    os.makedirs(STATE_ROOT, exist_ok=True)
    return os.path.join(STATE_ROOT, hashlib.sha1(session_id.encode()).hexdigest() + ".json")


def load_state(session_id):
    try:
        with open(state_file(session_id)) as fh:
            state = json.load(fh)
        if isinstance(state, dict) and "denies" in state:
            return state
    except (OSError, ValueError):
        pass
    return {"denies": 0, "keys": []}


def save_state(session_id, state):
    try:
        with open(state_file(session_id), "w") as fh:
            json.dump(state, fh)
    except OSError:
        pass


def first_deny(session_id, key):
    """True when this (session, key) has not been denied before."""
    state = load_state(session_id)
    if state["denies"] >= DENY_CAP or key in state["keys"]:
        return False
    state["denies"] += 1
    state["keys"].append(key)
    save_state(session_id, state)
    return True


def gate_read(payload, root, db):
    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    if not file_path:
        return
    abs_path = os.path.abspath(file_path)
    try:
        rel = os.path.relpath(abs_path, root)
    except ValueError:
        return
    if rel.startswith(".."):
        return
    with sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=0.2) as conn:
        if conn.execute("SELECT 1 FROM files WHERE path = ? LIMIT 1", (rel,)).fetchone() is None:
            return
    if not first_deny(payload.get("session_id", ""), "read:" + rel):
        return
    deny(
        f"'{rel}' is in the CodeGraph index. Call `codegraph node -p {root} -f {rel}` "
        "(or codegraph explore for its symbols): same line-numbered source plus "
        "dependents, a fraction of the tokens. Repeat the Read only if you need "
        "the raw bytes."
    )


def gate_bash(payload, root, db):
    cmd = (payload.get("tool_input") or {}).get("command") or ""
    if "codegraph" in cmd or cmd.lstrip().startswith("rtk "):
        return
    m = GREP_LIKE.match(cmd)
    if not m:
        return
    try:
        args = shlex.split(m.group(2))
    except ValueError:
        return
    pattern = next((a for a in args if not a.startswith("-")), "")
    if not IDENT.match(pattern) or os.path.exists(pattern):
        return
    with sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=0.2) as conn:
        if conn.execute("SELECT 1 FROM nodes WHERE name = ? LIMIT 1", (pattern,)).fetchone() is None:
            return
    if not first_deny(payload.get("session_id", ""), "grep:" + pattern):
        return
    deny(
        f"'{pattern}' is an indexed symbol. Call `codegraph explore -p {root} \"{pattern}\"` "
        "(verbatim source + call paths + blast radius in one call) before grepping."
    )


def main():
    if os.environ.get("CODEGRAPH_GATE") == "off":
        allow()
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        allow()
    tool = payload.get("tool_name") or ""
    if tool not in ("Read", "Bash"):
        allow()
    root, db = find_index(payload.get("cwd") or os.getcwd())
    if not db:
        allow()
    if tool == "Read":
        gate_read(payload, root, db)
    else:
        gate_bash(payload, root, db)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        allow()
    allow()
