# `@<scope>/<app>-sdk`

The typed REST client of the `<app>` backend, as a standalone package.

## Invariants

- **No electron, no react, no node.** The same code runs in the core
  process, in a browser page and in a test. Typecheck it with
  `pnpm --filter @<scope>/<app>-sdk typecheck`.
- **Routes live here.** `SDK_PATHS` is the only place a backend path is
  built (PLAYBOOK_URLS.md); the version and the namespace never authorize
  anything.
- **Errors are values.** `notes.add` answers `SdkResult<SdkNote>`, never an
  exception. The error envelope of the backend (code, message,
  requiredPermission, correlationId) wins over the HTTP status; an unknown
  code or an unreadable answer maps to `server` or `internal` by status.
- **The transport is injected.** `createSdk({ fetch, baseUrl, token })`
  takes the fetch; nothing here reads a global. `token` is a string or a
  reader for a token the session refreshes.
- **Shapes are declared, not imported.** The `SdkNote` shape mirrors
  `src/contracts/notes.ts`; the core validates every answer against the
  contract, so drift between the two ends fails loudly.

## Usage

```ts
import { createSdk } from "@<scope>/<app>-sdk";

const sdk = createSdk({ fetch, baseUrl: policy.tenantUrl, token: () => session.token });

const result = await sdk.notes.add({ title: "First", body: "hello" });
if (!result.ok) return; // result.error.code ∈ SDK_ERROR_CODES
```
