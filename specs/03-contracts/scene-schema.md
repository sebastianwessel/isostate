# Contracts: Scene Schema

## Overview

This file is the machine contract for authored `.isostate.yaml` parser output, validator input, compiler input, and compiled runtime scene data.

The authored DSL is **scene-delta based**:

1. `header` defines reusable assets, global render settings, optional floor/grid bounds, layers, theme, and layout behavior.
2. `scenes[]` defines the ordered timeline.
3. The first scene declares the initial placed elements.
4. Every following scene is a delta from the previous scene: only additions, removals, and changed element properties are authored.

Per-element top-level `keyframes` are **not part of the authored YAML contract**. The compiler expands scene deltas into resolved runtime `scenes[]` snapshots; examples and human-written YAML must use `scenes[]`.

## Authored Scene Document

```ts
interface SceneDocument {
  header: SceneHeader;
  scenes: SceneStep[];
}

interface SceneHeader {
  version?: string;
  name?: string;
  className?: string;
  assetBaseUrl?: string;
  assets: AssetCatalogEntry[];
  grid?: GridConfig;
  floor?: FloorConfig;
  theme?: string;
  layers: LayerDefinition[];
}
```

### Top-Level Fields

| Field | Required | Purpose |
|---|---:|---|
| `header` | yes | Document catalog and global scene settings. |
| `scenes` | yes | Ordered scene timeline; first scene is initial, later scenes are deltas. |

Unknown top-level fields produce `UNKNOWN_FIELD`.

### Header Fields

| Field | Required | Purpose |
|---|---:|---|
| `version` | no | Authored DSL version. Defaults to current compiler major/minor. |
| `name` | no | Human-readable document id/name. |
| `className` | no | CSS class string added to the root SVG for page-owned surface styling. |
| `assetBaseUrl` | no | Base URL/path for browser-loadable external asset files. |
| `assets` | yes | Catalog of local asset ids available to this scene document. |
| `grid` | no | Authoring grid unit. Defaults to `{ cellSize: 64 }`. |
| `floor` | no | Logical ground plane overrides. If omitted or missing `size`, compiler derives compiled floor size from scene element footprints. |
| `theme` | no | Theme name. Defaults to `light`. |
| `layers` | yes | Render order and grouping. |

Unknown header fields produce `UNKNOWN_FIELD`.

The root SVG always includes the built-in `iso-scene` class. `className` is an
optional additional root SVG hook for document-specific CSS, not a requirement
for light/dark mode. Light/dark switching is host CSS behavior, not scene
duplication. The recommended convention matches shadcn/ui: define default CSS
variables under `:root`, dark overrides under `.dark`, and reference semantic
tokens such as `var(--iso-label)` from text, primitive, and connector color
fields.

## Asset Catalog

```ts
type AssetCatalogEntry = UrlAssetCatalogEntry | SpriteSheetAssetCatalogEntry;

interface UrlAssetCatalogEntry {
  id: string;
  path?: string;
  anchor?: [number, number];
}

interface SpriteSheetAssetCatalogEntry {
  id: string;
  type: 'sprite-sheet';
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

`header.assets[]` is a document-local catalog of external asset ids the YAML is
allowed to reference. A normal URL asset exposes its own `id` as an element
`asset` value. A sprite sheet exposes each key under `sprites` as an element
`asset` value; the sheet `id` is a namespace only and must not be used by scene
elements or `header.floor.asset`.

For normal URL assets, the compiler combines `assetBaseUrl` with `path` or `id`
and appends `.svg` when the path omits an extension. Normal URL assets remain
the existing SVG-first contract.

For sprite sheets, `path` is required and must include an explicit image
extension. Supported sprite sheet extensions are `.png`, `.webp`, `.jpg`,
`.jpeg`, and `.svg`; `.gif` is rejected. Sprite sheet paths never receive an
implicit `.svg` extension.

`sheetSize` is `[width, height]` in source-image pixels. The runtime does not
inspect image dimensions, so `sheetSize` is required for every sprite sheet.
`tileSize` is `[width, height]` in source-image pixels and is required when any
sprite uses the compact tuple form or verbose `at` form.

The compact sprite form maps a column and row to a rectangle:

```yaml
assets:
  - id: app-icons
    type: sprite-sheet
    path: app-icons.png
    sheetSize: [512, 256]
    tileSize: [64, 64]
    sprites:
      server: [0, 0]
      database: [1, 0]
