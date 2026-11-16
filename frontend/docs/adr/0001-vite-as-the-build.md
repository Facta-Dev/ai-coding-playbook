# ADR 0001 - Vite as the build

- **Status**: Accepted
- **Date**: 2026
- **Scope**: the build of the frontend template

## Context

A React 19 web SPA needs a fast development loop, a production bundle, and a
test runner that shares the same module graph. The template needed a bundler
that:

1. produces a plain static bundle in `dist/` that any static host can serve;
2. understands TypeScript and JSX out of the box, with no second build system;
3. inlines the React runtime so a strict host CSP (`script-src 'self'`) is
   sufficient;
4. keeps the `tsconfig` and the editor in agreement with the bundler, so an
   import reads the same everywhere.

The backend kits in this repository use different toolchains; the frontend
needed one that produces a browser bundle rather than a server binary.

## Decision

**Use Vite 7 with the React plugin, `index.html` as the entry and
`src/main.tsx` as the browser entry point.**

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
});
```

The consequences that matter:

- **`index.html` is the entry.** Vite reads it, resolves `src/main.tsx` and
  emits `dist/`. There is no `entrypoints/` folder and no manifest: a web
  SPA has one page, one entry and one bundle.
- **`dist/` is a plain static site.** The output needs no runtime and no
  server; any static host serves it.
- **The React runtime is bundled.** No inline script and no inline event
  handler ship, so a strict host CSP is satisfied without `unsafe-inline`.

## Alternatives considered

| Option                | Why not                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Next.js               | A framework with server rendering and routing conventions; the kit is a client-only SPA with its own MVVM split, so a framework would own the seams this kit is built to teach. |
| webpack               | A larger configuration surface for the same output; Vite gives the same bundle with less to review.  |
| esbuild + shell script | The HTML entry, the dev server and the production build would all be hand-wired; more script to maintain, less to review. |
| No bundler            | Bare ES modules would leak the React source and force a module graph the host would have to serve; the production build still needs a bundler. |

## Consequences

- The build output is a plain static SPA: `dist/index.html` and the bundled
  JavaScript and CSS.
- A new screen means a new file under `src/views/`, a ViewModel under
  `src/viewmodels/` and a route builder under `src/core/routes.ts`; no entry
  list to maintain.
- The dev server and the production build share one config, so a build-only
  failure is rare.

## See also

- [ADR 0002 - npm and the committed lockfile](0002-npm-and-the-committed-lockfile.md)
- [Directory Structure & Project Skeleton](../05-directory-structure.md)
- [Testing & CI](../12-testing-and-ci.md)
