# Isostate Assets Reference

Use this when defining `header.assets`, SVG asset paths, sprite sheets, anchors,
floors, labels, and generated primitive underlays.

Scope host width/height and filter styles to the root scene SVG, for example
`.scene-host > svg.iso-scene`. Sprite assets contain nested SVG viewports whose
native dimensions and clipping must remain intact; a broad `.scene-host svg`
rule can resize them and reveal neighboring sprites. Verify a rendered crop
in the browser, not only its manifest rectangle.

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

## Enterprise Diagram Asset Quality

For architecture and process diagrams, prefer polished one-cell assets over
rough placeholders:

Choose SVG for vector artwork and transparent PNG/WebP sprites for detailed
photorealistic isometric renders. The software architecture catalog below is
the ready-made raster option; do not substitute simple geometric icons when
the requested visual direction calls for realistic materials and lighting.

- Use one consistent isometric camera angle, light direction, shadow style,
  edge treatment, and scale across the set.
- Keep silhouettes legible at one grid cell. A user should recognize browser,
  router, auth, service, cache, database, queue, worker, and warning assets
  before reading labels.
- Use calm enterprise palettes with subtle gradients, bevels, inner panels, and
  contact shadows. Avoid toy-like saturation, noisy details, or inconsistent
  icon metaphors.
- Preserve the checked `anchor` and native one-cell footprint. Split or redraw
  bad composite assets instead of compensating with oversized `size` values.
- Let labels and connections remain primary. Asset polish should improve
  recognition, not compete with route direction or source fidelity.
- For semantic branch cues, prefer dedicated one-cell marker assets or simple
  generated primitive shapes. Do not use text markers that duplicate nearby
  labels, such as `OK` next to an `ok` edge label. Do not use emoji or font
  glyphs as marker text in generated scene DSL; the text primitive is for
  labels, not an icon system, and the runtime does not control cross-platform
  emoji/font fallback or glyph metrics. If a symbol-like marker is required,
  provide it as a checked SVG/PNG asset or generated primitive.

## Asset Manifests

The editor discovers external catalogs through `isostate.asset-manifest` JSON.
Keep each manifest scoped to one asset family and one `assetBaseUrl`.

