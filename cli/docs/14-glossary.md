# Glossary

Every term used in this set, defined once. Where a term has a platform meaning
and a kit meaning, the kit meaning is the one that counts here.

**Adapter** - An implementation of a port that talks to the outside world.
`src/adapters/cli.ts` parses argv; `src/adapters/io.ts` owns the streams.

**Composition root** - The file that knows everything and wires it together:
`src/bin/main.ts`. It contains no rules.

**Contract** - A shared, versioned shape or table in `src/core/contracts.ts`
that scripts consume. The envelope and the exit-code table are contracts.

**Core** - The pure layer: use cases and the versioned contracts. No `process`,
no `node:`, no streams.

**Envelope** - The versioned `--json` output: `{ v, ok, data }` or
`{ v, ok: false, error }`.

**Envelope version** - `ENVELOPE_VERSION` in `src/core/contracts.ts`,
currently `1`. A consumer that reads another version is told to upgrade.

**Exit code** - One of the documented numbers scripts branch on: `0` success,
`1` general error, `2` usage, `7` validation (the fuller table, including
`130`/`143` for signals, is `PLAYBOOK_CLI.md` section 4.3).

**Flag** - A named command-line option. The flag surface is part of the
declared surface and is documented in `--help`.

**Fail closed** - When an input or a config cannot be read, the CLI refuses
instead of allowing. An empty allowlist allows nothing.

**Golden fixture** - A committed snapshot of the exact output of a command;
reviewed like code, so a formatting change is a reviewed diff.

**Layer wall** - The rule that `src/core/` is pure, `src/adapters/` owns the
process, and `src/bin/` wires them. Enforced by ESLint and the architecture
test.

**Pipe (non-TTY)** - An invocation whose stdout/stdin is not a terminal. It
must never prompt and must put nothing but data on stdout.

**Port** - An interface the consuming layer declares (for example
`GreetPorts`), so the use case depends on the abstraction and not on the
process.

**Print mode** - The non-interactive mode: human text or `--json` on stdout,
diagnostics on stderr.

**Result** - A value-typed outcome: `{ ok: true; value }` or
`{ ok: false; error }`. Expected failures are values, not exceptions.

**Slice** - A feature, cut end to end: its use case, its contract, its handler
and its tests. Sealed: a slice never imports another slice.

**Stream split** - The rule that stdout is data and stderr is diagnostics.
Mixing them corrupts every pipeline downstream.

**TTY** - A terminal. When stdout/stderr are TTYs, prompts, color and progress
are allowed (progress to stderr only).

**Use case** - A pure function over consumer-owned ports that returns an
`Envelope`. The example is `greet`.

**Vertical slicing** - Cutting the code by feature instead of by technical
layer, so one feature is one folder with all of its layers.

## See also

- [Overview & Principles](00-overview-and-principles.md)
- [Playbooks](13-playbooks.md)
