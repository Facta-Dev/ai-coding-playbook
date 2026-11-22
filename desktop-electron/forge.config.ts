// <app> — Electron Forge packaging configuration.
//
// Security defaults come straight from PLAYBOOK_DESKTOP_ELECTRON §9 and §12.3
// (Appendix D): ASAR on for the packaged app, and the run-time fuses flipped
// so a tampered binary cannot escape the hardened defaults — run-as-Node off,
// NODE_OPTIONS and inspect arguments off, the file protocol stripped of the
// privileges that enable file:// escapes, while cookie encryption and the two
// ASAR guarantees stay on.
//
// The CI packaging job reads the fuses back with
// `npx @electron/fuses read --app <packaged app>` and fails on any drift.
//
// Makers: one per shipping surface (Windows Squirrel installer, plain zip,
// deb, rpm). Keep this set minimal — every maker added multiplies build
// surface and CI time.
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

export default {
  packagerConfig: {
    asar: true,
  },
  makers: [
    new MakerZIP({}, ["linux"]),
    new MakerSquirrel({}, ["win32"]),
    new MakerDeb({}, ["linux"]),
    new MakerRpm({}, ["linux"]),
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};
