# Manifest & Permission Engineering

This chapter **does not apply to this stack**. The reference client kit is a
Chrome extension, whose `manifest.json` declares the permissions the browser
grants and the surfaces the store listing shows. A terminal CLI has no browser
manifest and no permission declaration to a host: what it may do is bounded by
the code it ships and the user that runs it.

## The analog that does apply

A CLI's "declared surface" is its machine-readable contract, and it is
reviewed with the same discipline:

- The **exit-code table** (`src/core/contracts.ts`) is the declaration of what
  a script may branch on. It lives in one file and is documented in `--help`.
- The **output envelope** (`src/core/contracts.ts`) is the declaration of what
  a script may parse. It is versioned (`v`), and a shape change is a breaking
  change.
- The **flag surface** (`src/adapters/cli.ts` plus `PLAYBOOK_CLI.md` section
  4.2) is the declaration of what a user may invoke.

The fuller contract's distribution posture (single-binary packaging, signing,
the update manifest) is in `PLAYBOOK_CLI.md` section 12, and the kit's
`packaging-reviewer` agent owns its review. The shipped template declares none
of it: it is a reduced form that demonstrates the exit-code and envelope
discipline only.

## What the template deliberately does not declare

| Not declared                     | Consequence                                                            |
| -------------------------------- | ---------------------------------------------------------------------- |
| A permission model               | A CLI needs no grant to read its own streams; the user's OS account is the boundary |
| A manifest file                  | The `package.json` `bin` field is the only "manifest", and it names the entry |
| An update manifest or signing    | Deferred to `PLAYBOOK_CLI.md` section 12; not implemented in the template |
| A telemetry or analytics surface | The template sends nothing anywhere (see [Telemetry](11-telemetry.md)) |

These are gaps of the template, not accidents: each one is a deliberate
omission that a project re-adds with a reason.

## See also

- [Security](10-security-and-csp.md)
- [Messaging & the Stream Contract](07-messaging-and-sender-validation.md)
- [Playbooks](13-playbooks.md)
