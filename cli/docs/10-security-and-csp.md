# Security

A terminal CLI runs privileged code inside somebody else's shell. The kit's
posture is: **deny by default, validate at every boundary, and refuse to run
untrusted data before it is checked.**

The reference client kit's CSP chapter does not apply - a CLI has no content
security policy - but the trust-boundary discipline is the same, and the
fuller threat model is `PLAYBOOK_CLI.md` section 10.

## 1. The boundaries and the checks at each one

| Boundary                     | What crosses it      | The check                                             |
| ---------------------------- | -------------------- | ----------------------------------------------------- |
| argv → parser                | The argument vector  | `parseArgv` returns a `Result`; an unknown command or flag is exit code 2 |
| parser → core                | A typed invocation   | The use case re-applies its own rules (trim, empty check) |
| core → adapter               | A typed envelope     | `--json` writes one versioned shape, nothing else      |
| adapter → process            | stdout / stderr      | Data on stdout, diagnostics on stderr, a versioned exit code |

## 2. What the code refuses

| Refused                                              | Where                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `process` or `node:` inside `src/core/`              | ESLint `no-restricted-globals` / `no-restricted-imports` + the architecture test |
| The adapters reaching the bin entry                  | ESLint `no-restricted-imports`                                  |
| A bad flag or unknown command                        | `parseArgv` → `CliParse` failure → exit code 2                  |
| An invalid use-case input                            | `greet` → `{ ok: false, error }` → exit code 7                  |
| A secret committed to the tree                       | `scripts/leak-guard.sh` fails the tree on a high-signal pattern |

## 3. Secrets

- **No secret is committed.** The kit ships `.env.example` and no secret
  value; `scripts/leak-guard.sh` fails the tree on a private key, a long
  bearer token or a password assignment.
- **The token belongs in the OS keystore.** The fuller contract specifies
  `SecretStorePort` (`PLAYBOOK_CLI.md` section 3.2); the env file documents
  the API URL and the profile, never a secret.

## 4. Untrusted text and the terminal

The fuller contract requires an output sanitizer that strips control
characters and ESC-prefixed sequences from any untrusted text before it
reaches the terminal, and a shell executor that uses argument arrays, never
string interpolation (`PLAYBOOK_CLI.md` section 10 and `PLAYBOOK_SECURITY.md`).
The shipped template writes only strings it constructs itself, so it ships no
sanitizer; when the project renders server or model output, route it through
the `injection-trust-reviewer` agent and add the sanitizer pass.

## 5. Known gaps of the template

| Gap                                          | Consequence                                                   | Fix                                          |
| -------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| No output sanitizer                          | Untrusted text would reach the terminal raw                   | Add the sanitizer pass before rendering      |
| No shell executor                            | No path builds a command string yet                           | Add `execFile`/`spawn` with argument arrays  |
| No keystore                                  | The env file documents the URL, not the token                | Add `SecretStorePort` per the playbook       |

These are gaps of the template, not accidents: each one is a deliberate
omission that a project re-adds with a reason.

## Do / Don't

| Do                                               | Don't                                          |
| ------------------------------------------------ | ---------------------------------------------- |
| Validate argv before using it                    | Trust a flag because it looks right            |
| Write data to stdout and diagnostics to stderr   | Mix the streams                                |
| Keep secrets out of committed files              | Put a token in argv, logs or config            |
| Argument arrays for any future shell call        | Interpolate untrusted input into a command string |

## See also

- [Messaging & the Stream Contract](07-messaging-and-sender-validation.md)
- [Telemetry](11-telemetry.md)
- [Playbooks](13-playbooks.md)
