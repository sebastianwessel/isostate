---
id: TICKET-039
title: Coverage to 80% and CI coverage gate
wave: 6
status: planned
parallel_group: wave06_slot_b
depends_on: []
blocked_by: []
spec_refs: [specs/04-nfr/runtime-ci.md, IMPLEMENTATION.md]
write_scope: [.github/workflows/pr.yml, .github/workflows/release.yml, tests/editor, tests/runtime, tests/cli, scripts/test-preload.ts]
read_scope: [packages, scripts/check-coverage.ts, .github/workflows]
contract_readiness:
  status: ready
  required_contracts: [specs/04-nfr/runtime-ci.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-039: Coverage Gate

## Goal

Raise line coverage to >=80% total (currently ~74.6%) and enforce
`bun run coverage` in CI per `specs/04-nfr/runtime-ci.md`.

## Steps

1. Run `bun run coverage` and list files below 80%. Focus on the editor
   package (known low: `SceneTreePanel.tsx`, `editor-shell.tsx`,
   `textarea.tsx`, canvas/panel components) plus `scripts/test-preload.ts`.
2. Add behavior tests (not snapshot padding): exercise real user flows
   through the existing tests/editor harness (React Testing-style
   interactions used by current tests). Tests must assert observable
   behavior, never internals.
3. Do NOT lower the 80% threshold in `scripts/check-coverage.ts` and do NOT
   add coverage-ignore pragmas.
4. Add a `Coverage` step (`run: bun run coverage`) to
   `.github/workflows/pr.yml` after the `Test` step, and to the equivalent
   verification list in `.github/workflows/release.yml`.

## Done Criteria

- `bun run coverage` exits 0 locally.
- PR and release workflows contain the coverage step.
