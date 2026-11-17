#!/usr/bin/env python3
"""Split an oversized playbook into numbered parts.

The 40,000-char warning in `playbook-lint.py` is for navigation, not a harness
hard limit (see docs/adr/0002-playbook-size-is-advisory.md). This tool performs
the split deterministically at `## ` section boundaries:

- `PLAYBOOK_X.md` keeps the preamble and the first sections, plus a Parts index.
- `PLAYBOOK_X_PARTn.md` carries the rest; each part keeps its original section
  numbers and links back to the main entry.
- `manifest.json` gains one entry per part.
- References such as `PLAYBOOK_X §9` are rewritten to the part that now holds
  section 9.

Usage:
    python3 scripts/split-playbook.py --dry-run
    python3 scripts/split-playbook.py
    python3 scripts/split-playbook.py --target=34000 --min-size=40000
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FM_END = "\n---\n"
SECTION_RE = re.compile(r"^## ")
NUMBER_RE = re.compile(r"^(\d+)[.\s]")
REF_PLAYBOOK = re.compile(r"(PLAYBOOK_[A-Z0-9_]+)(\s*§\s*)(\d+)")
REF_ID = re.compile(r"\b([A-Z][A-Z0-9_]{2,})(\s*§\s*)(\d+)")


def front_split(text: str) -> tuple[str, str]:
    if not text.startswith("---\n"):
        raise ValueError("missing front matter")
    end = text.find(FM_END, 4)
    if end < 0:
        raise ValueError("unterminated front matter")
    return text[4:end], text[end + len(FM_END):]


def meta(front: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in front.splitlines():
        if ":" not in line or line.lstrip().startswith("#"):
            continue
        key, _, value = line.partition(":")
        out[key.strip()] = value.strip().strip("'\"")
    return out


def sections(body: str) -> tuple[str, list[tuple[str, str]]]:
    preamble: list[str] = []
    found: list[tuple[str, str]] = []
    current: list[str] | None = None
    title = ""
    fence = False
    for line in body.splitlines(keepends=True):
        if line.lstrip().startswith("```"):
            fence = not fence
        if not fence and SECTION_RE.match(line):
            if current is not None:
                found.append((title, "".join(current)))
            current = [line]
            title = line.strip()[3:].strip()
        else:
            if current is None:
                preamble.append(line)
            else:
                current.append(line)
    if current is not None:
        found.append((title, "".join(current)))
    return "".join(preamble), found


def pack(preamble: str, found: list[tuple[str, str]], target: int) -> list[dict[str, object]]:
    parts: list[dict[str, object]] = [{"size": len(preamble.encode()), "sections": []}]
    for title, text in found:
        size = len(text.encode())
        if parts[-1]["sections"] and parts[-1]["size"] + size > target:  # type: ignore[operator]
            parts.append({"size": 0, "sections": []})
        parts[-1]["sections"].append((title, text))  # type: ignore[union-attr]
        parts[-1]["size"] = int(parts[-1]["size"]) + size  # type: ignore[arg-type]
    return parts


def covers(section_list: list[tuple[str, str]]) -> str:
    if not section_list:
        return "preamble"
    first = section_list[0][0]
    last = section_list[-1][0]
    text = first if first == last else f"{first} … {last}"
    if len(text) > 170:
        text = text[:167] + "…"
    return text.replace("|", "\\|")


def part_front(base_meta: dict[str, str], pid: str) -> str:
    deps = base_meta.get("depends_on", "[]").strip("[]")
    return (
        "---\n"
        f"id: {pid}\n"
        "version: 1.0.0\n"
        "status: active\n"
        f"last_reviewed: {base_meta.get('last_reviewed', '2026-11-17')}\n"
        f"review_cadence_days: {base_meta.get('review_cadence_days', '90')}\n"
        f"owner: {base_meta.get('owner', 'architecture')}\n"
        f"depends_on: [{base_meta.get('id', pid.rsplit('_PART', 1)[0])}]\n"
        "---\n\n"
    )


def split_file(path: Path, target: int, manifest: dict[str, object]) -> dict[str, int]:
    text = path.read_text()
    front, body = front_split(text)
    base_meta = meta(front)
    base_id = base_meta.get("id", path.stem.removeprefix("PLAYBOOK_"))
    preamble, found = sections(body)
    if not found:
        raise ValueError(f"{path.name}: no level-2 sections")
    parts = pack(preamble, found, target)
    if len(parts) == 1:
        return {}

    main_title = next(
        (line.lstrip("# ").strip() for line in preamble.splitlines() if line.startswith("# ")),
        base_id,
    )
    stem = path.stem
    total = len(parts)
    index_rows = ["## Parts", "", "This playbook is split so each file stays navigable. Sections keep",
                  "their original numbers; a reference to a section not in this file lives in a",
                  "sibling part.", "", "| Part | File | Covers |", "|---|---|---|"]
    for n, part in enumerate(parts, 1):
        name = path.name if n == 1 else f"{stem}_PART{n}.md"
        link = name
        index_rows.append(f"| {n} | [`{name}`]({link}) | {covers(part['sections'])} |")  # type: ignore[arg-type]
    index = "\n".join(index_rows) + "\n\n"

    for n, part in enumerate(parts, 1):
        sec_text = "".join(text for _title, text in part["sections"])  # type: ignore[union-attr]
        if n == 1:
            pre_lines = preamble.splitlines(keepends=True)
            h1_index = next(
                (i for i, line in enumerate(pre_lines) if line.startswith("# ")),
                0,
            )
            new_body = (
                "".join(pre_lines[: h1_index + 1])
                + "\n"
                + index
                + "".join(pre_lines[h1_index + 1:])
                + sec_text
            )
            if total > 1:
                new_body = new_body.rstrip() + (
                    f"\n\n---\n\n> Continues in [`{stem}_PART2.md`]({stem}_PART2.md).\n"
                )
            path.write_text("---\n" + front + FM_END + new_body)
        else:
            pid = f"{base_id}_PART{n}"
            header = (
                part_front(base_meta, pid)
                + f"# {stem}_PART{n}.md — {main_title} (part {n})\n\n"
                + f"> Part {n} of {total}. Main entry: [`{path.name}`]({path.name}). "
                + f"Covers: {covers(part['sections'])}.\n\n"
            )
            tail = ""
            if n < total:
                tail = f"\n---\n\n> Continues in [`{stem}_PART{n + 1}.md`]({stem}_PART{n + 1}.md).\n"
            (path.parent / f"{stem}_PART{n}.md").write_text(header + sec_text + tail)

    # manifest: one entry per part, cloned from the main entry
    entries = manifest.get("playbooks", [])
    assert isinstance(entries, list)
    base_entry = next((e for e in entries if e.get("file") == path.name), None)
    if base_entry is not None:
        additions = []
        for n in range(2, total + 1):
            clone = dict(base_entry)
            clone["id"] = f"{base_id}_PART{n}"
            clone["file"] = f"{stem}_PART{n}.md"
            clone["depends_on"] = [base_id]
            additions.append(clone)
        idx = entries.index(base_entry) + 1
        entries[idx:idx] = additions

    # section number -> part index, for the reference rewrite
    section_map: dict[int, int] = {}
    for n, part in enumerate(parts, 1):
        for title, _text in part["sections"]:  # type: ignore[union-attr]
            match = NUMBER_RE.match(str(title))
            if match:
                section_map[int(match.group(1))] = n
    return section_map


def rewrite_refs(section_maps: dict[str, dict[int, int]]) -> int:
    changed = 0
    paths = list(ROOT.glob("*.md")) + list(ROOT.glob("docs/**/*.md"))
    for kit in [p for p in ROOT.iterdir() if p.is_dir() and p.name not in {"node_modules", ".git"}]:
        paths.extend(kit.glob("*.md"))
        paths.extend(kit.glob("docs/**/*.md"))
        paths.extend(kit.glob(".claude/**/*.md"))
    for path in sorted(set(paths)):
        if "node_modules" in path.parts or ".venv" in path.parts:
            continue
        text = path.read_text()
        original = text

        def playbook_repl(match: re.Match[str]) -> str:
            name, sep, num = match.group(1), match.group(2), int(match.group(3))
            stem = name.removeprefix("PLAYBOOK_")
            if stem in section_maps and section_maps[stem].get(num, 1) > 1:
                return f"PLAYBOOK_{stem}_PART{section_maps[stem][num]}{sep}{num}"
            return match.group(0)

        def id_repl(match: re.Match[str]) -> str:
            ident, sep, num = match.group(1), match.group(2), int(match.group(3))
            if ident in section_maps and section_maps[ident].get(num, 1) > 1:
                return f"{ident}_PART{section_maps[ident][num]}{sep}{num}"
            return match.group(0)

        text = REF_PLAYBOOK.sub(playbook_repl, text)
        text = REF_ID.sub(id_repl, text)
        if text != original:
            path.write_text(text)
            changed += 1
    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=34000)
    parser.add_argument("--min-size", type=int, default=40000)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    manifest_path = ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    section_maps: dict[str, dict[int, int]] = {}
    planned = []
    for path in sorted(ROOT.glob("PLAYBOOK_*.md")):
        if path.name in {e.get("file") for e in manifest.get("playbooks", []) if "_PART" in str(e.get("id"))}:
            continue
        if len(path.read_text().encode()) <= args.min_size:
            continue
        front, body = front_split(path.read_text())
        base_id = meta(front).get("id", path.stem.removeprefix("PLAYBOOK_"))
        preamble, found = sections(body)
        parts = pack(preamble, found, args.target)
        planned.append(
            (
                path.name,
                base_id,
                [int(p["size"]) for p in parts],
                [covers(p["sections"]) for p in parts],  # type: ignore[arg-type]
            )
        )
        if not args.dry_run:
            section_maps[base_id] = split_file(path, args.target, manifest)

    for name, base_id, sizes, titles in planned:
        print(f"{name}: {len(sizes)} parts; sizes={sizes}")
        for i, title in enumerate(titles, 1):
            print(f"  part {i}: {title}")

    if args.dry_run:
        return 0

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    changed = rewrite_refs(section_maps)
    print(f"split-playbook: {len(planned)} playbook(s), {changed} file(s) with rewritten refs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
