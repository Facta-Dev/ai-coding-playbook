---
id: DESKTOP_ELECTRON_PART3
version: 1.0.0
status: active
last_reviewed: 2026-11-19
review_cadence_days: 30
owner: desktop + security
depends_on: [DESKTOP_ELECTRON]
---

# PLAYBOOK_DESKTOP_ELECTRON_PART3.md — PLAYBOOK_DESKTOP_ELECTRON.md — Cross-platform Electron desktop application playbook (Windows · Linux · macOS) (part 3)

> Part 3 of 3. Main entry: [`PLAYBOOK_DESKTOP_ELECTRON.md`](PLAYBOOK_DESKTOP_ELECTRON.md). Covers: 21. Definition of done and checklists … Appendix L — Support matrix template.

## 21. Definition of done and checklists

### 21.1 Feature DoD

- [ ] Spec lists processes touched, IPC messages, window capabilities, permissions, policy keys, realtime topics, perf impact, a11y, per-OS notes.
- [ ] Domain/application tested with fake ports; ViewModel statuses covered; no blocking work in main or renderer main thread.
- [ ] Uses the generated SDK in the core; no hand-written paths/DTOs; error taxonomy handled.
- [ ] New IPC channels have schemas (both sides), capability-table entries, sender-spoofing tests, and appear in the IPC register.
- [ ] Works with realtime on, degraded (polling) and off; resync tested.
- [ ] Works in GPU-off safe mode and within Floor-profile budgets.
- [ ] Keyboard/screen-reader accessible; HiDPI and dark/high-contrast verified; strings are keys; RTL checked.
- [ ] Policy-aware (locked controls, kill switch); telemetry with correlation ID and redaction; no secrets in logs/dumps.
- [ ] Storage changes have migrations and fixtures; secrets only via `safeStorage`.

### 21.2 Release checklist

- [ ] Reproducible builds; SBOM (incl. Electron/Chromium/Node) and license report generated; scans green.
- [ ] Fuses verified on the packaged output before and after signing; ASAR integrity enabled where supported.
- [ ] Unit/contract/architecture/e2e (packaged, GPU and software, X11 and Wayland)/a11y/security suites green; Floor perf within budget.
- [ ] Installer install/upgrade/uninstall/silent tests green on clean VMs; policies verified.
- [ ] Signed (Authenticode/Developer ID/GPG), notarized (macOS), signatures verified post-build.
- [ ] Update manifest signed; rollback tested; staged rollout and halt criteria configured.
- [ ] Electron major within the supported window; security advisories reviewed; admin guide and support matrix updated.

### 21.3 Architecture acceptance checklist

- [ ] Electron major pinned (exact) within the latest-two policy; upgrade cadence and SLA defined.
- [ ] Main/Core/Preload/Renderer separation with per-target tsconfig; dependency rules enforced in CI.
- [ ] Renderer sandboxed, context-isolated, no Node, no network (CSP `connect-src 'none'`); `app://` protocol with strict CSP.
- [ ] Typed, validated IPC with sender verification and per-window capabilities; narrow preload bridge.
- [ ] Core process owns SDK, realtime, storage, session; supervised and restartable.
- [ ] `safeStorage` for secrets (Linux `basic_text` refused); OIDC+PKCE in the system browser.
- [ ] Slices mirror backend slices; generated SDK/DTOs; route table and permission catalog shared.
- [ ] Realtime port with SSE/WebSocket/polling/off, state machine, resume, dedupe, resync, backpressure.
- [ ] Policy, kill switch, diagnostics bundle, crash recovery with safe mode.
- [ ] Signed, notarized, fused builds; signed update channel with rollback; CRA/vulnerability process defined.
- [ ] Test pyramid incl. packaged-app e2e, Floor perf, installer/updater, policy, fuses and security suites.

---

## Appendix A — Secure window factory and navigation lockdown (sketch)

```ts
// main/windows.ts
export function createWindow(kind: WindowKind): BrowserWindow {
  const win = new BrowserWindow({
    show: false, width: 1200, height: 800, minWidth: 900, minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInWorker: false,
      webviewTag: false, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false,
      devTools: !app.isPackaged && policy.devToolsEnabled,
    },
  });
  windowRegistry.register(win.webContents.id, kind);                       // capability lookup for the PEP
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { openExternalIfAllowed(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (new URL(url).origin !== APP_ORIGIN) e.preventDefault(); });
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());
  win.webContents.on('render-process-gone', (_e, d) => recovery.onRendererGone(win, d));
  void win.loadURL(`${APP_ORIGIN}/index.html`);                            // app:// , never file://
  return win;
}
```

## Appendix B — Typed IPC contract, preload bridge and PEP (sketch)

