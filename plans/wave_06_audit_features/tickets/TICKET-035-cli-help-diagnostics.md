---
id: TICKET-035
title: CLI help output and diagnostics grouping
wave: 6
status: done
parallel_group: wave06_slot_b
depends_on: [TICKET-034]
blocked_by: []
spec_refs: [specs/03-contracts/cli.md]
write_scope: [packages/cli/src/commands.ts, packages/cli/src/diagnostics.ts, tests/cli, docs/guides/use-the-cli.md, docs/reference/errors.md]
read_scope: [packages/cli/src, specs/03-contracts/cli.md, tests/cli]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/cli.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-035: CLI Help And Diagnostics Grouping

## Goal

Implement the `## Help` and `## Diagnostics` output-grouping contracts in
`specs/03-contracts/cli.md`.

## Steps

1. Global usage text and per-command usage exactly per the Help contract:
   `--help`/`-h`/no-args behavior, exit codes, command listing order,
   `CLI_UNKNOWN_COMMAND` for unknown commands.
2. Validation output grouping per the Diagnostics contract: `Errors (n)` /
   `Warnings (n)` headers, stderr/stdout split, and the exact summary lines
   `OK`, `OK (<n> warnings)`, `FAILED (<e> errors, <w> warnings)`.
3. Update existing CLI tests that pin the previous output format; add tests
   for: no-args exit 0 with usage, `<command> --help` exits 0 without
   executing, unknown command exit 1, grouped output with headers and both
   summary variants, stderr/stdout separation.
4. Update `docs/guides/use-the-cli.md` sample output blocks to the new
   format.

## Done Criteria

- Every Help and Diagnostics contract bullet has a pinned test.
- `docs/reference/errors.md` documents `CLI_UNKNOWN_COMMAND`.
