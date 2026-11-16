# Permissions & Guards

**There is no administrator policy in this kit.** The reference extension kit
resolves an administrator's managed policy over the user's settings and the
code's defaults. A web SPA has no `chrome.storage.managed` and no enterprise
administrator. What it has instead is the same idea at the product level:
**the backend decides what a session may do, and the client renders the
answer rather than deciding for itself.**

## 1. What the topic meant in the reference

The extension's order of precedence was fixed - administrator, then user,
then default - and it failed closed: an empty allowlist allowed nothing, and
an invalid policy was ignored rather than trusted. Those rules belong to code
that gates access to a resource.

## 2. What this kit has instead

The permission decision is a backend concern, surfaced through the typed
error envelope:

| Concern            | The reference              | This kit                                  |
| ------------------ | -------------------------- | ----------------------------------------- |
| Who decides access | A local policy resolver   | The backend, through the SDK             |
| The deny answer    | A failed-closed allowlist | `SdkError` `forbidden` or `unauthenticated` |
| The locked surface | Read-only settings        | A View rendered from the `forbidden` status |
| A kill switch      | A managed flag             | Not applicable                           |

The ViewModel maps `forbidden` to `status: "forbidden"` and the View renders
the denial; the client never decides that a route is open for everyone.

## 3. Failing closed

The ViewModel fails closed by construction: an unknown or unexpected error is
`status: "error"`, never `status: "ready"` with partial data. The View renders
`not-found` and `forbidden` as distinct denial states, and the `ready` branch
is the only one that renders the lead.

## 4. Guards, when the route tree grows

The single screen shipped here has no route guard because it has one route.
When the route tree grows, the playbook's guard discipline applies and the
kit will carry it as a first-class step: one guard per `{userType}`, a
`forbidden` redirect, and a `permission-guard-reviewer` pass (the agent
already ships in `.claude/agents/security/`). Until then, the absence is
deliberate: no guard is implemented because there is nothing to guard.

## 5. Worked example

A `403` becomes a denial state:

```ts
case "forbidden":
  return "forbidden";
```

The View renders it without ever seeing the status code, and the `requiredPermission`
field of the `forbidden` error is available for a View that wants to name the
missing permission.

## Do / Don't

| Do                                             | Don't                                          |
| ---------------------------------------------- | ---------------------------------------------- |
| Let the backend decide and the client render   | Decide access in the client                    |
| Map `forbidden` to a distinct status           | Collapse `forbidden` into a generic error     |
| Add a guard when the route tree grows          | Ship an unguarded authenticated route         |

## See also

- [The SDK Request Boundary](07-messaging-and-sender-validation.md)
- [Security & CSP](10-security-and-csp.md)
