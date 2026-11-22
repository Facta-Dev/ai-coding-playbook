// <app> — the privileged `app://` scheme and its handler.
//
// The renderer loads `app://bundle/index.html`, served by `protocol.handle`
// from the built renderer bundle (dist/renderer in dev, the ASAR path when
// packaged). Never `file://`, never remote code. The handler contains every
// request inside the renderer root (path traversal is a test class in the
// playbook, Appendix E) and stamps the strict CSP on every answer —
// `connect-src 'none'`: the renderer has no network of its own; everything
// it needs travels the typed rpc.

import { app, net, protocol } from "electron";
import { join, posix, sep } from "node:path";
import { pathToFileURL } from "node:url";

/** The origin every window loads and every rpc sender must carry. */
export const APP_ORIGIN = "app://bundle";

/** The strict CSP, header-set by the handler (PLAYBOOK_DESKTOP_ELECTRON §9.2). */
export const APP_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; " +
  "base-uri 'none'; form-action 'none'";

/** Declares the scheme's privileges. Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Installs the handler. Runs after `app.whenReady()`. */
export function installAppProtocol(): void {
  const rendererRoot = join(app.getAppPath(), "dist", "renderer");

  protocol.handle("app", async (request) => {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return new Response("bad request", { status: 400 });
    }
    if (url.host !== "bundle") return new Response("forbidden", { status: 403 });

    let relative: string;
    try {
      relative = posix.normalize(decodeURIComponent(url.pathname));
    } catch {
      return new Response("bad request", { status: 400 });
    }

    // Path containment: the resolved candidate must stay inside the root.
    const candidate = join(rendererRoot, relative);
    if (candidate !== rendererRoot && !candidate.startsWith(rendererRoot + sep)) {
      return new Response("forbidden", { status: 403 });
    }

    const file = await net.fetch(pathToFileURL(candidate).toString());
    const headers = new Headers(file.headers);
    headers.set("Content-Security-Policy", APP_CSP);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(file.body, { status: file.status, headers });
  });
}
