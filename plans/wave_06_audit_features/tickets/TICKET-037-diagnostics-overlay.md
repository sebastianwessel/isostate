---
id: TICKET-037
title: Diagnostics overlay
wave: 6
status: done
parallel_group: wave06_slot_c
depends_on: [TICKET-033, TICKET-036]
blocked_by: []
spec_refs: [specs/02-capabilities/diagnostics-overlay.md]
write_scope: [packages/core/src/runtime/diagnostics-overlay.ts, packages/core/src/index.ts, tests/runtime/diagnostics-overlay.test.ts, docs/reference/public-api.md, docs/guides/plan-a-scene.md]
read_scope: [packages/core/src, specs/02-capabilities/diagnostics-overlay.md, tests/runtime]
contract_readiness:
  status: ready
  required_contracts: [specs/02-capabilities/diagnostics-overlay.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-037: Diagnostics Overlay

## Goal

Implement `attachDiagnosticsOverlay` exactly per
`specs/02-capabilities/diagnostics-overlay.md`.

## Steps

1. Create `packages/core/src/runtime/diagnostics-overlay.ts` implementing
   the normative behavior list (grid, coordinates, anchors, routes, readout,
   live updates, replace-on-reattach, destroy semantics). Reuse the
   projection helpers exported by the rendering engine; do not duplicate
   projection math.
2. Export the function and both types from the root entry. Do NOT import
   from `browser-runtime.ts`.
3. Tests per the spec Testing section.
4. Docs per the spec Documentation section.

## Done Criteria

- Every spec Testing bullet passes; standalone runtime unaffected (verify
  the built runtime does not contain "data-iso-diagnostics").
