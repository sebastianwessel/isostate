---
id: TICKET-026
title: Implement sprite sheet parser and validator semantics
wave: 5
status: done
parallel_group: sprite_sheet_026_validator
depends_on: [TICKET-025]
blocked_by: [TICKET-025]
spec_refs: [specs/03-contracts/scene-schema.md, specs/03-contracts/errors.md, specs/02-capabilities/rendering/dsl-validator.md, specs/01-domains/assets.md]
write_scope: [packages/core/src/dsl/scene-parser.ts, packages/core/src/dsl/scene-validator.ts, packages/core/src/types/validation.ts, tests/dsl, tests/fixtures/sprite-sheet-assets]
read_scope: [packages/core/src/dsl, packages/core/src/types, tests/fixtures/sprite-sheet-assets, specs/03-contracts/scene-schema.md, specs/03-contracts/errors.md, specs/02-capabilities/rendering/dsl-validator.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/scene-schema.md, specs/03-contracts/errors.md, specs/02-capabilities/rendering/dsl-validator.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-026: Sprite Parser And Validator

## Goal

Parse sprite sheet asset declarations and enforce every sprite sheet validation
rule before compilation.

## Context Digest

`header.assets[]` accepts normal URL assets and `type: "sprite-sheet"` entries.
Normal URL assets keep the current SVG behavior. Sprite sheet entries require
`path`, `sheetSize`, and non-empty `sprites`; `tileSize` is required for tuple
and `at` sprites. Sprite sheet paths support `.png`, `.webp`, `.jpg`, `.jpeg`,
and `.svg`; `.gif` and extensionless sheet paths are invalid. Sprite ids are
global placeable asset ids. Sheet namespace ids are not placeable for elements
or floor assets.

execution_semantics: in_process.

Docs/examples are an approved deferral to TICKET-032. This ticket implements
validator behavior only.

Durable manifest semantics: no durable manifest is changed by this ticket;
asset manifest version, digest, schema, immutable snapshot, replay, and
canonical behavior remain unchanged.

## Implementation Approach

Extend parser structural checks to accept the new asset union and reject unknown
fields. Extend validator asset resolution to build three sets: normal URL asset
ids, sprite sheet namespace ids, and placeable sprite ids. Use those sets for
element and floor asset validation. Add focused validator tests using fixtures
from TICKET-025.

## Tasks

- Parse `type`, `sheetSize`, `tileSize`, and `sprites` in asset declarations.
- Reject unsupported asset `type` values with `ASSET_TYPE_UNSUPPORTED`.
- Validate sheet path extension with `INVALID_SPRITE_SHEET_PATH`.
- Validate `sheetSize` with `INVALID_SPRITE_SHEET_SIZE`.
- Validate required and positive `tileSize` with `INVALID_SPRITE_TILE_SIZE`.
- Validate non-empty `sprites` with `NO_SPRITES`.
- Validate sprite ids with `INVALID_SPRITE_ID`, `DUPLICATE_SPRITE_ID`, and
  `SPRITE_ASSET_ID_COLLISION`.
- Validate tuple, `at`, and `rect` forms with `INVALID_SPRITE_DEFINITION`.
- Validate tile-derived and authored rectangles fit inside `sheetSize` with
  `INVALID_SPRITE_RECT`.
- Reject sheet namespace ids used by elements or floor with
  `SPRITE_SHEET_NOT_PLACEABLE`.
- Preserve existing URL asset, built-in text, and primitive validation behavior.
- Add tests for every new error code and at least one valid compact and verbose
  sprite sheet scene.

## Acceptance

- Valid compact and verbose sprite sheet fixtures validate successfully.
- Every sprite validation error listed in `specs/03-contracts/errors.md` has a
  focused test.
- Existing non-sprite validation tests still pass.
- Built-in generated ids remain reserved for sheets and sprites.
- Element and floor references accept nested sprite ids and reject sheet ids.

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| valid compact fixture | `bun test tests/dsl` |
| valid verbose rect fixture | `bun test tests/dsl` |
| unsupported type error | `bun test tests/dsl` |
| invalid path and GIF rejection | `bun test tests/dsl` |
| size/tile/rect validation | `bun test tests/dsl` |
| namespace not placeable | `bun test tests/dsl` |
| no URL regression | existing validator tests via `bun test tests/dsl` |

## Verification

```bash
bun test tests/dsl
bunx tsc --noEmit
bunx biome check packages/core/src/dsl packages/core/src/types tests/dsl tests/fixtures/sprite-sheet-assets
```

## Decision Ledger

| Decision | Source |
|---|---|
| Sprite ids are globally unique placeable ids | `specs/03-contracts/scene-schema.md` |
| Sheet ids are not placeable | `specs/03-contracts/scene-schema.md` |
| Rectangles must fit inside `sheetSize` | `specs/03-contracts/scene-schema.md` |
| Error code names are fixed | `specs/03-contracts/errors.md` |

## Contract Traceability

| Surface | Contract | Owner Files | Tests |
|---|---|---|---|
| parser asset union | `scene-schema.md` | `scene-parser.ts` | `tests/dsl` |
| validator asset sets | `dsl-validator.md` | `scene-validator.ts` | `tests/dsl` |
| validation errors | `errors.md` | `scene-validator.ts`, `validation.ts` | `tests/dsl` |

## Non-goals

- Compiler output.
- Runtime rendering.
- CLI manifest scanning.
- Editor UI.

## Handoff

TICKET-027 can compile validated sprite sheets without rechecking schema
semantics beyond defensive assertions.
