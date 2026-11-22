---
name: "electron-security-check"
description: "Audits the <app> security posture on demand: webPreferences defaults on every window, navigation and protocol lockdown, the fuse table, secret handling, policy enforcement and the IPC surface, reporting a pass/fail matrix."
division: security
---

# `<app>` electron-security-check skill

> Reusable audit workflow for the `<app>` Electron app's hardening defaults.
> An agent invokes this skill; the skill reads the tree, checks every mandated
> control and reports a matrix — it does not fix, it reports.

## When to Activate

Activate this skill when a release is being prepared, a security-related change
landed, or someone asks "is the app still hardened?": a periodic posture
audit before signing and shipping.

Do NOT activate this skill when:

- A review of a specific diff is wanted — that is the reviewer agents' job
  (`security/electron-security-reviewer`), not this whole-tree audit.
- The request is to add a hardened window — build it correctly the first time;
  this skill only verifies.
- The request is about the update feed's external contract — flag it, but the
  sign-off belongs to the release checklist.

## Core Principles

- **Defaults are non-waivable.** The playbook's mandatory window and session
  hardening (`contextIsolation`, `sandbox`, `nodeIntegration` false,
  `webSecurity`, no popups) holds on every `BrowserWindow`, including
  background ones.
- **The renderer is hostile.** Every IPC path is guarded by the PEP in main;
  the preload bridge exposes only the declared surface; no renderer global
  reaches node or the SDK.
- **Fail closed on secrets.** `safeStorage` through `assertUsableBackend`
  rejects the Linux `basic_text` backend unless policy explicitly allows it;
  tokens never appear in logs, storage files or crash dumps.
- **Packaging closes the binary.** The fuse table and `OnlyLoadAppFromAsar`
  with ASAR integrity validation are applied at packaging time, before
  signing.
- **Claims carry sources or `(verify)`.** No fabricated version, vendor or
  platform fact, ever.

## Rules

- Check the actual tree, not memory: read every `BrowserWindow` call site, the
  `will-navigate`/`setWindowOpenHandler` wiring, `src/main/app-protocol.ts`,
  `forge.config.ts`, the secret adapter and the PEP.
- Report each mandated control as `enforced`, `missing` or `only-if`
  (condition stated); a `missing` critical control blocks the audit.
- Search for bypass shapes: any `ipcMain.on` outside the brokered path, any
  `webContents.executeJavaScript`, `loadURL` of remote content, `file://`
  loads, `allowpopups`, or `disablewebsecurity`.
- Do not fix while auditing; report first. Fixes become their own reviewed
  change.
- Every finding names the file and line and the concrete exploit path.
- No secret value appears in the report.

## Research References

| Claim | Source | Year | Link |
|-------|--------|------|------|
| Threat model and threat ranking | `PLAYBOOK_DESKTOP_ELECTRON.md` §12.1 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| Mandatory window and session hardening defaults | `PLAYBOOK_DESKTOP_ELECTRON.md` §12.2 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| Fuses, ASAR integrity and the packaging step | `PLAYBOOK_DESKTOP_ELECTRON.md` §12.3, Appendix D | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| Secrets and the safeStorage adapter | `PLAYBOOK_DESKTOP_ELECTRON.md` §12.4, Appendix I | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| Secure window factory and navigation lockdown sketch | `PLAYBOOK_DESKTOP_ELECTRON.md` Appendix A | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |

## Output Format

```
Security audit: <app> — <date>
Matrix:
  window hardening      <per-check: enforced | missing | only-if …>
  navigation/protocol   <enforced | missing …>
  IPC/PEP               <enforced | missing …>
  fuses/ASAR            <per-fuse value vs. mandated>
  secrets               <assertUsableBackend + storage paths>
  supply chain          <lockfile, cadence — (verify) markers>
Findings:
  [critical] <file>:<line> — <defect> — <exploit path>
  [major]    <file>:<line> — ...
  [minor]    <file>:<line> — ...
Verdict: PASS | FAIL — <one line>
(verify): <claims needing source confirmation, or none>
```
