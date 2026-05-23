---
id: TICKET-019
title: Implement editor asset provider and manifest browser state
wave: 4
status: pending
parallel_group: editor_package_foundation
depends_on: [TICKET-016, TICKET-017, TICKET-018]
blocked_by: [TICKET-016, TICKET-017, TICKET-018]
spec_refs: [specs/03-contracts/asset-manifest.md, specs/03-contracts/editor.md, specs/02-capabilities/editor.md]
write_scope: [packages/editor/src/assets.ts, packages/editor/src/types.ts, packages/editor/src/commands.ts, tests/editor/assets.test.ts, tests/editor/commands.test.ts]
read_scope: [specs/03-contracts/asset-manifest.md, packages/editor/src/workspace.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/asset-manifest.md, specs/03-contracts/editor.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-019: Asset Provider And Manifest State

## Goal

Load asset manifests in the editor, expose asset search/filter/recent/missing
state, and connect manifest assets to YAML asset declarations.

## Context Digest

The CLI owns filesystem scanning. The editor receives a manifest URL or
`EditorAssetProvider`, resolves previews by URL, and writes only DSL fields into
YAML.

execution_semantics: `in_process` browser UI/data code.

## Implementation Approach

Add manifest validation and provider helpers independent of UI rendering. Use
commands from Ticket 018 to mutate YAML asset declarations.

## Tasks

- Define `EditorAssetProvider`, `EditorAssetCatalog`, and preview types.
- Implement `createManifestAssetProvider(assetManifestUrl)`.
- Validate manifest `format`, `version`, `assetBaseUrl`, ids, paths, groups,
  names, anchors, tags, dimensions, and digests.
- Resolve relative preview URLs against the manifest URL.
- Implement asset search by id, label, path, and tag.
- Implement group/tag filters and recently-used tracking in workspace UI state.
- Implement missing YAML asset diagnostics and unused declared asset detection.
- Add command support for placing a manifest asset: ensure `header.assetBaseUrl`
  when missing, add `header.assets[]` when missing, then create the element.
- Add tests for manifest load, invalid manifest diagnostics, URL resolution,
  search/filter/recent, missing/unused reconciliation, and asset placement
  command effects.

## Required Behavior

- Built-in assets never call the provider.
- Manifest metadata fields never get serialized into authored YAML.
- Provider failures create non-fatal diagnostics and placeholders.
- SVG previews are URL-backed only; editor code does not inline SVG markup.

## Acceptance

- Asset placement from a manifest updates YAML as specified.
- Missing manifest entries are diagnostics, not destructive edits.

## Verification

```bash
bun test tests/editor/assets.test.ts tests/editor/commands.test.ts
bun run typecheck
bun run lint
```

## Decision Ledger

- Manifest URL is v1 default discovery.
- User-selected local files are out of scope for v1.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| asset provider | `specs/03-contracts/editor.md` | `packages/editor/src/assets.ts` |
| manifest shape | `specs/03-contracts/asset-manifest.md` | `tests/editor/assets.test.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| manifest validates | `tests/editor/assets.test.ts` |
| URL resolution works | `tests/editor/assets.test.ts` |
| placement updates YAML | `tests/editor/commands.test.ts` |

## Non-goals

- CLI manifest generation.
- Asset browser visual components.

## Handoff

Tickets 020 and 021 can render the asset browser and drag/drop UI on top of
this state layer.

