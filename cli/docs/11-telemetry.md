# Telemetry

The template ships **no telemetry to a remote service**, and no logger at
all. The shipped `greet` use case writes its result and exits; nothing is
recorded, nothing is sent, and nothing leaves the machine.

## The analog that does apply

The reference client kit ships a local, redacting logger (a ring buffer with a
replaceable sink). The CLI's fuller contract specifies the same posture in
`PLAYBOOK_CLI.md` section 13 (Observability and diagnostics):

- **One output path.** Diagnostics go to stderr; there is no second channel
  that prints twice or misses.
- **Redact on write.** A secret never enters a log entry; redaction happens at
  the logger, not at every call site.
- **State the retention.** A sink that persists must say where the entries go
  and for how long.
- **Nothing leaves the machine by default.** A remote sink is an explicit
  opt-in, never the default.

## What a project must add before shipping

The template is a starting point, not a finished observability story. Before a
real deployment, decide and write down:

| Question                          | Where the answer belongs                     |
| --------------------------------- | -------------------------------------------- |
| Where do the diagnostics go?      | stderr today; a logger with a sink when added |
| What is the retention period?     | The sink, and the storage policy if it persists |
| Does anything leave the machine?  | The privacy statement of the distribution    |

Never send a payload, a prompt body or a URL query to a sink by accident: the
future logger redacts _secrets_, not personal data.

## See also

- [Security](10-security-and-csp.md)
- [Testing & CI](12-testing-and-ci.md)
- [Playbooks](13-playbooks.md)
