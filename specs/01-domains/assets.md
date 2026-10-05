# Domain: Assets

## Overview

Assets are reusable visual building blocks. An asset is either a standalone
URL-loaded SVG graphic or a logical sprite cropped from a URL-loaded sprite
sheet. Assets are decoupled from grid positioning and animation; they only
define what the element looks like.

Standalone SVG assets are rendered into a square runtime image viewport for each
grid cell with `preserveAspectRatio="xMidYMax meet"`. Sprite assets are rendered
through a nested SVG viewport cropped to the compiled sprite rectangle. `anchor`
is normalized against the square runtime viewport, not against path geometry or
image pixels inspected by the browser. The renderer never infers a better
anchor from asset contents.

Authored YAML references external assets through document-local ids in
`header.assets[]`. Normal URL asset ids resolve to browser-loaded SVG files
through `header.assetBaseUrl`. Sprite sheet entries expose nested sprite ids as
the element-facing asset ids; the sheet id is only a namespace.

The reserved id `text` is the only built-in generic asset. It is not an SVG source, is not declared in `header.assets[]`, and is rendered from an element-level `text` payload.

## Asset Definition

Normal URL assets are standalone SVG files that fill their canvas with no empty
margins. Assets scale to grid cells via the DSL `size` property: size 1 fills 1
cell, size 2 fills a 2×2 area, etc.

```ts
type AssetDefinition = UrlAssetDefinition | SpriteSheetAssetDefinition;

interface UrlAssetDefinition {
  /** Unique asset id used by authored YAML and runtime elements. */
  id: string;
  /** Optional relative SVG path. Defaults to id when omitted. */
  path?: string;
  /** Normalized viewport point placed on the projected footprint anchor. */
  anchor?: [number, number];
  /** Optional category for authoring tooling. */
  category?: AssetCategory;
}

interface SpriteSheetAssetDefinition {
  /** Namespace id for the sheet. This id is not placeable. */
  id: string;
  type: 'sprite-sheet';
  /** Relative image path with explicit .png, .webp, .jpg, .jpeg, or .svg extension. */
  path: string;
  /** Source image size in pixels. Required because runtime does not inspect images. */
  sheetSize: [number, number];
  /** Regular tile size in pixels for grid-addressed sprites. */
  tileSize?: [number, number];
  /** Default normalized anchor inherited by sprites. */
  anchor?: [number, number];
  /** Logical placeable asset ids exposed by this sheet. */
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

Normal URL asset files must be standalone SVG documents with
`xmlns="http://www.w3.org/2000/svg"` and a valid `viewBox`. Asset SVG should
use semantic CSS classes or CSS variables inside the file when theming is
needed.

`anchor` defaults to `[0.5, 1]`, the bottom-center of the normalized square
runtime viewport.
Shared asset sets should declare an anchor for every SVG. Use `[0.5, 1]` for
checked centered assets, and use an off-center value when the imported SVG's real
ground contact point is intentionally not centered in its runtime viewport.

## Sprite Sheet Assets

Sprite sheets let one image file provide many logical asset ids:

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

scenes:
  - id: initial
    elements:
      - id: api
        asset: server
        at: [1, 1]
```

Rules:

- `asset: server` references the logical sprite id, not the sheet id.
- The sheet id, such as `app-icons`, is not placeable and cannot be used by
  scene elements or the floor.
- `sheetSize` is required for all sprite sheets and uses source-image pixels.
- `tileSize` is required for `[column, row]` and `at: [column, row]` sprites.
- `rect` is `[x, y, width, height]` in whole source-image pixels and must fit
  within `sheetSize`.
- Sprite ids share the global asset id namespace with standalone assets and
  built-ins.
- Sprite anchors inherit from the sheet-level `anchor`, then default to
  `[0.5, 1]`; per-sprite `anchor` overrides both.
- Sprite sheet paths must include `.png`, `.webp`, `.jpg`, `.jpeg`, or `.svg`.
  `.gif` is not supported.

## SVG Blueprint

One-cell assets should use this geometry contract:

- `viewBox="0 0 64 64"`
- visual ground contact at `(32, 64)` for `anchor: [0.5, 1]`
- visual mass centered around the vertical centerline `x=32`
- no empty padding around the asset
- consistent stroke widths across the asset set
- no connector or long-arrow geometry in object assets

