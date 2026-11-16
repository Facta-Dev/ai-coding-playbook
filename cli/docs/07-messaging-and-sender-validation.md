# Messaging & the Stream Contract

This chapter **does not apply to this stack** in its reference form. The
reference client kit is a Chrome extension whose only inbound channel is
`chrome.runtime.onMessage`, with a sender allowlist checked before the
payload. A CLI has no message bus and no sender: its inbound channel is the
argument vector, and its outbound channel is the two streams.

## The analog that does apply

The CLI's contract is the **stream split plus the versioned envelope**, and it
is validated with the same discipline:

- **stdout is data, stderr is diagnostics.** Anything that mixes them corrupts
  every pipeline downstream. Progress, spinners and color go to stderr only.
- **The envelope is versioned.** `--json` output is exactly
  `{ v: 1, ok: true, data }` or `{ v: 1, ok: false, error: { code, message } }`,
  one value on stdout, nothing else.
- **The argv parser validates before use.** `parseArgv` returns a `CliParse`
  `Result`; an unknown command or a bad flag is a usage error (exit code 2),
  never a thrown exception.

## 1. The envelope

```ts
{ v: 1, ok: true, data: { greeting: "Hello, Ada!", at: 1750000000000 } }
```

```ts
{ v: 1, ok: false, error: { code: "validation_failed", message: "name must not be empty" } }
```

The contract lives in `src/core/contracts.ts` and is the single shape every
consumer parses. `ENVELOPE_VERSION` is **1**; a consumer that reads another
version is told to upgrade, not to guess.

## 2. The order of checks in the entry

`src/bin/main.ts` checks in this order, and stops at the first failure:

| #   | Check                              | Exit code |
| --- | ---------------------------------- | --------- |
| 1   | `parseArgv(argv)` returns `ok`      | 2 (usage) |
| 2   | The invocation is `--version`/`--help` | 0        |
| 3   | The use case returns `ok: true`     | 0         |
| 4   | The use case returns `ok: false`    | 7 (validation) |

Step 1 before step 3 is the point: malformed input is rejected before the core
sees it.

## 3. Errors as values

The use case and the parser return values, not exceptions:

- `CliParse` is `{ ok: true; invocation } | { ok: false; message }`.
- `Envelope<T>` is `OkEnvelope<T> | ErrorEnvelope`.

Only a programming error reaches the boundary as a thrown exception, and the
composition root keeps it off the data stream.

## 4. Worked example

A script pipes an empty name:

```sh
echo '' | xargs -0 myapp greet --name '' --json
```

The process writes `{ "v": 1, "ok": false, "error": { "code":
"validation_failed", ... } }` to stdout, the diagnostic to stderr, and exits 7.
A script branches on 7, never on parsing stderr.

## Do / Don't

| Do                                             | Don't                                          |
| ---------------------------------------------- | ---------------------------------------------- |
| Validate argv before running the use case      | Run the use case on a bad flag                 |
| Write one envelope on stdout                   | Mix a log line into the JSON stream            |
| Answer with a stable exit code                 | Throw across the composition-root boundary     |
| Validate the response shape before writing it  | Write a shape the consumer cannot parse        |

## See also

- [Security](10-security-and-csp.md)
- [Platform Model & Execution Contexts](01-platform-model-and-execution-contexts.md)
- The contract: [`src/core/contracts.ts`](../src/core/contracts.ts)
