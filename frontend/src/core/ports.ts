// <app> - core: the platform ports (PLAYBOOK_FRONTEND §3.5).
//
// The SDK and the ViewModels receive these at construction, so they stay
// platform-agnostic. Each platform (web, native, extension) supplies its own
// adapters; the composition root (src/App.tsx) wires the web ones.

/** A minimal HTTP-like transport. The web adapter is src/sdk/fetch-transport.ts. */
export interface Transport {
  request(path: string, init?: TransportInit): Promise<TransportResponse>;
}

export interface TransportInit {
  readonly method?: string;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
}

export interface TransportResponse {
  readonly status: number;
  /** The parsed JSON body, or null when there is no body. */
  readonly body: unknown;
}

/** Supplies the access token for the auth header. Never the refresh token. */
export interface TokenStore {
  getAccessToken(): Promise<string | null>;
}

/** Navigation, so a ViewModel can route without a router library. */
export interface Navigator {
  go(route: string): void;
}

/** User-visible notifications, keyed by message id (PLAYBOOK_FRONTEND §6.6). */
export interface Notifier {
  success(messageKey: string): void;
  error(messageKey: string): void;
}
