// <app> - SDK: the web transport adapter.
//
// The default Transport for the web SPA, built on fetch (available on web,
// native and the extension service worker). Tests never touch this file: they
// inject a fake transport through the port.

import { type Transport, type TransportInit, type TransportResponse } from "../core/ports";

export const fetchTransport: Transport = {
  async request(path: string, init?: TransportInit): Promise<TransportResponse> {
    const requestInit: RequestInit = {
      method: init?.method ?? "GET",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      ...(init?.signal !== undefined ? { signal: init.signal } : {}),
    };
    const response = await fetch(path, requestInit);
    const body: unknown = await response.json().catch(() => null);
    return { status: response.status, body };
  },
};