```

The verbose form supports either `at` or `rect`, but never both:

```yaml
sprites:
  server:
    at: [0, 0]
  wide-service:
    rect: [128, 0, 96, 64]
    anchor: [0.5, 1]
```

`rect` is `[x, y, width, height]` in source-image pixels. `x` and `y` must be
whole numbers greater than or equal to `0`; `width` and `height` must be whole
numbers greater than `0`. The validator checks that `x + width <= sheetSize[0]`
and `y + height <= sheetSize[1]`.

`anchor` is the normalized point inside the runtime asset viewport that sits on
the element's projected footprint anchor. It defaults to bottom-center
`[0.5, 1]`. Sprite anchors inherit from the sheet-level `anchor` when present;
otherwise they use `[0.5, 1]`. A per-sprite `anchor` overrides both.

The id `text` is reserved for the built-in generic text asset. It must not be declared in `header.assets[]`, does not resolve through `assetBaseUrl`, and is rendered by the browser runtime from the element's `text` payload.

Validation rules:

- `id` is kebab-case and unique across normal URL asset ids and sprite sheet
  namespace ids.
- `path`, when supplied, is a relative path-like id and may omit `.svg`.
- `anchor`, when supplied, is a two-number tuple where both values are in the inclusive range `0..1`.
- Each declared external asset must resolve through `assetBaseUrl`.
- Elements may reference only normal URL asset ids, sprite ids, or reserved
  built-in generated ids.
- Sprite ids are kebab-case and must be unique across all normal URL asset ids,
  sprite sheet namespace ids, sprite ids, and built-in generated ids.
- Sprite sheet namespace ids are not placeable asset ids.
- `sprites` must contain at least one sprite.
- Verbose sprite definitions must contain exactly one of `at` or `rect`.
- Unknown fields in asset and sprite definitions produce `UNKNOWN_FIELD`.
- Asset declaration order is stable and has no render-order meaning.

## Grid And Floor

```ts
interface GridConfig {
  cellSize?: number;
}

interface FloorConfig {
  size?: [number, number];
  origin?: [number, number];
  layer?: string;
  visible?: boolean;
  asset?: string;
}

```

Defaults:

| Field | Default |
|---|---|
| `grid.cellSize` | `64` |
| `floor.origin` | `[0, 0]` |
| `floor.visible` | `true` |
| `floor.layer` | first layer named `ground`, otherwise first declared layer |

The compiler emits internal runtime layout metadata. Authors do not configure
`fit`, `align`, `padding`, or `bounds` in YAML. The renderer must compute
projected bounds from the floor and all compiled scene element positions, then
set the root SVG `viewBox` to those bounds plus compiler-defined padding. It
must not use fixed `800×600` projection offsets. The SVG fills its container
with `width: 100%`, `height: 100%`, `preserveAspectRatio: xMidYMid meet`, and
the projected content is centered with only aspect-ratio whitespace.

`floor.size` is `[columns, rows]` in grid cells. When omitted, the compiler derives the compiled floor size from all resolved scene snapshots by taking the maximum `at + size` footprint of every non-removed element. Authors should specify `floor.size` only when they need a larger fixed surface than the content requires.

## Layers

```ts
interface LayerDefinition {
  name: string;
  order?: number;
}
```

Layer names are kebab-case and unique. `order` defaults to declaration index. Layer keyframes are not part of the authored v1 contract; layer changes in scene deltas must use explicit future `layerUpdates` only after that contract is added.

## Scene Timeline

```ts
interface SceneStep {
  id: string;
  elements?: ElementPlacement[];
  connections?: ConnectionPlacement[];
  add?: SceneAddDelta;
  update?: SceneUpdateDelta;
  remove?: SceneRemoveDelta;
  camera?: CameraFocus;
}

