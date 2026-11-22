// <app> — the policy schema surface of the infrastructure.
//
// The schemas and types live in `contracts/policy.ts` — one contract; this
// module re-exports them and adds the one operation the reader needs:
// parsing an untrusted document (a registry blob, a plist payload, a JSON
// file) into a `PolicyDocument`, where an unknown key or an invalid value
// fails the parse and is ignored, never guessed (docs/11).

import { err, ok, type Result } from "../../shared-kernel";
import { PolicyDocumentSchema } from "../../contracts";
import type { PolicyDocument } from "../../contracts";

export {
  POLICY_DEFAULTS,
  PolicyDocumentSchema,
  ResolvedPolicySchema,
  type PolicyDocument,
  type ResolvedPolicy,
} from "../../contracts";

/**
 * A document as it arrives: valid, or an error naming the schema — the
 * error message stays generic so a malicious file learns nothing beyond
 * "does not match".
 */
export function parsePolicyDocument(raw: unknown): Result<PolicyDocument> {
  const parsed = PolicyDocumentSchema.safeParse(raw);
  return parsed.success
    ? ok(parsed.data)
    : err({
        code: "validation",
        message:
          "the policy document does not match the schema: an unknown key or an invalid value.",
      });
}