```svg
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Asset">
  <g stroke="#202020" stroke-width="1.25" stroke-linejoin="round">
    <path d="M16 24 32 16 48 24 32 32Z" fill="var(--iso-top, #f4f4f4)" />
    <path d="M16 24v20l16 10V32Z" fill="var(--iso-front, #d4d4d4)" />
    <path d="M48 24v20L32 54V32Z" fill="var(--iso-side, #a8a8a8)" />
  </g>
</svg>
```

The repo contains a copy with visible authoring guides at
`assets/blueprints/isometric-one-cell.svg`.

## Asset Categories

| Category       | Purpose |
|---|---|
| `building`     | Structures: houses, offices, warehouses, factories |
| `nature`       | Trees, bushes, flowers, rocks, water |
| `infrastructure` | Roads, bridges, fences, signs |
| `equipment`    | Servers, crates, barrels, machinery |
| `decoration`   | Clouds, birds, text, accent elements |
| `custom`       | User-defined assets |

```ts
type AssetCategory =
  | 'building'
  | 'nature'
  | 'infrastructure'
  | 'equipment'
  | 'decoration'
  | 'custom';
```

## Asset Catalog Tooling

The optional registry maps asset ids to metadata for authoring tools. It is not used by the browser renderer and does not carry raw SVG markup.

```ts
interface AssetRegistry {
  /** Register an asset definition (merges into registry) */
  register(asset: AssetDefinition): void;

  /** Get a single asset by id */
  get(id: string): AssetDefinition | undefined;

  /** Get all assets, optionally filtered by category */
  getAll(category?: AssetCategory): AssetDefinition[];

  /** Check if an asset exists */
  has(id: string): boolean;

  /** Remove an asset from the registry */
  remove(id: string): void;
}
```

## Asset Instantiation

An asset becomes an **element** when placed in a scene. Instantiation creates an SVG `<image>` node for the compiled URL and assigns position/transform based on grid coordinates.

The asset's visual size is determined by its `size` property in the DSL: `visualSize = cellSize * size`. The SVG image is scaled via CSS `transform: scale()` to fill the allocated grid cell area. Runtime validates asset URLs but does not parse or inject SVG markup.

## Built-In Generated Assets

`asset: text` creates a generated SVG text label:

```yaml
- id: gateway-label
  asset: text
  layer: labels
  at: [2, 3]
  text:
    value: |
      Authentication
      Gateway
    align: middle
    placement: cell
    fontSize: 12
    fontWeight: 700
    lineHeight: 1.2
    fill: "#111111"
```

Text elements do not use `assetBaseUrl`, image loading, or SVG parsing. The renderer creates `<text>` and `<tspan>` nodes directly and assigns authored lines through `textContent`. `text.placement` defaults to `cell`, which keeps text inside the grid cell; use `caption` for intentional top-floating labels. This makes labels safe for untrusted YAML text content and keeps common labels out of the asset catalog.

The DSL also reserves generated primitive asset ids: `rectangle`, `circle`,
`polygon`, and `line`. Primitive elements use an element-level `primitive`
payload instead of `header.assets`:

```yaml
- id: service-zone
  asset: rectangle
  layer: ground
  at: [1, 1]
  size: 3
  primitive:
    rectangle:
      fill: "#2563eb"
      stroke: "#1d4ed8"
      strokeWidth: 1
      opacity: 0.16
```

Primitive coordinates are normalized local grid coordinates from `0` to `1`.
They are generated with DOM SVG APIs, never loaded through browser image assets,
and are intended for ground underlays, markers, and simple authored geometry.
Primitive ids are reserved and must not appear in `header.assets`.

## Theme System

Themes define CSS variable values applied to all asset instances. A theme is a flat record of variable → color:

```ts
interface Theme {
  name: string;
  vars: Record<string, string>; // e.g. { '--color-leaf': '#15803d' }
}
```

### Built-in Themes

| Theme  | Description |
|---|---|
| `light` | Default light mode palette |
| `dark` | Dark mode palette |
| `brand` | Custom brand palette (configurable) |

Themes can be composed or extended:

```ts
const customTheme = composeTheme('dark', {
  '--color-trunk': '#a16207',
  '--color-leaf': '#166534',
});
```

Scene YAML should reference semantic CSS variables such as `var(--iso-label)`
or `var(--iso-flow)` for generated text, primitives, and connectors when colors
need to react to light/dark mode. The recommended host-page convention is
shadcn-compatible: define default variables under `:root` and dark overrides
under `.dark`. The DSL should not duplicate one set of scene objects for light
mode and another for dark mode.

