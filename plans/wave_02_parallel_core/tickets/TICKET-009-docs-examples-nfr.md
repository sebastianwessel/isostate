---
id: TICKET-009
title: Add docs, examples, and NFR verification
wave: 2
status: implementation_ready
parallel_group: docs_nfr
depends_on: [TICKET-001, TICKET-005, TICKET-006, TICKET-007, TICKET-008]
blocked_by: [TICKET-001, TICKET-005, TICKET-006, TICKET-007, TICKET-008]
spec_refs: [specs/03-contracts/public-api.md, specs/04-nfr/runtime-ci.md, specs/03-flows/dsl-to-runtime.md, specs/03-flows/controller-runtime.md]
write_scope: [docs/examples/runtime-basic.md, docs/examples/controller-scroll.md, docs/examples/compile-yaml.md, docs/examples/low-level-rendering.md, docs/examples/custom-assets.md, docs/examples/custom-theme.md, docs/examples/inspect-bundle.md, docs/reference/types.md, package.json, tests/nfr]
read_scope: [specs/03-contracts/public-api.md, specs/04-nfr/runtime-ci.md, package.json, rollup.config.ts, packages/core/src/index.ts, packages/core/src/dsl/index.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/public-api.md, specs/04-nfr/runtime-ci.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-009: Docs, Examples, and NFR Verification

## Goal

Add the public docs/examples and NFR verification required by the public API inventory.

## Spec Refs

- `specs/03-contracts/public-api.md`
- `specs/04-nfr/runtime-ci.md`
- `specs/03-flows/dsl-to-runtime.md`
- `specs/03-flows/controller-runtime.md`

## Context Digest

Public API inventory names docs and example paths, but the repo has no `docs/` directory. NFR requires size/publint/package-boundary checks and opt-in browser/perf gates.

execution_semantics: `data_only` for docs and `local_process` for verification scripts.

## Implementation Approach

Write focused docs for each inventory path and add hermetic NFR tests/scripts. Keep browser, perf, and network checks opt-in.

## Tasks

- Add all referenced docs and examples.
- Add NFR tests for package scripts and runtime boundary.
- Add `size` and `publint` scripts.
- Document opt-in verification flags.

## Read Scope

- `specs/03-contracts/public-api.md`
- `specs/04-nfr/runtime-ci.md`
- `package.json`
- `rollup.config.ts`
- implemented runtime and DSL APIs

## Write Scope

- `docs/examples/runtime-basic.md`
- `docs/examples/controller-scroll.md`
- `docs/examples/compile-yaml.md`
- `docs/examples/low-level-rendering.md`
- `docs/examples/custom-assets.md`
- `docs/examples/custom-theme.md`
- `docs/examples/inspect-bundle.md`
- `docs/reference/types.md`
- `package.json`
- `tests/nfr/`
- scripts needed for size/publint checks

## Required Behavior

- Add focused examples for every path named in public API inventory.
- Examples start with `mountScene` for runtime usage and `@isostate/core/dsl` for dev-time compile usage.
- Add NFR tests/scripts proving runtime entrypoint does not include `yaml`/DSL modules.
- Add `size` and `publint` scripts required by NFR.
- Browser/perf/network tests remain opt-in through documented env vars and are not part of default CI.

## Acceptance

- Referenced docs paths exist.
- NFR tests cover runtime/dev-time boundary and package scripts.
- `bun run size` exists.
- `bun run publint` or equivalent release check exists.
- Default verification commands do not require opt-in env vars.

## Verification

```bash
bun test tests/nfr
bun run typecheck
bun run lint
bun run size
bun run publint
```

## Contract Readiness

status: ready

required_contracts:

- `specs/03-contracts/public-api.md`
- `specs/04-nfr/runtime-ci.md`

missing_contracts: []

## Decision Ledger

- Docs are part of public API readiness.
- Opt-in checks stay out of default CI unless their env flag is set.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| focused examples | `03-contracts/public-api.md` | `docs/examples/` |
| NFR gates | `04-nfr/runtime-ci.md` | `tests/nfr/`, package scripts |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| docs paths exist | `tests/nfr/docs-paths.test.ts` |
| runtime excludes DSL/yaml | `tests/nfr/runtime-boundary.test.ts` |
| size/publint scripts exist | `tests/nfr/package-scripts.test.ts` |

## Non-goals

- Implementing CLI docs.
- Adding browser tests to default CI.

## Handoff

The project has reachable public docs and NFR verification hooks for release readiness.
