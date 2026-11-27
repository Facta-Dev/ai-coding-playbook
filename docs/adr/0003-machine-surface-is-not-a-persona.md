# 0003 — A machine surface is not a persona

- **Status:** proposed
- **Date:** 2026-11-27
- **Owner:** architecture

## Context

`PLAYBOOK_URLS.md` defines the `{userType}` segment with a table of seven
product personas — `app`, `admin`, `owner`, `manager`, `agent`, `partner`,
`public` — and states that the segment "defines experience and navigation,
not security".

It has no vocabulary for a **server-to-server** surface: a backend that calls
the API with an API key, a service account or a client-credentials token.
Such a caller has no experience, no navigation and no human persona. A project
that publishes one must therefore either

- invent a persona segment that means nothing (`/api/v1/app/...` for a
  machine client would claim an end-user console that does not exist), or
- drop the `{userType}` segment and break the template — and then carry a
  recorded deviation until the rule is clarified.

The second path is what a consumer hit: the TechnoRides platform (M01
Registry / M02 Router / M03 Ledger) publishes fourteen machine routes under
`/api/v1/...` behind an Eye-Key credential and recorded the deviation in its
own ADR-0003 — rule, reason, compensating control, owner, expiry and a human
approver — because the playbook offers no third option.

The template also stays silent on the relation between the `{module}` segment
and the permission catalog: `PLAYBOOK_MASTER.md` §3 I-1 wants slice = module =
permission prefix, but `PLAYBOOK_URLS.md` never says it. A project can
publish `/api/v1/networks` for the `registry` slice and still comply with the
URLS playbook, and the audit of that project found exactly that.

## Decision (proposed)

`PLAYBOOK_URLS.md` gains a **machine surface** rule, in the
"The {userType} segment" section:

```text
### Machine surfaces

A server-to-server surface — an API key, a service account or a
client-credentials token — has no persona. Publish it either under an
explicit `/machine` segment (`/api/v1/machine/{module}/{resource}`) or
without the `{userType}` segment (`/api/v1/{module}/{resource}`). When it is
published without the segment, record the deviation as an ADR with the
compensating control (token-scoped authorization), an expiry date and an
approver outside the owning team.
```

and the persona table gains a row:

| Segment | Use | Example |
|---|---|---|
| `/machine` | Server-to-server clients (API key, service account, client-credentials token) | `/api/v1/machine/registry/networks` |

`/machine` is an experience namespace too: it documents the kind of caller
and never grants anything — the same rule as every other segment.

Plus one clarification under "Enterprise template → API":

```text
The `{module}` segment is the domain module that owns the resource, and it
is the prefix the permission catalog uses: `registry.networks.read` →
`/api/v1/{userType}/registry/networks`. Splitting one module across two
segments (`/networks` and `/dispatch-authorizations`) breaks that parity.
```

### Why not simply require a persona

`/app` for a machine client would be a lie in the URL, and `/admin` would be
a lie that every security review has to disprove on every route. A dedicated
`/machine` segment documents the caller kind without pretending it is a
person — but it is not free either: it changes a published contract, so a
project that already omits the segment stays on its recorded deviation until
it re-shapes under a new version.

## Consequences

- A project with a machine surface gets a documented, non-deviant option and
  a vocabulary for it (`/machine`), instead of an undocumented choice between
  a false persona and a silent deviation.
- The module/permission parity rule removes the ambiguity that let the
  TechnoRides registry slice be published as `networks` +
  `dispatch-authorizations` while its permissions read `registry.networks.*`.
- The rule does not retro-fit a published contract: consumers keep their
  deviations until their next version.

## Applying this change (human act)

`PLAYBOOK_URLS.md` is a shared contract with 12 byte-identical kit mirrors, so
applying the rule is a 1:n change and a release, not an edit:

1. edit the root `PLAYBOOK_URLS.md` (front matter: bump `version`, set
   `last_reviewed`);
2. re-copy it byte-identically into every kit that ships `URLS`
   (`scripts/claude-kit/check-playbook-copies.sh` is the gate);
3. run `python3 scripts/claude-kit/generate-playbook-rules.py` and commit the
   regenerated per-kit rules;
4. update `manifest.json` and `CHANGELOG.md`;
5. run the gates: `python3 scripts/playbook-lint.py`,
   `bash scripts/claude-kit/check-playbook-copies.sh`,
   `python3 scripts/claude-kit/generate-playbook-rules.py --check`;
6. release the bundle (`NEW_UPDATE_PLAYBOOK.md` §6).

Until that happens the consumer records the deviation on its side
(TechnoRides ADR-0003) with an expiry and a human approver.
