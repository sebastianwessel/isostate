---
id: TICKET-038
title: Error docs completeness and drift guard
wave: 6
status: planned
parallel_group: wave06_slot_a
depends_on: []
blocked_by: []
spec_refs: [specs/03-contracts/errors.md]
write_scope: [docs/reference/errors.md, tests/nfr/error-docs.test.ts]
read_scope: [specs/03-contracts/errors.md, docs/reference/errors.md, tests/nfr]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/errors.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-038: Error Docs Completeness

## Goal

Make `docs/reference/errors.md` cover every code in
`specs/03-contracts/errors.md` and guard against future drift.

## Steps

1. Add `tests/nfr/error-docs.test.ts`: parse every backticked code from the
   spec's error and warning tables and assert each appears as a row code in
   the docs file's tables. The test reads both files from disk (follow
   `tests/nfr/docs-paths.test.ts` patterns).
2. Extend `docs/reference/errors.md` until the test passes: one row per
   missing code with a concrete fix action, grouped in the same order and
   sections as the spec (add section headers mirroring the spec's Parser /
   Validator / Converter / Compiler and Runtime Bundle / Runtime / Warnings
   grouping). Keep existing rows; move them into sections rather than
   rewriting their text.
3. Codes added to the spec by parallel wave-06 tickets (export, mermaid,
   MOUNT_DESTROYED, CLI_UNKNOWN_COMMAND) are in the spec already — document
   them too.

## Done Criteria

- `bun test tests/nfr/error-docs.test.ts` passes and fails when any spec
  code row is removed from the docs (verify by temporary mutation during
  development, then restore).
