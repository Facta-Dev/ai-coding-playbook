// <app> — the main process entry, the composition root.
//
// Order matters (PLAYBOOK_DESKTOP_ELECTRON §6, §12): the `app://` scheme is
// registered before ready, the lock decides whether this instance runs, and
// after ready the protocol handler, the core and its PEP and the first
// window come up. Main stays thin: business logic belongs in the core
// process; the platform modules in src/platform hold pure facts and the
// composition root binds them to the Electron APIs here.

import { BrowserWindow, app, safeStorage } from "electron";
import { join } from "node:path";
import { installAppProtocol, APP_ORIGIN, registerAppScheme } from "./app-protocol";
import { registerIpcPep } from "./ipc-pep";
import { startCore, type CoreHandle } from "./core-supervisor";
import { createWindow, type WindowFactoryDeps } from "./windows";
import { createWindowRegistry } from "./window-registry";
import {
  assertUsableBackend,
  type SafeStorageBackend,
  type SecretsPolicy,
} from "../platform/secrets/safe-storage";
import { getSystemInfo } from "../platform/system-info";

/** The secrets policy of the template: never plaintext on Linux. */
const SECRETS_POLICY: SecretsPolicy = { allowBasicTextOnLinux: false };

// Single instance: a second launch hands over to this one and just quits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // The window factory deps, filled in when the app is ready.
  let factory: WindowFactoryDeps | undefined;

  app.on("second-instance", () => {
    // Focus the running main window instead of opening a second one.
    const existing = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
    }
  });

  // Standard lifecycle: quit when the last window closes, except on macOS.
  app.on("window-all-closed", () => {
    // The platform fact comes from src/platform (the single reader of
    // `process.platform`): main never touches the runtime global directly.
    if (getSystemInfo().platform !== "darwin") app.quit();
  });

  // The core handle, stopped once at quit.
  let core: CoreHandle | undefined;

  app.on("will-quit", () => {
    // Stop the supervisor before the loop drains: no respawn, no pending wait.
    core?.close();
    core = undefined;
  });

  app.on("activate", () => {
    if (factory !== undefined && BrowserWindow.getAllWindows().length === 0) {
      createWindow("main", factory);
    }
  });

  // Privileged scheme: registered before ready, or it is not privileged.
  registerAppScheme();

  void app.whenReady().then(() => {
    installAppProtocol();

    const registry = createWindowRegistry();
    core = startCore({
      storagePath: join(app.getPath("userData"), "notes.db"),
    });
    registerIpcPep({ registry, core, expectedOrigin: APP_ORIGIN });

    factory = { registry };

    // Secrets gate: Linux `basic_text` is refused; the SDK's auth slice
    // refuses to persist tokens when this check fails.
    const backend: SafeStorageBackend =
      typeof safeStorage.getSelectedStorageBackend === "function"
        ? (safeStorage.getSelectedStorageBackend() ?? "unknown")
        : "unknown";
    const secrets = assertUsableBackend(getSystemInfo().platform, backend, SECRETS_POLICY);
    if (!secrets.ok) {
      // Sealed storage is unusable (Linux `basic_text`): the SDK slice must
      // keep tokens in memory only. Diagnosed, not a crash — the app runs.
      console.warn(secrets.error.message);
    }

    // Crash hooks on the main side: the supervisor restarts the core and the
    // window factory reloads a gone renderer. A GPU crash-loop detector and
    // the safe-mode relaunch (Appendix G) are a template gap, not wired here.
    app.on("child-process-gone", (_event, _details) => {
      // The supervisor owns core restarts; a GPU crash policy hook lands with
      // the safe-mode slice.
    });

    createWindow("main", { registry });
  });
}
