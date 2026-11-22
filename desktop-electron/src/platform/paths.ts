// <app> — the directories the app may write to.
//
// Pure module: it takes a `getPath` function (the composition root in
// src/main/index.ts binds `app.getPath`, because `src/platform` imports no
// electron — see the dependency walls). Every path a feature or adapter
// needs comes through here, so nowhere else forms its own location.

import { join } from "node:path";

/** The Electron path names this app is allowed to read. */
export type PathName = "userData" | "logs" | "temp";

/** The fixed set of directories the app writes to. */
export type AppPaths = {
  /** Profile data: the database, the safeStorage ciphertext. */
  readonly userData: string;
  /** Logs and diagnostics bundles. */
  readonly logs: string;
  /** Scratch files; the OS may clean it up. */
  readonly temp: string;
};

/** The app's directories, resolved by the injected path reader. */
export function createAppPaths(getPath: (name: PathName) => string): AppPaths {
  const temp = getPath("temp");
  return { userData: getPath("userData"), logs: getPath("logs"), temp };
}

/** A stable path inside one of the app's directories. */
export function within(dir: "userData" | "logs" | "temp", paths: AppPaths, name: string): string {
  return join(paths[dir], name);
}
