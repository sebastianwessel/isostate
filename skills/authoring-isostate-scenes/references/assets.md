# Isostate Assets Reference

Use this when defining `header.assets`, SVG asset paths, sprite sheets, anchors,
floors, labels, and generated primitive underlays.

## Asset Catalog

```yaml
header:
  assetBaseUrl: ./assets/aws-3d
  assets:
    - id: api-server
      path: compute/server
      anchor: [0.5, 1]
    - id: internet-gateway
      path: networking/internet-gateway
      anchor: [0.125, 1]
```

Rules:

- `id` is the document-local asset id used by elements.
- `path` is combined with `assetBaseUrl`; `.svg` may be omitted.
- `anchor` is normalized viewport coordinate `[x, y]`, default `[0.5, 1]`.
- Asset declaration order has no render-order meaning.
- External assets must be browser-loadable standalone SVG files.

## Sprite Sheets

Sprite sheets expose many placeable sprite ids from one image file:

```yaml
header:
  assetBaseUrl: ./assets
  assets:
    - id: app-icons
      type: sprite-sheet
      path: app-icons.png
      sheetSize: [512, 256]
      tileSize: [64, 64]
      anchor: [0.5, 1]
      sprites:
        server: [0, 0]
        database:
          at: [1, 0]
          anchor: [0.5, 0.92]
        wide-service:
          rect: [128, 0, 96, 64]
```

Rules:

- Elements use nested sprite ids, for example `asset: server`.
- The sheet id, for example `app-icons`, is only a namespace and is not
  placeable.
- `sheetSize`, `tileSize`, and `rect` are source-image pixels.
- `tileSize` is required for tuple and `at` sprites; `rect` sprites do not need
  `tileSize`.
- Sprite ids must not collide with standalone asset ids, other sprite ids, or
  built-ins.
- Sprite sheet paths must include `.png`, `.webp`, `.jpg`, `.jpeg`, or `.svg`;
  `.gif` is not supported.
- Prefer `128 x 128` or `256 x 256` pixels per one-cell raster sprite. Use
  `256 x 256` for detailed skeuomorphic or 3D-looking sprites. Keep full sheets
  at `2048 x 2048` or smaller when practical, and use WebP for large catalogs.
- Generated PNG/WebP sprite sheets must have real transparency. If a
  checkerboard appears in the rendered scene, the image pixels likely contain a
  checkerboard background instead of alpha.

## AI-Generated Asset Sets

When using OpenAI or another image model to generate assets, ask for a
consistent transparent sprite sheet instead of unrelated one-off images:

```text
Create a transparent PNG sprite sheet of 16 isometric traffic assets in a
consistent skeuomorphic 3D style. Use a 4 by 4 grid, 256 px per tile. Include
cars, bus, roads, signs, traffic lights, cones, barriers, and street lamps.
Keep the same camera angle, lighting, scale, and transparent background.
```

After generation:

- verify the alpha channel is real
- crop excessive padding without clipping objects
- write exact `sheetSize`, `tileSize`, and per-sprite anchors
- use `[0.5, 0.85]` as a starting point for cars and other low objects whose
  ground contact sits above the tile bottom due to perspective
- use `[0.5, 0.5]` for flat road tiles

## Asset Manifests

The editor discovers external catalogs through `isostate.asset-manifest` JSON.
Keep each manifest scoped to one asset family and one `assetBaseUrl`.

```bash
bunx --package @sebastianwessel/isostate-cli isostate assets manifest assets/traffic \
  --out public/assets/traffic.manifest.json \
  --asset-base-url ./traffic
```

For separate visual families, generate separate manifests and pass all manifest
URLs to the editor. Do not merge unrelated source folders into one manifest just
to make browsing easier; the editor can browse multiple manifests while
preserving their separate URL roots.

## Text Labels

`asset: text` is built in and must not be declared in `header.assets`.

```yaml
- id: api-label
  asset: text
  layer: labels
  at: [2, 2]
  text:
    value: |
      Public
      API
    align: middle
    fontSize: 14
    fontWeight: 700
    lineHeight: 1.2
    fill: "#111111"
```

Text rules:

- `text.value` is required when placing or adding `asset: text`.
- `text.value: ""` and whitespace-only values are allowed but emit
  `EMPTY_TEXT_CONTENT`; use them only for intentionally invisible labels.
- Text over `1000` characters or `20` lines is invalid.
- Text updates are sparse; changing `text.fill` keeps the previous
  `text.value` and other text style fields.
- Line breaks are supported.
- Non-text assets must not include `text`.

## Generated Primitives

`rectangle`, `circle`, `polygon`, and `line` are built-in generated assets and
must not be declared in `header.assets`.

```yaml
- id: zone-underlay
  asset: rectangle
  layer: ground
  at: [2, 3]
  size: 2
  primitive:
    rectangle:
      fill: "#2563eb"
      stroke: "#2563eb"
      strokeWidth: 1
      opacity: 0.08
```

Primitive rules:

- `primitive` must contain exactly one child matching the asset id.
- Use primitives for simple ground areas, markers, polygons, and local lines.
- `polygon.points` and `line.points` are normalized local coordinates from `0`
  to `1`.
- Primitive updates are sparse; changing one nested style field keeps omitted
  primitive fields unchanged.
- Use whole-cell `size` values to scale primitives on the grid.
- External URL assets and sprites must not include `primitive`.

## Floor And Fit

```yaml
floor:
  visible: true
  layer: ground
```

Rules:

- Omit `floor.size` unless a larger fixed surface is needed.
- The compiler derives floor size from resolved scene footprints when omitted.
- Authored YAML does not expose `layout.fit`, `layout.align`, `layout.padding`, or `layout.bounds`.
- Page backgrounds belong in host CSS via the built-in `.iso-scene` class or an
  optional `header.className`, not YAML gradient config.
- Theme-aware text, primitive, and connector colors should use semantic CSS
  variables in YAML, for example `fill: var(--iso-label)` or
  `stroke: var(--iso-flow)`.
- Define light values in host CSS defaults and dark values under the
  shadcn-compatible `.dark` root class. Do not duplicate scene YAML for themes.
- Do not add `theme: light` or `header.className` only for light/dark mode.

## Composite SVG Assets

Some imported SVGs contain a multi-cell visual object or multiple visual
objects. Do not let those drift against the grid:

- Do not enlarge an imported composite SVG with `size` unless the SVG was
  intentionally authored for that multi-cell footprint.
- If the SVG contains independent objects, split it into separate asset files
  and place each object as its own element.
- If splitting is not practical, keep the source asset at `size: 1` and use the
  checked catalog `anchor`.
- Do not compensate with fractional `at` or fractional `size` values.
- Do not fix repeated placement drift in scene YAML. Fix the asset catalog
  `anchor` so every placement behaves the same.
