# 07 — SDK, Auth & Realtime

## The SDK runs in core, only in core

The generated TypeScript SDK (`packages/sdk/`, source of truth is the
backend's OpenAPI) runs **only in the core utility process**; renderers never
import it — the renderer dependency wall rejects `@/sdk`
([03](03-layers-and-mvvm.md), [§6.1](../PLAYBOOK_DESKTOP_ELECTRON.md)).

**Transport is `net.fetch`** (Chromium's network stack), not Node's
`http`/undici: system proxy settings/PAC, enterprise certificate stores,
NTLM/Negotiate proxy auth and TLS policy apply without extra code. Node's
stack ignores system proxies — acceptable only for loopback or tests.

Interceptors (order per [PLAYBOOK_FRONTEND.md](../PLAYBOOK_FRONTEND.md)):
auth (Bearer from memory, single-flight refresh, replay once), tenant,
correlation (`X-Correlation-Id`), client info (`X-Client: desktop-electron/…`),
idempotency key, retry with backoff + jitter honoring `Retry-After`, error
mapping to the shared `SdkError` taxonomy
([§6.1](../PLAYBOOK_DESKTOP_ELECTRON.md)). Hosts outside the policy/tenant
allowlist are refused.

## Authorization stays server-side

The session carries `permissions: string[]` (obtained over the
`session.get` IPC type). `can("funnels.leads.update")` shapes UI only; the
backend decides. `{userType}` selects the experience shell; multi-role users
switch through the session, and switching clears caches and subscriptions
([§6.2](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Authentication

**OIDC Authorization Code + PKCE in the system browser**
(`shell.openExternal`), with a loopback redirect served by the core on
`http://127.0.0.1:<random port>` and a single-use `state`; device-code flow
as fallback for restricted environments. **Never an in-app `BrowserWindow`
login for a third-party IdP** — phishing surface and shared-process exposure
([§8](../PLAYBOOK_DESKTOP_ELECTRON.md), [PLAYBOOK_SECURITY.md](../PLAYBOOK_SECURITY.md)).

Token handling in the kit's process model:

| Token | Where | Rules |
| --- | --- | --- |
| Access token | core memory only | cleared on sign-out, suspension, lock-on-idle (`powerMonitor`) |
| Refresh token | ciphertext blob in the user data dir | sealed with `safeStorage` (`platform/secrets/safe-storage.ts`) |
| Anything token-shaped | never a renderer, never logs/crash dumps | renderer IPC payload schemas would reject the shape |

`safeStorage` rules ([§8](../PLAYBOOK_DESKTOP_ELECTRON.md)): check
`isEncryptionAvailable()`; on Linux inspect `getSelectedStorageBackend()` and
**refuse the `basic_text` fallback** (plaintext-equivalent) unless policy
allows it, degrading to sign-in-per-session. macOS encryption depends on the
app being signed.

> **Known gap: no real IdP.** The kit ships the seams — the session port, the
> `session.get` contract, the `safeStorage` adapter with its pure
> `assertUsableBackend()` — but **no OIDC flow implementation** and no
> configured issuer. Wiring a real IdP (loopback server in core, single-use
> `state`, rotation with reuse detection) is product work with an ADR; until
> then the app runs against the backend anonymously or with a token injected
> for development.

## Realtime — optional and degradable

`RealtimeMode = auto | websocket | sse | polling | off` (policy > user >
default); the app is fully correct with polling or none
([§9](../PLAYBOOK_DESKTOP_ELECTRON.md)).

| Mode | Transport | Notes |
| --- | --- | --- |
| SSE | streaming `net.fetch` with an incremental spec-compliant parser (`infrastructure/realtime/sse-parser.ts`: UTF-8, CR/LF/CRLF, comments as heartbeat, `data:`/`event:`/`id:`/`retry:`, 64 KiB line cap, 256 KiB event cap) | `Last-Event-ID` on resume |
| WebSocket | `net.WebSocket` (Chromium stack: proxy, certs) where the Electron major provides it **(verify availability per major)**, otherwise `ws` for non-proxied environments | subprotocol, message-size caps, validated envelopes |
| Polling | plain SDK calls | always works |

Core owns every connection; renderers subscribe through the PEP and receive
coalesced events. Lifecycle reacts to `powerMonitor` (`suspend`, `resume`,
`lock-screen`, `unlock-screen`) and `net.online` changes, drops half-open
sockets, resumes with `Last-Event-ID`/resume tokens, reconciles on show,
surfaces `resyncRequired(topics)` after gaps. Backoff 1 s → 60 s cap with
jitter. Snapshot + stream, at-least-once with dedupe by event ID
([§9](../PLAYBOOK_DESKTOP_ELECTRON.md)).

The SSE parser is the tested artifact (`tests/infrastructure/
sse-parser.test.ts`); the transport state machine is kit-level and shared by
all slices.

## See also

- [06 — IPC & Preload](06-ipc-and-preload.md) — how core answers the renderer
- [08 — Storage, Outbox & Offline](08-storage-outbox-and-offline.md)
- [§8 and §9 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)
