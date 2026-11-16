# Service Worker Lifetime

This chapter **does not apply to this stack**. The reference client kit is a
Chrome extension, whose background context is a service worker that is killed
after ~30 seconds of inactivity and restarted cold. A terminal CLI has no
service worker: the process starts, runs, writes its result and exits, and
there is no long-lived background context to manage.

## The analog that does apply

The only "lifetime" fact that matters to a CLI is the process lifecycle:

- A CLI process starts cold on every invocation. There is no state that
  survives between invocations unless it is written to a file, a config store
  or the OS keystore.
- A signal (`SIGINT`, `SIGTERM`) may interrupt the process mid-task. The
  fuller contract reserves exit codes 130 and 143 for those two signals
  (`PLAYBOOK_CLI.md` section 4.3); the shipped template's table is the reduced
  set 0/1/2/7 (`src/core/contracts.ts`).
- `stdout` and `stderr` are the only durable output; anything the next process
  must read goes through the versioned envelope, not through a module global.

## What the template does about it

| Rule                                        | Where it lives                    | Why                                                       |
| ------------------------------------------- | --------------------------------- | --------------------------------------------------------- |
| No state in module globals                  | `src/core/greet.ts`               | A use case is a pure function over its inputs             |
| Time is injected, not read from the global   | `src/core/greet.ts` (`GreetPorts`) | A test freezes the clock; the process clock is an adapter |
| The envelope is versioned                    | `src/core/contracts.ts`           | The next process in a pipeline knows what it parsed       |
| The exit code is versioned                   | `src/core/contracts.ts`           | A script branches on a stable number, not on stderr text  |

## Restart-safety checklist

Ask these three questions of any new CLI-side code:

1. **Where does this value live after the process exits?** If the answer is
   "in a variable", it is a bug.
2. **What happens if the input arrives twice?** The parser returns a `Result`;
   the use case is pure, so re-running it is safe.
3. **What happens if the process is interrupted mid-write?** The envelope is
   written as one line, so a consumer reads a whole value or nothing.

## See also

- [Platform Model & Execution Contexts](01-platform-model-and-execution-contexts.md)
- [Storage & Migrations](08-storage-and-migrations.md)
- [Messaging & the Stream Contract](07-messaging-and-sender-validation.md)
