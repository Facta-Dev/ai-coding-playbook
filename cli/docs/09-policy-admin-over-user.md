# Policy: Administrator Over User

This chapter **does not apply to this stack** in its reference form. The
reference client kit is a Chrome extension deployed inside an enterprise,
where the administrator publishes a policy through `chrome.storage.managed`
and the user may have preferences. A CLI has no managed-storage channel: the
analogous question is config precedence.

## The analog that does apply

The fuller contract specifies the precedence for every setting
(`PLAYBOOK_CLI.md` section 8.1), and it is the same discipline:

| Source    | Transport                                  | Written by     |
| --------- | ------------------------------------------ | -------------- |
| Managed   | the OS (registry / plist / a managed file) | the administrator |
| Flags     | the command line                           | the invocation |
| Env       | the environment                            | the caller     |
| Project   | a project config file                      | the project    |
| User      | a user config file                         | the user       |
| Defaults  | the code                                   | the code       |

The order is fixed: managed beats flags beats env beats project beats user
beats defaults. The resolver is pure so the precedence can be tested directly.
A setting the administrator locks is reported as locked and rendered
read-only, never offered as editable.

## Failing closed

The fuller contract resolves an invalid source by ignoring what does not
validate and falling back to the next source - never to "everything is
allowed". An empty allowlist allows nothing; a kill switch stops everything.

## The template ships none of it

The shipped template has no config resolver, no managed settings and no
precedence logic: `greet` takes its inputs from argv only. When the project
adds a config surface, follow `PLAYBOOK_CLI.md` section 8.1 and keep the
resolver pure and tested.

## See also

- [Storage & Migrations](08-storage-and-migrations.md)
- [Security](10-security-and-csp.md)
- [Playbooks](13-playbooks.md)
