---
id: TICKET-031
title: Support sprite sheets in editor asset browser and placement
wave: 5
status: pending
parallel_group: sprite_sheet_031_editor
depends_on: [TICKET-030]
blocked_by: [TICKET-030]
spec_refs: [specs/03-contracts/editor.md, specs/02-capabilities/editor.md, specs/03-contracts/asset-manifest.md, specs/03-flows/editor-authoring.md]
write_scope: [packages/editor/src/assets, packages/editor/src/types.ts, packages/editor/src/workspace, packages/editor/src/components, tests/editor, docs/reference/editor.md]
read_scope: [packages/editor/src, packages/core/src/types, specs/03-contracts/editor.md, specs/02-capabilities/editor.md, specs/03-contracts/asset-manifest.md, tests/editor]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/editor.md, specs/02-capabilities/editor.md, specs/03-contracts/asset-manifest.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-031: Sprite Editor Asset Browser

## Goal

Make the editor asset provider, asset browser, and drag-to-place behavior handle
sprite sheet manifest entries exactly as specified.

## Context Digest

The editor fetches `isostate.asset-manifest` JSON. For sprite sheet entries, it
displays each nested sprite as a draggable logical asset. Dragging a sprite adds
or reuses one containing `type: sprite-sheet` declaration in `header.assets` and
places the nested sprite id on the element. The editor writes `id`, `type`,
`path`, `sheetSize`, optional `tileSize`, optional sheet `anchor`, and the full
manifest `sprites` map. It does not write `group`, `name`, sheet `label`, sheet
`tags`, sprite `label`, or sprite `tags`. Conflicting sheet metadata reports
`EDITOR_ASSET_CONFLICT` and leaves YAML unchanged.

Public API inventory:

| Surface | Kind | Owner | Stability | Execution |
|---|---|---|---|---|
| `EditorAssetProvider` sprite previews | extension point | `packages/editor` | experimental | in_process |
| manifest-backed drag placement | UI workflow | `packages/editor` | experimental | in_process |

execution_semantics: in_process.

Durable manifest semantics: the editor consumes asset manifest version `1` and
does not rewrite manifest files. It preserves manifest schema, digest values,
immutable snapshot semantics, replay from literal JSON, and canonical entry data
when copying sheet declarations into YAML.

## Implementation Approach

Extend editor manifest types to represent URL and sprite sheet entries. Normalize
the asset browser view model to one draggable item per URL asset and one
draggable item per nested sprite. Keep write behavior centralized in existing
workspace command paths so YAML round trips remain deterministic.

## Tasks

- Update editor manifest validation to accept `type: sprite-sheet` entries.
- Extend `EditorAssetPreview` handling to include `sprite.sheetSize` and
  `sprite.rect`.
- Render sprite previews through the same nested SVG `viewBox` contract as the
  runtime.
- Display nested sprite ids as draggable asset items under their sheet group.
- On sprite drag, add or reuse the containing sheet declaration.
- Place the element with `asset` equal to the nested sprite id.
- Detect existing conflicting sheet declarations and report
  `EDITOR_ASSET_CONFLICT` without mutating YAML.
- Keep URL asset drag behavior unchanged.
- Add editor tests for manifest load, sprite preview data, sprite drag YAML
  mutation, conflict diagnostics, and URL regression.
- Update `docs/reference/editor.md` for sprite asset provider behavior.

## Acceptance

- Sprite sheet manifest entries load without `EDITOR_ASSET_MANIFEST_INVALID`.
- Each nested sprite appears as a draggable item.
- Dragging a sprite writes one sheet declaration and an element using the sprite
  id.
- Labels and tags from manifest are not written into YAML.
- Conflicts produce `EDITOR_ASSET_CONFLICT` and leave YAML unchanged.
- URL asset behavior remains unchanged.

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| manifest validation | `bun test tests/editor` |
| sprite asset browser items | `bun test tests/editor` |
| sprite drag YAML output | `bun test tests/editor` |
| conflict diagnostic | `bun test tests/editor` |
| URL regression | `bun test tests/editor` |
| editor docs | `bun test tests/nfr/docs-paths.test.ts` |

## Verification

```bash
bun test tests/editor tests/nfr/docs-paths.test.ts
bunx tsc --noEmit
bunx biome check packages/editor/src tests/editor docs/reference/editor.md
```

## Decision Ledger

| Decision | Source |
|---|---|
| Nested sprite id is element asset value | `specs/03-contracts/editor.md` |
| Full sheet declaration is written on drag | `specs/03-contracts/asset-manifest.md` |
| Labels/tags are manifest-only metadata | `specs/03-contracts/asset-manifest.md` |
| Conflicts use `EDITOR_ASSET_CONFLICT` | `specs/03-contracts/editor.md` |

## Contract Traceability

| Surface | Contract | Owner Files | Tests |
|---|---|---|---|
| editor provider | `editor.md` | `packages/editor/src/types.ts` | `tests/editor` |
| asset browser | `editor.md`, `editor.md capability` | `packages/editor/src/assets` | `tests/editor` |
| YAML mutation | `asset-manifest.md` | workspace command files | `tests/editor` |
| docs | `docs/reference/editor.md` | docs | `docs-paths.test.ts` |

## Non-goals

- CLI manifest generation.
- Runtime renderer.
- New visual route editing behavior.

## Handoff

TICKET-032 can document sprite sheet editor use after this ticket.
