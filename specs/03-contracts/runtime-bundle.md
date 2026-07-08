# Contracts: Runtime Bundle

## Overview

`RuntimeBundle` is the only scene data format loaded by the browser runtime. It is produced by the dev-time compiler from a validated `SceneDocument`.

Runtime bundles must be deterministic: compiling the same semantic scene with the same compiler version and options produces byte-equivalent JSON before JS module wrapping.

## Shape

```ts
interface RuntimeBundle {
  _version: string;
  _format: 'isostate-runtime-bundle';
  _digest: string;
  grid: { cellSize: number };
  floor: CompiledFloor;
  layout: CompiledLayout;
  theme: string;
  className?: string;
  themeVars?: Record<string, string>;
  scenes: RuntimeSceneStop[];
  layers: CompiledLayer[];
  assets?: Record<string, CompiledAsset>;
}

interface RuntimeSceneStop {
  id: string;
  progress: number;
  elements: RuntimeElementState[];
  connectors: RuntimeConnectorState[];
  camera?: RuntimeCameraFocus;
}

interface RuntimeCameraFocus {
  target: RuntimeCameraTarget;
  padding?: number;
  duration?: number;
  easing?: CameraEasing;
}

type RuntimeCameraTarget =
  | { type: 'element'; id: string }
  | { type: 'area'; at: [number, number]; size: [number, number] }
  | { type: 'reset' };

type CameraEasing = 'linear' | 'ease-in-out' | 'ease-out';

interface RuntimeElementState {
  id: string;
  asset: string;
  pos: [number, number];
  size: number;
  layer: string;
  presence: 'present' | 'entering' | 'exiting' | 'removed';
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
  text?: TextContent;
  primitive?: PrimitiveContent;
}

interface CompiledAsset {
  url?: string;
  category?: AssetCategory;
  anchor?: [number, number];
  sprite?: CompiledSprite;
}

interface CompiledSprite {
  sheetSize: [number, number];
  rect: [number, number, number, number];
}

type ConnectorPattern = 'solid' | 'dashed' | 'dotted';
type ConnectorVariant = 'line' | 'road';
type ConnectorEndpoint = 'none' | 'arrow' | 'dot' | 'circle' | 'diamond' | 'bar';
type ConnectorDirection = 'route' | 'reverse';

interface RuntimeConnectorStyle {
  variant: ConnectorVariant;
  pattern: ConnectorPattern;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  dash?: [number, number];
  outline?: string;
  outlineWidth: number;
  lane: 'none' | 'center-dashed';
}

interface RuntimeConnectorState {
  id: string;
  route: [number, number][];
  layer: string;
  style: RuntimeConnectorStyle;
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  direction: ConnectorDirection;
  presence: 'present' | 'entering' | 'exiting' | 'removed';
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
}
```

`RuntimeElementState.size` is a resolved number and may be `0` when authored by
an update patch. A zero-size runtime element remains present in the scene
snapshot and is rendered as a zero-scale element; it is not equivalent to
`presence: 'removed'`.

Runtime bundles use `scenes` as the only compiled timeline. Compatibility fields such as top-level `states`, top-level `elements`, or per-element `keyframes` are not emitted or accepted by the runtime contract.

`connectors` is always present on each runtime scene stop. It may be an empty
array. Connector style values are fully defaulted by the compiler so the browser
runtime does not need authored-style fallback logic.

`camera` is optional on each runtime scene stop. It is non-persistent metadata:
omitting `camera` from a scene stop means navigation to that stop leaves the
current runtime camera viewBox unchanged.

## Identity and Digest

| Field | Rule |
|---|---|
| `_format` | Constant string `isostate-runtime-bundle`. |
| `_version` | Compiler package version that produced the bundle. |
| `_digest` | SHA-256 hex digest of canonical bundle content excluding `_digest`. |

Canonicalization rules:

- Object keys are sorted lexicographically.
- Optional fields with default values are omitted unless required by runtime.
- Arrays preserve semantic order: scenes by progress, layers by order then name, scene elements by resolved declaration/addition order unless compiler explicitly sorts.
- Runtime connectors preserve resolved declaration/addition order. The renderer
  may sort connector DOM groups only by fixed render bucket, never by route
  length.
