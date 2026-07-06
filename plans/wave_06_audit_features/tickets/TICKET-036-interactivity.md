---
id: TICKET-036
title: Element interactivity (hover/click events)
wave: 6
status: done
parallel_group: wave06_slot_b
depends_on: [TICKET-033]
blocked_by: []
spec_refs: [specs/02-capabilities/interactivity.md, specs/03-contracts/errors.md]
write_scope: [packages/core/src/runtime/interactivity.ts, packages/core/src/runtime/mount-scene.ts, packages/core/src/rendering/animation-css.ts, packages/core/src/index.ts, tests/runtime/interactivity.test.ts, tests/runtime/mount-scene.test.ts, docs/reference/public-api.md, docs/examples/interactive-elements.md, docs/README.md, README.md]
read_scope: [packages/core/src, specs/02-capabilities/interactivity.md, tests/runtime]
contract_readiness:
  status: ready
  required_contracts: [specs/02-capabilities/interactivity.md, specs/03-contracts/errors.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-036: Element Interactivity

## Goal

Implement the `interactive` mount option and `MountedScene.on()` exactly per
`specs/02-capabilities/interactivity.md`.

## Steps

1. Create `packages/core/src/runtime/interactivity.ts` (delegated listener
   setup, element resolution via the element state map, enter/leave
   translation, `iso-hover` toggling, teardown) and wire it in
   `mountScene()`.
2. Add the `.iso-interactive g[data-id] { cursor: pointer; }` rule to the
   runtime stylesheet builder; set/omit the `iso-interactive` root class per
   the spec.
3. Export `ElementPointerEvent` and `MountedSceneEvents`; extend
   `MountedScene` with `on()` (throws `MOUNT_DESTROYED` after destroy).
4. Tests per the spec Testing section in
   `tests/runtime/interactivity.test.ts`; extend the mount-scene DOM shim
   only with real-DOM-faithful event dispatch.
5. Docs per the spec Documentation section.

## Done Criteria

- Every spec Testing bullet passes; `bun run size` stays within budget
  (interactivity ships in the runtime).