interface SceneAddDelta {
  elements?: ElementPlacement[];
  connections?: ConnectionPlacement[];
}

interface SceneUpdateDelta {
  elements?: ElementPatch[];
  connections?: ConnectionPatch[];
}

interface SceneRemoveDelta {
  elements?: ElementRemoval[];
  connections?: ConnectionRemoval[];
}
```

Rules:

- `scenes` must contain at least one item.
- `scenes[].id` is kebab-case and unique.
- The compiler distributes scene stop progress evenly from `0` to `1` in declaration order.
- The first scene must use `elements` to define the initial full element placement set. It may also use `connections` for initial visual connections. It may not use `add`, `update`, or `remove`.
- Scenes after the first may use `add`, `update`, and `remove`. They may not use top-level `elements` or `connections`.
- `add`, `update`, and `remove` are operation sections. Each section may contain `elements` and/or `connections`.
- A later scene omits unchanged elements and connections entirely; omitted objects retain their previously resolved properties.
- `camera`, when present, declares the camera focus for that scene stop. It is
  metadata, not a scene delta: it does not persist to later scene stops and it
  does not change element or connector state.
- Connections with `from.element` or `to.element` cannot outlive either endpoint
  element. If `remove.elements` removes an endpoint element, the same scene must
  also remove every still-present connection that references that element.
- The compiler expands deltas into resolved snapshots for every scene before producing the runtime bundle.

## Camera Focus

Scene camera metadata directs the runtime controller to change the SVG viewBox
when presentation navigation lands on a scene. It can also be used by tooling to
preview the intended focus target.

```ts
interface CameraFocus {
  target: CameraTarget;
  padding?: number;
  duration?: number;
  easing?: 'linear' | 'ease-in-out' | 'ease-out';
}

type CameraTarget =
  | { element: string }
  | { area: CameraGridArea }
  | { reset: true };

interface CameraGridArea {
  at: [number, number];
  size: [number, number];
}
```

Rules:

- A scene may contain at most one `camera` object.
- `camera.target` is required and must contain exactly one of `element`,
  `area`, or `reset`.
- `camera.target.element` must be a kebab-case element id that resolves to an
  element whose presence in the same resolved scene snapshot is `present`,
  `entering`, or `exiting`. It must not reference a connector id or an element
  whose resolved presence is `removed`.
- `camera.target.area.at` uses the same grid coordinate convention as element
  `at`.
- `camera.target.area.size` is `[columns, rows]` in grid cells and each value
  must be positive.
- Hand-authored camera area coordinates and sizes use whole grid cells.
- `camera.target.reset` must be the boolean literal `true` and returns the
  runtime camera to the compiled full scene viewBox.
- `camera.padding` is SVG user units after projection; it defaults to `32`, and
  must be finite, `>= 0`, and `<= 2048`.
- `camera.padding` must be omitted when `camera.target.reset: true`; reset uses
  the exact compiled full scene viewBox.
- `camera.duration` is milliseconds; when omitted, runtime navigation uses the
  active controller transition duration. When authored, it must be an integer
  `>= 0` and `<= 10000`.
- `camera.easing`, when omitted, uses the active controller transition easing.
- Camera focus does not affect compiler-derived `progress` values.

## Element Placement And Delta Patches

```ts
interface ElementPlacement {
  id: string;
  asset: string;
  at: [number, number];
  size?: number;
  layer?: string;
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
  text?: TextContent;
  primitive?: PrimitiveContent;
}

interface ElementPatch {
  id: string;
  at?: [number, number];
  size?: number;
  layer?: string;
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
  text?: TextContentPatch;
  primitive?: PrimitiveContentPatch;
}

interface ElementRemoval {
  id: string;
  exit?: ExitAnimation;
}

interface TextContent {
  value: string;
  align?: 'start' | 'middle' | 'end';
  placement?: 'cell' | 'caption';
  fontSize?: number;
  fontWeight?: number | 'normal' | 'bold';
  lineHeight?: number;
  fill?: string;
}

