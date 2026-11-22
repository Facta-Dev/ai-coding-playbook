# 09 — Security: Fuses, CSP & Secrets

Aligned with [`PLAYBOOK_SECURITY.md`](../PLAYBOOK_SECURITY.md) and Electron's
security checklist; threat model and hardening in
[§12](../PLAYBOOK_DESKTOP_ELECTRON.md). This chapter is the checklist
shape.

## Layered threats, layered controls

| Threat | Controls (in this kit) |
| --- | --- |
| Compromised renderer (XSS) | sandbox + context isolation, CSP `connect-src 'none'`, narrow typed bridge, main/core re-authorize |
| IPC abuse | allowlisted types, sender verification in `main/ipc-policy.ts`, per-window capabilities, `.strict()` schemas, size limits |
| Malicious navigation | `will-navigate` locked to `app://`, `setWindowOpenHandler` denies, `shell.openExternal` allowlist only |
| Local tampering (edit `app.asar`, flip flags) | **fuses**, ASAR integrity + `OnlyLoadAppFromAsar`, code signing, signed updates |
| Token/secret theft | `safeStorage`, tokens in core memory only, `basic_text` refused on Linux |
| Supply chain (npm tree + bundled Chromium/Node) | exact-pinned Electron, lockfile, frozen installs, SCA/SBOM, 8-week cadence |
| Update hijack/downgrade | signed manifest layer, monotonic versions, platform signature checks |

## Window hardening — mandatory defaults

`src/main/windows.ts` sets, for **every** window
([§12.2](../PLAYBOOK_DESKTOP_ELECTRON.md)):

`contextIsolation: true` · `sandbox: true` · `nodeIntegration: false` ·
`nodeIntegrationInWorker: false` · `webviewTag: false` · `webSecurity: true` ·
`allowRunningInsecureContent: false` · `safeDialogs: true` ·
`devTools: !app.isPackaged`.

Permission requests and checks are **denied by default**
(`session.setPermissionRequestHandler`/`setPermissionCheckHandler`); a
window type gains only what a slice requires (clipboard-write,
notifications). TLS verification is never relaxed. The per-window capability
lists live in `src/main/window-registry.ts` and are consumed by the PEP
([06](06-ipc-and-preload.md)).

## Content loading and CSP

The **`app://`** protocol (`src/main/app-protocol.ts`, `protocol.handle`)
serves the packaged ASAR. Never `file://`, never remote code
([§12.2](../PLAYBOOK_DESKTOP_ELECTRON.md)). The handler sets the CSP
response header:

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://<cdn>;
font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none';
base-uri 'none'; form-action 'none'
```

`connect-src 'none'` is the point: a renderer has no network of its own —
all backend traffic is core's, behind the SDK. Server-supplied strings are
rendered as text, never `dangerouslySetInnerHTML`
([§12.6](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Fuses — flipped in packaging, before signing

`forge.config.ts` wires the Fuses plugin with exactly this table
([§12.3](../PLAYBOOK_DESKTOP_ELECTRON.md)):

| Fuse | Value |
| --- | --- |
| `RunAsNode` | **off** (never let the app become a plain Node runtime) |
| `EnableNodeOptionsEnvironmentVariable` | **off** |
| `EnableNodeCliInspectArguments` | **off** |
| `EnableCookieEncryption` | **on** |
| `EnableEmbeddedAsarIntegrityValidation` | **on** (macOS/Windows; **not available on Linux** — do not claim it there) |
| `OnlyLoadAppFromAsar` | **on** |
| `GrantFileProtocolExtraPrivileges` | **off** |

CI reads the fuses back from the packaged output (`@electron/fuses`) and
fails on drift, **before** signing ([10](10-packaging-signing-and-updates.md)).
ASAR integrity detects tampering with the archive; it does not hide code
(macOS support since Electron 16, Windows since 30 — (verify per version)).

## Secrets

| Secret | Handling |
| --- | --- |
| Refresh tokens, local-DB wrap keys | `safeStorage` ciphertext; never plaintext files, never a renderer |
| Tenant provider keys | never on the desktop (invariant I-15) |
| Update signing key | KMS/HSM, separate from the code-signing identity |
| Code-signing keys | hardware/cloud-protected; never on CI runners or dev machines |

`platform/secrets/safe-storage.ts` keeps the **pure** decision
(`assertUsableBackend(platform, backend, policy)`) separate from the
Electron `safeStorage` calls, so the rule is unit-tested without Electron:
on Linux, `basic_text` is rejected unless policy explicitly allows it

## The Linux sandbox reality

Chromium's sandbox relies on user namespaces or a setuid helper; recent
distros may restrict them (example: AppArmor on current Ubuntu). **Never
ship or document `--no-sandbox` as a fix.** Ship `.deb`/`.rpm` with the
helper correctly set up (an AppArmor profile where the distro requires it)
or distribute Flatpak/Snap; test on current Ubuntu LTS, Fedora and a Wayland
session (verify distro behavior per release)
([§12.5](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## See also

- [06 — IPC & Preload](06-ipc-and-preload.md) — the turnstile
- [10 — Packaging, Signing & Updates](10-packaging-signing-and-updates.md)
- [§12 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md) — the
  full threat model table
