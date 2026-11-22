// <app> — the window factory.
//
// Every window the app creates passes exactly one door (PLAYBOOK_DESKTOP
// ELECTRON Appendix A): sandboxed, context-isolated, no Node, no webview, a
// preload that is the typed bridge, the registry entry the PEP reads as the
// window's capability, and a navigation lockdown — `app://` origin only,
// new windows denied, webview attach denied. The window loads never
// `file://`, only `app://bundle/index.html`.

import { BrowserWindow, app } from "electron";
import { join } from "node:path";
import { APP_ORIGIN } from "./app-protocol";
import type { IpcWindow } from "../contracts/ipc";
import type { WindowRegistry } from "./window-registry";

/** The deps the factory reads; the composition root wires them once. */
export type WindowFactoryDeps = {
  readonly registry: WindowRegistry;
};

/** Creates one window of a registered kind. */
export function createWindow(kind: IpcWindow, deps: WindowFactoryDeps): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, "..", "preload", "index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      // DevTools only unpackaged; a policy-driven toggle is the settings
      // slice's job (`DevToolsEnabled`), never the window's default.
      devTools: !app.isPackaged,
    },
  });

  // The capability the PEP consults for this webContents id.
  deps.registry.register(win.webContents.id, kind);

  win.once("ready-to-show", () => {
    win.show();
  });

  // New windows are denied outright; an external-link shim (shell
  // .openExternal with a scheme/host allowlist) waits for a policy key.
  // #ponytail: no external-link allowlist until the policy keys define one.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Navigation lockdown: this origin or nothing.
  win.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin !== APP_ORIGIN) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });

  win.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  // Crash hook: the renderer died. Recovery reloads the last route; the
  // crash-loop detection and the GPU safe mode are a documented template gap.
  win.webContents.on("render-process-gone", () => {
    if (win.isDestroyed()) return;
    win.webContents.reload();
  });

  win.webContents.on("destroyed", () => {
    deps.registry.unregister(win.webContents.id);
  });

  void win.loadURL(`${APP_ORIGIN}/index.html`);
  return win;
}
