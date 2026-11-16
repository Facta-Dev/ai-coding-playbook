# Security & CSP

A web SPA ships code into somebody else's browser. The kit's posture is:
**deny by default, validate at every boundary, and refuse to load remote code
at all.**

## 1. The boundaries and the checks at each one

| Boundary               | What crosses it         | The check                                                  |
| ---------------------- | ----------------------- | ---------------------------------------------------------- |
| Backend -> SDK         | A response              | The status-to-`SdkError` mapping; a raw value never passes |
| SDK -> ViewModel       | A `Result`              | The ViewModel discriminates on `.ok`                       |
| ViewModel -> View      | A status                | The View renders only the declared statuses               |
| Build -> bundle        | Every `VITE_` variable  | No secret is baked in; `.env.*` is ignored                 |
| Network -> bundle      | Nothing                 | The kit ships no remote script                            |

## 2. The public client

The SPA is a **public client**: the bundle ships to every user's browser, so
it can hold no secret. Three consequences, all enforced:

- **No secret in the bundle.** `scripts/leak-guard.sh` fails the tree on a
  high-signal secret pattern, and `.env.example` carries only the shape.
- **The access token arrives at runtime.** It is supplied by the `TokenStore`
  port, never baked into the build and never persisted in `localStorage`.
- **No client secret.** There is no OAuth client secret, because a browser
  cannot keep one.

## 3. The CSP is set by the host

A static Vite SPA does not set its own CSP; the hosting server sends the
`Content-Security-Policy` header. The kit therefore emits no inline script
and no inline event handler: the Vite build inlines the React runtime into
the bundle, and React attaches the handlers, so a strict host policy
(`script-src 'self'`) is sufficient. If a project adds a stricter policy, it
is declared at the host, not in the bundle.

## 4. What the code refuses

| Refused                                     | Where                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `react` in `core`, `sdk` or `viewmodels`    | ESLint `no-restricted-imports`                                        |
| A View or ViewModel that fetches            | The architecture test + the layer rule                                |
| A forbidden relative import                 | `tests/architecture/architecture.test.ts`                             |
| A status the SDK does not map               | `toSdkError` falls through to `server`                                |
| A secret in the tree                        | `scripts/leak-guard.sh`                                              |
| Remote code                                 | `no eval`, `no new Function`, no remote `<script>` (the layer rules) |

## 5. Secrets, tokens and the bundle

- **No secret is committed.** The kit ships `.env.example` and no secret
  value; `scripts/leak-guard.sh` fails the tree on a high-signal secret
  pattern.
- **The token is not at rest.** The `TokenStore` port supplies it per call;
  the SDK holds no cached copy and `localStorage` is not used for it.
- **Nothing is exposed to a third-party page.** The SPA runs on its own
  origin and ships no content script, no `web_accessible_resources` and no
  cross-origin message channel.

## 6. Known gaps of the template

| Gap                                                | Consequence                                                             | Fix                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| No CSP is declared by the kit                      | The policy is whatever the host sends                                    | Set `Content-Security-Policy` at the hosting layer              |
| The token store in `App.tsx` returns `null`        | The shipped screen runs unauthenticated                                  | Point `TokenStore` at the real session                           |
| The `baseUrl` is same-origin (`""`)                | The SDK hits the same origin                                             | Set `VITE_API_BASE_URL` when the backend lives elsewhere        |

## 7. Worked example

The SDK never persists a token:

```ts
const token = await config.tokenStore.getAccessToken();
if (token !== null) headers["authorization"] = `Bearer ${token}`;
```

The token is read per call and used per call; nothing of it survives the call.

## Do / Don't

| Do                                                    | Don't                                      |
| ----------------------------------------------------- | ------------------------------------------ |
| Validate a response before the value                  | Trust a body because the route is known    |
| Set a strict CSP at the host                           | Add `unsafe-eval` to make a build work     |
| Read the token per call through the `TokenStore`       | Persist the token in `localStorage`        |
| Keep `host_permissions`-style grants out of the build  | Ship a secret in the bundle                |

## See also

- [The SDK Request Boundary](07-messaging-and-sender-validation.md)
- [Environment & Configuration](06-manifest-and-permission-engineering.md)
