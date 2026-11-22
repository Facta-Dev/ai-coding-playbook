# Support Matrix

The per-release table. It is a product artifact: when an operating system
leaves the supported set, the change is made here, not in a chat. The
reasoning, the floor profile and the budgets are in
[01 — Platform, Support & Budgets](01-platform-support-and-budgets.md).

> **Re-derive at every Electron upgrade** — OS support is the intersection of
> Chromium's floor and the vendor's window; it is never hard-coded. Electron
> facts below are for the pinned major, 45 ([verify-register.md](../../verify-register.md)).

## 1 · The Electron runtime

| Item | Value |
| --- | --- |
| Pinned major | **Electron 45** (exact, no caret) |
| Bundled Chromium | 156 |
| Bundled Node | 24 |
| Released | 2026-10-20 |
| Support window | latest three majors (45, 44, 43 today); a major reaches end of life ~6 months after release |
| Cadence | a new major every 8 weeks |
| End of support (pinned major) | ~2027-04 (≈6 months after 2026-10-20) |

## 2 · Minimum supported versions

| Platform | Minimum | Recommended | Architectures | Rationale |
| --- | --- | --- | --- | --- |
| **Windows** | 11 (a Chromium-supported build) **(verify per major)** | current 11 | x64, arm64 | Chromium sets the actual floor |
| **macOS** | **13 Ventura** (the Electron 44 floor **(verify)**) | current | x64, arm64 (per-arch builds) | Electron 44+ raised the floor to macOS 13 |
| **Ubuntu** | 22.04 LTS | 24.04 LTS | x64, arm64 | working sandbox, recent glibc |
| **Debian** | 12 Bookworm | 13 Trixie | x64, arm64 | recent glibc |
| **Fedora** | one current release **(verify)** | current | x64, arm64 | 13-month window |
| **RHEL / Rocky** | 9 **(verify)** | current | x64 | long vendor window |

Raising a platform floor is a change to this table and to
`PLAYBOOK_DESKTOP_ELECTRON §2.1`'s assumptions in the same pull request.

## 3 · Display servers and rendering

| Environment | Supported | Rendering path |
| --- | --- | --- |
| Windows desktop | Yes | GPU, or **software** in Compatibility Mode |
| macOS desktop | Yes | GPU, or **software** in Compatibility Mode |
| X11 on Linux | Yes | GL/ANGLE or the software path (`--disable-gpu`) |
| Wayland on Linux | Yes | native via `--ozone-platform-hint=auto` **(verify per Electron major; global shortcuts, capture and window positioning differ)** |
| RDP / VDI | Yes | **Software** (Compatibility Mode) |
| VM without a 3D device | Yes | **Software** (Compatibility Mode) |
| Headless / SSH console | No — no window to draw on | — |

software-rendering runs are part of e2e on all three OSes
([12](12-testing-and-ci.md)); a UI that is not fully usable in software
rendering is a bug, not a limitation.

## 4 · Explicitly unsupported

| Excluded | Reason |
| --- | --- |
| 32-bit Windows and Linux | No 32-bit Chromium/Node binaries in supported majors |
| Windows 7/8/8.1 | Outside the supported Chromium floor |
| macOS 12 Monterey and older | Electron 44+ requires macOS 13 |
| Electron majors older than 45 – 3 majors | Past end of support; never run one ([01](01-platform-support-and-budgets.md)) |
| `--no-sandbox` installs | A hardening violation, not a compatibility option ([09](09-security-fuses-csp-and-secrets.md)) |
| Running from a network share | Undefined locking/latency for the user data dir; install locally |
| Loading the UI over `file://` | The `app://` protocol is the only supported origin ([09](09-security-fuses-csp-and-secrets.md)) |

## 5 · The Floor and what it means here

| Profile | CPU | RAM | Storage | Graphics |
| --- | --- | --- | --- | --- |
| **Floor** | 2 cores ~2 GHz | 4 GB | SATA SSD | integrated GPU or software rendering |

Below the Floor, the honest answer is the Qt template
([§2.2 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)) — the
budgets in [01](01-platform-support-and-budgets.md) are not reachable there
by tuning.
