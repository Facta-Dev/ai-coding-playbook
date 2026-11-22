// <app> — Secrets at rest: the policy decision around `safeStorage`.
//
// Pure module, no Electron import (the platform layer imports no electron —
// the composition root in src/main/index.ts supplies the `SafeStoragePort`
// bound to the real `safeStorage`). The one hard rule, from
// PLAYBOOK_DESKTOP_ELECTRON §8: on Linux `basic_text` is plaintext-equivalent
// and is refused unless the administrator policy explicitly allows it.

import { err, ok, type Result } from "../../shared-kernel";

/**
 * A selected safeStorage backend, as the Electron API reports it
 * (`safeStorage.getSelectedStorageBackend()`). `basic_text` is the
 * plaintext-equivalent fallback the policy refuses on Linux; every other
 * named backend is a real secrets store.
 */
export type SafeStorageBackend =
  | "basic_text"
  | "unknown"
  | "gnome_libsecret"
  | "kwallet"
  | "kwallet5"
  | "kwallet6";

/** The secrets policy keys this module reads. */
export type SecretsPolicy = {
  /** Allow the plaintext-equivalent `basic_text` backend on Linux. */
  readonly allowBasicTextOnLinux: boolean;
};

/** The parts of Electron's safeStorage this module touches. */
export type SafeStoragePort = {
  /** Whether sealed data can be decrypted again (the key is available). */
  isEncryptionAvailable(): boolean;
  /** The backend Chromium selected; null outside Linux. */
  getSelectedStorageBackend(): SafeStorageBackend | null;
  /** Seals a string into binary ciphertext. */
  encryptString(value: string): Uint8Array;
  /** Unseals ciphertext that this platform sealed. */
  decryptString(ciphertext: Uint8Array): string;
};

/** The refusal when the backend is not usable. */
export type SecretsRefusal = {
  code: "policy-blocked";
  message: string;
  requiredPermission: "secrets.allowBasicTextOnLinux";
};

/**
 * The usability rule, as a value, and separate from the Electron calls, so a
 * unit test can exercise it without Electron: Linux `basic_text` is rejected
 * unless the policy allows it; everywhere else the selected backend is usable.
 */
export function assertUsableBackend(
  platform: NodeJS.Platform,
  backend: SafeStorageBackend,
  policy: SecretsPolicy,
): Result<void, SecretsRefusal> {
  if (platform === "linux" && backend === "basic_text" && !policy.allowBasicTextOnLinux) {
    return err({
      code: "policy-blocked",
      message: "safeStorage fell back to basic_text on Linux; plaintext secrets are refused.",
      requiredPermission: "secrets.allowBasicTextOnLinux",
    });
  }
  return ok(undefined);
}

/** The input of `sealSecret`. */
export type SealRequest = {
  /** The plaintext; it lives momentarily in memory and never on disk. */
  readonly value: string;
};

/** Seal one secret with the injected port, after the policy check. */
export function sealSecret(
  port: SafeStoragePort,
  platform: NodeJS.Platform,
  policy: SecretsPolicy,
  request: SealRequest,
): Result<Uint8Array, SecretsRefusal> {
  const backend = port.getSelectedStorageBackend() ?? "unknown";
  const decision = assertUsableBackend(platform, backend, policy);
  if (!decision.ok) return decision;
  if (!port.isEncryptionAvailable()) {
    return err({
      code: "policy-blocked",
      message: "safeStorage encryption is not available in this session.",
      requiredPermission: "secrets.allowBasicTextOnLinux",
    });
  }
  return ok(port.encryptString(request.value));
}

/** Unseal a secret that this platform sealed. */
export function openSecret(port: SafeStoragePort, ciphertext: Uint8Array): Result<string> {
  try {
    return ok(port.decryptString(ciphertext));
  } catch (reason) {
    return err({
      code: "internal",
      message: `the stored secret could not be unsealed: ${String(reason)}`,
    });
  }
}
