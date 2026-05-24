---
id: TICKET-020
title: Implement runtime preview canvas and editor overlays
wave: 4
status: pending
parallel_group: editor_ui
depends_on: [TICKET-015, TICKET-017, TICKET-018, TICKET-019]
blocked_by: [TICKET-015, TICKET-017, TICKET-018, TICKET-019]
spec_refs: [specs/02-capabilities/editor.md, specs/03-contracts/editor-support-api.md, specs/03-flows/editor-authoring.md]
write_scope: [packages/editor/src/canvas, packages/editor/src/IsostateEditor.tsx, packages/editor/src/style.css, tests/editor/canvas.test.tsx]
read_scope: [packages/core/src/editor-support, packages/editor/src/workspace.ts, packages/editor/src/commands.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/02-capabilities/editor.md, specs/03-contracts/editor-support-api.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-020: Runtime Preview Canvas And Overlays

## Goal

Render the editor canvas through core `mountScene`, add editor overlays, and
wire basic selection, drag-to-place, move, resize, zoom, pan, grid, and
remount-after-commit behavior.

## Context Digest

Core rendering is the visual source of truth. Editor overlays are temporary UI
layers above the runtime SVG. On committed edits, the editor updates YAML,
recompiles, destroys the old preview, mounts a fresh runtime preview, and
restores selection/viewport.

execution_semantics: browser UI.

## Implementation Approach

Build a `CanvasView` component that accepts workspace and dispatches commands.
Use editor-support helpers for hit testing, pointer conversion, and grid cell
polygons. Keep drag preview state transient until commit.

## Tasks

- Add `CanvasView` and supporting components under `packages/editor/src/canvas`.
- Mount core runtime preview from the current compiled bundle.
- Create overlay container above runtime SVG for grid, selection bounds, handles,
  drag ghost, and camera area preview.
- Implement pointer conversion through `clientPointToSvgPoint` and
  `unprojectScreenPoint`.
- Implement selection and marquee selection for elements.
- Implement drag-to-place from asset state and built-ins.
- Implement move, resize, nudge, delete, fit scene, fit selection, reset
  viewport, zoom, pan, grid toggle, and snap-to-grid.
- Implement remount-after-commit and restore selection/viewport.
- Add component/unit tests for command dispatch and overlay state transitions.

## Required Behavior

- Canvas never writes editor overlays into the runtime SVG as scene objects.
- Canvas uses commands from Ticket 018 for committed changes.
- Runtime preview ignores editor-only visibility in runtime preview mode.
- Edit preview applies editor-only visibility and locks.
- Connection route dragging is not implemented in v1.

## Acceptance

- Tests show drag-to-place dispatches asset declaration plus element add command.
- Tests show move/resize dispatches update commands and remount callback.
- Tests show invalid locked-layer edits produce diagnostics and no mutation.

## Verification

```bash
bun test tests/editor/canvas.test.tsx tests/editor/commands.test.ts
bun run typecheck
bun run lint
```

## Decision Ledger

- Remount-after-commit is v1 preview behavior.
- No duplicate renderer in the editor package.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| canvas behavior | `specs/02-capabilities/editor.md` | `packages/editor/src/canvas` |
| core reuse | `specs/03-contracts/editor-support-api.md` | `packages/editor/src/canvas` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| command dispatch | `tests/editor/canvas.test.tsx` |
| overlay state | `tests/editor/canvas.test.tsx` |
| locked edit rejected | `tests/editor/canvas.test.tsx` |

## Non-goals

- Browser automation.
- Visual connector route dragging.

## Handoff

Ticket 021 adds inspector controls that operate on the same workspace and
command pipeline.

