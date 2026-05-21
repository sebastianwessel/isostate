---
id: TICKET-007
title: Implement animation engine and controller semantics
wave: 2
status: implementation_ready
parallel_group: animation_controller
depends_on: [TICKET-001, TICKET-002]
blocked_by: [TICKET-001, TICKET-002]
spec_refs: [specs/02-capabilities/animation.md, specs/02-capabilities/controller.md, specs/03-flows/controller-runtime.md, specs/03-contracts/errors.md]
write_scope: [packages/core/src/animation/animation-engine.ts, packages/core/src/animation/controller.ts, tests/runtime/animation-engine.test.ts, tests/runtime/controller.test.ts]
read_scope: [packages/core/src/animation/animation-engine.ts, packages/core/src/animation/controller.ts, packages/core/src/rendering/rendering-engine.ts, packages/core/src/types/errors.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/02-capabilities/animation.md, specs/03-flows/controller-runtime.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-007: Animation and Controller Semantics

## Goal

Make the animation engine and controller follow interpolation, lifecycle, batching, pause, resume, and error contracts.

## Spec Refs

- `specs/02-capabilities/animation.md`
- `specs/02-capabilities/controller.md`
- `specs/03-flows/controller-runtime.md`
- `specs/03-contracts/errors.md`

## Context Digest

Animation engine transition tracking is broken, lifecycle defaults are wrong, and controller updates synchronously without RAF batching. Pause/resume and destroyed-controller semantics are incomplete.

execution_semantics: `in_process`.

## Implementation Approach

Keep trigger handling in the controller and interpolation in the engine. Use focused runtime tests with fake DOM/RAF behavior.

## Tasks

- Correct interpolation and lifecycle transition tracking.
- Implement controller RAF batching.
- Implement pause, resume, destroy, and error-code behavior.
- Add animation and controller tests.

## Read Scope

- `packages/core/src/animation/animation-engine.ts`
- `packages/core/src/animation/controller.ts`
- `packages/core/src/rendering/rendering-engine.ts`
- `packages/core/src/types/errors.ts`

## Write Scope

- `packages/core/src/animation/animation-engine.ts`
- `packages/core/src/animation/controller.ts`
- `tests/runtime/animation-engine.test.ts`
- `tests/runtime/controller.test.ts`

## Required Behavior

- Animation engine interpolates positions/sizes between surrounding states.
- Lifecycle resolution matches the contract used by validator.
- Previous frame state is captured before current frame updates so lifecycle transitions are observable.
- Controller batches progress forwarding with `requestAnimationFrame`.
- While paused, `setProgress()` stores progress but does not forward to engine until `resume()`.
- `destroy()` removes listeners, cancels RAF, clears subscribers, and later API calls throw `CONTROLLER_DESTROYED`.
- Error codes match `CONTROLLER_NO_SCENES`, `CONTROLLER_SCENE_INDEX_OUT_OF_RANGE`, and `CONTROLLER_PROGRESS_OUT_OF_RANGE`.
- Non-finite progress throws; finite progress clamps to `[0, 1]`.

## Acceptance

- Animation tests cover interpolation, lifecycle transition detection, ambient changes, and pause behavior.
- Controller tests cover RAF batching, scroll mapping, pause/resume, destroyed calls, scene navigation wraparound, and error codes.

## Verification

```bash
bun test tests/runtime/animation-engine.test.ts tests/runtime/controller.test.ts
bun run typecheck
```

## Contract Readiness

status: ready

required_contracts:

- `specs/02-capabilities/animation.md`
- `specs/03-flows/controller-runtime.md`

missing_contracts: []

## Decision Ledger

- Controller owns trigger sources and progress batching.
- Engine receives progress only and remains trigger-agnostic.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `AnimationEngine` | `02-capabilities/animation.md` | `animation-engine.ts` |
| `AnimationController` | `02-capabilities/controller.md` | `controller.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| interpolation/lifecycle | `tests/runtime/animation-engine.test.ts` |
| RAF batching | `tests/runtime/controller.test.ts` |
| pause/resume | `tests/runtime/controller.test.ts` |
| error codes | `tests/runtime/controller.test.ts` |

## Non-goals

- Asset sanitization.
- Compiler digest.

## Handoff

Runtime API can compose engine and controller with the specified behavior.
