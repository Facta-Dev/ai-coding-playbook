// <app> — the packaged-app E2E.
//
// One smoke suite against the Forge-packaged app: the window opens on the
// `app://` origin and the notes view renders. The suite skips itself unless
// all three are true —
//
//   1. `E2E=1` (it is never part of the default gates);
//   2. the `electron` package resolves (installed inside tests/e2e);
//   3. the packaged app exists (a Forge `out/<dir>` output with a
//      package.json, or `E2E_APP_DIR` pointing at one).
//
// Install once: `cd tests/e2e && pnpm install`. Run:
// `E2E=1 pnpm exec playwright test`.

import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = path.resolve(HERE, "..", "..");

/**
 * The Electron binary of this package's node_modules, when installed:
 * `require("electron")` answers the binary path in a Node context.
 */
const nodeRequire = createRequire(import.meta.url);
let electronPath: string | undefined;
try {
  const resolved: unknown = nodeRequire("electron");
  if (typeof resolved === "string") electronPath = resolved;
} catch {
  electronPath = undefined;
}

/** The packaged app dir: `E2E_APP_DIR`, or the first Forge `out/<dir>` with a package.json. */
function findPackagedApp(): string | undefined {
  const override = process.env.E2E_APP_DIR;
  if (override !== undefined) return existsSync(path.join(override, "package.json")) ? override : undefined;
  const outDir = path.join(KIT_ROOT, "out");
  if (!existsSync(outDir)) return undefined;
  for (const entry of readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(outDir, entry.name);
    if (existsSync(path.join(candidate, "package.json"))) return candidate;
  }
  return undefined;
}

const enabled = process.env.E2E === "1";
const appDir = findPackagedApp();

test.skip(
  !enabled || electronPath === undefined || appDir === undefined,
  `packaged E2E skipped (needs E2E=1, a resolvable electron package and the packaged app; got ` +
    `E2E=1 -> ${String(enabled)}, electron -> ${String(electronPath !== undefined)}, ` +
    `app dir -> ${String(appDir ?? "not found")}; package with: ` +
    "`cd tests/e2e && pnpm install` and Forge first).",
);

let electronApp: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  if (electronPath === undefined || appDir === undefined) throw new Error("unreachable");
  electronApp = await electron.launch({ executablePath: electronPath, args: [appDir] });
  window = await electronApp.firstWindow();
  await window.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  if (electronApp !== undefined) await electronApp.close();
});

test("the packaged app opens its main window on the app:// origin", async () => {
  expect(window).toBeDefined();
  const url = window.url();
  expect(url.protocol).toBe("app:");
  expect(url.host).toBe("bundle");
});

test("the notes view renders inside the window", async () => {
  await expect(window.getByRole("heading", { level: 1 })).toContainText("Notes");
});
