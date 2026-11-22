# Permissions Register

Two registers in one file: what the app may do **inside the IPC/OS
boundary**, and what a user's **backend permissions** may unlock. They are
separate on purpose — OS/IPC capability is about what code may reach;
backend permissions are about what the signed-in human may do. The URL never
authorizes ([PLAYBOOK_URLS.md](../PLAYBOOK_URLS.md)).

## 1 · IPC capability table (window kind → IPC types)

From `src/contracts/ipc.ts`; enforced by the PEP
(`src/main/ipc-policy.ts`):

| IPC type | Request schema | Response | Windows allowed |
| --- | --- | --- | --- |
| `notes.list` | `{}` (strict) | `NoteDto[]` | `main` |
| `notes.add` | `{ title 1..120, body 0..10000 }` (strict) | `NoteDto` | `main` |
| `session.get` | `{}` (strict) | `{ permissions: string[] }` | `main`, `settings` |

Rules for the table ([§5.1 of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md)):

* A window kind not listed is rejected before the payload is parsed.
* The `settings` window may read the session but may not mutate notes —
  capability, not convenience.
* New types extend this table, get a `.strict()` schema and a PEP test in
  the same change ([06](06-ipc-and-preload.md)).

## 2 · Chromium permission handlers (renderer → OS/browser APIs)

`session.setPermissionRequestHandler` / `setPermissionCheckHandler`
**deny by default** (`src/main/windows.ts`); the register lists everything a
window may be granted. Anything not here is denied.

| Permission | Granted | Rationale |
| --- | --- | --- |
| `clipboard-sanitized-write` | `main` window, on user gesture | copy from the list |
| Notifications | not granted by default | a slice that notifies adopts it explicitly ([§11 of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md)) |
| geolocation, camera, microphone, MIDI, sensors, pointer lock, screen capture | **never** | no desktop slice needs them; a request is a review finding |
| open external links | never via permission — `shell.openExternal` with a scheme/host allowlist only ([§7](../PLAYBOOK_DESKTOP_ELECTRON.md)) | |

## 3 · Deep links and file associations (untrusted input)

| Surface | Handled in | Rules |
| --- | --- | --- |
| `heimdall://…` deep links | main, strict parser | route allowlist, ID validation, size limits, **no actions**; state-changing routes need UI confirmation + session ([§7 of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md)) |
| File associations / drag-drop | a utility process | parsed, never executed |

## 4 · OS integration surfaces used

| Capability | Where | Backend permission involved |
| --- | --- | --- |
| `safeStorage` sealing (refresh token) | `platform/secrets/safe-storage.ts` | none — local |
| Tray/notifications/autostart | `platform/` adapters | none; graceful fallback when unavailable |
| Protocol registration (`heimdall://`) | installer/main | none |
| SQLite read/write | core only | none |

## 5 · Backend permission prefixes (UI-shaping only)

Shared from the backend permission catalog
([§6.2 of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md)); the strings ride
`session.get` into the renderer as **UI-shaped truth only**:

| Prefix | Module | Used by |
| --- | --- | --- |
| `notes.*` (as shipped: read/list, create) | notes slice | `notes.list`, `notes.add` gating in the ViewModel status (`forbidden`) |
| `<module>.<resource>.<action>` | backend catalog, generated | every other slice — never hand-written |

Rules: `can(...)` shapes UI only; the backend decides; a `forbidden` status
is a first-class ViewModel state, not an error dialog
([07](07-sdk-auth-and-realtime.md)). `{userType}` selects the shell and is
*not* a permission.

## 6 · What may never appear in any register row

A token-bearing IPC payload (schemas reject the shape), `ipcRenderer` or a
generic channel exposed to a renderer, camera/microphone/geolocation grants,
`--no-sandbox`, a permission granted "temporarily" in code without a row in
section 2.

## See also

- [06 — IPC & Preload](06-ipc-and-preload.md)
- [09 — Security](09-security-fuses-csp-and-secrets.md)
- [§5, §7 and §12 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)
