// <app> - lead detail View tests. Each status is rendered from a stubbed
// ViewModel via react-dom/server, so the test runs in node (no DOM, no jsdom).
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Transport } from "../../../src/core/ports";
import { asLeadId, type Lead } from "../../../src/core/types";
import { createSdk } from "../../../src/sdk";
import { createLeadDetailViewModel } from "../../../src/viewmodels/lead-detail-view-model";
import { LeadDetailView } from "../../../src/views/LeadDetailView";

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

const tokenStore = { getAccessToken: () => Promise.resolve(null) };

function viewModelWith(transport: Transport) {
  return createLeadDetailViewModel({
    sdk: createSdk({ baseUrl: "", transport, tokenStore }),
    leadId: asLeadId("lead-1"),
    navigator: { go: (): void => {} },
    notifier: { success: (): void => {}, error: (): void => {} },
  });
}

function render(viewModel: ReturnType<typeof viewModelWith>): string {
  return renderToString(createElement(LeadDetailView, { viewModel }));
}

describe("lead detail view", () => {
  it("renders the loading status", () => {
    const viewModel = viewModelWith({
      request: () => Promise.resolve({ status: 200, body: makeLead() }),
    });
    expect(render(viewModel)).toContain("Loading lead...");
  });

  it("renders the ready status with the lead", async () => {
    const viewModel = viewModelWith({
      request: () => Promise.resolve({ status: 200, body: makeLead() }),
    });
    await viewModel.load();
    const html = render(viewModel);
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("ada@example.com");
    expect(html).toContain("Stage:");
  });

  it("renders the not-found status", async () => {
    const viewModel = viewModelWith({
      request: () => Promise.resolve({ status: 404, body: null }),
    });
    await viewModel.load();
    expect(render(viewModel)).toContain("Lead not found.");
  });

  it("renders the forbidden status", async () => {
    const viewModel = viewModelWith({
      request: () => Promise.resolve({ status: 403, body: null }),
    });
    await viewModel.load();
    expect(render(viewModel)).toContain("You do not have access to this lead.");
  });

  it("renders the error status with the mapped message", async () => {
    const viewModel = viewModelWith({
      request: () => Promise.reject(new Error("offline")),
    });
    await viewModel.load();
    expect(render(viewModel)).toContain("The network is unavailable.");
  });
});
