// <app> - core: the pure types shared by every layer.
//
// This file holds the domain types (Lead, Stage) and the typed error envelope
// (PLAYBOOK_FRONTEND §3.4). It imports nothing, so it can be imported from the
// SDK, the ViewModels and the Views without pulling any platform concern in.

/** A branded lead id, so a raw string cannot be passed where a lead id belongs. */
export type LeadId = string & { readonly __brand: "LeadId" };

/** The pipeline stages a lead moves through. */
export const STAGES = ["new", "contacted", "qualified", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

/** A lead as the backend returns it. */
export interface Lead {
  readonly id: LeadId;
  readonly name: string;
  readonly email: string;
  readonly stage: Stage;
  readonly campaignId: string;
  readonly createdAt: string;
}

/** Brands a raw string as a lead id. */
export function asLeadId(id: string): LeadId {
  return id as LeadId;
}

/**
 * The typed error envelope the SDK maps every backend failure into
 * (PLAYBOOK_FRONTEND §3.4). The SDK returns it as the error half of a Result;
 * ViewModels translate it into view state and never inspect raw HTTP.
 */
export type SdkError =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "forbidden"; readonly requiredPermission?: string }
  | { readonly kind: "not-found" }
  | { readonly kind: "conflict" }
  | { readonly kind: "validation"; readonly fields: Record<string, string> }
  | { readonly kind: "rate-limited"; readonly retryAfterMs?: number }
  | { readonly kind: "network" }
  | { readonly kind: "server"; readonly correlationId?: string };
