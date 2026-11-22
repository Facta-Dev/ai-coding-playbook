# 10 — Packaging, Signing & Updates

## The pipeline order is the security order

([§15](../PLAYBOOK_DESKTOP_ELECTRON.md))

```text
build → package → flip fuses → verify fuses → sign → notarize
      → verify signature/notarization → SBOM → publish
```

Fuses are flipped **before** signing; verification happens twice (raw and
signed artifact). A step done out of order silently produces an artifact
whose tamper protections can be undone by anyone with the app
([09](09-security-fuses-csp-and-secrets.md)).

## Forge in the kit

`forge.config.ts` is checked in, with the Fuses plugin and the fuse table
from [09](09-security-fuses-csp-and-secrets.md), `packagerConfig.asar:
true`, and a minimal maker set (zip + Squirrel for Windows + deb + rpm —
documented, extend with an ADR). Vite builds all four targets first
([ADR 0003](adr/0003-vite-multi-config-forge-fuses-and-node-sqlite.md)).

## Template gate

The template ships the packaging target but leaves it out of the default gate
(the Electron binary is not downloaded there):

```sh
pnpm install                                 # let the Electron binary download
make package                                 # electron-forge package
make fuses APP=out/<name>-linux-x64/<name>   # read the fuse table
```

Packaging and fuse verification are release steps, not unit gates; Windows and
macOS artifacts are produced on their own runners.

| OS | Primary artifact | Managed fleets | Notes |
| --- | --- | --- | --- |
| Windows | Squirrel (per-user, auto-update) | **MSI** per-machine | sign every `.exe/.dll/.node` and the installer; MSIX experimental **(verify)** |
| macOS | `.app` in **zip** (Squirrel.Mac) and DMG | **pkg** for MDM | Developer ID, hardened runtime, notarization + stapling; `safeStorage` and the updater depend on a signed app |
| Linux | `.deb`, `.rpm` | package repos | sandbox helper/AppArmor rules ([09](09-security-fuses-csp-and-secrets.md)); Flatpak/Snap optional |

x64 + arm64 on all three; no 32-bit.

## Signing

([§15.3](../PLAYBOOK_DESKTOP_ELECTRON.md)) Signing runs in a **dedicated CI
job** with isolated credentials and manual approval:

* **Windows**: Authenticode with timestamp; the key on hardware or a cloud
  HSM (for example Azure Artifact Signing); SmartScreen reputation planned.
* **macOS**: Developer ID via `@electron/osx-sign`, hardened runtime with
  minimal entitlements (per Electron's V8 docs), notarization via
  `@electron/notarize`, staple
* **Linux**: GPG-signed repos; detached signatures/checksums for tarballs.

## Updates

([§15.4](../PLAYBOOK_DESKTOP_ELECTRON.md)) Channels (`canary`, `beta`,
`stable`), staged rollout with auto-halt, background checks throttled by
policy, apply-on-restart, previous version kept for **rollback**; never
update mid-critical-operation without consent (Windows cannot replace a
running exe — the updater's staged swap handles it).

The **platform signature is necessary but not sufficient**: a signed
manifest layer we control (Ed25519; version, channel, platform/arch, URL,
hash, size, min OS, `minSupportedVersion`, cohort) is verified **before** the
updater is allowed to fetch; non-monotonic versions are rejected. Admin
control maps to the policy keys: disable/defer/pin/mirror.

## Known gap: the updater is specified, not implemented

The kit ships the fuses, the packaging config and the manifest contract in
the docs — **no `autoUpdater`/`electron-updater` wiring, no feed host, no
manifest signer and no update smoke test**. Connecting a real updater is
product work: it needs a hosted feed, an Ed25519 signing key, a rollout plan
and e2e coverage of the update flow. Until then the shipped artifacts update
the way their platform's installer does — which is "not at all", and that is
an honest gap, not a hidden one.

## Supply chain

([§15.2](../PLAYBOOK_DESKTOP_ELECTRON.md) and §2.6 of the same file)

* Exact-pinned Electron major; lockfile; frozen installs.
* The **SBOM includes the bundled Chromium/Node/Electron versions**
  (CVE feeds key off them) plus the npm tree; the license report covers
  Chromium/ffmpeg notices.
* Native modules — the kit has **zero by design** (`node:sqlite` fallback in
  [08](08-storage-outbox-and-offline.md)); adding one requires an ADR, an
  ABI rebuild, ASAR unpacking and signing.
* A release-age cooldown on new dependency versions is recommended by the
  playbook's threat model ([§12.1](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Do / don't

| Do | Don't |
| --- | --- |
| Verify fuses from the packaged output in CI | Flip fuses after signing, or "verify later" |
| Keep the last version for rollback | Let the updater treat downgrades as valid |
| Treat Chromium/Node as dependency versions (SBOM + CVE watch) | Ship an Electron major past end of support |

## See also

- [09 — Security](09-security-fuses-csp-and-secrets.md) — the fuse table
- [01 — Platform, Support & Budgets](01-platform-support-and-budgets.md) — the cadence
- [§15 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)
