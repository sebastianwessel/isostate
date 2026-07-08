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

`buildSceneDOM(container, bundle, config?)` is the lower-level rendering
primitive `mountScene` builds on; it accepts a `RenderConfig`:

```ts
interface RenderConfig {
	label?: string; // accessible label for the mounted SVG root
	themeVars?: Record<string, string>; // CSS custom properties applied on top of the bundle theme
}
```

## Interactivity

```ts
import type {
	ElementPointerEvent,
	MountedSceneEvents
} from '@sebastianwessel/isostate';
```

Set `interactive: true` in `MountSceneOptions` and subscribe with
`MountedScene.on(event, listener)`. Listeners receive an `ElementPointerEvent`:

```ts
interface ElementPointerEvent {
	id: string; // element id from the scene definition
	originalEvent: Event; // the native DOM event that triggered the notification
}

interface MountedSceneEvents {
	'element-click': (event: ElementPointerEvent) => void;
	'element-enter': (event: ElementPointerEvent) => void;
	'element-leave': (event: ElementPointerEvent) => void;
}
```

## Snapshot Export

```ts
import type {
	SnapshotOptions,
	PngSnapshotOptions
} from '@sebastianwessel/isostate';
```

`exportSceneSvg(mounted, options?)` and `exportScenePng(mounted, options?)`
serialize a mounted scene at a chosen progress.

```ts
interface SnapshotOptions {
	progress?: number; // render this progress first; omitted = current progress
	inlineAssets?: boolean; // inline external <image> hrefs as data: URIs (default true)
	background?: string; // solid background color; default none (transparent)
}

interface PngSnapshotOptions extends SnapshotOptions {
	scale?: number; // device-pixel multiplier applied to the viewBox size (default 2)
}
```

## Diagnostics Overlay

```ts
import type {
	DiagnosticsOverlayOptions,
	DiagnosticsOverlayHandle
} from '@sebastianwessel/isostate';
```

`attachDiagnosticsOverlay(mounted, options?)` returns a
`DiagnosticsOverlayHandle` for a dev-time grid/anchor/route/readout overlay.

```ts
interface DiagnosticsOverlayOptions {
	grid?: boolean; // draw grid lines across the floor extent (default true)
	coordinates?: boolean; // draw cell coordinate labels (default false)
	anchors?: boolean; // mark element anchor points (default true)
	routes?: boolean; // mark connector route points (default true)
	readout?: boolean; // show the scene id / progress readout panel (default true)
}

interface DiagnosticsOverlayHandle {
	update(): void; // re-render from current scene state
	destroy(): void; // remove the overlay and its subscriptions; safe to call twice
}
```

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
	target: CameraTarget;
	padding?: number;
	duration?: number;
	easing?: CameraEasing;
}

type CameraTarget = { element: string } | { area: CameraGridArea } | { reset: true };

interface CameraGridArea {
	at: [number, number];
	size: [number, number];
}

