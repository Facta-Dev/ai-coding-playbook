// Stable machine-readable contracts for the <app> CLI: the versioned output
// envelope and the exit-code table. These are the surface scripts consume,
// so a change is a breaking change and is versioned (PLAYBOOK_CLI.md sections
// 4.3 and 4.4). core is pure: this module imports nothing and touches no
// process.

export const ENVELOPE_VERSION = 1 as const;

// ExitCode is the stable exit-code table. Scripts branch on these numbers;
// changing their meaning is a breaking change.
export const ExitCode = {
  Ok: 0,
  GeneralError: 1,
  Usage: 2,
  Validation: 7,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

// The versioned envelope: `--json` output is always one of these two shapes.
export type OkEnvelope<T> = { v: typeof ENVELOPE_VERSION; ok: true; data: T };

export type ErrorEnvelope = {
  v: typeof ENVELOPE_VERSION;
  ok: false;
  error: { code: string; message: string };
};

export type Envelope<T> = OkEnvelope<T> | ErrorEnvelope;
