// <app> — the platform facts the app publishes.
//
// One source: `process.platform`. No `os` module, no remote probe, no
// fingerprinting — a surface that wants the platform asks here, and the
// renderer gets it through the preload bridge only (window.hmd.platform.info).

export type SystemInfo = {
  /** The platform the app runs on, as Node names it (`darwin`, `win32`, `linux`). */
  platform: NodeJS.Platform;
};

/** The static platform facts, read from `process.platform` only. */
export function getSystemInfo(): SystemInfo {
  return { platform: process.platform };
}
