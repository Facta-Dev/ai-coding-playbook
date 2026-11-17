#!/usr/bin/env python3
"""Pin every GitHub Action in the kit workflows to a commit SHA.

A mutable tag (`@v4`, `@stable`, `@nextest`) is a supply-chain risk: the tag
can be moved under us. This tool resolves the ref with `git ls-remote`, writes
`owner/repo@<sha> # <ref>`, and is idempotent. A 40-hex ref is already pinned.

Usage:
    python3 scripts/claude-kit/pin-actions.py            # rewrite
    python3 scripts/claude-kit/pin-actions.py --check    # report only
    python3 scripts/claude-kit/pin-actions.py --root=DIR
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

USES_RE = re.compile(r"^(\s*(?:-\s+)?uses:\s*)([^@\s]+)@([^\s#]+)(\s*(?:#.*)?)$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
SKIP = ("docker://", "./", "../")
# These actions read the ref after `@` as an input, not as a version: pinning
# them to a SHA would change the toolchain/tool they install. Keep the
# semantic ref and review the action repository itself.
SEMANTIC_REF = {"dtolnay/rust-toolchain", "taiki-e/install-action"}


def resolve(repo: str, ref: str) -> str | None:
    url = f"https://github.com/{repo}"
    try:
        out = subprocess.run(
            ["git", "ls-remote", url, f"refs/tags/{ref}", f"refs/tags/{ref}^{{}}", f"refs/heads/{ref}"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        ).stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    peeled: str | None = None
    tag: str | None = None
    head: str | None = None
    for line in out.splitlines():
        sha, _, name = line.partition("\t")
        if name == f"refs/tags/{ref}^{{}}":
            peeled = sha
        elif name == f"refs/tags/{ref}":
            tag = sha
        elif name == f"refs/heads/{ref}":
            head = sha
    return peeled or tag or head


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[2]))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    root = Path(args.root)
    workflows = sorted(root.glob("*/.github/workflows/*.yml")) + sorted(
        root.glob(".github/workflows/*.yml")
    )
    if not workflows:
        print("pin-actions: no workflows found", file=sys.stderr)
        return 1

    cache: dict[tuple[str, str], str | None] = {}
    unpinned = 0
    changed = 0
    for workflow in workflows:
        lines = workflow.read_text().splitlines(keepends=True)
        out: list[str] = []
        dirty = False
        for line in lines:
            match = USES_RE.match(line.rstrip("\n"))
            if (
                not match
                or match.group(2).startswith(SKIP)
                or match.group(2) in SEMANTIC_REF
                or SHA_RE.match(match.group(3))
            ):
                out.append(line)
                continue
            repo, ref = match.group(2), match.group(3)
            key = (repo, ref)
            if key not in cache:
                cache[key] = resolve(repo, ref)
            sha = cache[key]
            if sha is None:
                print(f"WARN  could not resolve {repo}@{ref}", file=sys.stderr)
                out.append(line)
                continue
            unpinned += 1
            if args.check:
                print(f"UNPINNED {workflow.relative_to(root)}: {repo}@{ref}", file=sys.stderr)
                out.append(line)
                continue
            newline = f"{match.group(1)}{repo}@{sha}  # {ref}\n"
            out.append(newline)
            dirty = True
        if dirty:
            workflow.write_text("".join(out))
            changed += 1
            print(f"pinned {workflow.relative_to(root)}")

    if args.check:
        if unpinned:
            print(f"pin-actions: FAIL — {unpinned} mutable action ref(s).")
            return 1
        print("pin-actions: OK — every version ref is pinned (semantic refs exempt).")
        return 0
    print(f"pin-actions: {changed} workflow(s) updated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
