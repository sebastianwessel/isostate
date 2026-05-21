---
id: TICKET-012
title: Add standalone browser runtime artifact
wave: 3
status: done
parallel_group: runtime_artifact
depends_on: [TICKET-010]
blocked_by: []
spec_refs: [specs/03-contracts/static-bundle.md, specs/04-nfr/runtime-ci.md, specs/03-contracts/public-api.md]
write_scope: [rollup.config.ts, package.json, scripts/check-size.ts, tests/nfr/runtime-boundary.test.ts, tests/contracts/dist-entrypoints.test.ts]
read_scope: [packages/core/src/index.ts, packages/core/src/runtime/index.ts, specs/03-contracts/static-bundle.md, specs/04-nfr/runtime-ci.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/static-bundle.md, specs/04-nfr/runtime-ci.md]
  missing_contracts: []
ticket_readiness:
  status: done
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-012: Standalone Runtime Artifact

## Goal

Build a browser-safe `isostate.runtime.js` artifact that static bundles can copy
without including dev-time code.

## Context Digest

The current runtime entrypoint is browser-safe, and `bun run size` is already
near the 20KB gzip budget. Static bundles need a stable file to copy without
pulling in DSL or CLI modules.

execution_semantics: `in_process` for browser runtime APIs and `local_process`
for build verification.

## Implementation Approach

Add or adjust a Rollup output target for a standalone browser runtime artifact.
Keep the source entrypoint runtime-only and extend boundary tests to scan the
actual artifact copied by static bundles.

## Tasks

- Add the standalone runtime output target.
- Update size checks to measure the static runtime artifact.
- Update boundary tests for forbidden dev-time imports.
- Add import smoke coverage for the artifact.

## Required Behavior

- Build output includes a stable standalone runtime file, for example
  `packages/core/dist/browser/isostate.runtime.js`.
- The artifact exports `mountScene` and runtime-safe public helpers.
- The artifact excludes `yaml`, `@sebastianwessel/isostate/dsl`, parser, validator,
  compiler, filesystem APIs, and `node:crypto`.
- Size checks continue to enforce the `<20KB` gzipped runtime budget or document
  any required budget-preserving split.

## Acceptance

- Dist entrypoint tests import the standalone runtime artifact.
- Runtime boundary tests scan the artifact for forbidden dev-time imports.
- `bun run size` measures the artifact used by static bundles.

## Verification

```bash
bun run build
bun test tests/nfr/runtime-boundary.test.ts tests/contracts/dist-entrypoints.test.ts
bun run size
```

## Decision Ledger

- Static deployment bundles copy a runtime artifact instead of asking users to
  install a bundler.
- Runtime size must stay within the existing NFR budget unless a later spec
  changes the budget.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| standalone runtime artifact | `specs/03-contracts/static-bundle.md` | `rollup.config.ts`, `packages/core/dist/browser` |
| runtime dependency boundary | `specs/04-nfr/runtime-ci.md` | `tests/nfr/runtime-boundary.test.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| artifact imports cleanly | `tests/contracts/dist-entrypoints.test.ts` |
| artifact excludes dev-time code | `tests/nfr/runtime-boundary.test.ts` |
| size budget enforced | `bun run size` |

## Non-goals

- Implementing CLI asset copying.
- Changing public runtime behavior.

## Handoff

After this ticket, Ticket 013 can copy the artifact into generated static
bundles.
