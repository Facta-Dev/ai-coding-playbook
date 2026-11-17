#!/usr/bin/env python3
"""Deterministic checks for the playbook set.

Checks every root `PLAYBOOK_*.md` against `manifest.json`: required front
matter, manifest coverage, dependency ids, relative links, cross-references and
the 40,000-char split threshold. External facts are not verified; they live in
`verify-register.md` with an owner and a due date.

Usage:
    python3 scripts/playbook-lint.py
    python3 scripts/playbook-lint.py --self-test
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {
    "id",
    "version",
    "status",
    "last_reviewed",
    "review_cadence_days",
    "owner",
    "depends_on",
}
FM_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
REF_RE = re.compile(r"`(PLAYBOOK_[A-Z0-9_]+\.md)`")
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
STATUSES = {"draft", "active", "deprecated"}
CADENCE = {"fast": 60, "medium": 90, "slow": 180}


def frontmatter(text: str) -> dict[str, str]:
    match = FM_RE.match(text)
    if not match:
        return {}
    meta: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line or line.lstrip().startswith("#"):
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip("'\"")
    return meta


def deps(value: str) -> list[str]:
    return [part.strip() for part in value.strip("[]").split(",") if part.strip()]


def load_manifest(root: Path) -> tuple[dict[str, dict[str, object]], list[str]]:
    path = root / "manifest.json"
    if not path.is_file():
        return {}, ["manifest.json is missing"]
    try:
        data = json.loads(path.read_text())
    except ValueError as exc:
        return {}, [f"manifest.json is invalid JSON: {exc}"]
    entries: dict[str, dict[str, object]] = {}
    errors: list[str] = []
    for entry in data.get("playbooks", []):
        pid = str(entry.get("id", ""))
        name = str(entry.get("file", ""))
        if not pid or not name:
            errors.append("manifest entry without id/file")
            continue
        if pid in entries:
            errors.append(f"manifest: duplicate id {pid}")
        entries[pid] = entry
    return entries, errors


def lint_tree(root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    manifest, manifest_errors = load_manifest(root)
    errors.extend(manifest_errors)

    playbooks = sorted(root.glob("PLAYBOOK_*.md"))
    seen_files = {str(entry.get("file")) for entry in manifest.values()}

    for path in playbooks:
        text = path.read_text()
        meta = frontmatter(text)
        missing = REQUIRED - set(meta)
        if missing:
            errors.append(f"{path.name}: missing front matter: {', '.join(sorted(missing))}")
            continue

        pid = meta["id"]
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", pid):
            errors.append(f"{path.name}: id {pid!r} is not UPPER_SNAKE_CASE")
        if meta["status"] not in STATUSES:
            errors.append(f"{path.name}: status {meta['status']!r} not in {sorted(STATUSES)}")
        if not SEMVER.match(meta["version"]):
            errors.append(f"{path.name}: version {meta['version']!r} is not semver")
        try:
            reviewed = date.fromisoformat(meta["last_reviewed"])
        except ValueError:
            errors.append(f"{path.name}: last_reviewed is not an ISO date")
        else:
            try:
                cadence = int(meta["review_cadence_days"])
            except ValueError:
                errors.append(f"{path.name}: review_cadence_days is not an integer")
            else:
                if (date.today() - reviewed).days > cadence:
                    warnings.append(
                        f"{path.name}: review overdue ({(date.today() - reviewed).days}d > {cadence}d)"
                    )
        if pid not in manifest:
            errors.append(f"{path.name}: id {pid} is not in manifest.json")
        if path.name not in seen_files:
            errors.append(f"{path.name}: file is not in manifest.json")
        for dep in deps(meta["depends_on"]):
            if dep not in manifest:
                errors.append(f"{path.name}: depends_on {dep} is not in manifest.json")

        body = FM_RE.sub("", text, count=1)
        for target in LINK_RE.findall(body):
            if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I) or target.startswith(("#", "//")):
                continue
            clean = target.split("#", 1)[0]
            if not clean:
                continue
            resolved = (path.parent / clean).resolve()
            if not resolved.exists():
                errors.append(f"{path.name}: broken link {target!r}")
        for ref in set(REF_RE.findall(body)):
            if not (root / ref).is_file():
                errors.append(f"{path.name}: missing playbook reference {ref!r}")
        size = len(text.encode())
        if size > 40000:
            warnings.append(f"{path.name}: {size} chars > 40000; split by concern")

    for pid, entry in manifest.items():
        name = str(entry.get("file"))
        if not (root / name).is_file():
            errors.append(f"manifest: {pid} points at missing file {name}")

    if not (root / "verify-register.md").is_file():
        warnings.append("verify-register.md is missing")
    return errors, warnings


def self_test() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "manifest.json").write_text(
            json.dumps(
                {
                    "set": "test",
                    "playbooks": [
                        {"id": "A", "file": "PLAYBOOK_A.md"},
                        {"id": "B", "file": "PLAYBOOK_B.md"},
                    ],
                }
            )
        )
        fm = (
            "---\nid: A\nversion: 1.0.0\nstatus: active\n"
            "last_reviewed: 2026-11-17\nreview_cadence_days: 180\n"
            "owner: test\ndepends_on: []\n---\n\n"
        )
        (root / "PLAYBOOK_A.md").write_text(fm + "# A\n\nSee `PLAYBOOK_B.md`.\n")
        (root / "PLAYBOOK_B.md").write_text(
            fm.replace("id: A", "id: B") + "# B\n\n[back](PLAYBOOK_A.md)\n"
        )
        (root / "verify-register.md").write_text("# register\n")
        errors, _warnings = lint_tree(root)
        if errors:
            print("self-test: clean tree reported errors:", errors, file=sys.stderr)
            return 1

        (root / "PLAYBOOK_B.md").write_text("# B\n")
        errors, _warnings = lint_tree(root)
        if not any("missing front matter" in e for e in errors):
            print("self-test: missing front matter was not detected", file=sys.stderr)
            return 1

        (root / "PLAYBOOK_B.md").write_text(
            fm.replace("id: A", "id: B") + "# B\n\n[broken](does-not-exist.md)\n"
        )
        errors, _warnings = lint_tree(root)
        if not any("broken link" in e for e in errors):
            print("self-test: broken link was not detected", file=sys.stderr)
            return 1

    print("self-test: OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()

    errors, warnings = lint_tree(ROOT)
    for warning in warnings:
        print(f"WARN  {warning}")
    for error in errors:
        print(f"ERROR {error}", file=sys.stderr)
    if errors:
        print(f"playbook-lint: FAIL — {len(errors)} error(s), {len(warnings)} warning(s).")
        return 1
    print(f"playbook-lint: OK — {len(list(ROOT.glob('PLAYBOOK_*.md')))} playbooks, {len(warnings)} warning(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