type TextContentPatch = Partial<TextContent>;

type PrimitiveAssetId = 'rectangle' | 'circle' | 'polygon' | 'line';

interface PrimitiveContent {
  rectangle?: PrimitiveStyle;
  circle?: PrimitiveStyle;
  polygon?: PrimitiveStyle & { points: [number, number][] };
  line?: Omit<PrimitiveStyle, 'fill'> & {
    points: [number, number][];
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
  };
}

interface PrimitiveContentPatch {
  rectangle?: Partial<PrimitiveStyle & { rx?: number }>;
  circle?: Partial<PrimitiveStyle>;
  polygon?: Partial<PrimitiveStyle & { points: [number, number][] }>;
  line?: Partial<Omit<PrimitiveStyle, 'fill'> & {
    points: [number, number][];
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
  }>;
}

interface PrimitiveStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  dash?: [number, number];
}
```

`at` is the authored grid coordinate. The old authored `pos` field is not accepted in `.isostate.yaml`; the compiler may map `at` to runtime `pos`.

Validation rules:

- `ElementPlacement.id` is unique in the resolved timeline.
- `add.elements[].id` must not already be present in the previous scene.
- `update.elements[].id` and `remove.elements[].id` must be present in the previous scene.
- `remove.elements[].id` may not also appear in the same scene's `update.elements`.
- `asset` must be a placeable normal URL asset id or sprite id that resolves
  through `assetBaseUrl`, except reserved built-in generated assets: `text`,
  `rectangle`, `circle`, `polygon`, and `line`. Sprite sheet namespace ids are
  not placeable.
- Built-in primitive placements require `primitive` with exactly one matching
  payload and must not use `text`.
- `update.elements[].text` is a sparse nested patch. It merges with the
  previous resolved text payload; omitted nested fields retain their previous
  values. `text.value` is required for placements but optional in updates.
- `update.elements[].primitive` is a sparse nested patch. It must use the child
  key matching the element's existing primitive asset id and merges with the
  previous resolved primitive payload. `polygon.points` and `line.points` are
  required for placements but optional in updates that only change style.
- Placement `size` must be a positive whole-grid-cell count.
- Patch `size` must be a whole-grid-cell count `>= 0`; `0` keeps the element
  present and scales it to zero.
- `layer` defaults to `structures` when that layer exists, otherwise the first declared layer.
- `size` defaults to `1`. Human-authored examples use whole-cell values.
- `at` coordinates must be finite numbers, each `>= 0`. Human-authored examples use whole-cell values.
- Converter internals may calculate sub-cell geometry, but public `.isostate.yaml` examples and hand-authored files use full grid cells only.

## Connector Placement And Delta Patches

```ts
type ConnectorPattern = 'solid' | 'dashed' | 'dotted';
type ConnectorVariant = 'line' | 'road';
type ConnectorEndpoint = 'none' | 'arrow' | 'dot' | 'circle' | 'diamond' | 'bar';
type ConnectorDirection = 'route' | 'reverse';

interface ConnectorStyle {
  variant?: ConnectorVariant;
  pattern?: ConnectorPattern;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  dash?: [number, number];
  outline?: string;
  outlineWidth?: number;
  lane?: 'none' | 'center-dashed';
}

interface ConnectorEndpointRef {
  element?: string;
  at?: [number, number];
  side?: 'auto' | 'top' | 'right' | 'bottom' | 'left' | 'front' | 'back';
  offset?: number;
}

interface ConnectorRouting {
  mode?: 'straight' | 'orthogonal' | 'manual';
  avoid?: 'objects' | 'none' | string[];
  clearance?: number;
  gridStep?: number;
  maxBends?: number;
  prefer?: 'direct' | 'fewest-bends' | 'shortest';
}

interface ConnectionPlacement {
  id: string;
  route?: [number, number][];
  from?: ConnectorEndpointRef;
  to?: ConnectorEndpointRef;
  routing?: ConnectorRouting;
  layer?: string;
  style?: ConnectorStyle;
  start?: ConnectorEndpoint;
  end?: ConnectorEndpoint;
  direction?: ConnectorDirection;
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
}

