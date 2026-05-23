# Runtime Bundle

`RuntimeBundle` is the compiled artifact loaded by the browser runtime. It is
created by `compileScene()` and consumed by `mountScene()`.

```ts
interface RuntimeBundle {
	_format: 'isostate-runtime-bundle';
	_version: string;
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
```

## Timeline

The runtime timeline is `scenes[]`. Each scene contains resolved element
snapshots with runtime `pos` coordinates, resolved connector snapshots with
runtime route/style data, and compiler-derived `presence`.

Runtime bundles do not contain legacy top-level `states`, top-level `elements`,
or per-element authored fields.

Text elements keep their text payload on the element snapshot:

```json
{
	"id": "auth-gateway-label",
	"asset": "text",
	"pos": [2, 3],
	"size": 1,
	"layer": "labels",
	"presence": "present",
	"text": { "value": "Authentication\nGateway", "align": "middle" }
}
```

Primitive elements keep their primitive payload on the element snapshot:

```json
{
	"id": "service-zone",
	"asset": "rectangle",
	"pos": [1, 1],
	"size": 3,
	"layer": "ground",
	"presence": "present",
	"primitive": { "rectangle": { "fill": "#2563eb", "opacity": 0.16 } }
}
```

Connectors keep generated geometry inputs on the connector snapshot:

```json
{
	"id": "request-flow",
	"route": [[1, 5], [3, 4], [5, 4]],
	"layer": "ground",
	"style": {
		"variant": "line",
		"pattern": "dotted",
		"stroke": "#2563eb",
		"strokeWidth": 3,
		"opacity": 1,
		"dash": [0, 8],
		"outlineWidth": 0,
		"lane": "none"
	},
	"start": "none",
	"end": "arrow",
	"direction": "route",
	"presence": "present",
	"ambient": [{ "name": "flow" }]
}
```

Scene stops may include camera focus metadata:

```json
{
	"id": "focus-api",
	"progress": 0.5,
	"elements": [],
	"connectors": [],
	"camera": {
		"target": { "type": "element", "id": "api-gateway" },
		"padding": 32,
		"duration": 600,
		"easing": "ease-in-out"
	}
}
```

Camera metadata is non-persistent. If a scene stop omits `camera`, navigating to
that stop leaves the current runtime camera viewBox unchanged. A reset target
returns to the compiled full scene viewBox:

```json
{
	"camera": {
		"target": { "type": "reset" },
		"duration": 500
	}
}
```

At runtime the controller builds an effective camera timeline by inheriting the
previous camera target across scene stops that omit `camera`, starting from an
implicit full-scene reset. Scroll and direct progress updates interpolate
between adjacent effective camera viewBoxes, so backward playback follows the
same path in reverse.

## Digest

`_digest` is a SHA-256 digest over canonical bundle content excluding
`_digest`. The runtime rejects missing, malformed, or mismatched digests.

## Assets

Compiled external assets contain browser-loadable URLs produced from
`header.assetBaseUrl` and each asset `path` or `id`:

```json
{
	"assets": {
		"server": { "url": "./assets/server.svg" }
	}
}
```

Compiled sprite assets are also flat asset entries. They share the sheet URL and
include source-image metadata for runtime cropping:

```json
{
	"assets": {
		"server": {
			"url": "./assets/app-icons.png",
			"sprite": { "sheetSize": [512, 256], "rect": [0, 0, 64, 64] },
			"anchor": [0.5, 1]
		}
	}
}
```

Built-in generated assets and connectors are not emitted under `assets` and never need an
external asset URL.

## Serialization

Use `toJs(bundle)` for browser imports:

```ts
export default { "_format": "isostate-runtime-bundle" };
```

Use `toJson(bundle)` when another build step loads JSON explicitly.