```bash
npx --package @sebastianwessel/isostate-cli isostate assets manifest assets/traffic \
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
    placement: cell
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
- `text.placement` defaults to `cell`, which keeps the label inside the grid
  cell. Use `caption` only when an intentional floating label above the cell is
  wanted.
- Position text according to that placement. `placement: cell` is a normal
  in-cell text object and should usually have its own `at` cell. `placement:
  caption` may share a one-cell icon's `at` when the goal is an attached label.
  For scaled or visually tall assets, prefer a separate `cell` label next to the
  asset.
- Treat text layout as grid layout. Choose cells from the text role: the center
  cell or center band of a zone for an introductory group label, an edge/corner
  cell for persistent group context, an adjacent cell for a large asset label,
  and the route's clear lane cell for a connection caption. The renderer
  projects grid cells into SVG scene coordinates, then camera focus and
  responsive scaling change the SVG `viewBox`. Do not solve authored text
  placement with screen pixels, pixel offsets, fractional nudges, or manual
  visual drift; those assumptions can break under zoom, camera focus, different
  containers, or responsive rendering.
- Reserve a caption band below artwork and check it against neighboring assets,
  status rings, and routes. `cell` text is centered half a cell above its grid
  position, so moving a label by `[1, 1]` from an icon only puts the text back
  on the icon's ground anchor. The homepage uses wider stage spacing and
  separate `[2, 2]` caption offsets, two-line names, and a host text outline.
  Verify actual rendered bounds at every stop and responsive width; a text
  outline improves contrast but cannot fix a collision.
- Text style communicates hierarchy after placement is correct. Larger or
  heavier text can introduce a region; quieter color or smaller text can demote
  it later. Style must not be used to hide a label that is in the wrong cell or
  competing with an active route.
- Route and condition labels should behave like lane labels. Place them in a
  clear grid cell beside the route segment they explain. For branch outcome
  labels, prefer a cell near the receiving element or terminal side of the
  branch; use branch-source placement only when it clarifies a crowded fan-out.
  If a label is visually closer to another element, another route, or a group
  label, move the label, move the route endpoints, or split the branch into a
  clearer scene.
- For decision fan-outs, reserve distinct grid lanes or directional ports for
  semantically different outcomes. Do not send every branch through the same
  side of the decision and rely only on color or labels. Use separate lanes for
  failure, success, optional, fallback, and async paths when space allows.
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
- For grouped regions or Mermaid subgraphs, use separated primitive rectangles
  with quiet, distinct semantic variables for fill, stroke, and matching group
  label text. Leave at least one empty grid cell between subgraph footprints by
  default, and use more when labels, icons, or routed connections still feel
  cramped. If those regions define the visual structure, make the host floor
  grid very light or hide it so the group boundaries stay readable.
- Region labels can start centered and prominent while the region is being
  introduced. When contained elements appear, move the region label by whole
  grid cells toward an edge or corner of that region, keep a clear cell from
  active elements where possible, and switch it to quieter region-context
  styling so it no longer competes with the active story.
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

## Included Software Architecture Catalog

Use `assets/software-architecture/manifest.json` when authoring architecture,
workflow, or process diagrams in this repository. This photorealistic collection
uses transparent PNG sprite sheets. Preserve the declared sheet dimensions,
per-sprite rectangles, and checked anchors from source metadata. Place logical
sprite ids (`architecture-service`, `workflow-decision`, `process-approval`, etc.),
never the sheet namespace. Do not assume each sprite has a standalone SVG path.

The npm runtime package distributes the static catalog under
`dist/assets/software-architecture`; copy it into the host public asset folder.
The website editor already loads its manifest. The example source is
`website/src/scenes/software-architecture.isostate.yaml`. Regenerate catalog,
package, website, and compiled/downloadable examples with `bun run assets:build`.
Use native `size: 1`, whole-cell placements, generated text labels, and real
connections. For decisions, separate branches and label outcomes explicitly.

## Agentic And Human Workflow Vocabulary

The software catalog includes AI roles and retrieval/quality assets, human
participants, intake channels, control flow, lifecycle events, ServiceNow
records, provider concepts, Redis variants, tools, and supporting architecture.
See `docs/guides/agentic-workflows.md` for the complete logical-id inventory.

- Preserve `provider-azure-foundry` as a stable id; its current display label is
  Microsoft Foundry. Azure Foundry, Azure AI Foundry, and Azure AI Studio are
  useful discovery aliases. Vertex AI is a platform and Gemini a model family;
  use labels to describe the actual deployment.
- Distinguish ServiceNow Interaction (conversation), catalog item (offering),
  Request/REQ (order), Requested Item/RITM (ordered item), and request/catalog
  task/SCTASK (fulfillment work). Incident, Problem, and Change have separate
  restoration, root-cause, and controlled-change roles.
- Distinguish an AI reviewer, a human approver, and a workflow waiting for a
  person. Redis cache, Streams, and Pub/Sub also have separate sprite ids.
- Provider and ServiceNow illustrations are conceptual artwork rather than
  official vendor logos. Keep product or record identification in clear labels.
- Use the manifest's source crop and checked anchor, native `size: 1`, captions,
  and real `connections`. Tell a dense story through deltas, staying within 50
  active elements plus connections per scene.

## Directional Handoffs And State Variants

The software catalog distinguishes `human-handoff` (human to human),
`human-to-ai-handoff`, and `ai-to-human-handoff`. Use the directional sprite and
connection direction that match the story. Preserve checked one-cell anchors.
For a changing worker, keep the element id and patch its external `asset` to a
declared state sprite. Do not replace or resize the PNG source to communicate
processing: use the generated `activity` indicator and an explanatory label.
