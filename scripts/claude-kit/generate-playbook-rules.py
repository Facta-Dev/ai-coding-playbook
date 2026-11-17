#!/usr/bin/env python3
"""Generate `.claude/rules/playbooks.md` in every kit.

The rule is path-scoped: it loads only when a file under the kit's code roots
is touched, points at the local playbooks, and never @-imports one. This is the
routing mechanism PLAYBOOK_MASTER §5.3 and README §3.3 describe.

Usage:
    python3 scripts/claude-kit/generate-playbook-rules.py
    python3 scripts/claude-kit/generate-playbook-rules.py --check
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

KITS: dict[str, dict[str, object]] = {
    "golang": {
        "paths": ["cmd/**", "internal/**", "migrations/**", "specs/**"],
        "arch": "PLAYBOOK_BACKEND.md",
        "stack": "PLAYBOOK_GOLANG.md",
    },
    "rust": {
        "paths": ["crates/**", "migrations/**", "specs/**"],
        "arch": "PLAYBOOK_BACKEND.md",
        "stack": "PLAYBOOK_RUST.md",
    },
    "nodejs": {
        "paths": ["src/**", "migrations/**", "specs/**"],
        "arch": "PLAYBOOK_BACKEND.md",
        "stack": "PLAYBOOK_NODEJS.md",
    },
    "python": {
        "paths": ["src/**", "migrations/**", "specs/**"],
        "arch": "PLAYBOOK_BACKEND.md",
        "stack": "PLAYBOOK_PYTHON.md",
    },
    "java": {
        "paths": ["src/**", "specs/**"],
        "arch": "PLAYBOOK_BACKEND.md",
        "stack": "PLAYBOOK_JAVA_J2EE.md",
    },
    "extension": {
        "paths": ["entrypoints/**", "src/**", "packages/**", "managed-schema.json"],
        "arch": "PLAYBOOK_FRONTEND.md",
        "stack": "PLAYBOOK_CHROME_EXTENSION.md",
    },
    "desktop": {
        "paths": ["src/**", "packages/**", "cmake/**"],
        "arch": "PLAYBOOK_FRONTEND.md",
        "stack": "PLAYBOOK_DESKTOP_QT.md",
    },
    "frontend-mobile": {
        "paths": ["app/**", "src/**", "packages/**"],
        "arch": "PLAYBOOK_FRONTEND.md",
        "stack": "PLAYBOOK_FRONTEND_MOBILE.md",
    },
    "mobile-android": {
        "paths": ["app/**", "src/**"],
        "arch": "PLAYBOOK_FRONTEND.md",
        "stack": "PLAYBOOK_MOBILE_ANDROID_KOTLIN.md",
    },
    "mobile-ios": {
        "paths": ["Sources/**", "Tests/**", "Packages/**"],
        "arch": "PLAYBOOK_FRONTEND.md",
        "stack": "PLAYBOOK_MOBILE_IOS_SWIFT.md",
    },
    "frontend": {
        "paths": ["src/**", "tests/**"],
        "arch": "PLAYBOOK_FRONTEND.md",
        "stack": None,
    },
    "cli": {
        "paths": ["src/**", "tests/**"],
        "arch": "PLAYBOOK_FRONTEND.md",
        "stack": "PLAYBOOK_CLI.md",
    },
}

SHARED = [
    "PLAYBOOK_SECURITY.md",
    "PLAYBOOK_TESTS.md",
    "PLAYBOOK_URLS.md",
    "PLAYBOOK_AUDIT.md",
    "PLAYBOOK_CLAUDE_CODE.md",
]


def render(kit: str, spec: dict[str, object]) -> str:
    paths = spec["paths"]
    assert isinstance(paths, list)
    arch = str(spec["arch"])
    stack = spec.get("stack")
    lines = [
        "---",
        "paths:",
        *(f'  - "{p}"' for p in paths),
        "---",
        "",
        f"# Playbooks for `{kit}` — load on demand",
        "",
        "Before editing a file under these paths, read the playbook that governs",
        "it. Do not `@`-import a playbook: this rule is the routing entry and the",
        "always-on instruction set stays inside the harness budget.",
        "",
    ]
    files: list[tuple[str, str]] = []
    if stack:
        files.append((str(stack), "the stack contract for this kit."))
    files.append((arch, "the shared architecture contract."))
    files.extend((name, "shared contract.") for name in SHARED)

    seen: set[str] = set()
    for name, description in files:
        if name in seen:
            continue
        seen.add(name)
        stem = name[:-3]
        parts = sorted(ROOT.glob(f"{stem}_PART*.md"))
        lines.append(f"- `{name}` — {description}")
        for part in parts:
            lines.append(f"  - `{part.name}` — part of `{name}`.")
    lines.extend(
        [
            "",
            "If a rule here contradicts a playbook, the playbook is the contract:",
            "change it in the same PR, then re-copy it into the kit.",
            "",
        ]
    )
    return "\n".join(lines)


def write(kit: str, spec: dict[str, object], *, check: bool) -> bool:
    target = ROOT / kit / ".claude" / "rules" / "playbooks.md"
    content = render(kit, spec)
    if check:
        if not target.is_file() or target.read_text() != content:
            print(f"drift: {target.relative_to(ROOT)}")
            return False
        return True
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    print(f"wrote {target.relative_to(ROOT)}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    ok = True
    for kit, spec in KITS.items():
        ok = write(kit, spec, check=args.check) and ok
    if not ok:
        print("generate-playbook-rules: FAIL — run without --check to regenerate.", file=sys.stderr)
        return 1
    print("generate-playbook-rules: OK" if args.check else "generate-playbook-rules: done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
