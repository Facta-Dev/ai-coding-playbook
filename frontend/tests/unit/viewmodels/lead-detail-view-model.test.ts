// <app> - lead detail ViewModel tests. Hermetic: the ViewModel is driven
// directly against a fake SDK and fake ports, with no DOM and no network.
import { describe, expect, it } from "vitest";
import { type Transport, type TransportResponse } from "../../../src/core/ports";
import { routes } from "../../../src/core/routes";
import { asLeadId, type Lead, type Stage } from "../../../src/core/types";
import { createSdk, type AppSdk } from "../../../src/sdk";
import { createLeadDetailViewModel } from "../../../src/viewmodels/lead-detail-view-model";

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

function sdkWith(transport: Transport): AppSdk {
  return createSdk({ baseUrl: "", transport, tokenStore });
}

/** Returns the canned lead for GET and the updated stage for PATCH. */
function leadTransport(lead: Lead): Transport {
  return {
    request: (_path, init) => {
      if (
        init?.method === "PATCH" &&
        typeof init.body === "object" &&
        init.body !== null &&
        "stage" in init.body
      ) {
        return Promise.resolve({
          status: 200,
          body: { ...lead, stage: (init.body as { stage: Stage }).stage },
        });
      }
      return Promise.resolve({ status: 200, body: lead });
    },
  };
}

function errorTransport(status: number, body: unknown = null): Transport {
  return {
    request: (): Promise<TransportResponse> => Promise.resolve({ status, body }),
  };
}

function makeFakes() {
  const navigated: string[] = [];
  const notifications: string[] = [];
  return {
    navigator: {
      go: (route: string): void => {
        navigated.push(route);
      },
    },
    notifier: {
      success: (key: string): void => {
        notifications.push(key);
      },
      error: (key: string): void => {
        notifications.push(key);
      },
    },
    navigated,
    notifications,
  };
}

function makeViewModel(transport: Transport, fakes = makeFakes()) {
  return createLeadDetailViewModel({
    sdk: sdkWith(transport),
    leadId: asLeadId("lead-1"),
    navigator: fakes.navigator,
    notifier: fakes.notifier,
  });
}

describe("lead detail view model", () => {
  it("starts in the loading status", () => {
    const viewModel = makeViewModel(leadTransport(makeLead()));
    expect(viewModel.getState().status).toBe("loading");
    expect(viewModel.getState().lead).toBeNull();
    expect(viewModel.getState().errorKey).toBeNull();
  });

  it("goes to ready with the lead on a successful load", async () => {
    const viewModel = makeViewModel(leadTransport(makeLead()));
    await viewModel.load();
    expect(viewModel.getState().status).toBe("ready");
    expect(viewModel.getState().lead?.name).toBe("Ada Lovelace");
  });

  it("goes to not-found when the SDK reports 404", async () => {
    const viewModel = makeViewModel(errorTransport(404));
    await viewModel.load();
    expect(viewModel.getState().status).toBe("not-found");
  });

  it("goes to forbidden when the SDK reports 403", async () => {
    const viewModel = makeViewModel(errorTransport(403));
    await viewModel.load();
    expect(viewModel.getState().status).toBe("forbidden");
  });

  it("goes to error with a message key on a network failure", async () => {
    const transport: Transport = {
      request: () => Promise.reject(new Error("offline")),
    };
    const viewModel = makeViewModel(transport);
    await viewModel.load();
    expect(viewModel.getState().status).toBe("error");
    expect(viewModel.getState().errorKey).toBe("lead.error.network");
  });

  it("moves the stage and notifies on success", async () => {
    const fakes = makeFakes();
    const viewModel = makeViewModel(leadTransport(makeLead()), fakes);
    await viewModel.load();
    await viewModel.moveToStage("qualified");
    expect(viewModel.getState().lead?.stage).toBe("qualified");
    expect(fakes.notifications).toEqual(["lead.moved"]);
  });

  it("keeps the lead and surfaces the error when the update fails", async () => {
    const transport: Transport = {
      request: (_path, init) =>
        init?.method === "PATCH"
          ? Promise.resolve({ status: 500, body: null })
          : Promise.resolve({ status: 200, body: makeLead() }),
    };
    const viewModel = makeViewModel(transport);
    await viewModel.load();
    await viewModel.moveToStage("qualified");
    expect(viewModel.getState().isSaving).toBe(false);
    expect(viewModel.getState().errorKey).toBe("lead.error.server");
    expect(viewModel.getState().lead?.stage).toBe("new");
  });

  it("navigates to the campaign route", async () => {
    const fakes = makeFakes();
    const viewModel = makeViewModel(leadTransport(makeLead()), fakes);
    await viewModel.load();
    viewModel.openCampaign();
    expect(fakes.navigated).toEqual([routes.app.campaign("campaign-1")]);
  });

  it("notifies subscribers on each state change", async () => {
    const viewModel = makeViewModel(leadTransport(makeLead()));
    let calls = 0;
    viewModel.subscribe(() => {
      calls += 1;
    });
    await viewModel.load();
    expect(calls).toBe(2); // loading, then ready
  });

  it("stops notifying after unsubscribe", async () => {
    const viewModel = makeViewModel(leadTransport(makeLead()));
    let calls = 0;
    const unsubscribe = viewModel.subscribe(() => {
      calls += 1;
    });
    await viewModel.load();
    unsubscribe();
    await viewModel.load();
    expect(calls).toBe(2);
  });
});