type CameraEasing = 'linear' | 'ease-in-out' | 'ease-out';
```

Runtime controllers expose the same camera area type plus zoom options and
camera state:

```ts
interface CameraZoomOptions {
	padding?: number;
	duration?: number;
	easing?: CameraEasing;
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

`ControllerConfig` configures the optional `AnimationController` created by
`mountScene()` via `MountSceneOptions.controller`, or constructed directly:

```ts
interface ControllerConfig {
	container?: HTMLElement; // scroll container; defaults to the mount target
	sceneElement?: SVGSVGElement; // defaults to the first SVG in `container`
	scrollDirection?: 'vertical' | 'horizontal'; // default 'vertical'
	scrollOffset?: { top?: number; bottom?: number; left?: number; right?: number };
	minProgress?: number; // default 0
	maxProgress?: number; // default 1
	keyboardControls?: boolean; // default false
	touchControls?: boolean; // default false
	scrollSensitivity?: number; // default 1.0
	transitionDuration?: number; // camera transition ms; default 600
	transitionEasing?: 'linear' | 'ease-in-out' | 'ease-out'; // default 'ease-in-out'
}
```

`ControllerEvents` are the events accepted by `AnimationController.on(event, listener)`:

```ts
interface ControllerEvents {
	'progress-change': (progress: number) => void;
	'scene-change': (index: number) => void;
	'camera-change': (state: CameraState) => void;
	paused: () => void;
	resumed: () => void;
}
```

`TextContent` is used by the reserved built-in `asset: text`:

```ts
interface TextContent {
	value: string;
	align?: 'start' | 'middle' | 'end';
	placement?: 'cell' | 'caption';
	fontSize?: number;
	fontWeight?: number | 'normal' | 'bold';
	lineHeight?: number;
	fill?: string;
}
```

Text elements do not need `header.assets` or `assetBaseUrl`.
The runtime renders them as SVG `<text>/<tspan>` nodes and supports line breaks
in `value`.
`placement` defaults to `cell`, which centers text in the element's one-cell
text canvas. Use `caption` only when a label should intentionally float at the
top of that cell.

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

`RuntimeBundle.floor`, `.layout`, `.layers`, and `.assets` use these compiled
shapes (compiled scene stops are documented under Animation and Lifecycle):

```ts
interface CompiledFloor {
	size: [number, number];
	origin: [number, number];
	visible: boolean;
	layer: string;
	asset?: string;
}

interface CompiledLayer {
	name: string;
	order: number;
}

type LayoutFit = 'contain' | 'none';
type LayoutBounds = 'floor' | 'content' | 'union';

interface CompiledLayout {
	fit: LayoutFit;
	align: [number, number];
	padding: { x: number; y: number };
	bounds: LayoutBounds;
}

interface CompiledAsset {
	url?: string; // omitted for reserved built-in generated assets
	category?: AssetCategory;
	anchor?: [number, number];
	sprite?: { sheetSize: [number, number]; rect: [number, number, number, number] };
}
```

`ResolvedLayoutConfig` has the same shape as `CompiledLayout` and is the
dev-time compiler's resolved layout value before bundling.

## Assets and Themes

```ts
import type {
	AssetCatalogEntry,
	AssetCategory,
	AssetDefinition,
	AssetRegistry,
	Theme
} from '@sebastianwessel/isostate';
```

Authored YAML uses document-local `header.assets[]` values, typed as
`AssetCatalogEntry` (`UrlAssetCatalogEntry | SpriteSheetAssetCatalogEntry`).
Normal asset ids resolve to browser-loaded SVG files through
`header.assetBaseUrl`. Sprite sheet entries expose nested sprite ids as
placeable asset ids while sharing one image URL. Built-in generated assets
(`text`, `rectangle`, `circle`, `polygon`, `line`) are reserved exceptions and
are never registered or URL-loaded. External asset definitions may declare
`anchor: [x, y]` with normalized viewport coordinates so imported visuals align
their real ground contact point to the grid. Sprite sheets require
`sheetSize`; tuple and `at` sprites also require `tileSize`.

`AssetDefinition` (`UrlAssetDefinition | SpriteSheetAssetDefinition`) is the
equivalent authoring-tooling shape, managed through `AssetRegistry` — a
mutable metadata registry for editors and catalogs, not used by browser
rendering:

```ts
interface AssetRegistry {
	register(asset: AssetDefinition): void;
	get(id: string): AssetDefinition | undefined;
	getAll(category?: AssetCategory): AssetDefinition[];
	has(id: string): boolean;
	remove(id: string): void;
}
```

Theme variables are `Record<string, string>` values whose keys must start with
`--`.

## Animation and Lifecycle

```ts
import type {
	AmbientAnimation,
	EntryAnimation,
	ExitAnimation,
	FrameUpdate,
	LifecycleKey,
	LifecycleStatus,
	RuntimeElementState,
	RuntimeSceneStop
} from '@sebastianwessel/isostate';
```

These types describe entry and exit animations plus ambient animation classes.
Lifecycle is derived from scene `add`, `update`, and `remove` operations by the
compiler; `LifecycleStatus` is the resulting presence value (never authored in
YAML):

```ts
type LifecycleStatus = 'entering' | 'present' | 'exiting' | 'removed';
```

`RuntimeElementState` is the resolved per-element state inside a compiled
scene stop, and `RuntimeSceneStop` is one compiled entry in
`RuntimeBundle.scenes`:

```ts
interface RuntimeElementState {
	id: string;
	asset: string;
	pos: [number, number];
	size: number;
	layer: string;
	presence: LifecycleStatus;
	enter?: EntryAnimation;
	exit?: ExitAnimation;
	ambient?: AmbientAnimation[];
	text?: TextContent;
	primitive?: PrimitiveContent;
}

interface RuntimeSceneStop {
	id: string;
	progress: number;
	elements: RuntimeElementState[];
	connectors: RuntimeConnectorState[]; // connector analogue of RuntimeElementState
	camera?: RuntimeCameraFocus; // resolved camera focus, if the scene step declared one
}
```

`AnimationEngine.getFrameUpdates()` (used internally by `mountScene` and
`AnimationController`) returns interpolated `FrameUpdate` values keyed by
`LifecycleKey`, whose literal values match `LifecycleStatus`:

```ts
type LifecycleKey = 'entering' | 'present' | 'exiting' | 'removed';

interface FrameUpdate {
	id: string;
	asset: string;
	lifecycle: LifecycleKey;
	ambient: AmbientAnimation[];
	pos: [number, number];
	size: number;
	layer: string;
	entry?: string;
	exit?: string;
	text?: TextContent;
	primitive?: PrimitiveContent;
}
```

### Easing

```ts
import type { EasingFn, EasingType } from '@sebastianwessel/isostate';
```

```ts
type EasingFn = (t: number) => number;
type EasingType = 'linear' | 'easeInCubic' | 'easeInOutCubic' | 'easeOutCubic';
```

`resolveEasing(type)` maps an `EasingType` to its `EasingFn` implementation.
Camera transitions and ambient/entry/exit keyframe interpolation both use
resolved easing functions internally.

## Validation

```ts
import type {
	ValidationError,
	ValidationReport,
	ValidationWarning
} from '@sebastianwessel/isostate';
```

Validation reports are returned by the dev-time validator and are safe to use in
build tooling and tests. Findings include stable `code` and `message` fields,
plus contextual fields such as `sceneId`, `elementId`, `connectionId`,
`assetName`, `layerName`, `field`, and `value` when the validator can determine
the exact source of the issue.

## Dev-Time Bundles

```ts
import type { CompileOptions, RuntimeBundle } from '@sebastianwessel/isostate/dsl';
```

Parser, validator, compiler, serializers, and bundle inspection helpers belong
to `@sebastianwessel/isostate/dsl` and must stay out of browser runtime bundles.
