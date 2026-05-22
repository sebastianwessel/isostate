# Types Reference

Public types are exported from `@sebastianwessel/isostate`. Dev-time bundle types are
exported from `@sebastianwessel/isostate/dsl`.

## Runtime Mounting

```ts
import type {
	MountSceneOptions,
	MountedScene,
	ResolvedRuntimeConfig,
	RuntimeBundle
} from '@sebastianwessel/isostate';
```

`MountSceneOptions` accepts controller config, an accessible scene label, and
runtime theme variables. `MountedScene` exposes the created SVG, animation engine,
optional controller, `getResolvedConfig()`, and `destroy()`.

`ResolvedRuntimeConfig` is the supported inspection shape:

```ts
interface ResolvedRuntimeConfig {
	grid: { cellSize: number };
	floor: {
		size: [number, number]; // compiled; derived from scene footprints when omitted in YAML
		origin: [number, number];
		visible: boolean;
		layer: string;
		asset?: string;
	};
	layout: {
		fit: 'contain' | 'none';
		align: [number, number];
		padding: { x: number; y: number };
		bounds: 'floor' | 'content' | 'union';
	};
	viewBox: { minX: number; minY: number; width: number; height: number };
	camera: CameraState;
	theme: string;
	themeVars: Record<string, string>;
	scenes: Array<{ id: string; progress: number }>;
	layerOrder: Array<{ name: string; order: number }>;
}
```

`RuntimeBundle` is the compiled browser artifact accepted by `mountScene`.
Import it from `@sebastianwessel/isostate` in runtime code or from `@sebastianwessel/isostate/dsl` in
build tooling.

## Scene Data

```ts
import type {
	ElementPatch,
	ElementPlacement,
	ElementRemoval,
	ConnectionPatch,
	ConnectionPlacement,
	ConnectionRemoval,
	FloorConfig,
	GridConfig,
	LayerDefinition,
	SceneDocument,
	SceneHeader,
	SceneStep,
	TextContent,
	PrimitiveContent
} from '@sebastianwessel/isostate';
```

`SceneDocument` is the parsed authored YAML shape: `header` plus ordered
`scenes`. Authored scenes are steps; runtime `progress` is derived during
compilation. Browser applications normally receive compiled runtime bundles and
call `mountScene`; YAML parsing stays in dev-time tooling.

`ConnectionPlacement`, `ConnectionPatch`, and `ConnectionRemoval` describe
generated visual routes. They are used by first-scene `connections` and later
`add.connections`, `update.connections`, and `remove.connections` operations.

Scene steps may declare camera focus metadata:

```ts
interface CameraFocus {
	target: { element: string } | { area: CameraGridArea } | { reset: true };
	padding?: number;
	duration?: number;
	easing?: 'linear' | 'ease-in-out' | 'ease-out';
}

interface CameraGridArea {
	at: [number, number];
	size: [number, number];
}
```

Runtime controllers expose the same camera area type plus zoom options and
camera state:

```ts
interface CameraZoomOptions {
	padding?: number;
	duration?: number;
	easing?: 'linear' | 'ease-in-out' | 'ease-out';
}

interface CameraState {
	viewBox: { minX: number; minY: number; width: number; height: number };
	target?:
		| { type: 'element'; id: string }
		| { type: 'area'; at: [number, number]; size: [number, number] }
		| { type: 'reset' };
	isZoomed: boolean;
}
```

`TextContent` is used by the reserved built-in `asset: text`:

```ts
interface TextContent {
	value: string;
	align?: 'start' | 'middle' | 'end';
	fontSize?: number;
	fontWeight?: number | 'normal' | 'bold';
	lineHeight?: number;
	fill?: string;
}
```

Text elements do not need `header.assets` or `assetBaseUrl`.
The runtime renders them as SVG `<text>/<tspan>` nodes and supports line breaks
in `value`.

`ElementPatch.text` is sparse: an update may provide only changed text fields,
such as `text.fill`, and omitted fields inherit from the previous resolved
scene. `text.value` is required for placements but optional for updates.

`PrimitiveContent` is used by reserved built-in primitive assets:

```ts
type PrimitiveAssetId = 'rectangle' | 'circle' | 'polygon' | 'line';
```

Use `asset: rectangle`, `circle`, `polygon`, or `line` with a matching
`primitive` payload. Primitive points use normalized local grid coordinates from
`0` to `1`; primitive elements do not need `header.assets` or `assetBaseUrl`.

`ElementPatch.primitive` is also sparse. Updating only
`primitive.rectangle.opacity` preserves the previous rectangle fill, stroke, and
other primitive fields. `update.elements[].size` may be `0` to scale an existing
element to zero; initial and added placements still require positive whole-cell
sizes.

## Assets and Themes

```ts
import type {
	AssetCategory,
	AssetDefinition,
	Theme
} from '@sebastianwessel/isostate';
```

Authored YAML uses document-local `header.assets[].id` values; those ids must
resolve to browser-loaded SVG files through `header.assetBaseUrl`. Built-in
generated assets (`text`, `rectangle`, `circle`, `polygon`, `line`) are reserved
exceptions and are never registered or URL-loaded.
External asset definitions may declare `anchor: [x, y]` with normalized viewport
coordinates so imported SVGs align their real ground contact point to the grid.
Theme variables are `Record<string, string>` values whose keys must start with
`--`.

## Animation and Lifecycle

```ts
import type {
	AmbientAnimation,
	EntryAnimation,
	ExitAnimation
} from '@sebastianwessel/isostate';
```

These types describe entry and exit animations plus ambient animation classes.
Lifecycle is derived from scene `add`, `update`, and `remove` operations by the
compiler.

## Validation

```ts
import type {
	ValidationError,
	ValidationReport,
	ValidationWarning
} from '@sebastianwessel/isostate';
```

Validation reports are returned by the dev-time validator and are safe to use in
build tooling and tests.

## Dev-Time Bundles

```ts
import type { CompileOptions, RuntimeBundle } from '@sebastianwessel/isostate/dsl';
```

Parser, validator, compiler, serializers, and bundle inspection helpers belong
to `@sebastianwessel/isostate/dsl` and must stay out of browser runtime bundles.
