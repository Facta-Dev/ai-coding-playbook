// <app> - SDK: the typed API client (PLAYBOOK_FRONTEND §3).
//
// The SDK is the only thing that talks to the backend. Its namespace mirrors
// the URL playbook: sdk.app.funnels.leads maps 1:1 to
// /api/v1/app/funnels/leads. It receives its platform ports (transport,
// token store) at construction, so it imports core only and never React.
//
// Every call returns Result<T, SdkError> rather than throwing; the error half
// is the typed envelope of PLAYBOOK_FRONTEND §3.4. Minimal client: the auth
// header and the error mapping are implemented; the tenant, correlation,
// idempotency and retry interceptors are left out on purpose (see README
// "What is not included").

import { type TokenStore, type Transport, type TransportInit, type TransportResponse } from "../core/ports";
import { err, ok, type Result } from "../core/result";
import { type Lead, type LeadId, type SdkError, type Stage } from "../core/types";

export interface SdkConfig {
  readonly baseUrl: string;
  readonly transport: Transport;
  readonly tokenStore: TokenStore;
}

export interface AppSdk {
  readonly app: {
    readonly funnels: {
      readonly leads: {
        get(id: LeadId, opts?: { readonly signal?: AbortSignal }): Promise<Result<Lead, SdkError>>;
        update(
          id: LeadId,
          input: { readonly stage: Stage },
          opts?: { readonly signal?: AbortSignal },
        ): Promise<Result<Lead, SdkError>>;
      };
    };
  };
}

/** The canonical envelope is `{error:{...}}`; tolerate a flat body for
 *  older backends while the fleet migrates. */
function errorPayload(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const record = body as Record<string, unknown>;
  const nested = record["error"];
  return typeof nested === "object" && nested !== null
    ? (nested as Record<string, unknown>)
    : record;
}

function readString(body: unknown, key: string): string | undefined {
  const value = errorPayload(body)?.[key];
  if (typeof value === "string") return value;
  return undefined;
}

function readFields(body: unknown): Record<string, string> {
  const fields = errorPayload(body)?.["fields"];
  if (typeof fields !== "object" || fields === null) return {};
  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    if (typeof value === "string") entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}

/** Maps the backend status + error envelope into the typed SdkError. */
function toSdkError(status: number, body: unknown): SdkError {
  switch (status) {
    case 400:
    case 422:
      return { kind: "validation", fields: readFields(body) };
    case 401:
      return { kind: "unauthenticated" };
    case 403: {
      const requiredPermission = readString(body, "requiredPermission");
      return requiredPermission === undefined
        ? { kind: "forbidden" }
        : { kind: "forbidden", requiredPermission };
    }
    case 404:
      return { kind: "not-found" };
    case 409:
      return { kind: "conflict" };
    case 429:
      return { kind: "rate-limited" };
  }
  return { kind: "server" };
}

export function createSdk(config: SdkConfig): AppSdk {
  async function request<T>(
    path: string,
    init?: { method?: string; body?: unknown; signal?: AbortSignal },
  ): Promise<Result<T, SdkError>> {
    const token = await config.tokenStore.getAccessToken();
    const headers: Record<string, string> = {};
    if (token !== null) headers["authorization"] = `Bearer ${token}`;

    const transportInit: TransportInit = {
      ...(init?.method !== undefined ? { method: init.method } : {}),
      ...(init?.body !== undefined ? { body: init.body } : {}),
      ...(init?.signal !== undefined ? { signal: init.signal } : {}),
      headers,
    };

    let response: TransportResponse;
    try {
      response = await config.transport.request(`${config.baseUrl}${path}`, transportInit);
    } catch {
      return err<T, SdkError>({ kind: "network" });
    }

    if (response.status >= 200 && response.status < 300) {
      return ok<T, SdkError>(response.body as T);
    }
    return err<T, SdkError>(toSdkError(response.status, response.body));
  }

  const leadsPath = (id: LeadId): string =>
    `/api/v1/app/funnels/leads/${encodeURIComponent(id)}`;

  const get = (id: LeadId, opts?: { readonly signal?: AbortSignal }): Promise<Result<Lead, SdkError>> =>
    request<Lead>(leadsPath(id), opts);

  const update = (
    id: LeadId,
    input: { readonly stage: Stage },
    opts?: { readonly signal?: AbortSignal },
  ): Promise<Result<Lead, SdkError>> =>
    request<Lead>(leadsPath(id), {
      method: "PATCH",
      body: input,
      ...(opts?.signal !== undefined ? { signal: opts.signal } : {}),
    });

  return {
    app: {
      funnels: {
        leads: { get, update },
      },
    },
  };
}