interface ConnectionPatch {
  id: string;
  route?: [number, number][];
  from?: ConnectorEndpointRef;
  to?: ConnectorEndpointRef;
  routing?: ConnectorRouting;
  layer?: string;
  style?: ConnectorStyle;
  start?: ConnectorEndpoint;
  end?: ConnectorEndpoint;
  direction?: ConnectorDirection;
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
}

interface ConnectionRemoval {
  id: string;
  exit?: ExitAnimation;
}
```

Validation rules:

- `ConnectionPlacement.id` is unique in the resolved connection timeline and must
  not collide with element ids in the same scene document.
- `add.connections[].id` must not already be present in the previous scene.
- `update.connections[].id` and `remove.connections[].id` must be present in the
  previous scene.
- `remove.connections[].id` may not also appear in the same scene's
  `update.connections`.
- A placement uses exactly one route source: either `route` or both `from` and
  `to`.
- `route` must contain at least two `[x, y]` points.
- Public hand-authored manual `route` coordinates must be whole grid numbers,
  and every manual segment must change only one grid axis. Fractional runtime
  route points may be emitted only by the compiler after resolving `from`/`to`
  ports.
- `from` and `to`, when used, must each contain exactly one of `element` or
  `at`.
- `from.element` and `to.element` must reference elements present in the
  resolved scene for that connection step.
- A present connection whose `from.element` or `to.element` is removed by
  `remove.elements` in the same scene must also be listed in
  `remove.connections`. The compiler does not auto-remove or auto-retarget
  connections.
- `from.at` and `to.at` must be finite non-negative grid points.
- `routing`, when supplied, is valid only with `from` and `to`.
- `routing.mode` defaults to `orthogonal`; valid values are `straight`,
  `orthogonal`, and `manual`.
- `routing.avoid` defaults to `objects`; valid values are `objects`, `none`, or
  an array of element ids.
- `routing.clearance` defaults to `0.5` and must be a finite number `>= 0`.
- Every route coordinate must be a finite number `>= 0`.
- `style.pattern` defaults to `solid`; valid values are `solid`, `dashed`, and
  `dotted`.
- `style.variant` defaults to `line`; valid values are `line` and `road`.
- `style.stroke`, `style.outline`, and any future CSS color fields use the same
  safe color-token rules as `text.fill`.
- `style.strokeWidth`, `style.outlineWidth`, and `style.dash[]` values must be
  positive finite numbers.
- `style.opacity`, when supplied, must be in the inclusive range `0..1`.
- `style.lane` defaults to `none`; valid values are `none` and `center-dashed`.
- `start` defaults to `none`; `end` defaults to `arrow`.
- `direction` defaults to `route`; valid values are `route` and `reverse`.
- The compiler must resolve `from`/`to` connectors into concrete runtime
  `route` points. Runtime connector states never carry `from`, `to`, or
  `routing`.

Runtime rendering rules:

- Connectors are generated SVG geometry. They never resolve through
  `header.assets` and never load SVG images.
- The shaft is one SVG `<path>` using projected route points. Dashes/dots are
  expressed as fixed SVG user-unit dash arrays, so route length does not stretch
  the pattern.
- Arrowheads and endpoint indicators are generated as separate geometry oriented
  from the projected first or last segment.
- `ambient: [{ name: flow }]` is reserved for dash/dot movement. The animation
  direction must follow `direction`.

### Built-In Text Asset

`asset: text` creates a runtime-generated SVG text label instead of instantiating an external SVG. Text elements are ordinary elements for placement, layering, lifecycle, animation, bounds, and scene-delta behavior.

Authoring rules:

- A placement with `asset: text` must include `text.value`.
- A patch for an existing text element may include sparse `text` fields; omitted
  nested text fields keep their previous resolved values.
- A non-text asset must not include `text`.
- `text.value` may be a YAML quoted string with `\n` escapes or a YAML block scalar. The parser preserves line breaks; the runtime normalizes `\r\n` and `\r` to `\n`.
- `text.value` is required for placements. Empty or whitespace-only values are
  allowed and emit `EMPTY_TEXT_CONTENT`; this supports intentionally hidden or
  deferred labels. Values longer than `1000` characters or `20` lines emit
  `INVALID_TEXT_CONTENT`.
- `text.align` defaults to `middle`; valid values are `start`, `middle`, and `end`.
- `text.placement` defaults to `cell`; valid values are `cell` and `caption`.
  `cell` centers text inside the element's one-cell text canvas. `caption`
  preserves the legacy top-floating label position.
- `text.fontSize` defaults to `12` and must be a positive finite number.
- `text.fontWeight` defaults to `700`; valid values are `normal`, `bold`, or a positive finite number.
- `text.lineHeight` defaults to `1.2` and must be a positive finite number.
- `text.fill` defaults to `currentColor` and must not contain control characters, `<`, `>`, `url(`, or `javascript:`.

Runtime rendering rules:

- The renderer must create SVG `<text>` and `<tspan>` nodes with DOM APIs and assign each line via `textContent`.
- The renderer must not use `innerHTML`, parse `text.value` as SVG, or load a browser image for `asset: text`.
- Each line break creates one `<tspan>`.
- The text element is anchored inside the same normalized one-cell asset canvas used by SVG assets: `start` maps to `x = -cellSize / 2`, `middle` to `x = 0`, and `end` to `x = cellSize / 2`. For default `placement: cell`, text uses `y = -cellSize / 2` with `dominant-baseline="middle"`. For `placement: caption`, text uses `y = -cellSize` with `dominant-baseline="text-before-edge"`.

## Lifecycle Semantics

The authoring DSL expresses lifecycle through scene operations:

| Operation | Lifecycle Meaning |
|---|---|
| first-scene `elements[]` | element is present at timeline start |
| `add.elements[]` | element enters at this scene |
| `update.elements[]` | element remains present and changes only listed properties |
| `remove.elements[]` | element exits at this scene and is absent from later scenes until re-added |
| first-scene `connections[]` | connection is present at timeline start |
| `add.connections[]` | connection enters at this scene |
| `update.connections[]` | connection remains present and changes only listed properties |
| `remove.connections[]` | connection exits at this scene and is absent from later scenes until re-added |

Authored YAML must not contain `lifecycle.status` or internal `absent` states. The compiler owns lifecycle expansion.

## Runtime Expansion Contract

The compiler must produce a resolved timeline equivalent to:

```ts
interface ResolvedSceneSnapshot {
  id: string;
  progress: number;
  elements: ResolvedElementState[];
  connectors: ResolvedConnectorState[];
}
```

The compiled `RuntimeBundle` exposes resolved `scenes[]` snapshots only. It does not expose legacy top-level `states`, top-level `elements`, or per-element `keyframes`.

## Primitive Constraints

| Field | Constraint | Error Code |
|---|---|---|
| identifiers | kebab-case `/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/` | `INVALID_IDENTIFIER` |
| `header.assets` | at least one item | `NO_ASSETS` |
| `floor.size` | optional tuple of two positive finite numbers | `INVALID_FLOOR_SIZE` |
| `header.layers` | at least one item | `NO_LAYERS` |
| `scenes` | at least one item | `NO_SCENES` |
| `at` | tuple of two finite numbers, each `>= 0` | `INVALID_POSITION` |
| `size` | placement: whole-cell number `> 0`; patch: whole-cell number `>= 0` | `INVALID_SIZE` |
| `ambient[].iterations` | positive integer when `infinite` is false | `INVALID_AMBIENT_ITERATIONS` |

## Unknown Fields

The parser must reject unknown fields inside `header`, `assets`, `grid`, `floor`, `layers`, `scenes`, `elements`, `add`, `update`, `remove`, and `ambient` objects with `UNKNOWN_FIELD`. Authored scenes do not accept progress fields such as `scenes[].at`; scene order is the step order.

This keeps generated YAML deterministic and prevents typo-driven behavior.
