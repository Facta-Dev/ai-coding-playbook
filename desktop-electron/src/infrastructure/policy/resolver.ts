// <app> — the policy resolver (pure).
//
// Precedence: managed (the administrator) > user > default (docs/11). The
// sources arrive already validated (`parsePolicyDocument`, schema.ts): an
// invalid source is ignored by the reader, never guessed, and the resolver
// overlays the valid ones over the built-in defaults. Every key of the
// resolved settings always keeps a value.

import type { PolicyDocument, ResolvedPolicy } from "../../contracts";
import { POLICY_DEFAULTS } from "../../contracts";

/** The policy sources, strongest last. */
export interface PolicySources {
  /** The administrator policy, when the machine provides one. */
  managed?: PolicyDocument;
  /** The user's own settings, when they provide any. */
  user?: PolicyDocument;
}

function overlay(source: PolicyDocument | undefined, resolved: ResolvedPolicy): ResolvedPolicy {
  if (source === undefined) return resolved;
  if (source.TenantUrl !== undefined) resolved.tenantUrl = source.TenantUrl;
  if (source.SsoMode !== undefined) resolved.ssoMode = source.SsoMode;
  if (source.UpdatesEnabled !== undefined) resolved.updatesEnabled = source.UpdatesEnabled;
  if (source.UpdateChannel !== undefined) resolved.updateChannel = source.UpdateChannel;
  if (source.RealtimeMode !== undefined) resolved.realtimeMode = source.RealtimeMode;
  if (source.HardwareAcceleration !== undefined) {
    resolved.hardwareAcceleration = source.HardwareAcceleration;
  }
  if (source.DevToolsEnabled !== undefined) resolved.devToolsEnabled = source.DevToolsEnabled;
  if (source.TelemetryLevel !== undefined) resolved.telemetryLevel = source.TelemetryLevel;
  if (source.KillSwitch !== undefined) resolved.killSwitch = source.KillSwitch;
  if (source.FeatureFlags !== undefined) resolved.featureFlags = source.FeatureFlags;
  if (source.DataRetentionDays !== undefined) resolved.dataRetentionDays = source.DataRetentionDays;
  if (source.AllowUserSettings !== undefined) resolved.allowUserSettings = source.AllowUserSettings;
  return resolved;
}

/** The resolved settings: managed over user over the defaults. */
export function resolvePolicy(
  sources: PolicySources,
  defaults: ResolvedPolicy = POLICY_DEFAULTS,
): ResolvedPolicy {
  const resolved: ResolvedPolicy = {
    ...defaults,
    featureFlags: { ...defaults.featureFlags },
  };
  overlay(sources.user, resolved);
  overlay(sources.managed, resolved);
  return resolved;
}
