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
}

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

Runtime bundles use `scenes` as the only compiled timeline. Compatibility fields such as top-level `states`, top-level `elements`, or per-element `keyframes` are not emitted or accepted by the runtime contract.

`connectors` is always present on each runtime scene stop. It may be an empty
array. Connector style values are fully defaulted by the compiler so the browser
runtime does not need authored-style fallback logic.

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
- Asset URL strings are preserved exactly after compiler URL resolution.

## Compatibility

Runtime compatibility uses semver:

- Same major version: compatible.
- Different major version: `BUNDLE_VERSION_MISMATCH`.
- Missing `_format`: `BUNDLE_FORMAT_MISSING`.
- Missing `_digest`: error.
- Digest mismatch: `BUNDLE_DIGEST_MISMATCH`.

## Asset URL Compilation

The compiler emits one `CompiledAsset` entry for every external SVG asset referenced by resolved scene elements or the floor asset. Each entry must contain a browser-loadable `url` resolved from `header.assetBaseUrl` plus the asset `path` or `id`, with `.svg` appended when the path omits an extension. If the authored asset declares `anchor`, the compiler preserves it so the browser runtime can align the asset's real ground contact point to the projected footprint anchor.

Built-in generated assets (`text`, `rectangle`, `circle`, `polygon`, and
`line`) are not embeddable assets. They never appear under
`RuntimeBundle.assets`; their content remains on `RuntimeElementState.text` or
`RuntimeElementState.primitive`.

The runtime loads external assets through SVG `<image href="...">`. It never receives raw SVG strings, parses asset SVG markup, or injects per-asset CSS.

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
| compile referenced external asset without emitted URL | `ASSET_URL_REQUIRED` |
| runtime load without emitted URL | `ASSET_NOT_FOUND` |
| runtime load with unsafe URL scheme | `INVALID_ASSET_URL` |

## Serialization

JS module output:

```ts
export default <canonical-json>;
```

JSON output:

```json
{
  "_format": "isostate-runtime-bundle",
  "_version": "0.1.2",
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
      "connectors": []
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
