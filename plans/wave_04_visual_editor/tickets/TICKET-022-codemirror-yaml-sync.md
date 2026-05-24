---
id: TICKET-022
title: Add CodeMirror YAML editor and synchronization
wave: 4
status: pending
parallel_group: editor_ui
depends_on: [TICKET-017, TICKET-018, TICKET-020, TICKET-021]
blocked_by: [TICKET-017, TICKET-018, TICKET-020, TICKET-021]
spec_refs: [specs/02-capabilities/editor.md, specs/03-contracts/editor.md, specs/03-flows/editor-authoring.md]
write_scope: [packages/editor/src/yaml-editor, packages/editor/src/IsostateEditor.tsx, packages/editor/src/style.css, tests/editor/yaml-editor.test.tsx, tests/editor/serialization.test.ts]
read_scope: [packages/editor/src/commands.ts, packages/editor/src/serialization.ts, specs/02-capabilities/editor.md]
contract_readiness:
  status: ready
  required_contracts: [specs/02-capabilities/editor.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-022: CodeMirror YAML Editor Sync

## Goal

Embed CodeMirror 6 for YAML editing, diagnostics, formatting, and canvas/YAML
sync.

## Context Digest

CodeMirror 6 is the v1 editor choice. YAML edits update canvas after parse
success. While YAML is invalid, visual edits are disabled and the canvas keeps a
read-only last-valid preview.

execution_semantics: browser UI.

## Implementation Approach

Create a focused YAML editor component. Wire editor changes into debounced
`yaml.edit` commands and format into `yaml.format`.

## Tasks

- Add CodeMirror 6 dependencies to the editor package.
- Add YAML editor component with highlighting, line numbers, folding, search,
  diagnostics gutter, bracket matching, indentation, and light/dark theme.
- Wire debounced YAML typing to `yaml.edit` command.
- Wire format action to canonical serializer.
- Show parser/validator diagnostics in gutter and editor state.
- Implement canvas read-only behavior while YAML is invalid.
- Implement canvas/YAML/split mode switching.
- Add tests for debounce behavior, invalid YAML state, format output, and mode
  switching.

## Required Behavior

- YAML typing preserves raw text until a visual edit, format, or export.
- Format is disabled when parsing fails.
- Diagnostics link to YAML ranges when available.
- Visual edits reserialize canonical YAML and update CodeMirror content.

## Acceptance

- Tests cover invalid YAML disables visual commands.
- Tests cover format uses canonical serializer.
- Tests cover split mode shows both canvas and YAML editor.

## Verification

```bash
bun test tests/editor/yaml-editor.test.tsx tests/editor/serialization.test.ts
bun run typecheck
bun run lint
```

## Decision Ledger

- Monaco is not a v1 dependency.
- Comments and original scalar quoting are not preserved after visual edits.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| YAML editor | `specs/02-capabilities/editor.md` | `packages/editor/src/yaml-editor` |
| sync flow | `specs/03-flows/editor-authoring.md` | `packages/editor/src/IsostateEditor.tsx` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| invalid YAML read-only canvas | `tests/editor/yaml-editor.test.tsx` |
| format canonical YAML | `tests/editor/yaml-editor.test.tsx` |
| split mode | `tests/editor/yaml-editor.test.tsx` |

## Non-goals

- Monaco support.
- Comment-preserving YAML patching.

## Handoff

After this ticket, the editor has the core v1 authoring loop.

