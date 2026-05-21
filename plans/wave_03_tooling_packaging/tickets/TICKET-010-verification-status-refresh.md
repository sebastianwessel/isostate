---
id: TICKET-010
title: Repair clean-checkout verification and refresh status docs
wave: 3
status: done
parallel_group: tooling_foundation
depends_on: [TICKET-009]
blocked_by: []
spec_refs: [specs/04-nfr/runtime-ci.md]
write_scope: [package.json, tests/contracts/dist-entrypoints.test.ts, tests/nfr/runtime-boundary.test.ts, plans/implementation-plan.md, plans/_status.yaml]
read_scope: [package.json, rollup.config.ts, tests/contracts/dist-entrypoints.test.ts, tests/nfr/runtime-boundary.test.ts, specs/04-nfr/runtime-ci.md]
contract_readiness:
  status: ready
  required_contracts: [specs/04-nfr/runtime-ci.md]
  missing_contracts: []
ticket_readiness:
  status: done
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-010: Verification and Status Refresh

## Goal

Make default verification reliable from a clean checkout and keep planning
status aligned with the implemented core.

## Context Digest

Core implementation is present and normal build/type/lint gates pass. The
remaining verification gap is that tests which inspect `packages/core/dist`
currently assume a prior build.

execution_semantics: `local_process` for verification commands and `data_only`
for plan/status files.

## Implementation Approach

Keep the default local workflow hermetic. Either make the dist-specific tests
build their fixture before assertions or move them behind an explicit script
that the default command invokes in the correct order.

## Tasks

- Update test scripts or dist tests so `bun test` works from a clean checkout.
- Keep `bun run build` as the source of publishable `dist` artifacts.
- Refresh status files only for Wave 03 execution state.

## Required Behavior

- `bun test` must not fail only because `packages/core/dist` is absent.
- Dist entrypoint tests either build their required fixture first or move behind
  an explicit package/dist test script.
- Planning status must show Waves 01 and 02 as completed historical work and
  Wave 03 as the active implementation wave.

## Acceptance

- `bun test` passes after `bun install` without manually running `bun run build`
  first.
- `bun run build`, `bun run typecheck`, and `bun run lint` still pass.
- Status indexes continue to list Ticket 010 through Ticket 014.

## Verification

```bash
bun test
bun run build
bun run typecheck
bun run lint
```

## Decision Ledger

- Default verification must be runnable without manual pre-build steps.
- Dist import checks remain default coverage because package boundary regressions
  are high risk.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| default CI commands | `specs/04-nfr/runtime-ci.md` | `package.json`, `tests/nfr`, `tests/contracts` |
| planning status | `plans/implementation-plan.md` | `plans/_status.yaml`, `plans/_registry.yaml` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| clean checkout tests pass | `bun test` |
| build still passes | `bun run build` |
| type/lint still pass | `bun run typecheck`, `bun run lint` |

## Non-goals

- Implementing CLI commands.
- Changing runtime behavior.

## Handoff

After this ticket, Ticket 011 and Ticket 012 can run in parallel.
