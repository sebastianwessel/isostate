---
id: TICKET-021
title: Implement inspector, scenes, layers, connections, and camera controls
wave: 4
status: pending
parallel_group: editor_ui
depends_on: [TICKET-017, TICKET-018, TICKET-019, TICKET-020]
blocked_by: [TICKET-017, TICKET-018, TICKET-019, TICKET-020]
spec_refs: [specs/02-capabilities/editor.md, specs/03-contracts/editor.md, specs/03-contracts/scene-schema.md]
write_scope: [packages/editor/src/inspector, packages/editor/src/scenes, packages/editor/src/layers, packages/editor/src/IsostateEditor.tsx, packages/editor/src/style.css, tests/editor/inspector.test.tsx, tests/editor/scenes.test.tsx]
read_scope: [packages/editor/src/commands.ts, packages/editor/src/workspace.ts, specs/03-contracts/scene-schema.md]
contract_readiness:
  status: ready
  required_contracts: [specs/02-capabilities/editor.md, specs/03-contracts/scene-schema.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-021: Inspector, Scenes, Connections, And Camera

## Goal

Implement the right-sidebar controls for elements, layers, scenes, inspector
connection editing, and camera authoring.

## Context Digest

Scenes are structured and simple: active scene dropdown plus add/duplicate/
rename/remove/reorder controls. Connections are inspector-driven in v1 using
dropdowns and fields, not drag-and-drop route editing.

execution_semantics: browser UI.

## Implementation Approach

Build small components that read current selection and dispatch semantic
commands. Disable invalid fields instead of generating invalid YAML.

## Tasks

- Add sidebar shell with tabs for Inspector, Scenes, Assets, and Layers.
- Implement element inspector fields for id, asset, `at`, `size`, layer, text,
  primitive styles, and basic animation presets.
- Implement layer controls for name, order, lock, visibility, and assign
  selected objects.
- Implement scene controls for active dropdown, add, duplicate, rename, remove,
  reorder, camera marker, operation counts, and validation status.
- Implement connection inspector:
  - add connection button;
  - `from` and `to` element dropdowns plus grid-point endpoint fields;
  - endpoint side dropdowns and offset fields;
  - routing dropdowns/number inputs;
  - layer dropdown;
  - style fields;
  - start/end endpoint dropdowns;
  - direction dropdown.
- Implement camera controls for element target, area target, reset, padding,
  duration, easing, preview, and clear.
- Add tests for scene commands, connection add/update validation, camera
  commands, disabled invalid controls, and layer assignment.

## Required Behavior

- Connection controls write `from`/`to` + `routing` by default.
- Manual route connections show read-only route points in the inspector and
  remain editable in YAML.
- Removing the first scene is blocked unless the operation rewrites another
  scene as the initial full scene; v1 default is block with diagnostic.
- Camera element target dropdown lists only elements present, entering, or
  exiting in the active resolved scene.

## Acceptance

- Tests cover adding a connection from two selected elements.
- Tests cover scene add/duplicate/remove constraints.
- Tests cover camera target validation.

## Verification

```bash
bun test tests/editor/inspector.test.tsx tests/editor/scenes.test.tsx tests/editor/commands.test.ts
bun run typecheck
bun run lint
```

## Decision Ledger

- Inspector-driven connection editing is v1 scope.
- Visual route dragging is out of scope for v1.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| inspector controls | `specs/02-capabilities/editor.md` | `packages/editor/src/inspector` |
| scene schema | `specs/03-contracts/scene-schema.md` | command usage |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| connection add/update | `tests/editor/inspector.test.tsx` |
| scene controls | `tests/editor/scenes.test.tsx` |
| camera controls | `tests/editor/inspector.test.tsx` |

## Non-goals

- Visual route-point dragging.
- Animation timeline editor.

## Handoff

Ticket 022 adds YAML split view and diagnostics that share the same workspace
state.

