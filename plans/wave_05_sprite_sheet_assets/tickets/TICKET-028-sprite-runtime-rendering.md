---
id: TICKET-028
title: Render compiled sprite assets in the browser runtime
wave: 5
status: done
parallel_group: sprite_sheet_028_renderer
depends_on: [TICKET-027]
blocked_by: [TICKET-027]
spec_refs: [specs/03-contracts/runtime-bundle.md, specs/02-capabilities/rendering/rendering-engine.md, specs/01-domains/assets.md]
write_scope: [packages/core/src/rendering/asset-node.ts, packages/core/src/rendering/rendering-engine.ts, tests/runtime, tests/rendering, tests/fixtures/sprite-sheet-assets]
read_scope: [packages/core/src/rendering, packages/core/src/types/runtime-bundle.ts, tests/fixtures/sprite-sheet-assets, specs/03-contracts/runtime-bundle.md, specs/02-capabilities/rendering/rendering-engine.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/runtime-bundle.md, specs/02-capabilities/rendering/rendering-engine.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-028: Sprite Runtime Rendering

## Goal

Render compiled `CompiledAsset.sprite` entries as nested SVG viewports while
preserving existing standalone URL asset rendering.

## Context Digest

Runtime compiled sprite assets contain `url`, `anchor`, and
`sprite: { sheetSize, rect }`. The renderer must create a nested `<svg>` with
`x = -cellSize * anchor[0]`, `y = -cellSize * anchor[1]`, `width = cellSize`,
`height = cellSize`, `viewBox = "rectX rectY rectWidth rectHeight"`, and
`preserveAspectRatio = "xMidYMax meet"`. The nested SVG contains one `<image>`
with `href` and `xlink:href` set to the resolved URL, `x="0"`, `y="0"`,
`width=sheetSize[0]`, and `height=sheetSize[1]`.

execution_semantics: in_process.

Docs/examples are an approved deferral to TICKET-032. This ticket implements
runtime DOM behavior only.

## Implementation Approach

Extend `createAssetNode` to branch on `asset.sprite`. Keep URL safety checks and
browser URL resolution shared with normal URL assets. Do not use `clipPath`, do
not inspect image dimensions, and do not parse image or SVG source content.

## Tasks

- Add a `createSpriteAssetNode` path in `asset-node.ts`.
- Reuse `isSafeAssetUrl` and `resolveBrowserAssetUrl`.
- Set both `href` and `xlink:href` on sprite child `<image>`.
- Apply the exact nested SVG viewport attributes from the runtime bundle spec.
- Preserve `data-asset`, layer, transform, size scaling, lifecycle, and ambient
  behavior owned by `rendering-engine.ts`.
- Add DOM tests for nested SVG attributes and child image attributes.
- Add regression tests for normal URL asset rendering.
- Add runtime error test for unsafe sprite URL using existing
  `INVALID_ASSET_URL`.

## Acceptance

- Sprite asset DOM contains one nested `<svg>` with the exact `viewBox`.
- Child `<image>` uses sheet dimensions from `sprite.sheetSize`.
- Anchor placement matches normal URL asset placement formula.
- Unsafe sprite URLs throw `INVALID_ASSET_URL`.
- Normal URL assets still render as direct `<image>` nodes.
- Runtime does not inspect image dimensions or parse asset source.

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| nested SVG viewBox | `bun test tests/rendering tests/runtime` |
| child image sheet size | `bun test tests/rendering tests/runtime` |
| anchor placement | `bun test tests/rendering tests/runtime` |
| unsafe URL | `bun test tests/rendering tests/runtime` |
| normal asset regression | `bun test tests/rendering tests/runtime` |

## Verification

```bash
bun test tests/rendering tests/runtime
bunx tsc --noEmit
bunx biome check packages/core/src/rendering tests/rendering tests/runtime
```

## Decision Ledger

| Decision | Source |
|---|---|
| Nested SVG viewport is the renderer mechanism | `specs/03-contracts/runtime-bundle.md` |
| Runtime does not inspect dimensions | `specs/03-contracts/runtime-bundle.md` |
| Anchor placement formula matches normal assets | `specs/03-contracts/runtime-bundle.md` |
| Unsafe URLs use existing runtime error | `specs/03-contracts/errors.md` |

## Contract Traceability

| Surface | Contract | Owner Files | Tests |
|---|---|---|---|
| sprite asset DOM | `runtime-bundle.md` | `asset-node.ts` | `tests/rendering`, `tests/runtime` |
| renderer asset branch | `rendering-engine.md` | `asset-node.ts`, `rendering-engine.ts` | `tests/rendering` |
| URL safety | `errors.md` | `asset-node.ts` | `tests/runtime` |

## Non-goals

- Compiler metadata generation.
- CLI copying.
- Image preloading.
- Pixel inspection.

## Handoff

TICKET-029 can rely on runtime sprite URLs being ordinary browser-loadable asset
URLs.
