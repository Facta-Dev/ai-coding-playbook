// <app> — the policy contract.
//
// Two surfaces, the same meaning: the administrator policy — published as a
// JSON document, a Windows registry key set or a macOS plist (the keys are
// the PascalCase policy names, `additionalProperties: false`) — and the
// resolved settings every feature reads, where each key has a value. The
// reader in `src/infrastructure/policy/` applies the precedence policy >
// user > default; the schema here is the shape of each surface.

import { z } from "zod";

/** The base URL of the backend; the allowlist check is the resolver's job. */
export const TenantUrlSchema = z.string();
export type TenantUrl = z.infer<typeof TenantUrlSchema>;

export const SSO_MODES = ["oidc", "local"] as const;
export type SsoMode = (typeof SSO_MODES)[number];
export const SsoModeSchema = z.enum(SSO_MODES);

export const UPDATE_CHANNELS = ["stable", "beta", "canary"] as const;
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];
export const UpdateChannelSchema = z.enum(UPDATE_CHANNELS);

/** How the realtime connection to the backend is opened. */
export const REALTIME_MODES = ["auto", "websocket", "sse", "polling", "off"] as const;
export type RealtimeMode = (typeof REALTIME_MODES)[number];
export const RealtimeModeSchema = z.enum(REALTIME_MODES);

/** GPU compositing: forced off lands in the safe-mode rendering path. */
export const HARDWARE_ACCELERATIONS = ["auto", "off"] as const;
export type HardwareAcceleration = (typeof HARDWARE_ACCELERATIONS)[number];
export const HardwareAccelerationSchema = z.enum(HARDWARE_ACCELERATIONS);

/** The diagnostics governance level; `off` sends nothing. */
export const TELEMETRY_LEVELS = ["off", "errors", "full"] as const;
export type TelemetryLevel = (typeof TELEMETRY_LEVELS)[number];
export const TelemetryLevelSchema = z.enum(TELEMETRY_LEVELS);

export const FeatureFlagMapSchema = z.record(z.string(), z.boolean());

/**
 * The administrator policy document, as it is read from the registry, the
 * plist or the policy JSON. Unknown keys are rejected, missing keys keep the
 * default: the document is validated, not completed, here.
 */
export const PolicyDocumentSchema = z.strictObject({
  TenantUrl: TenantUrlSchema.optional(),
  SsoMode: SsoModeSchema.optional(),
  UpdatesEnabled: z.boolean().optional(),
  UpdateChannel: UpdateChannelSchema.optional(),
  RealtimeMode: RealtimeModeSchema.optional(),
  HardwareAcceleration: HardwareAccelerationSchema.optional(),
  DevToolsEnabled: z.boolean().optional(),
  TelemetryLevel: TelemetryLevelSchema.optional(),
  KillSwitch: z.boolean().optional(),
  FeatureFlags: FeatureFlagMapSchema.optional(),
  DataRetentionDays: z.number().int().nonnegative().optional(),
  AllowUserSettings: z.boolean().optional(),
});

export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;

/** The resolved settings: every key always has a value. */
export const ResolvedPolicySchema = z.strictObject({
  tenantUrl: TenantUrlSchema,
  ssoMode: SsoModeSchema,
  updatesEnabled: z.boolean(),
  updateChannel: UpdateChannelSchema,
  realtimeMode: RealtimeModeSchema,
  hardwareAcceleration: HardwareAccelerationSchema,
  devToolsEnabled: z.boolean(),
  telemetryLevel: TelemetryLevelSchema,
  killSwitch: z.boolean(),
  featureFlags: FeatureFlagMapSchema,
  dataRetentionDays: z.number().int().nonnegative(),
  allowUserSettings: z.boolean(),
});

export type ResolvedPolicy = z.infer<typeof ResolvedPolicySchema>;

/** The built-in safe defaults, used when no policy source provides a key. */
export const POLICY_DEFAULTS: ResolvedPolicy = {
  tenantUrl: "",
  ssoMode: "oidc",
  updatesEnabled: true,
  updateChannel: "stable",
  realtimeMode: "auto",
  hardwareAcceleration: "auto",
  devToolsEnabled: false,
  telemetryLevel: "errors",
  killSwitch: false,
  featureFlags: {},
  dataRetentionDays: 30,
  allowUserSettings: true,
};
