---
id: TICKET-002
title: Align public type contracts and layer keyframe schema
wave: 2
status: done
parallel_group: contracts
depends_on: [TICKET-001]
blocked_by: [TICKET-001]
spec_refs: [specs/03-contracts/scene-schema.md, specs/01-domains/scene.md, specs/01-domains/node.md, specs/03-contracts/errors.md]
write_scope: [packages/core/src/types/node.ts, packages/core/src/types/scene.ts, packages/core/src/types/index.ts, tests/contracts/types.test.ts]
read_scope: [packages/core/src/types/node.ts, packages/core/src/types/scene.ts, packages/core/src/types/index.ts, packages/core/src/dsl/scene-parser.ts, packages/core/src/dsl/scene-validator.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/scene-schema.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-002: Type Contracts and Layer Keyframes

## Goal

Align exported TypeScript contracts with the approved schema and add layer keyframe data types.

## Spec Refs

- `specs/03-contracts/scene-schema.md`
- `specs/01-domains/scene.md`
- `specs/01-domains/node.md`
- `specs/03-contracts/errors.md`

## Context Digest

Public types currently expose `LifecycleStatus = 'absent'`, but `absent` is internal only. `LayerDefinition` lacks `keyframes`, so layer state propagation cannot be represented.

## Implementation Approach

Change public type definitions only. Keep validator implementation work in Ticket 003.

## Tasks

- Remove `absent` from public `LifecycleStatus`.
- Add an internal sentinel type for validator use.
- Add `LayerKeyframe` and `LayerDefinition.keyframes`.
- Export the new types from the type barrel.
- Add type contract tests.

## Read Scope

- `packages/core/src/types/node.ts`
- `packages/core/src/types/scene.ts`
- `packages/core/src/types/index.ts`
- `packages/core/src/dsl/scene-parser.ts`
- `packages/core/src/dsl/scene-validator.ts`

## Write Scope

- `packages/core/src/types/node.ts`
- `packages/core/src/types/scene.ts`
- `packages/core/src/types/index.ts`
- `tests/contracts/types.test.ts`

## Required Behavior

- Public `LifecycleStatus` is exactly `entering | present | exiting | removed`.
- Internal validator sentinel uses a private/internal type, not public `LifecycleStatus`.
- Add `LayerKeyframe` and `LayerDefinition.keyframes?: Record<string, LayerKeyframe>`.
- Export type contracts needed by parser, validator, renderer, compiler, and users.

## Acceptance

- Type tests prevent assigning `absent` to public lifecycle status.
- Type tests cover `LayerDefinition.keyframes` with `opacity`, `className`, and `vars`.
- `bun run typecheck` passes.

## Verification

```bash
bun run typecheck
bun test tests/contracts/types.test.ts
```

## Contract Readiness

status: ready

required_contracts:

- `specs/03-contracts/scene-schema.md`

missing_contracts: []

## Decision Ledger

- `absent` remains only an internal validator sentinel.
- Layer keyframes are discrete v1 state propagation data.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `LifecycleStatus` | `03-contracts/scene-schema.md` | `packages/core/src/types/node.ts` |
| `LayerKeyframe` | `03-contracts/scene-schema.md` | `packages/core/src/types/scene.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| public lifecycle excludes `absent` | `tests/contracts/types.test.ts` |
| layer keyframes type-check | `tests/contracts/types.test.ts` |

## Non-goals

- Parser/validator behavior for layer keyframes.
- Runtime layer keyframe application.

## Handoff

Parser, validator, compiler, and runtime tickets can use the aligned public type contracts.
