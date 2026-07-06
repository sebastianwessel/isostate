---
id: TICKET-034
title: mermaid2dsl converter and CLI command
wave: 6
status: planned
parallel_group: wave06_slot_a
depends_on: []
blocked_by: []
spec_refs: [specs/02-capabilities/dsl/mermaid2dsl.md, specs/03-contracts/cli.md, specs/03-contracts/errors.md]
write_scope: [packages/cli/src/mermaid2dsl.ts, packages/cli/src/commands.ts, packages/cli/src/index.ts, tests/cli/mermaid2dsl.test.ts, docs/guides/convert-mermaid.md, docs/guides/use-the-cli.md]
read_scope: [packages/cli/src, packages/core/src/dsl, specs/02-capabilities/dsl/mermaid2dsl.md, specs/03-contracts/cli.md, tests/cli]
contract_readiness:
  status: ready
  required_contracts: [specs/02-capabilities/dsl/mermaid2dsl.md, specs/03-contracts/cli.md, specs/03-contracts/errors.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-034: mermaid2dsl Converter

## Goal

Implement the Mermaid flowchart converter and `isostate mermaid2dsl`
command exactly per `specs/02-capabilities/dsl/mermaid2dsl.md`.

## Steps

1. Create `packages/cli/src/mermaid2dsl.ts`: pure function
   `convertMermaidToDsl(source, options?: { name?: string })` implementing
   the supported-input grammar, id normalization, layout algorithm, shape
   payloads, connection mapping, YAML emission, and self-validation exactly
   as spec'd. No filesystem access in this module. No new dependencies.
2. Wire the CLI command in `packages/cli/src/commands.ts` per the cli.md
   command contract (default --out derivation, warning printing, exit
   codes). Export `convertMermaidToDsl` from `packages/cli/src/index.ts`.
3. Add `tests/cli/mermaid2dsl.test.ts` covering every bullet in the spec's
   Testing section, including the byte-for-byte YAML snapshot.
4. Write `docs/guides/convert-mermaid.md` and extend
   `docs/guides/use-the-cli.md` per the spec's Documentation section.

## Done Criteria

- Generated YAML for the happy-path fixture parses and validates with zero
  errors through `@sebastianwessel/isostate/dsl`.
- Determinism: converting the same input twice yields identical bytes.
- All spec'd error/warning codes are exercised by tests.

## Escalation

The Mermaid grammar in the spec is exhaustive. Any input construct not
listed maps to `MERMAID_UNSUPPORTED` — never add support beyond the spec.
