---
id: TICKET-018
title: Implement editor workspace, commands, and canonical serializer
wave: 4
status: pending
parallel_group: editor_package_foundation
depends_on: [TICKET-015, TICKET-017]
blocked_by: [TICKET-015, TICKET-017]
spec_refs: [specs/01-domains/editor-workspace.md, specs/02-capabilities/editor.md, specs/03-contracts/editor.md]
write_scope: [packages/editor/src/workspace.ts, packages/editor/src/commands.ts, packages/editor/src/serialization.ts, packages/editor/src/types.ts, tests/editor/workspace.test.ts, tests/editor/commands.test.ts, tests/editor/serialization.test.ts]
read_scope: [packages/core/src/types, specs/01-domains/editor-workspace.md, specs/02-capabilities/editor.md]
contract_readiness:
  status: ready
  required_contracts: [specs/01-domains/editor-workspace.md, specs/03-contracts/editor.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-018: Workspace, Commands, And Serializer

## Goal

Implement the editor's pure state layer: workspace creation, semantic command
application, undo/redo primitives, and canonical YAML serialization.

## Context Digest

UI components must dispatch commands and never mutate YAML, history, or runtime
DOM directly. Visual edits reserialize canonical YAML and remount preview in
later tickets.

execution_semantics: `in_process` pure browser code.

## Implementation Approach

Keep this ticket DOM-free. Use browser-safe DSL APIs for parse/validate/compile
and `yaml` serialization only through the editor package dependency graph.

## Tasks

- Define editor types from specs: `EditorWorkspace`, `EditorSelection`,
  `EditorViewport`, `EditorCommand`, `EditorCommandResult`, diagnostics, and
  operation types.
- Implement `createEditorWorkspace({ sourceYaml, activeSceneId })`.
- Implement `serializeSceneDocument(document)` with exact field order,
  two-space indentation, flow tuples, block scalar multiline text, and omitted
  empty optional structures.
- Implement `serializeEditorWorkspace(workspace)`.
- Implement `applyEditorCommand(workspace, command)` with immutable return
  values and validation before commit.
- Implement commands for YAML edit, YAML format, scene add/rename/remove,
  element add/update/remove, layer update, connection add/update/remove, camera
  update/remove, and asset declaration add/update/remove.
- Add unit tests for serializer shape, command immutability, invalid-command
  diagnostics, undo inverse behavior, and later-scene delta generation.

## Required Behavior

- Commands do not access DOM APIs.
- Commands that produce invalid documents return `changed: false` and a
  diagnostic.
- Later-scene edits follow the delta table in `specs/02-capabilities/editor.md`.
- Comments and original scalar quoting are not preserved after visual edits or
  format.

## Acceptance

- Serializer output is deterministic across repeated calls.
- Command tests cover every `EditorOperation` variant in the contract.
- Invalid first-scene/delta operations are rejected before mutation.

## Verification

```bash
bun test tests/editor/workspace.test.ts tests/editor/commands.test.ts tests/editor/serialization.test.ts
bun run typecheck
bun run lint
```

## Decision Ledger

- State changes are command-driven.
- Remount-after-commit belongs to UI/runtime preview tickets, not command code.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| workspace model | `specs/01-domains/editor-workspace.md` | `packages/editor/src/workspace.ts` |
| command model | `specs/02-capabilities/editor.md` | `packages/editor/src/commands.ts` |
| serializer | `specs/02-capabilities/editor.md` | `packages/editor/src/serialization.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| serializer deterministic | `tests/editor/serialization.test.ts` |
| commands immutable | `tests/editor/commands.test.ts` |
| deltas correct | `tests/editor/commands.test.ts` |
| workspace init works | `tests/editor/workspace.test.ts` |

## Non-goals

- React UI.
- Core renderer mounting.

## Handoff

UI tickets must use `applyEditorCommand` rather than mutating workspace state
directly.

