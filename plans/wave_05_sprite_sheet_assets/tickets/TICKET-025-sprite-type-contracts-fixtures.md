---
id: TICKET-025
title: Add sprite sheet public type contracts and fixtures
wave: 5
status: done
parallel_group: sprite_sheet_025_contracts
depends_on: []
blocked_by: []
spec_refs: [specs/01-domains/assets.md, specs/03-contracts/scene-schema.md, specs/03-contracts/runtime-bundle.md, specs/03-contracts/errors.md, specs/.readiness-report.yaml]
write_scope: [packages/core/src/types/assets.ts, packages/core/src/types/scene.ts, packages/core/src/types/runtime-bundle.ts, packages/core/src/types/index.ts, tests/contracts, tests/fixtures/sprite-sheet-assets]
read_scope: [packages/core/src/types, specs/01-domains/assets.md, specs/03-contracts/scene-schema.md, specs/03-contracts/runtime-bundle.md, specs/03-contracts/errors.md, tests/contracts, tests/fixtures]
contract_readiness:
  status: ready
  required_contracts: [specs/01-domains/assets.md, specs/03-contracts/scene-schema.md, specs/03-contracts/runtime-bundle.md, specs/03-contracts/errors.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-025: Sprite Type Contracts And Fixtures

## Goal

Expose the sprite sheet authored and runtime type contracts in public TypeScript
types and add reusable fixtures for later parser, compiler, renderer, CLI, and
editor tickets.

## Context Digest

Sprite sheets are external asset declarations with `type: "sprite-sheet"`,
required `path`, required `sheetSize`, optional `tileSize`, optional sheet
`anchor`, and a `sprites` map. Sprite definitions are `[column, row]`,
`{ at: [column, row] }`, or `{ rect: [x, y, width, height] }` plus optional
sprite `anchor` for verbose forms. Runtime compiled assets add
`sprite: { sheetSize, rect }`. Built-in generated ids remain excluded from
external asset entries.

Public API inventory:

| Surface | Kind | Owner | Stability | Execution |
|---|---|---|---|---|
| `AssetCatalogEntry` union | schema/type | `packages/core/src/types/scene.ts` | experimental | data_only |
| `AssetDefinition` union | schema/type | `packages/core/src/types/assets.ts` | experimental | data_only |
| `CompiledAsset.sprite` | schema/type | `packages/core/src/types/runtime-bundle.ts` | experimental | data_only |

execution_semantics: data_only.

Durable manifest semantics: no durable manifest is changed by this ticket;
asset manifest version, digest, schema, immutable snapshot, replay, and
canonical behavior remain unchanged.

## Implementation Approach

Update only shared type declarations and fixture files. Keep type names aligned
with specs: `UrlAssetCatalogEntry`, `SpriteSheetAssetCatalogEntry`,
`SpriteDefinition`, `CompiledSprite`, `UrlAssetDefinition`, and
`SpriteSheetAssetDefinition`. Export the new names from `packages/core/src/types/index.ts`.

Create fixture YAML and expected runtime JSON snippets under
`tests/fixtures/sprite-sheet-assets/`:

- `compact.isostate.yaml`
- `verbose-rect.isostate.yaml`
- `invalid-sheet-id-used.isostate.yaml`
- `invalid-rect-outside-sheet.isostate.yaml`
- `expected-compact-assets.json`

## Tasks

- Update authored asset union types in `packages/core/src/types/scene.ts`.
- Update tooling asset union types in `packages/core/src/types/assets.ts`.
- Update compiled runtime asset types in `packages/core/src/types/runtime-bundle.ts`.
- Export all new public type names from `packages/core/src/types/index.ts`.
- Add compact and verbose sprite fixture YAML.
- Add invalid fixture YAML for sheet namespace placement and out-of-bounds rect.
- Add expected compiled assets JSON for compact tuple expansion.
- Add or extend contract tests that import the new public types.

## Acceptance

- Public type exports include all sprite sheet type names.
- Existing standalone SVG type usage remains source-compatible.
- Fixtures use only fields defined in canonical specs.
- Invalid fixtures map directly to `SPRITE_SHEET_NOT_PLACEABLE` and
  `INVALID_SPRITE_RECT`.
- No parser, validator, compiler, renderer, CLI, or editor implementation changes
  are made in this ticket.

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| public type exports compile | `bunx tsc --noEmit` |
| package exports still load | `bun test tests/contracts/package-exports.test.ts tests/contracts/dist-entrypoints.test.ts` |
| fixtures are present | `test -f tests/fixtures/sprite-sheet-assets/compact.isostate.yaml` |
| formatting is valid | `bunx biome check packages/core/src/types tests/fixtures/sprite-sheet-assets tests/contracts` |

## Verification

```bash
bunx tsc --noEmit
bun test tests/contracts/package-exports.test.ts tests/contracts/dist-entrypoints.test.ts
bunx biome check packages/core/src/types tests/contracts
```

## Decision Ledger

| Decision | Source |
|---|---|
| Sheet ids are namespaces and nested sprite ids are placeable | `specs/03-contracts/scene-schema.md` |
| `sheetSize` is required on authored and compiled sprite sheets | `specs/03-contracts/scene-schema.md`, `specs/03-contracts/runtime-bundle.md` |
| Runtime sprite metadata is `CompiledSprite { sheetSize, rect }` | `specs/03-contracts/runtime-bundle.md` |
| GIF support is out of scope | `specs/01-domains/assets.md` |

## Contract Traceability

| Surface | Contract | Owner Files | Downstream |
|---|---|---|---|
| authored asset union | `specs/03-contracts/scene-schema.md` | `packages/core/src/types/scene.ts` | parser, validator, editor |
| tooling asset union | `specs/01-domains/assets.md` | `packages/core/src/types/assets.ts` | editor, registry |
| compiled sprite asset | `specs/03-contracts/runtime-bundle.md` | `packages/core/src/types/runtime-bundle.ts` | compiler, renderer |
| fixtures | all sprite specs | `tests/fixtures/sprite-sheet-assets` | later tickets |

## Non-goals

- Runtime behavior.
- YAML parsing behavior.
- CLI or editor behavior.
- Documentation prose beyond fixture comments.

## Handoff

Later tickets can rely on public type names and fixture paths created here.
