---
name: recon
description: "Answer a codebase question through the prebuilt indexes instead of reading files: delegate to the code-scout agent, which queries CodeGraph (symbols, call paths, impact) and Graphify (architecture graph) and returns a digest under 300 tokens. Use when a question spans several files — how does X work, where is Y defined, what breaks if I change Z, onboarding into an area — or before any multi-file plan. Skip it for a single known file or symbol: read/explore that one directly."
---

# Recon

Cheapest-first reconnaissance for questions that span several files.

## When to Activate

- "how does X work", "where is Y", "what calls Z", "what breaks if I change X"
- Before planning a multi-file change, to map the blast radius.
- Unfamiliar area of the repo (onboarding, first task in a module).

Do not activate for a single already-identified file or symbol — call
`codegraph explore` for that one directly.

## Rules

1. One question per invocation. If the user asked several, split them.
2. Delegate with the Agent tool: `subagent_type: code-scout`, and give it the
   question plus the project root. Do not paste the repo layout into the prompt.
3. Treat the returned digest as the map: cite its `file:line` facts. Read a
   file yourself only when you must edit it or the digest flags `unknown:`.
4. If the digest is insufficient, send one follow-up to the same agent with the
   missing piece; do not start a fresh broad search.

## Output Format

Relay the digest as-is, then state the next concrete step in one line
(edit target, test to run, or the open question).

## Research References

- CodeGraph: `.codegraph/` index, CLI `codegraph context|explore|impact|affected`.
- Graphify: `graphify-out/graph.json`, CLI `graphify query|path|explain`.
