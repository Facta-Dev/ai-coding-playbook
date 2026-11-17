---
id: AUDIT_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 90
owner: compliance
depends_on: [AUDIT]
---

# PLAYBOOK_AUDIT_PART2 — Audit, certification & compliance playbook (part 2)

> Part 2 of 2. Main entry: [`PLAYBOOK_AUDIT.md`](PLAYBOOK_AUDIT.md). Covers: 17. Metrics and reporting … 20. Checklist.

## 17. Metrics and reporting

| Metric | Target (set in policy) |
|---|---|
| Controls `passing` / total, `stale` count | 100% passing; zero stale |
| Evidence freshness | Within frequency + tolerance |
| Critical/high vulnerability SLA compliance | ≥ 95% within SLA |
| Access review completion and removal turnaround | 100% on time |
| Training completion | 100% within deadline |
| Open audit findings and CAPA aging | No overdue critical |
| Incident MTTD / MTTR and post-mortem completion | Trending down; 100% post-mortems |
| DR test result vs. RPO/RTO | Within objectives |
| Vendor reviews on time | 100% for critical vendors |
| Audit outcome | Zero major NCs; SOC 2 exceptions trending down |

A monthly compliance report (generated) goes to the executive sponsor; a
quarterly summary to management review.

## 18. Annual compliance calendar

| Quarter | Activities |
|---|---|
| Q1 | Annual risk assessment, policy review cycle, scope review, internal audit (part 1), vendor annual reviews, access review, security training refresh |
| Q2 | Penetration test and retest, DR/restore rehearsal, access review, internal audit (part 2), tabletop exercise |
| Q3 | Management review, access review, external audit fieldwork window (align with period end), chaos/game day |
| Q4 | SOC 2 period close and report; ISO surveillance/recertification audit; access review; budget and roadmap for next year; playbook and control-map review |

Align actual dates to the SOC 2 period and the certification body's
schedule.

## 19. Concrete example: quarterly access review (`CTL-ACC-03`)

1. **Trigger**: scheduler creates a ticket on the first business day of the
   quarter, assigned to the system owners.
2. **Collection**: collector exports permissions from the identity provider,
   cloud IAM, code host, production datastores and the admin console
   (`/admin` users and their granular permissions, as defined in
   `PLAYBOOK_URLS.md`) into `evidence/CTL-ACC-03/{quarter}/`.
3. **Comparison**: the export is diffed against the expected role→permission
   matrix used by `_platform/authz-matrix`; unexpected grants are flagged.
4. **Review**: each owner approves or marks removals; removals are executed
   and ticketed; the sign-off JSON records reviewer, time and decisions.
5. **Verification**: the `tenant-isolation` and `authz-matrix` suites run
   against staging to prove the permission model itself still holds.
6. **Evidence**: export, diff, sign-off, removal tickets and test results with
   hashes in the manifest.
7. **Auditor sample**: for the SOC 2 Type II window the auditor selects one or
   more quarters; the population query returns every quarter in the period;
   the ISO auditor sees the same evidence mapped to A.5.18 and A.8.3.
8. **Failure path**: overdue or incomplete review turns the control `failing`
   on the dashboard and opens a CAPA.

## 20. Checklist

- [ ] Scope, boundary, data classification and subservice organizations are
      documented and reviewed annually.
- [ ] Roles, RACI and an executive sponsor are named; every control has a
      named owner.
- [ ] Policy set approved, versioned in the repo and reviewed annually.
- [ ] One control library maps to SOC 2, ISO 27001, ISO 9001 and privacy
      requirements; validators run in CI.
- [ ] Risk methodology, register, treatment plan and Statement of
      Applicability exist and are current.
- [ ] Evidence is system-generated, hashed, append-only, retained per policy
      and free of secrets and personal data.
- [ ] Populations can be reproduced for every sampled control.
- [ ] Continuous control monitoring shows no stale or failing controls, or
      each has a ticket and owner.
- [ ] Internal audit covers all domains and clauses each cycle by independent
      auditors; findings flow into CAPA.
- [ ] Management review held at least annually with minutes and actions.
- [ ] Access reviews, vulnerability SLAs, pen test, DR restore, incident
      tabletop and training run on schedule.
- [ ] Vendor register, tiering, due diligence and annual reviews are current;
      sub-processor list is published.
- [ ] Privacy program: roles, records of processing, DPIAs, data-subject
      rights flows, transfer mechanisms and outreach guardrails are in place.
- [ ] Certification bodies are accredited (including for ISO 9001:2026);
      SOC 2 auditor is a licensed CPA firm.
- [ ] Marketing and questionnaire claims match the scope and reports.
- [ ] Applicability of CRA, NIS2/DORA flow-downs, EU AI Act and other
      regulations assessed with counsel and recorded.
- [ ] This playbook, the control map and framework editions are reviewed at
      least annually.
