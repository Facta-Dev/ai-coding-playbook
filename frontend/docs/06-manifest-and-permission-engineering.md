# Environment & Configuration

**The manifest does not exist in this kit.** The reference extension kit
declares a `src/manifest.ts` as the extension's public contract - permissions,
host grants, the CSP, the entry points. A web SPA has no such declaration.
What it has instead is a build-time environment, and the same discipline
applies: one source of truth, no secrets, every addition is a review.

## 1. One source of truth for the environment

`.env.example` is the single file that names every build-time variable the
kit may read:

```text
# VITE_API_BASE_URL=https://api.example.com
```

Vite exposes only `VITE_`-prefixed names to the bundle; anything else stays
in the build process. The one variable the kit understands is
`VITE_API_BASE_URL`, the origin the SDK prepends to its paths. The shipped
composition root uses the same-origin default (`baseUrl: ""`); point it at
the API origin when the backend lives elsewhere.

## 2. The config posture

| Declaration      | Value                     | Why it is there                             |
| ---------------- | ------------------------- | ------------------------------------------- |
| `VITE_` prefix   | only `VITE_*` reaches the bundle | Everything else stays server-side     |
| access token     | supplied at runtime       | The `TokenStore` port, never the build      |
| secrets          | none                      | The SPA is a public client                  |
| `.env.example`   | committed, `.env.*` ignored | The shape is reviewed, the values are not  |

The `.gitignore` ignores `.env` and `.env.*` but keeps `.env.example`, so the
reviewed shape ships and the local values do not.

## 3. Adding a variable is a review

A new environment variable changes what a deployed build can read and what an
attacker gets if the bundle is inspected. The kit makes that a first-class
step:

1. Add the `VITE_` name to `.env.example` with a one-line justification.
2. Read it through a port or a config module, never directly in a View.
3. Run `make ci` and the eval `the SDK layer imports no React`, which fails if
   the config change leaked a platform import into the shared layers.

## 4. What the kit deliberately does not declare

| Not declared        | Consequence                                                        |
| ------------------- | ------------------------------------------------------------------ |
| a service worker    | No background context ships; see [Service Worker Lifetime](02-service-worker-lifetime.md) |
| a content script    | No code runs in a page this app does not own                        |
| a CSP key           | The CSP is set by the hosting server, not by the bundle              |
| a manifest          | Nothing to review for permissions; the review is the `.env.example` diff |

These are gaps of the template, not accidents: each one is a deliberate
omission that a project re-adds with a reason.

## 5. Worked example

The SDK reads the base URL at construction:

```ts
const sdk = createSdk({ baseUrl: "", transport: fetchTransport, tokenStore });
```

`baseUrl` is the composition root's decision; the SDK never reads
`import.meta.env` itself, so the SDK stays platform-agnostic and testable.

## Do / Don't

| Do                                            | Don't                                        |
| --------------------------------------------- | -------------------------------------------- |
| Keep every `VITE_` name in `.env.example`     | Read `import.meta.env` inside `src/sdk/`     |
| Read the token through the `TokenStore` port   | Bake a token into the build                  |
| Treat a config addition as a review            | Add a `VITE_` variable on the way past        |

## See also

- [Security & CSP](10-security-and-csp.md)
- [The SDK Request Boundary](07-messaging-and-sender-validation.md)
