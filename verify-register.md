# Verify register

Every dated or version-specific claim used by the playbook set is registered
here with an owner, a source and a re-check date. `scripts/playbook-lint.py`
does not verify external facts; it verifies that this register exists and that
the playbooks it points at do.

Status values: `open`, `confirmed`, `changed`, `retired`.

| ID | Claim | Source | Owner | Due | Status |
| --- | --- | --- | --- | --- | --- |
| V-CLAUDE-1 | Claude Code docs baseline v2.1.309+; native binaries since v2.1.113 | Claude Code docs / `claude --version` | engineering-productivity | 2026-12-15 | open |
| V-CLAUDE-2 | Agent teams are experimental and disabled by default; `/goal`, `/loop`, `/schedule`/routines and dynamic workflows are current or beta | Claude Code docs | engineering-productivity | 2026-12-15 | open |
| V-CLAUDE-3 | `onFailure: "block"` on policy hooks is available since v2.1.295 | Claude Code hooks docs | engineering-productivity | 2026-12-15 | open |
| V-RN-1 | React Native 0.88 (Oct 2026), Expo SDK 58, Hermes V1 default since 0.84 | RN / Expo release notes | client-platform | 2027-01-15 | open |
| V-ANDROID-1 | Android 17 (API 37) released June 2026; Play target API 36 from 2026-08-31; Compose 1.12 needs compileSdk 37 + AGP 9.1.1; Navigation 3 1.0; AndroidX minSdk 24; 16 KB page-size enforcement dates | Android / Play docs | client-platform | 2027-01-15 | open |
| V-IOS-1 | Xcode 27.2 / Swift 6.4.x; iOS 27 (Sep 2026); App Store floor Xcode 26 since 2026-04-28 | Apple release notes | client-platform | 2027-01-15 | open |
| V-QT-1 | Qt 6.12 LTS (2026-09-30); 6.8 LTS supported to Oct 2029 | Qt release schedule | client-platform | 2027-03-31 | open |
| V-CHROME-1 | MV3 only; WXT recommended; Plasmo in maintenance mode | Chrome extension docs | client-platform | 2027-01-15 | open |
| V-JAVA-1 | Jakarta EE 11 current; EE 12 Core Profile target Q4 2026, Web/Platform Q1–Q2 2027; JDK 25 LTS | Jakarta EE / OpenJDK roadmaps | backend-platform | 2027-03-31 | open |
| V-SEC-1 | OWASP Top 10:2025 (SSRF merged into Broken Access Control; Supply Chain Failures added) | OWASP | security | 2027-02-15 | open |
| V-REG-1 | EU CRA reporting from 2026-09-11, most obligations 2027-12-11; ISO 9001:2026 published 2026-09-16, transition to 2029-09-30 | EU / ISO; confirm with counsel | compliance | 2027-02-15 | open |
| V-AVATAR-1 | Ready Player Me shut down 2026-01-31; no vendor lock-in for avatars | Vendor announcement | client-platform | 2027-01-15 | open |
