---
id: TICKET-004
title: Implement compliant runtime bundle compiler
wave: 2
status: implementation_ready
parallel_group: compiler
depends_on: [TICKET-001, TICKET-002]
blocked_by: [TICKET-001, TICKET-002]
spec_refs: [specs/03-contracts/runtime-bundle.md, specs/03-contracts/errors.md, specs/02-capabilities/dsl/compiler.md]
write_scope: [packages/core/src/dsl/compiler.ts, tests/compiler.test.ts]
read_scope: [packages/core/src/dsl/compiler.ts, packages/core/src/types/assets.ts, packages/core/src/types/scene.ts, packages/core/src/types/errors.ts, tests/scene-parser.test.ts, tests/scene-validator.test.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/runtime-bundle.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-004: Runtime Bundle Compiler

## Goal

Emit deterministic runtime bundles with format, version, digest, defaults, and embedded asset contracts.

## Spec Refs

- `specs/03-contracts/runtime-bundle.md`
- `specs/03-contracts/errors.md`
- `specs/02-capabilities/dsl/compiler.md`

## Context Digest

Compiler currently emits only `_version` plus raw scene data. It lacks `_format`, `_digest`, canonical serialization, asset object shape, materialized defaults, and required asset errors.

## Implementation Approach

Implement canonical JSON generation inside the compiler module and cover all serializer behavior with focused tests.

## Tasks

- Add `_format` and `_digest`.
- Materialize runtime defaults.
- Embed compiled asset objects.
- Throw required asset errors.
- Make `toJs`, `toJson`, `fromJs`, and `fromJson` strict and deterministic.
- Add compiler tests.

## Read Scope

- `packages/core/src/dsl/compiler.ts`
- `packages/core/src/types/assets.ts`
- `packages/core/src/types/scene.ts`
- `packages/core/src/types/errors.ts`
- `tests/scene-parser.test.ts`
- `tests/scene-validator.test.ts`

## Write Scope

- `packages/core/src/dsl/compiler.ts`
- `packages/core/src/types/errors.ts`
- `tests/compiler.test.ts`

## Required Behavior

- `RuntimeBundle` includes `_format: 'isostate-runtime-bundle'`, `_version`, `_digest`, materialized grid/theme/layer defaults, elements, states, background, and optional compiled assets.
- Digest is SHA-256 hex over canonical bundle content excluding `_digest`.
- Canonical serialization sorts object keys lexicographically.
- `inlineAssets: true` without registry throws `ASSET_REGISTRY_REQUIRED`.
- Missing referenced asset during compile throws `ASSET_NOT_FOUND`.
- Embedded assets use `{ svg, css?, category? }`.
- `fromJs()` accepts only exact `export default <json>;` output from `toJs()` and does not evaluate JavaScript.

## Acceptance

- Compiler tests prove deterministic output across repeated compiles.
- Compiler tests prove digest changes when semantic bundle content changes.
- Compiler tests cover missing registry, missing asset, JS serialization, JSON serialization, and strict `fromJs()`.

## Verification

```bash
bun test tests/compiler.test.ts
bun run typecheck
```

## Contract Readiness

status: ready

required_contracts:

- `specs/03-contracts/runtime-bundle.md`

missing_contracts: []

## Decision Ledger

- Digest uses SHA-256 over canonical JSON excluding `_digest`.
- JS output is an ESM default export wrapping canonical JSON.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `RuntimeBundle` | `03-contracts/runtime-bundle.md` | `compiler.ts` |
| serializers | `03-contracts/runtime-bundle.md` | `compiler.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| deterministic compile | `tests/compiler.test.ts` |
| digest behavior | `tests/compiler.test.ts` |
| asset errors | `tests/compiler.test.ts` |
| strict serializers | `tests/compiler.test.ts` |

## Non-goals

- Runtime `mountScene` loading.
- Asset SVG DOM sanitization.

## Handoff

Runtime API work can load compliant `RuntimeBundle` objects from the compiler.
