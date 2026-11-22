// <app> — the policy resolver tests: managed > user > default.
//
// The precedence is the contract (docs/11): the administrator wins over the
// user, the user wins over the built-in defaults, and every resolved key
// keeps a value. The defaults object must never be mutated by a resolution —
// two tenants in one process read the same safe table.

import { describe, expect, it } from "vitest";
import { POLICY_DEFAULTS } from "../../src/contracts";
import { resolvePolicy } from "../../src/infrastructure/policy/resolver";

describe("resolvePolicy", () => {
  it("answers the built-in defaults without any source", () => {
    expect(resolvePolicy({})).toEqual(POLICY_DEFAULTS);
  });

  it("layers a user policy over the defaults", () => {
    const resolved = resolvePolicy({
      user: { RealtimeMode: "sse", FeatureFlags: { betaNotes: true } },
    });
    expect(resolved.realtimeMode).toBe("sse");
    expect(resolved.featureFlags).toEqual({ betaNotes: true });
    // Every untouched key keeps its default.
    expect(resolved.telemetryLevel).toBe(POLICY_DEFAULTS.telemetryLevel);
    expect(resolved.dataRetentionDays).toBe(POLICY_DEFAULTS.dataRetentionDays);
  });

  it("layers the managed policy over the user policy", () => {
    const resolved = resolvePolicy({
      user: { TelemetryLevel: "full", UpdatesEnabled: true },
      managed: { TelemetryLevel: "off", KillSwitch: true },
    });
    expect(resolved.telemetryLevel).toBe("off"); // managed wins
    expect(resolved.updatesEnabled).toBe(true); // user wins over the default
    expect(resolved.killSwitch).toBe(true);
  });

  it("replaces the whole feature-flag map, never merges it", () => {
    const resolved = resolvePolicy(
      { managed: { FeatureFlags: { managedFlag: true } } },
      { ...POLICY_DEFAULTS, featureFlags: { userFlag: true, managedFlag: false } },
    );
    expect(resolved.featureFlags).toEqual({ managedFlag: true });
  });

  it("never mutates the defaults table", () => {
    const before = structuredClone(POLICY_DEFAULTS);
    resolvePolicy({ user: { HardwareAcceleration: "off", FeatureFlags: { a: true } } });
    expect(POLICY_DEFAULTS).toEqual(before);
    resolvePolicy({ managed: { FeatureFlags: { b: true } } });
    expect(POLICY_DEFAULTS.featureFlags).toEqual(before.featureFlags);
  });

  it("keeps a key the sources do not mention", () => {
    const resolved = resolvePolicy({ managed: { TenantUrl: "https://notes.example" } });
    expect(resolved.tenantUrl).toBe("https://notes.example");
    expect(resolved.ssoMode).toBe(POLICY_DEFAULTS.ssoMode);
    expect(resolved.devToolsEnabled).toBe(POLICY_DEFAULTS.devToolsEnabled);
  });
});