```ts
// contracts/ipc.ts
export const ipc = {
  'leads.get':        { req: z.object({ leadId: z.string().uuid() }).strict(), res: LeadDto,            windows: ['main', 'admin'] },
  'leads.moveStage':  { req: MoveStageInput,                                   res: LeadDto,            windows: ['main'] },
  'session.get':      { req: z.object({}).strict(),                            res: SessionSummary,      windows: ['main', 'admin', 'settings'] },
} as const;

// preload/index.ts  (bundled as CJS/IIFE)
contextBridge.exposeInMainWorld('hmd', {
  rpc: (type: string, payload: unknown) => ipcRenderer.invoke('rpc', { v: 1, id: crypto.randomUUID(), type, payload, correlationId: crypto.randomUUID() }),
  subscribe: (topic: string, cb: (e: unknown) => void) => { /* register via port, return unsubscribe */ },
});

// main/ipc-pep.ts
ipcMain.handle('rpc', async (event, raw) => {
  const kind = windowRegistry.kindOf(event.sender.id);
  if (!kind || event.senderFrame !== event.sender.mainFrame || new URL(event.senderFrame.url).origin !== APP_ORIGIN) return err('forbidden-sender');
  const env = Envelope.safeParse(raw); if (!env.success) return err('bad-envelope');
  const def = ipc[env.data.type as keyof typeof ipc]; if (!def || !def.windows.includes(kind)) return err('forbidden-message');
  const req = def.req.safeParse(env.data.payload); if (!req.success) return err('validation');
  return core.call(env.data.type, req.data, { correlationId: env.data.correlationId, windowKind: kind });   // core re-validates and authorizes via use case
});
```

## Appendix C — Core utility process bootstrap and supervision (sketch)

```ts
// main/core-supervisor.ts
export function startCore(): CoreHandle {
  const child = utilityProcess.fork(path.join(__dirname, '../core/index.js'), [], { serviceName: 'hmd-core', env: scrubbedEnv() });
  child.on('exit', (code) => restartWithBackoff(code));                    // surface "reconnecting" status to windows
  return { child, call: (type, payload, ctx) => rpcOverPort(child, type, payload, ctx) };
}

// core/index.ts
process.parentPort.on('message', (e) => {
  const [port] = e.ports; if (!port) return;
  container.rpcServer.attach(port);                                         // validate again, run use cases, return Result
  port.start();
});
```

## Appendix D — Fuses (Forge plugin) and CI verification (sketch)

```ts
// forge.config.ts
new FusesPlugin({
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
});
// CI (before and after signing): npx @electron/fuses read --app <path-to-packaged-app>   → fail on any drift from the table in 12.3
```

## Appendix E — `app://` protocol with CSP and path containment (sketch)

```ts
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);   // before ready
app.whenReady().then(() => {
  protocol.handle('app', async (req) => {
    const rel = path.posix.normalize(decodeURIComponent(new URL(req.url).pathname));
    const abs = path.join(RENDERER_ROOT, rel);
    if (!abs.startsWith(RENDERER_ROOT + path.sep)) return new Response('forbidden', { status: 403 });          // containment
    const res = await net.fetch(pathToFileURL(abs).toString());
    const h = new Headers(res.headers); h.set('Content-Security-Policy', CSP); h.set('X-Content-Type-Options', 'nosniff');
    return new Response(res.body, { status: res.status, headers: h });
  });
});
```

## Appendix F — SSE over the Chromium network stack in the core process (sketch)

