// <app> - SDK contract tests. The SDK is the only thing that talks to the
// backend; these tests pin the request shape and the error mapping with a fake
// transport (no network).
import { describe, expect, it } from "vitest";
import { type Transport, type TransportInit, type TransportResponse } from "../../../src/core/ports";
import { asLeadId, type Lead } from "../../../src/core/types";
import { createSdk } from "../../../src/sdk";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: asLeadId("lead-1"),
    name: "Ada Lovelace",
    email: "ada@example.com",
    stage: "new",
    campaignId: "campaign-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface RecordedCall {
  readonly path: string;
  readonly init: TransportInit | undefined;
}

function recordingTransport(response: TransportResponse): Transport & { readonly calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  return {
    calls,
    request: (path, init) => {
      calls.push({ path, init });
      return Promise.resolve(response);
    },
  };
}

const tokenStore = {
  getAccessToken: () => Promise.resolve("access-token"),
};

function makeSdk(transport: Transport) {
  return createSdk({ baseUrl: "", transport, tokenStore });
}

describe("sdk", () => {
  it("builds the lead path from the URL playbook", async () => {
    const transport = recordingTransport({ status: 200, body: makeLead() });
    await makeSdk(transport).app.funnels.leads.get(asLeadId("lead-1"));
    expect(transport.calls[0]?.path).toBe("/api/v1/app/funnels/leads/lead-1");
  });

  it("attaches the bearer token from the token store", async () => {
    const transport = recordingTransport({ status: 200, body: makeLead() });
    await makeSdk(transport).app.funnels.leads.get(asLeadId("lead-1"));
    expect(transport.calls[0]?.init?.headers?.["authorization"]).toBe("Bearer access-token");
  });

  it("returns the lead on a 200", async () => {
    const transport = recordingTransport({ status: 200, body: makeLead() });
    const result = await makeSdk(transport).app.funnels.leads.get(asLeadId("lead-1"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("Ada Lovelace");
  });

  it("maps a 404 into a not-found SdkError", async () => {
    const transport = recordingTransport({ status: 404, body: null });
    const result = await makeSdk(transport).app.funnels.leads.get(asLeadId("lead-1"));
    expect(result).toMatchObject({ ok: false, error: { kind: "not-found" } });
  });

  it("maps a 403 into a forbidden SdkError with the required permission", async () => {
    const transport = recordingTransport({
      status: 403,
      body: { requiredPermission: "funnels.leads.read" },
    });
    const result = await makeSdk(transport).app.funnels.leads.get(asLeadId("lead-1"));
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "forbidden", requiredPermission: "funnels.leads.read" },
    });
  });

  it("maps a transport failure into a network SdkError", async () => {
    const transport: Transport = {
      request: () => Promise.reject(new Error("offline")),
    };
    const result = await makeSdk(transport).app.funnels.leads.get(asLeadId("lead-1"));
    expect(result).toMatchObject({ ok: false, error: { kind: "network" } });
  });

  it("updates the stage through the PATCH verb", async () => {
    const transport = recordingTransport({ status: 200, body: makeLead({ stage: "qualified" }) });
    const result = await makeSdk(transport).app.funnels.leads.update(asLeadId("lead-1"), {
      stage: "qualified",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.stage).toBe("qualified");
    expect(transport.calls[0]?.init?.method).toBe("PATCH");
    expect(transport.calls[0]?.init?.body).toEqual({ stage: "qualified" });
  });
});