## Depth Shading

Isometric assets use CSS `color-mix()` to create depth shading from a single color variable. Each face of a 3D shape maps to one or more CSS classes:

| CSS Class   | Meaning | Mix |
|---|---|---|
| `iso-top`   | Top face (lightest) | base color |
| `iso-front` | Front face | base color 70% |
| `iso-side`  | Side face | base color 85% |
| `iso-back`  | Back face (darkest) | base color 100% |

Asset geometry only needs one color variable per material, and all depth shading is handled by CSS.

## Software Architecture and Agentic Workflow Catalog

`assets/software-architecture/` is a first-party optional catalog of 92
photorealistic isometric software, AI, and process objects distributed under the
repository's MIT license. The original twenty objects remain available with
the same identifiers, rectangles, and anchors. Nine additional transparent PNG
sheets provide 72 objects for agentic work:

| Sheet | Logical ids / purpose |
| --- | --- |
| `agents-sprites.png` | `ai-agent`, orchestrator, planner, researcher, tool runner, reviewer, memory, knowledge |
| `ai-capabilities-sprites.png` | `ai-rag`, embedding, vector search, context, prompt, evaluation, guardrail, model router |
| `humans-sprites.png` | `human-` requester, operator, approver, expert, team, handoff, escalation, feedback |
| `channels-sprites.png` | `channel-` email, phone, Teams, web form, chat, issue, document, webhook |
| `orchestration-sprites.png` | `agent-` workflow, parallel, router, condition, loop, retry, timeout, error |
| `lifecycle-sprites.png` | `agent-` trigger, schedule, await human, approval, rejection, escalation, audit, complete |
| `servicenow-sprites.png` | `servicenow-` interaction, request, requested item, request task, catalog item, incident, problem, change |
| `providers-sprites.png` | `provider-` Azure Foundry, AWS Bedrock, Anthropic, OpenAI, Google Vertex, Google Gemini, local model, Hugging Face |
| `infrastructure-sprites.png` | `infra-` Redis cache, Redis stream, Redis pub/sub, vector database, object storage, knowledge base, API tool, secret vault |

All nine new sheets live in `agentic/`. Provider/product assets are original
conceptual illustrations; catalog labels and search aliases identify the
corresponding products. They are not official vendor logo files. Provider
choice, ticket type, human responsibility, and escalation meaning live in the
scene's authored labels and visual connections; catalog images do not implement
workflow execution or ticket schemas.

The material palette combines graphite metal, cyan glass, teal accents, amber
lights, realistic miniature people, and distinguishing product accents. Exact
prompts are recorded in `IMAGEGEN-PROMPTS.md` and the two provenance documents
under `agentic/`. Original generated image bytes and genuine alpha channels are
preserved. Each source sheet must fit the CLI's existing 2 MiB image limit.

The metadata source is `.isostate-assets.yaml`. Every logical sprite has an
explicit whole-pixel `rect`, checked normalized ground `anchor`, label, and
search tags. Crop geometry is measured from the actual generated sheet, rather
than assuming an evenly spaced layout. Scenes use these sprite declarations at
native `size: 1`; a sheet namespace is not placeable. Labels remain generated
`text` elements and routes remain scene `connections`.

The existing CLI generates `manifest.json`, including actual dimensions,
source byte digests, and sprite labels/tags. Its `assetBaseUrl` is `./` because it
resides beside the group directories. Website copies preserve ids, rectangles,
anchors, digests, and source bytes. Gallery categories and search expose all 92
objects; the editor registers the complete manifest.

Three runnable website examples cover software architecture, human-to-agent
workflow migration, and provider/tool routing. Each source YAML declares only
the catalog sprites it uses, and the build validates and compiles its generated
module and public YAML/JS downloads together. Examples show human review,
escalation, intake channels, ServiceNow records, and model/tool choices using
ordinary scene deltas and visual connections. Each scene stays within the
50-object target and uses whole grid cells.

The core package build copies all eleven sheets, the generated manifest,
README, image-generation provenance, and MIT LICENSE to
`dist/assets/software-architecture/`, exposing the files through the static
`./assets/software-architecture/*` package export. Consumers may copy these
files into a public directory or use bundler URL imports. This distribution
adds no runtime imports, browser dependencies, public DSL fields, or renderer
behavior. Asset bytes remain outside the core engine's compressed bundle budget.
