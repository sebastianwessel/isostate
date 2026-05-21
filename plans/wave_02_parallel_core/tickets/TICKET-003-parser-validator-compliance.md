---
id: TICKET-003
title: Make parser and validator schema-compliant
wave: 2
status: implementation_ready
parallel_group: dsl_validation
depends_on: [TICKET-001, TICKET-002]
blocked_by: [TICKET-001, TICKET-002]
spec_refs: [specs/03-contracts/scene-schema.md, specs/03-contracts/errors.md, specs/02-capabilities/rendering/dsl-rendering.md, specs/02-capabilities/rendering/dsl-validator.md]
write_scope: [packages/core/src/dsl/scene-parser.ts, packages/core/src/dsl/scene-validator.ts, packages/core/src/types/errors.ts, tests/scene-parser.test.ts, tests/scene-validator.test.ts]
read_scope: [packages/core/src/dsl/scene-parser.ts, packages/core/src/dsl/scene-validator.ts, packages/core/src/types/errors.ts, packages/core/src/types/node.ts, packages/core/src/types/scene.ts, tests/scene-parser.test.ts, tests/scene-validator.test.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/scene-schema.md, specs/03-contracts/errors.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-003: Parser and Validator Compliance

## Goal

Make `parseScene` and `validateScene` enforce the approved schema, lifecycle, and error contracts.

## Spec Refs

- `specs/03-contracts/scene-schema.md`
- `specs/03-contracts/errors.md`
- `specs/02-capabilities/rendering/dsl-rendering.md`
- `specs/02-capabilities/rendering/dsl-validator.md`

## Context Digest

Parser silently drops invalid animation names and unknown fields. Validator lifecycle resolution resets omitted lifecycle to `present`, which violates the contract after `exiting` and `removed`.

## Implementation Approach

Keep parser responsibilities limited to syntax and schema shape. Keep semantic references, ranges, lifecycle, and warnings in the validator.

## Tasks

- Update parser error codes.
- Reject unknown fields and invalid identifiers.
- Preserve raw animation strings for validator checks.
- Preserve authored empty ambient arrays.
- Implement lifecycle resolution from the schema contract.
- Add parser and validator tests for the required failure paths.

## Read Scope

- `packages/core/src/dsl/scene-parser.ts`
- `packages/core/src/dsl/scene-validator.ts`
- `packages/core/src/types/errors.ts`
- `packages/core/src/types/node.ts`
- `packages/core/src/types/scene.ts`
- `tests/scene-parser.test.ts`
- `tests/scene-validator.test.ts`

## Write Scope

- `packages/core/src/dsl/scene-parser.ts`
- `packages/core/src/dsl/scene-validator.ts`
- `packages/core/src/types/errors.ts`
- `tests/scene-parser.test.ts`
- `tests/scene-validator.test.ts`

## Required Behavior

- Parser throws contract error codes: `DSL_PARSE_SYNTAX_ERROR`, `DSL_SCHEMA_TYPE_ERROR`, `UNKNOWN_FIELD`, `INVALID_IDENTIFIER`.
- Parser preserves raw valid/invalid entry and exit strings so validator reports `UNKNOWN_ANIMATION`.
- Parser preserves authored `ambient: []`.
- Parser rejects unknown fields in top-level, states, layers, elements, keyframes, lifecycle, ambient, and background.
- Validator uses `INVALID_POSITION` for malformed/negative positions.
- Validator lifecycle resolution follows `internal absent -> entering -> present`, `exiting -> removed`, `removed -> removed`, and explicit `removed -> entering` re-addition.
- Re-addition without `pos` produces `REMOVED_ELEMENT_NO_POSITION`.
- Layer keyframe state references are validated.

## Acceptance

- Existing parser/validator tests pass after updating expectations to current specs.
- New tests cover unknown fields, invalid identifiers, invalid lifecycle `absent`, exiting-to-removed omission, removed-to-removed omission, and re-addition without `pos`.

## Verification

```bash
bun test tests/scene-parser.test.ts tests/scene-validator.test.ts
bun run typecheck
```

## Contract Readiness

status: ready

required_contracts:

- `specs/03-contracts/scene-schema.md`
- `specs/03-contracts/errors.md`

missing_contracts: []

## Decision Ledger

- Parser owns syntax/schema shape and unknown fields.
- Validator owns semantic references, ranges, lifecycle transitions, and warnings.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `parseScene` | `03-contracts/public-api.md`, `03-contracts/scene-schema.md` | `scene-parser.ts` |
| `validateScene` | `02-capabilities/rendering/dsl-validator.md` | `scene-validator.ts` |
| error codes | `03-contracts/errors.md` | parser/validator tests |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| parser rejects unknown fields | `tests/scene-parser.test.ts` |
| validator catches unknown animations | `tests/scene-validator.test.ts` |
| lifecycle resolution matches contract | `tests/scene-validator.test.ts` |
| re-addition requires position | `tests/scene-validator.test.ts` |

## Non-goals

- Compiler digest generation.
- Runtime DOM rendering.

## Handoff

Compiler and runtime tickets can rely on parsed and validated scene definitions matching the schema contract.
