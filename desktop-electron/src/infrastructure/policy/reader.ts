// <app> — the policy reader seam (placeholder).
//
// Reading the per-OS sources is main-process platform work: the managed
// document from the Windows registry (`HKLM\Software\Policies\...`, ADMX
// via GPO/Intune) or a machine JSON under `%PROGRAMDATA%`, the macOS
// managed preferences plist, `/etc/<product>/policy.json` on Linux; the
// user document from the user data dir (docs/11). The kit ships the seam
// only — wiring a source is a platform step, and `process.platform` stays
// in `src/platform/`.
//
// A source returns the raw document (`unknown`); the caller validates it
// with `parsePolicyDocument` before it reaches the resolver.

export interface PolicySourceReader {
  /** The managed document, `undefined` when the machine carries none. */
  readManaged(): Promise<unknown>;
  /** The user document, `undefined` when the user carries none. */
  readUser(): Promise<unknown>;
}

/** The empty reader: no source, the resolver answers the defaults. */
export const voidPolicySourceReader: PolicySourceReader = {
  readManaged(): Promise<unknown> {
    return Promise.resolve(undefined);
  },
  readUser(): Promise<unknown> {
    return Promise.resolve(undefined);
  },
};