- Optional scene camera metadata preserves authored scene order and participates
  in canonical digest generation with lexicographically sorted object keys.
- Asset URL strings are preserved exactly after compiler URL resolution.

## Compatibility

Runtime compatibility uses semver:

- Same major version: compatible.
- Different major version: `BUNDLE_VERSION_MISMATCH`.
- Missing `_format`: `BUNDLE_FORMAT_MISSING`.
- Missing `_digest`: error.
- Digest mismatch: `BUNDLE_DIGEST_MISMATCH`.

## Asset URL Compilation

The compiler emits one `CompiledAsset` entry for every external asset
referenced by resolved scene elements or the floor asset.

For normal URL assets, each entry must contain a browser-loadable `url`
resolved from `header.assetBaseUrl` plus the asset `path` or `id`, with `.svg`
appended when the path omits an extension. If the authored asset declares
`anchor`, the compiler preserves it so the browser runtime can align the
asset's real ground contact point to the projected footprint anchor.

For sprite sheets, the compiler emits one flat `CompiledAsset` entry per
referenced logical sprite id, not per sheet. Every sprite from the same sheet
uses the same resolved `url`. Sprite sheet paths must include an explicit image
extension and the compiler must not append `.svg` to them.

Authored sprite tuple and `at` definitions compile through `tileSize`:

```text
rect.x = column * tileSize[0]
rect.y = row * tileSize[1]
rect.width = tileSize[0]
rect.height = tileSize[1]
```

Authored `rect` definitions compile without conversion. Compiled sprite rects
and sheet sizes are whole source-image pixels.

Example compiled sprite assets:

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

Built-in generated assets (`text`, `rectangle`, `circle`, `polygon`, and
`line`) are not embeddable assets. They never appear under
`RuntimeBundle.assets`; their content remains on `RuntimeElementState.text` or
`RuntimeElementState.primitive`.

The runtime loads external assets through SVG `<image href="...">`. It never
receives raw SVG strings, parses asset SVG markup, inspects image dimensions, or
injects per-asset CSS.

For a compiled sprite asset, the renderer must create a nested SVG image
viewport equivalent to:

```svg
<svg
  x="{assetX}"
  y="{assetY}"
  width="{cellSize}"
  height="{cellSize}"
  viewBox="{rectX} {rectY} {rectWidth} {rectHeight}"
  preserveAspectRatio="xMidYMax meet"
>
  <image href="{url}" x="0" y="0" width="{sheetWidth}" height="{sheetHeight}" />
</svg>
```

The nested SVG's `x` and `y` use the same normalized anchor placement as normal
URL assets: `x = -cellSize * anchor[0]`, `y = -cellSize * anchor[1]`. Element
`size` scaling continues to happen on the containing element group exactly as it
does for normal URL assets.

## Connector Compilation

The compiler emits every resolved connector into each scene stop's
`connectors[]` array. Connectors are data-only route/style records and do not
appear under `assets`.

Connector defaults are normalized during compilation:

- `layer`: first layer named `connectors`, otherwise `ground`, otherwise first
  declared layer
- `style.variant`: `line`
- `style.pattern`: `solid`
- `style.stroke`: `#2563eb`
- `style.strokeWidth`: `3` for `line`, `14` for `road`
- `style.opacity`: `1`
- `style.dash`: omitted for `solid`, `[12, 8]` for `dashed`, `[0, 8]` for
  `dotted`, unless authored
- `style.outline`: `#ffffff` for `road`, omitted for `line`, unless authored
- `style.outlineWidth`: `2` for `road`, `0` for `line`, unless authored
- `style.lane`: `none`
- `start`: `none`
- `end`: `arrow`
- `direction`: `route`
- `enter`: `fade-in` when entering and omitted
- `exit`: `fade-out` when exiting and omitted

Route points remain in grid coordinates in the runtime bundle. Projection is a
browser runtime responsibility so layout bounds and SVG viewBox use one
projection implementation. Endpoint routing metadata (`from`, `to`, `routing`)
is dev-time only and is never emitted to runtime bundles.

Missing asset behavior:

