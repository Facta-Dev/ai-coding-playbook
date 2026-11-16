# Telemetry

The kit ships **no telemetry to a remote service**. What it ships is a
placeholder for user-visible messages - the `Notifier` port - and a
discipline about the console. That is the whole observability story, and it
is deliberately small.

## 1. The notifier

`src/core/ports.ts` declares the port the ViewModel uses to report a
user-visible outcome:

```ts
export interface Notifier {
  success(messageKey: string): void;
  error(messageKey: string): void;
}
```

The ViewModel calls it through the port (`notifier.success("lead.moved")`),
so the shared layers never touch a console or a toast library. The shipped
composition root wires no-ops; a project replaces them with real surfaces.

## 2. What is not logged

| Concern           | The reference extension | This kit                              |
| ----------------- | ----------------------- | ------------------------------------- |
| A log buffer      | A redacting ring buffer | None                                  |
| A remote sink     | Optional, never wired   | None                                  |
| `console.*` in `src/` | Forbidden            | Forbidden by convention, not by lint  |

The kit does not ship a logger because a web SPA's failures are surfaced as
statuses and message keys, not as log entries. There is no global logger to
pass down; the `Notifier` port is the only message channel.

## 3. The ceiling

A ViewModel has no side channel to a remote service. Two consequences, both
deliberate:

- **Nothing leaves the machine by default.** The `Notifier` port is a
  local-only surface in the shipped template.
- **The token is never logged.** It is read per call and never written to the
  console or a notifier message.

## 4. What a project must add before shipping

The kit is a starting point, not a finished observability story. Before a
real deployment, decide and write down:

| Question                         | Where the answer belongs                  |
| -------------------------------- | ----------------------------------------- |
| Where do the messages go?        | The `Notifier` implementation in `App.tsx` |
| Is anything sent to a service?   | A sink, and only with a privacy statement |
| Is a session id in the payload?  | Only if it is not personal data           |
| Does anything leave the machine? | The privacy statement of the deployment   |

Never send a lead body, an email address or a URL query to a sink by
accident: the ViewModel exposes message keys, not payloads.

## 5. Worked example

A successful move is reported by message key, not by a literal:

```ts
notifier.success("lead.moved");
```

The ViewModel names the message; the View (or the notifier) owns the text.

## Do / Don't

| Do                                              | Don't                                            |
| ----------------------------------------------- | ------------------------------------------------ |
| Report through the `Notifier` port              | Call `console.*` from a ViewModel                |
| Expose message keys, not payloads               | Log a lead body or an email address             |
| State where a sink sends before adding one      | Ship data off the machine by default             |

## See also

- [Security & CSP](10-security-and-csp.md)
- [Testing & CI](12-testing-and-ci.md)
