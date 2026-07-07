# Sprite Sheet Assets Design

> **Status: Implemented (historical design record).** Sprite sheet assets
> shipped in wave 05. The authoritative contracts now live in
> `specs/03-contracts/scene-schema.md` and `specs/03-contracts/asset-manifest.md`.

## Purpose

Add first-class sprite sheet assets to the isostate DSL so authors can load one
larger image file and expose many logical scene asset ids from it. Scene
placement should remain as simple as the current asset model: elements reference
one `asset` id, regardless of whether that visual comes from a standalone SVG or
from a sprite sheet.

This feature is for image-backed assets, especially transparent PNG or WebP
sprite sheets. SVG remains the preferred format for scalable one-off isometric
icons.

## Goals

- Preserve the current element authoring UX: `asset: server` stays the only
  visual selector on scene elements.
- Keep sprite-sheet complexity inside `header.assets`.
- Reuse the existing compiler pipeline: authored YAML validates and compiles to
  a browser runtime bundle with no parser or validator shipped to the browser.
- Allow many sprite assets to share one browser-loaded image URL.
- Keep current standalone SVG assets fully backward compatible.

## Non-Goals

- Do not add element-level `sprite` fields.
- Do not model sprite sheets as generated built-ins like `text` or `rectangle`.
- Do not support runtime parsing of image metadata.
- Do not add CSS theming inside raster sprites.
- Do not support animated sprite playback in this feature.

## Authored DSL

Sprite sheets are declared in `header.assets` as a new external asset entry
type:

```yaml
header:
  assetBaseUrl: ./assets
  assets:
    - id: app-icons
      type: sprite-sheet
      path: app-icons.png
      sheetSize: [512, 256]
      tileSize: [64, 64]
      sprites:
        server: [0, 0]
        database: [1, 0]
        cache: [2, 0]

scenes:
  - id: initial
    elements:
      - id: api
        asset: server
        layer: structures
        at: [1, 1]
      - id: db
        asset: database
        layer: structures
        at: [2, 1]
```

The compact `sprites.<id>: [column, row]` form is the default DX for regular
tile sheets. A verbose per-sprite form is available when an individual sprite
needs a custom anchor or rectangle:

```yaml
header:
  assetBaseUrl: ./assets
  assets:
    - id: app-icons
      type: sprite-sheet
      path: app-icons.webp
      sheetSize: [512, 256]
      tileSize: [64, 64]
      anchor: [0.5, 1]
      sprites:
        server:
          at: [0, 0]
        database:
          at: [1, 0]
          anchor: [0.5, 0.92]
        wide-service:
          rect: [128, 0, 96, 64]
          anchor: [0.5, 1]
```

Standalone assets keep their existing shape:

```yaml
assets:
  - id: server
    path: equipment/server
    anchor: [0.5, 1]
```

## Type Shape

The authored asset catalog becomes a union:

```ts
type AssetCatalogEntry = UrlAssetCatalogEntry | SpriteSheetAssetCatalogEntry;

interface UrlAssetCatalogEntry {
  id: string;
  path?: string;
  anchor?: [number, number];
}

interface SpriteSheetAssetCatalogEntry {
  id: string;
  type: "sprite-sheet";
  path: string;
  sheetSize: [number, number];
  tileSize?: [number, number];
  anchor?: [number, number];
  sprites: Record<string, SpriteDefinition>;
}

type SpriteDefinition =
  | [number, number]
  | {
      at?: [number, number];
      rect?: [number, number, number, number];
      anchor?: [number, number];
    };
```

For v1, `sheetSize` is required for every sprite sheet because the runtime does
not inspect image dimensions. `tileSize` is required when any sprite uses the
compact tuple form or the verbose `at` form. `rect` is pixel-based and does not
require `tileSize`.

## Validation

Validation expands the set of legal external asset ids before validating scene
elements:

- Standalone asset ids are legal element `asset` values.
- Sprite ids nested under all sprite sheets are also legal element `asset`
  values.