```ts
export async function* sse(url: string, lastId: string | undefined, token: () => string, signal: AbortSignal) {
  const res = await net.fetch(url, { signal, headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token()}`, ...(lastId ? { 'Last-Event-ID': lastId } : {}) } });
  if (!res.ok || !res.body) throw new RealtimeError(res.status);                         // → fallback transport
  const reader = res.body.getReader(); const parser = new SseParser({ maxLine: 64 * 1024, maxEvent: 256 * 1024 });
  for (;;) { const { value, done } = await reader.read(); if (done) return; for (const ev of parser.feed(value)) yield ev; }
}
// WebSocket: net.WebSocket (Electron ≥ 44, verify) or `ws`; token in the handshake header, never in the URL.
```

## Appendix G — GPU safe-mode relaunch logic (sketch)

```ts
// main/index.ts — before app.whenReady()
const boot = readBootStateSync();                                    // tiny JSON: { startupInProgress, gpuCrashes }
const forceSoftware = policy.hardwareAcceleration === 'off' || argv.includes('--disable-gpu') || boot.startupInProgress || boot.gpuCrashes >= 2;
if (forceSoftware) app.disableHardwareAcceleration();
writeBootStateSync({ ...boot, startupInProgress: true });
app.on('child-process-gone', (_e, d) => { if (d.type === 'GPU') bumpGpuCrashes(); });
firstWindow.once('ready-to-show', () => writeBootState({ startupInProgress: false }));   // healthy start confirmed
```

## Appendix H — Policy schema (JSON form; same keys via registry/plist)

```json
{
  "type": "object",
  "properties": {
    "TenantUrl":          { "type": "string" },
    "SsoMode":            { "type": "string", "enum": ["oidc", "local"] },
    "UpdatesEnabled":     { "type": "boolean" },
    "UpdateChannel":      { "type": "string", "enum": ["stable", "beta", "canary"] },
    "RealtimeMode":       { "type": "string", "enum": ["auto", "websocket", "sse", "polling", "off"] },
    "HardwareAcceleration": { "type": "string", "enum": ["auto", "off"] },
    "DevToolsEnabled":    { "type": "boolean" },
    "TelemetryLevel":     { "type": "string", "enum": ["off", "errors", "full"] },
    "KillSwitch":         { "type": "boolean" },
    "FeatureFlags":       { "type": "object", "additionalProperties": { "type": "boolean" } },
    "DataRetentionDays":  { "type": "integer", "minimum": 0 },
    "AllowUserSettings":  { "type": "boolean" }
  },
  "additionalProperties": false
}
```

## Appendix I — `safeStorage` secret adapter (sketch)

```ts
export class SafeStorageSecrets implements SecretStorePort {
  constructor(private readonly dir: string, private readonly policy: EffectivePolicy) {}
  private assertUsable() {
    if (!safeStorage.isEncryptionAvailable()) throw new SecretStoreUnavailable('no-os-keystore');
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text' && !this.policy.allowBasicTextSecrets)
      throw new SecretStoreUnavailable('weak-backend');                     // caller falls back to "sign in each session"
  }
  async set(key: string, v: Uint8Array) { this.assertUsable(); await writeAtomic(this.path(key), safeStorage.encryptString(Buffer.from(v).toString('base64'))); }
  async get(key: string) { this.assertUsable(); const b = await readOpt(this.path(key)); return b ? Buffer.from(safeStorage.decryptString(b), 'base64') : null; }
  async remove(key: string) { await rmIfExists(this.path(key)); }
  private path(key: string) { return path.join(this.dir, `${hash(key)}.bin`); }
}
```

## Appendix J — Example vertical slice flow: update a lead's stage

```text
View (LeadDetailView) → ViewModel (useLeadDetailViewModel.moveToStage) → CorePort.rpc('leads.moveStage', {…})
  → preload bridge → ipcRenderer.invoke('rpc') → MAIN PEP (sender, window capability, schema) → CORE
  → use case MoveLeadStage (UX permission hint; builds IdempotencyKey) → LeadRepositoryPort.updateStage
  → SDK: PATCH /api/v1/app/funnels/leads/{leadId}  (Authorization, X-Tenant-Id, X-Correlation-Id, Idempotency-Key, via net.fetch)
  → backend authorizes (RBAC, tenant, ownership) → Result<Lead> → ViewModel status Ready | Forbidden(requiredPermission) | Conflict | Offline(outbox)
  ← Realtime "funnels.lead.updated" (topic funnels.leads.<id>) → dedupe → cache refresh → coalesced renderer update (≤ 30 Hz)
Tests: unit (policy/domain), ViewModel statuses, IPC contract + sender-spoof test, adapter integration (SDK mock),
       realtime conformance, parity fixture vs web/extension, authz-matrix row, packaged e2e, Floor list-scroll perf.
```

## Appendix K — CI matrix (sketch)

```yaml
strategy:
  matrix:
    include:
      - { os: windows-latest,  arch: x64,   gpu: [on, off] }
      - { os: windows-11-arm,  arch: arm64, gpu: [off] }
      - { os: macos-latest,    arch: arm64, gpu: [on, off] }
      - { os: macos-13,        arch: x64,   gpu: [on] }              # keep only while the Electron major supports it
      - { os: ubuntu-24.04,    arch: x64,   display: [x11, wayland], gpu: [off] }
      - { os: ubuntu-24.04-arm, arch: arm64, display: [x11],         gpu: [off] }
steps: [checkout, pinned-node, frozen-install(--ignore-scripts), typecheck(all targets), unit+contract, package, verify-fuses, e2e(packaged), perf-smoke, sbom]
```

## Appendix L — Support matrix template

```markdown
# Support matrix (per release)
| Item | Value |
| Electron | <major> (Chromium <ver>, Node <ver>) · end of support: <date> · next-major canary: <major> |
| Windows | 10 22H2+ / 11 · x64, arm64 |
| macOS | 13+ (Electron 44+) · arm64, x64 |
| Linux | Ubuntu LTS <versions>, Fedora <ver> · x64, arm64 · X11 and Wayland · sandbox helper/AppArmor configured |
| Hardware floor | 2 cores, 4 GB RAM, SSD; software rendering supported |
| Packaging | Windows: Squirrel/MSI · macOS: zip/DMG/pkg · Linux: deb/rpm/Flatpak |
| Known limitations | tray on some Wayland desktops, global shortcuts on Wayland, ASAR integrity on Linux, GPU blocklist |
```