| Stage | Error |
|---|---|
| validate declared external asset without URL source | `ASSET_URL_REQUIRED` |
| validate invalid sprite sheet contract | one of the sprite validation errors in `specs/03-contracts/errors.md` |
| compile referenced external asset without emitted URL | `ASSET_URL_REQUIRED` |
| runtime load without emitted URL | `ASSET_NOT_FOUND` |
| runtime load with unsafe URL scheme | `INVALID_ASSET_URL` |

## Camera Compilation

The compiler emits normalized camera metadata on each runtime scene stop that
authored `scenes[].camera`.

Authored element focus:

```yaml
camera:
  target:
    element: api
  padding: 32
```

Runtime output:

```json
{
  "camera": {
    "target": { "type": "element", "id": "api" },
    "padding": 32
  }
}
```

Authored area focus:

```yaml
camera:
  target:
    area:
      at: [1, 1]
      size: [3, 2]
  duration: 450
  easing: ease-out
```

Runtime output:

```json
{
  "camera": {
    "target": { "type": "area", "at": [1, 1], "size": [3, 2] },
    "padding": 32,
    "duration": 450,
    "easing": "ease-out"
  }
}
```

Authored reset focus:

```yaml
camera:
  target:
    reset: true
  duration: 500
```

Runtime output:

```json
{
  "camera": {
    "target": { "type": "reset" },
    "duration": 500
  }
}
```

Rules:

- `padding` is emitted with the authored value or default `32` for element and
  area targets.
- `padding` is omitted for reset targets.
- `duration` and `easing` are emitted only when authored.
- Runtime camera targets remain in element/grid terms. They must not contain
  preprojected pixel values, DOM selectors, functions, or style hooks.
- Browser runtime resolves camera target bounds with the same projection and
  layout math used by rendering.
- Reset targets resolve to the compiled full scene viewBox used by
  `resetZoom()`.

## Serialization

JS module output:

```ts
export default <canonical-json>;
```

JSON output:

```json
{
  "_format": "isostate-runtime-bundle",
  "_version": "0.5.0",
  "_digest": "...",
  "grid": { "cellSize": 64 },
  "floor": { "size": [5, 4], "origin": [0, 0], "visible": true, "layer": "ground" },
  "layout": {
    "fit": "contain",
    "align": [0.5, 0.5],
    "padding": { "x": 16, "y": 16 },
    "bounds": "union"
  },
  "theme": "light",
  "layers": [{ "name": "structures", "order": 0 }],
  "scenes": [
    {
      "id": "initial",
      "progress": 0,
      "elements": [
        {
          "id": "app-server",
          "asset": "iso-server",
          "pos": [2, 2],
          "size": 1,
          "layer": "structures",
          "presence": "present"
        }
      ],
      "connectors": [],
      "camera": {
        "target": { "type": "element", "id": "app-server" },
        "padding": 32
      }
    }
  ]
}
```

`fromJs()` is a dev/test helper only. It must parse only the exact `export default <json>;` format emitted by `toJs()` and must not evaluate arbitrary JavaScript.

## Compiler Options

```ts
interface CompileOptions {
  minify?: boolean;
  version?: string;
}
```

Defaults:

| Option | Default |
|---|---|
| `minify` | `true` |
| `version` | package version |

## Layout Metadata

The runtime bundle carries enough layout data for the browser runtime to compute a tight viewBox without parsing YAML:

```ts
interface CompiledFloor {
  size: [number, number];
  origin: [number, number];
  visible: boolean;
  layer: string;
  asset?: string;
}

interface CompiledLayout {
  fit: 'contain' | 'none';
  align: [number, number];
  padding: { x: number; y: number };
  bounds: 'floor' | 'content' | 'union';
}
```

The runtime must expose resolved bounds/viewBox through `getResolvedConfig()` for debugging.

## Size Budget

Default budget command:

```bash
bun run build && bun run size
```

Budgets:

| Artifact | Limit |
|---|---|
| core runtime without DSL exports | `<20KB` gzipped |
| compiled scene data for 50 elements with URL asset references | `<2KB` gzipped target |
| dev-time DSL entrypoint | no browser budget; excluded from runtime bundle |

The root build must fail if `yaml` appears in the runtime bundle dependency graph.
