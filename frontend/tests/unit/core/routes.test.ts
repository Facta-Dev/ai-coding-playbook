// <app> - route builder tests. Paths are built in exactly one place (core),
// mirroring the frontend half of PLAYBOOK_URLS.md.
import { describe, expect, it } from "vitest";
import { routes } from "../../../src/core/routes";

describe("routes", () => {
  it("builds the lead detail path", () => {
    expect(routes.app.lead("lead-1")).toBe("/app/funnels/leads/lead-1");
  });

  it("builds the campaign path", () => {
    expect(routes.app.campaign("campaign-1")).toBe("/app/projects/campaign-1");
  });
});
