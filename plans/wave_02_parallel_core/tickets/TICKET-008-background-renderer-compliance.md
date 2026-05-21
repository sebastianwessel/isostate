---
id: TICKET-008
title: Complete background renderer compliance
wave: 2
status: implementation_ready
parallel_group: background
depends_on: [TICKET-001]
blocked_by: [TICKET-001]
spec_refs: [specs/01-domains/scene-background.md, specs/03-contracts/errors.md]
write_scope: [packages/core/src/rendering/background-renderer.ts, packages/core/src/types/scene-background.ts, tests/runtime/background-renderer.test.ts]
read_scope: [packages/core/src/rendering/background-renderer.ts, packages/core/src/types/scene-background.ts, packages/core/src/types/errors.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/01-domains/scene-background.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-008: Background Renderer Compliance

## Goal

Implement SVG background rendering for solid, gradient, image, and grid variants.

## Spec Refs

- `specs/01-domains/scene-background.md`
- `specs/03-contracts/errors.md`

## Context Digest

Background renderer does not consistently place gradients/patterns under `<defs>`, uses global IDs, and does not fully implement angle, repeat, tile, cover/contain, or validation behavior.

## Implementation Approach

Keep all background output in SVG nodes. Generate unique IDs per background instance and put reusable definitions under `<defs>`.

## Tasks

- Implement solid background output.
- Implement gradient definitions and angle handling.
- Implement image pattern behavior.
- Implement grid pattern geometry.
- Add background renderer tests.

## Read Scope

- `packages/core/src/rendering/background-renderer.ts`
- `packages/core/src/types/scene-background.ts`
- `packages/core/src/types/errors.ts`

## Write Scope

- `packages/core/src/rendering/background-renderer.ts`
- `packages/core/src/types/scene-background.ts`
- `tests/runtime/background-renderer.test.ts`

## Required Behavior

- Solid backgrounds render one rect.
- Gradient backgrounds render `<defs><linearGradient|radialGradient>...` with unique IDs and correct stops.
- Linear gradient angle follows the spec formula.
- Image backgrounds implement repeat/tile and cover/contain behavior according to the v1 spec.
- Grid backgrounds render a pattern with dimensions `(cellSize, cellSize * 0.5)` and specified diamond points.
- Invalid numeric background values throw/warn according to the background spec.

## Acceptance

- Tests cover solid, linear gradient, radial gradient, image, and grid backgrounds.
- Tests verify `<defs>` placement and unique IDs.
- Tests verify grid pattern dimensions and polygon points.

## Verification

```bash
bun test tests/runtime/background-renderer.test.ts
bun run typecheck
```

## Contract Readiness

status: ready

required_contracts:

- `specs/01-domains/scene-background.md`

missing_contracts: []

## Decision Ledger

- Background rendering remains SVG-only.
- Image load failures are warning-level behavior.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `Background` rendering | `01-domains/scene-background.md` | `background-renderer.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| solid/gradient/image/grid rendering | `tests/runtime/background-renderer.test.ts` |
| defs and unique IDs | `tests/runtime/background-renderer.test.ts` |
| grid geometry | `tests/runtime/background-renderer.test.ts` |

## Non-goals

- Full browser visual/perf automation.
- Runtime mount API.

## Handoff

Rendering and runtime API tickets can rely on compliant background SVG nodes.
