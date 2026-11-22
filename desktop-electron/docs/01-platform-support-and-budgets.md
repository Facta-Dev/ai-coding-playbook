# 01 — Platform, Support & Budgets

## The runtime facts

Electron **45** is the latest supported stable major: **Chromium 156**, built
against **Node 24**, released **2026-10-20**. A new major ships **every eight
weeks**, only the **latest three majors** are supported, and each major
reaches end of life about six months after release. Electron **44+ requires
macOS 13 or later**. Anything version-specific in this document that was not
reconfirmed at the source is marked **(verify)** — the full verify register
lives in the root [`verify-register.md`](../../verify-register.md).

The kit pins an **exact** Electron major in `package.json`, never a caret:
a caret silently moves you onto a Chromium/Node bundle your fuse and
signature verification was never tested against ([§2.6](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## OS support = the intersection

Support is the intersection of the Electron/Chromium supported OS list and
the vendor-supported window; it is re-derived at every Electron upgrade, not
hard-coded. The per-release table is [`support-matrix.md`](support-matrix.md):
minimum OS, architectures, display servers (X11 **and** Wayland on Linux),
end of support, and the Electron major the release pins.

| Platform | Minimum | Architectures | Notes |
| --- | --- | --- | --- |
| Windows | A Chromium-supported Windows 11 ¹ | x64, arm64 | No 32-bit |
| macOS | 13 Ventura (Electron 44 floor) ¹ | x64, arm64 | Per-arch; universal only if distribution requires |
| Linux | A recent glibc, working sandbox, GTK/Wayland or X11 ¹ | x64, arm64 | Sandbox reality in [09](09-security-fuses-csp-and-secrets.md) |

¹ (verify per major against the Electron release notes; Chromium sets the
actual floor.)

## The hardware floor

Electron embeds Chromium. Be explicit about what that costs
([§2.2](../PLAYBOOK_DESKTOP_ELECTRON.md)):

| Profile | CPU | RAM | Storage | Graphics | Display |
| --- | --- | --- | --- | --- | --- |
| **Floor** | 2 cores, ~2 GHz | **4 GB** | SATA SSD | Integrated GPU or software rendering | 1366×768 |
| **Typical** | 4 cores | 8 GB | SSD | Integrated | 1920×1080, 125% dpi |

Below the Floor (2 GB RAM, HDD-only, pre-Windows-10 fleets) Electron cannot
meet the budgets — that is the decision the Qt template exists for
([§1 D1](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Budgets (starting points, calibrated on the Floor runner)

| Metric | Budget |
| --- | --- |
| Cold start to first usable window (SSD) | ≤ 2.5 s; ≤ 4 s on HDD |
| Warm start | ≤ 1.2 s |
| Main-process event-loop block | ≤ 16 ms typical, ≤ 50 ms hard limit (watchdog) |
| Renderer long tasks in primary flows | none > 50 ms; lists virtualized |
| Idle CPU | ≈ 0% — no timers, polling or animation without need |
| Idle RAM, single window, warm | ≤ ~300 MB across all processes |
| Idle RAM per additional window | ≤ ~100 MB; windows are destroyed, not hidden |
| 8 h soak memory growth | ≈ 0 |
| Realtime burst (1,000 events/s) | UI coalesced to ≤ 30 Hz, no stall |

([§2.3](../PLAYBOOK_DESKTOP_ELECTRON.md).) The perf job compares against the
last release and fails on regression ([12](12-testing-and-ci.md)); budgets are
**starting points to calibrate on your own hardware**, not truth handed down.

## Why the budgets are cheap here

Most of them are bought by structure, not tuning: the main process stays thin
so the 50 ms loop limit is not fought in review; windows are created lazily
and destroyed; realtime is coalesced in the core before it reaches a
renderer. Where the structure does not buy a budget, the kit says so — see
the gap table in [00](00-overview-and-principles.md).

## The upgrade cadence (security-critical)

* Upgrade PR opened **within two weeks** of a new major; security patch
  releases adopted on a published SLA (7 days for high/critical
  Chromium/Node/Electron advisories).
* Every upgrade runs the full matrix (3 OS × x64/arm64 × X11/Wayland ×
  software/GPU) and a changelog review for preload/sandbox/fuses/API breaks.
* Native modules and tooling upgrade **in lockstep**; never run an
  unsupported major ([§2.6](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## No-GPU guarantee

Chromium's GPU process can fail on old drivers. The kit carries the safe-mode
contract from [§2.5](../PLAYBOOK_DESKTOP_ELECTRON.md): a Compatibility mode
(`HardwareAcceleration = off` policy → `app.disableHardwareAcceleration()`
before `app.ready`), automatic safe mode after repeated GPU `child-process-gone`
events, and a CI e2e smoke run in software rendering on all three OSes. GPU
safe-mode relaunch logic: [§G of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md).

## See also

- [`support-matrix.md`](support-matrix.md) — the per-release table itself
- [02 — Processes & Trust](02-processes-and-trust.md) — where the budgets are
  enforced structurally
- [10 — Packaging, Signing & Updates](10-packaging-signing-and-updates.md)