- Sprite sheet ids are namespaces only and are not legal element `asset` values.
- Sprite ids must be kebab-case.
- Sprite ids must not collide with standalone asset ids, built-in generated asset
  ids, or other sprite ids across sheets.
- Sprite sheet `path` must include an explicit image extension. Supported
  extensions are `.png`, `.webp`, `.jpg`, `.jpeg`, and `.svg`.
- `.gif` is rejected in v1 because animated sprite playback is out of scope.
- Standalone current SVG behavior remains unchanged: omitted extensions still
  compile to `.svg`.
- `sheetSize` is a required positive whole-pixel `[width, height]` tuple.
- Sprite tuple values are non-negative integer column and row indices.
- `rect` values are positive whole-pixel rectangles `[x, y, width, height]`.
- Authored and tile-derived rectangles must fit inside `sheetSize`.
- Anchors use the existing normalized inclusive `0..1` validation.

## Compiler

The compiler emits one runtime asset entry per logical sprite id. All sprites
from one sheet share the same resolved image URL:

```json
{
  "assets": {
    "server": {
      "url": "./assets/app-icons.png",
      "sprite": { "sheetSize": [512, 256], "rect": [0, 0, 64, 64] },
      "anchor": [0.5, 1]
    },
    "database": {
      "url": "./assets/app-icons.png",
      "sprite": { "sheetSize": [512, 256], "rect": [64, 0, 64, 64] },
      "anchor": [0.5, 0.92]
    }
  }
}
```

The runtime bundle keeps a flat asset lookup table so renderer and animation
code can continue resolving assets by `element.asset`.

Digest calculation includes sprite metadata because it is part of the runtime
bundle.

## Renderer

The renderer keeps the existing whole-asset path for runtime assets without a
`sprite` field.

For sprite assets, the renderer creates a nested SVG viewport:

- Create a nested `<svg>` with `viewBox` equal to the sprite rectangle.
- Set the nested viewport to the same square cell allocation as standalone
  assets using the same anchor placement formula.
- Add a child SVG `<image>` using the shared URL with `x="0"`, `y="0"`,
  `width` equal to `sheetSize[0]`, and `height` equal to `sheetSize[1]`.

The renderer does not inspect image dimensions. The validator guarantees sprite
rectangles fit inside the authored `sheetSize`.

## Asset Manifest

Asset manifest support uses the same logical model:

- A manifest entry with `type: sprite-sheet` represents a sprite sheet.
- Editor tooling exposes each nested sprite as a draggable logical asset.
- When a sprite is dragged into a scene, the editor writes or reuses the
  containing sprite-sheet declaration and places the logical sprite id on the
  element.

Manifest changes are part of implementation because the editor already uses
manifest entries to manage `header.assets`.

## Docs And Skill Updates

Update these artifacts in the same implementation:

- `specs/01-domains/assets.md`
- `specs/03-contracts/scene-schema.md`
- `specs/03-contracts/runtime-bundle.md`
- `specs/03-contracts/asset-manifest.md`
- `specs/02-capabilities/rendering/dsl-rendering.md`
- `docs/reference/types.md`
- `docs/reference/runtime-bundle.md`
- `docs/reference/public-api.md`
- `docs/examples/custom-assets.md`
- `skills/authoring-isostate-scenes/references/assets.md`

## Testing

Focused tests should cover:

- Parser and validator accept compact and verbose sprite declarations.
- Validator rejects duplicate sprite ids, invalid anchors, invalid paths, sheet
  ids used as element assets, missing `sheetSize`, missing `tileSize` when `at`
  is used, and rectangles outside `sheetSize`.
- Compiler emits flat runtime assets with shared URLs and pixel sprite rects.
- Renderer creates a clipped image node for sprite assets and preserves existing
  standalone asset behavior.
- Public type contract tests include the new asset union and runtime sprite
  metadata.
- Docs path and generated example checks remain in sync.
