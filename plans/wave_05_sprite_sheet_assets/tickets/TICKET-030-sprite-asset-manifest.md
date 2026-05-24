---
id: TICKET-030
title: Generate sprite sheet entries in asset manifests
wave: 5
status: done
parallel_group: sprite_sheet_030_manifest
depends_on: [TICKET-026]
blocked_by: [TICKET-026]
spec_refs: [specs/03-contracts/asset-manifest.md, specs/03-contracts/cli.md, specs/03-contracts/errors.md, docs/examples/asset-manifest.md]
write_scope: [packages/cli/src/assets-manifest.ts, packages/cli/src/commands.ts, tests/cli/assets-manifest.test.ts, tests/fixtures/assets-manifest, docs/examples/asset-manifest.md]
read_scope: [packages/cli/src, specs/03-contracts/asset-manifest.md, specs/03-contracts/cli.md, tests/fixtures/assets-manifest, docs/examples/asset-manifest.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/asset-manifest.md, specs/03-contracts/cli.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-030: Sprite Asset Manifest

## Goal

Extend `isostate assets manifest` so manifests can include metadata-declared
sprite sheet entries and editor-ready nested sprite definitions.

## Context Digest

Asset manifest version remains `1`. `AssetManifestEntry` is a union of URL
entries and `type: "sprite-sheet"` entries. Sprite sheet entries require
`path`, `width`, `height`, `sheetSize`, `sprites`, and `digest`; `tileSize` is
optional unless tuple or `at` sprites are present. Raster sprite sheet files are
included only through metadata. The generator reads raster image dimensions and
requires metadata `sheetSize` to match when supplied. Sprite id collisions fail
with `ASSET_MANIFEST_ID_COLLISION`.

execution_semantics: `local_process`.

Durable manifest semantics: asset manifest `format` stays
`isostate.asset-manifest`, version stays `1`, schema becomes the documented URL
or sprite-sheet entry union, digest remains `sha256:<hex>` over source file
bytes, entries remain immutable snapshots of source files and metadata at
generation time, replay uses the literal manifest JSON, and canonical behavior
keeps sorted entries by group, name, and path.

## Implementation Approach

Extend manifest metadata parsing and manifest entry generation. Keep standalone
SVG scanning unchanged. Add raster dimension reading for PNG, WebP, JPEG, and
JPG files declared in metadata. Treat source files as opaque bytes for digesting.
Reuse scene-schema sprite validation rules or a CLI-local equivalent that emits
manifest diagnostics.

## Tasks

- Accept metadata entries with `type: sprite-sheet`.
- Include metadata-declared `.png`, `.webp`, `.jpg`, `.jpeg`, and `.svg` sprite
  sheet files in manifest generation.
- Read raster image width and height for `sheetSize`.
- Reject unreadable dimensions, unsupported extensions, GIF, oversized raster
  sprite sheets over 2MB, invalid sprite ids, invalid sprite definitions, and
  rectangles outside `sheetSize`.
- Emit `SpriteSheetManifestEntry` with `type`, `path`, `group`, `name`,
  `width`, `height`, `sheetSize`, optional `tileSize`, optional sheet `anchor`,
  `sprites`, optional labels/tags, and digest.
- Detect collisions across URL ids, sheet namespace ids, sprite ids, and
  built-in generated ids.
- Add fixture sprite sheet files with deterministic dimensions.
- Add tests for happy path, collision, invalid rect, unsupported extension,
  missing metadata, dimension mismatch, digest, and sorting.
- Update `docs/examples/asset-manifest.md` output examples when implementation
  output differs from current prose examples.

## Acceptance

- Manifest generation emits a valid `type: sprite-sheet` entry.
- Manifest generation exposes nested sprite ids exactly as metadata declares.
- Collisions fail before writing output.
- Invalid sprite metadata fails before writing output.
- Existing standalone SVG manifest behavior remains unchanged.
- Manifest docs match the generated JSON shape.

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| sprite sheet manifest happy path | `bun test tests/cli/assets-manifest.test.ts` |
| collision failure | `bun test tests/cli/assets-manifest.test.ts` |
| invalid rect failure | `bun test tests/cli/assets-manifest.test.ts` |
| unsupported extension failure | `bun test tests/cli/assets-manifest.test.ts` |
| dimension mismatch failure | `bun test tests/cli/assets-manifest.test.ts` |
| SVG manifest regression | `bun test tests/cli/assets-manifest.test.ts` |
| docs path inventory | `bun test tests/nfr/docs-paths.test.ts` |

## Verification

```bash
bun test tests/cli/assets-manifest.test.ts tests/nfr/docs-paths.test.ts
bunx tsc --noEmit
bunx biome check packages/cli/src tests/cli docs/examples/asset-manifest.md
```

## Decision Ledger

| Decision | Source |
|---|---|
| Manifest version stays `1` | `specs/03-contracts/asset-manifest.md` |
| Raster sprite sheets are metadata-declared | `specs/03-contracts/asset-manifest.md` |
| Sprite sheet digest is source file bytes | `specs/03-contracts/asset-manifest.md` |
| Editor YAML excludes labels/tags | `specs/03-contracts/asset-manifest.md` |

## Contract Traceability

| Surface | Contract | Owner Files | Tests |
|---|---|---|---|
| `SpriteSheetManifestEntry` | `asset-manifest.md` | `assets-manifest.ts` | `assets-manifest.test.ts` |
| CLI command behavior | `cli.md` | `commands.ts`, `assets-manifest.ts` | `assets-manifest.test.ts` |
| docs example | `docs/examples/asset-manifest.md` | docs | `docs-paths.test.ts` |

## Non-goals

- Editor UI consumption.
- Static bundle copying.
- Runtime rendering.

## Handoff

TICKET-031 can consume sprite sheet manifest entries without adding manifest
shape behavior.
