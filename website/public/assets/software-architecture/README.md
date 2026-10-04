# Software architecture assets

Twenty premium isometric renders for software architecture diagrams, workflows,
and business processes. Brushed graphite metal, translucent cyan glass, teal
accents, and warm amber lights give the objects a consistent dimensional style.
The catalog is distributed under the included MIT license.

## Catalog

| Group | Logical identifier suffixes |
| --- | --- |
| `architecture-` | `browser`, `api-gateway`, `service`, `database`, `cache`, `queue`, `worker`, `load-balancer`, `storage`, `cloud`, `container`, `observability` |
| `workflow-` | `start`, `end`, `task`, `decision`, `event` |
| `process-` | `approval`, `document`, `scheduler` |

`architecture/architecture-sprites.png` contains twelve architecture objects in
1448 × 1086 pixels. `workflow/workflow-process-sprites.png` contains eight
workflow/process objects in 1774 × 887 pixels. Both are original generated PNGs
with genuine transparency and preserved source bytes. Generation prompts are
recorded in [IMAGEGEN-PROMPTS.md](./IMAGEGEN-PROMPTS.md).

`.isostate-assets.yaml` supplies the exact whole-pixel crop rectangles, checked
anchors, labels, and search tags. `manifest.json` is generated from this metadata
and the PNG bytes. Architecture rectangles are 350 × 350 pixels with individual
ground anchors; workflow/process rectangles follow the source grid with explicit
`[0.5, 0.9]` anchors. Do not infer crops from an evenly divided architecture grid:
its generated rows have slightly different vertical spacing.

## Use in a scene

Copy this directory into the site's public assets directory. Declare the sheet
once, then place its logical sprite ids through the existing sprite-sheet DSL:

```yaml
header:
  assetBaseUrl: ./assets/software-architecture
  assets:
    - id: architecture-architecture-sprites
      type: sprite-sheet
      path: architecture/architecture-sprites.png
      sheetSize: [1448, 1086]
      sprites:
        architecture-service:
          rect: [730, 0, 350, 350]
          anchor: [0.507, 0.931]
        architecture-database:
          rect: [1092, 0, 350, 350]
          anchor: [0.511, 0.909]
```

Place `asset: architecture-service` using whole grid coordinates and the default
`size: 1`. Copy the manifest's exact rectangles and anchors when adding more
sprites. The sheet namespace itself is not placeable. Labels remain generated
`text` elements and routes remain scene `connections`.

For editor discovery, point `assetManifestUrl` at this directory's
`manifest.json`. Its `assetBaseUrl: ./` resolves relative to the manifest URL.
For a scene saved elsewhere, set `header.assetBaseUrl` to the directory where
the images are actually hosted. Host CSS variables cannot recolor these images.

## Package distribution

The core package ships these files at `dist/assets/software-architecture/`,
with the static export path `@sebastianwessel/isostate/assets/software-architecture/*`.
For example, a bundler that supports URL imports can load
`@sebastianwessel/isostate/assets/software-architecture/architecture/architecture-sprites.png?url`.
Static-site projects can copy the directory from the installed package into
their public assets directory. The catalog is optional static content and is
never imported by the browser engine.

## Regenerate the manifest

From the repository root:

```bash
bun packages/cli/src/bin.ts assets manifest assets/software-architecture \
  --out assets/software-architecture/manifest.json \
  --asset-base-url ./ --pretty
```

Keep source sheets, metadata, generated digests, and website copies together in
one change. Inspect each cropped sprite on light and dark backgrounds after
changing its rectangle or anchor. Preserve the source alpha channel.
