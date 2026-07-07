# Public API

isostate has four core package entrypoints:

| Entrypoint | Use In | Purpose |
|---|---|---|
| `@sebastianwessel/isostate` | browser/runtime code | Mount compiled bundles, control progress, provide assets and themes. |
| `@sebastianwessel/isostate/runtime` | browser/runtime code | Minimal runtime-only entrypoint for applications that want the smallest import surface. |
| `@sebastianwessel/isostate/dsl` | build scripts, tests, CI | Parse, validate, compile, and serialize YAML scene documents. |
| `@sebastianwessel/isostate/dsl/browser` | browser-based authoring tools | Compile already-parsed scene documents without importing the YAML parser. |
| `@sebastianwessel/isostate/editor-support` | editor and tooling integrations | Shared support utilities for browser authoring surfaces. |

Do not import `@sebastianwessel/isostate/dsl` from browser code.

The website editor lives in a separate internal package,
`@sebastianwessel/isostate-editor`. It is documented in
[Editor Reference](./editor.md), but it is not planned for public npm publishing
in this version.

## Browser Runtime

```ts
import {
	mountScene,
	type ControllerConfig,
	type ElementPointerEvent,
	type MountedScene,
	type MountedSceneEvents,
	type MountSceneOptions,
	type ResolvedRuntimeConfig,
	type RuntimeBundle
} from '@sebastianwessel/isostate';
```

`mountScene(target, bundle, options)` is the primary browser API. It validates
the bundle, builds the SVG, initializes animation state, and optionally wires a
controller.

```ts
const mounted = mountScene(target, sceneBundle as RuntimeBundle, {
	label: 'Deployment scene',
	controller: { container: document.documentElement },
	themeVars: { '--color-accent': '#f97316' }
});
```

Use `mounted.getResolvedConfig()` to inspect effective grid, floor, layout,
theme, viewBox, camera state, scene stops, and layer order.

Use `mounted.destroy()` when removing the host page or component.

## Interactivity

Pass `interactive: true` to enable pointer events on scene elements:

```ts
const mounted = mountScene(target, sceneBundle, { interactive: true });

const unsubscribeClick = mounted.on('element-click', (event) => {
	console.log('clicked', event.id, event.originalEvent);
});

const unsubscribeEnter = mounted.on('element-enter', (event) => {
	console.log('entered', event.id);
});

mounted.on('element-leave', (event) => {
	console.log('left', event.id);
});

unsubscribeClick();
unsubscribeEnter();
```

`mounted.on(event, listener)` subscribes to `MountedSceneEvents` and returns an
unsubscribe function. It is always callable, whether or not `interactive` was
set; without `interactive: true` no events ever fire.

```ts
interface ElementPointerEvent {
	id: string;
	originalEvent: Event;
}

interface MountedSceneEvents {
	'element-click': (event: ElementPointerEvent) => void;
	'element-enter': (event: ElementPointerEvent) => void;
	'element-leave': (event: ElementPointerEvent) => void;
}
```

When `interactive: true`, `mountScene()` attaches exactly three delegated
listeners (`click`, `pointerover`, `pointerout`) to the root SVG — never
per-element listeners. `element-enter`/`element-leave` fire only on group
crossings, not on movement between child nodes of the same element group.
Floor, connectors, `<defs>`, and the diagnostics overlay never produce events,
and an element whose current presence is `removed` never produces events
either.

The SVG root gains the `iso-interactive` class only when `interactive: true`;
the runtime stylesheet scopes `cursor: pointer` to
`.iso-interactive g[data-id]`. While the pointer is over an element group, the
engine toggles the `iso-hover` class on that group so scenes can style hover
state in CSS.

`mounted.on()` throws `RenderError` with code `MOUNT_DESTROYED` when called
after `mounted.destroy()`. Listener exceptions are not caught, matching
`AnimationController`'s event system. See
[Interactive Elements](../examples/interactive-elements.md) and
[Errors](./errors.md).

## Camera Focus

When a mounted scene has a controller, applications can focus the SVG camera on
an element or grid area:

```ts
mounted.controller?.zoomToElement('api-gateway', { padding: 48 });
mounted.controller?.zoomToArea({ at: [1, 1], size: [3, 2] }, { duration: 400 });
mounted.controller?.resetZoom();
```

Scene YAML may also declare `camera` metadata on scene stops. Presentation
navigation applies that camera focus automatically when the destination scene
has camera metadata. Scene stops without camera metadata leave the current
camera viewBox unchanged. Use `camera.target.reset: true` in DSL to return to
the compiled full scene view.

Scroll-driven scenes use the same authored camera timeline: omitted camera stops
inherit the previous camera focus, and scrolling backward interpolates the same
viewBox path in reverse.

## Assets

External assets are browser-loadable URL assets. Normal assets are standalone
SVG files authored with `header.assetBaseUrl` and `header.assets[].path`; the
compiler emits URL entries in the runtime bundle and the renderer loads them
with SVG `<image>` nodes. Use `header.assets[].anchor` to align imported SVGs
whose visual ground contact is not centered in the viewport.

Sprite sheet assets expose many logical asset ids from one image URL:

```yaml
header:
  assetBaseUrl: ./assets
  assets:
    - id: app-icons
      type: sprite-sheet
      path: app-icons.png
      sheetSize: [512, 256]
      tileSize: [64, 64]
      sprites:
        server: [0, 0]

scenes:
  - id: initial
    elements:
      - id: api
        asset: server
        at: [1, 1]
```

Reserved built-in generated assets do not use external asset URLs. Use
`asset: text` for labels:

```yaml
- id: service-label
  asset: text
  at: [2, 1]
  text:
    value: "Service\nAPI"
    placement: cell
```

Use primitive assets for simple underlays or markers:

```yaml
- id: service-zone
  asset: rectangle
  at: [1, 1]
  size: 3
  primitive:
    rectangle:
      fill: "#2563eb"
      opacity: 0.16
```

Connections also do not use external asset URLs. They are authored under
`connections` or nested connection delta fields and render as generated SVG
connector paths.

See [Assets Workflow](../guides/assets-workflow.md) for anchors, sprite sheet
sizing, asset manifests, OpenAI generation prompts, and publishing checks.

## Animation And Connections

Scene animation is derived from authored scene stops:

- first scene: full `elements` and optional `connections`
- later scenes: sparse `add`, `update`, and `remove` deltas
- element movement: update `at`
- element scaling: update `size`
- connection movement/style: update `route`, `from`, `to`, `style`, `start`,
  `end`, or `ambient`
- camera movement: scene `camera` metadata or controller camera methods

See [Animation And Connections](../guides/animation-and-connections.md) for the
full authoring model.

## Dev-Time DSL

```ts
import {
	compileScene,
	parseScene,
	toJs,
	toJson,
	validateScene,
	type CompileOptions,
	type RuntimeBundle
} from '@sebastianwessel/isostate/dsl';
```

The standard compile pipeline is:

```ts
const document = parseScene(yamlText);
const report = validateScene(document);
if (!report.isValid) throw new Error(report.errors[0]?.message);

const bundle = compileScene(document);
const js = toJs(bundle);
const json = toJson(bundle);
```

`fromJs` and `fromJson` are diagnostics/test helpers for inspecting generated
bundles. They are not needed in the browser path.

## Snapshot Export

```ts
import {
	exportScenePng,
	exportSceneSvg,
	type PngSnapshotOptions,
	type SnapshotOptions
} from '@sebastianwessel/isostate';
```

`exportSceneSvg(mounted, options?)` serializes a `MountedScene` to a
standalone SVG document string at a chosen progress. `options` is a
`SnapshotOptions`:

| Field | Meaning | Default |
|---|---|---|
| `progress` | Progress to render before serializing. | current progress |
| `inlineAssets` | Inline external `<image>` hrefs as `data:` URIs. | `true` |
| `background` | Solid CSS background color drawn behind the scene. | none (transparent) |

```ts
const svgString = await exportSceneSvg(mounted, {
	progress: 1,
	background: '#ffffff'
});
```

`exportScenePng(mounted, options?)` rasterizes the same clone to a PNG
`Blob`. `PngSnapshotOptions` extends `SnapshotOptions` with `scale` (device
pixel multiplier applied to the viewBox size, default `2`). PNG export always
inlines assets; passing `inlineAssets: false` throws `EXPORT_INVALID_OPTIONS`.

```ts
const blob = await exportScenePng(mounted, { progress: 0.5, scale: 3 });
const url = URL.createObjectURL(blob);
```

Both functions restore the engine's prior progress after serializing, even
when the export rejects, and throw `EXPORT_TARGET_DESTROYED` if the mount was
already destroyed. See [Export Snapshot](../examples/export-snapshot.md) and
[Errors](./errors.md) for the full error code list.

## Diagnostics Overlay

```ts
import {
	attachDiagnosticsOverlay,
	type DiagnosticsOverlayHandle,
	type DiagnosticsOverlayOptions
} from '@sebastianwessel/isostate';
```

`attachDiagnosticsOverlay(mounted, options?)` draws a development-time overlay
on top of a mounted scene: floor grid lines, optional cell coordinate labels,
element anchor points, connector route points, and a scene/progress readout.
It is exported from the root entry only and is never part of the standalone
runtime bundle or its size budget.

```ts
const overlay = attachDiagnosticsOverlay(mounted, { coordinates: true });

overlay.update(); // re-render manually (always safe to call)
overlay.destroy(); // remove the overlay group and its subscriptions
```

`DiagnosticsOverlayOptions`:

| Field | Meaning | Default |
|---|---|---|
| `grid` | Draw grid lines across the floor extent. | `true` |
| `coordinates` | Draw cell coordinate labels at whole-cell intersections. | `false` |
| `anchors` | Mark element anchor points. | `true` |
| `routes` | Mark connector route points. | `true` |
| `readout` | Show the scene id / progress readout panel. | `true` |

The overlay renders into a single `<g data-iso-diagnostics>` appended as the
last child of the root SVG, above all scene content. Its elements never carry
`data-id`, so they never trigger `interactive: true` pointer events, and
`exportSceneSvg`/`exportScenePng` always strip the group from snapshots (see
[Snapshot Export](#snapshot-export)).

Attaching a second overlay to the same mount replaces the first: the earlier
handle's `update()`/`destroy()` become no-ops. When the mount has a
controller, the overlay subscribes to `progress-change` and `camera-change`
and re-renders itself automatically; without a controller, call `update()`
after changing progress. `attachDiagnosticsOverlay()` throws `RenderError`
with code `MOUNT_DESTROYED` when called on an already-destroyed mount, and
`mounted.destroy()` removes the overlay implicitly since its group lives
inside the SVG. See [Errors](./errors.md).

## Low-Level Escape Hatches

`buildSceneDOM`, `AnimationEngine`, `AnimationController`, projection helpers,
easing helpers, theme helpers, type guards, and structured error classes remain
exported for advanced integrations and tests. Start new applications with
`mountScene` unless you need to own the rendering and controller lifecycle
manually.

### Assets And Themes

| Export | Purpose |
|---|---|
| `AssetRegistryImpl` | Default `AssetRegistry` implementation: register/get/getAll/has/remove asset definitions. |
| `createAssetRegistry(assets?)` | Create an `AssetRegistryImpl` pre-populated with the given asset definitions. |
| `createDefaultRegistry()` | Create a registry pre-populated with the built-in demo assets (platform, server, database, connector, cloud). |
| `resolveTheme(name)` | Resolve a built-in theme name (`light`, `dark`, `brand`) to its CSS variable map; `undefined` if not found. |
| `composeTheme(baseName, overrides)` | Build a `Theme` by extending a built-in theme's variables with overrides. |
| `applyThemeToElement(element, themeVars)` | Set CSS custom properties on an SVG/HTML element; throws `RenderError` (`INVALID_THEME_VAR`) for invalid property names. |

### Easing And Projection Utilities

| Export | Purpose |
|---|---|
| `DEFAULT_CELL_SIZE` | Default grid cell size in pixels (`64`). |
| `projectToScreen(gridX, gridY, cellSize, boundsMinX?, boundsMinY?, paddingX?, paddingY?)` | Convert isometric grid coordinates to screen coordinates within resolved layout bounds. |
| `calculateVisualSize(gridSize, cellSize)` | Compute an element's on-screen size from its grid size. |
| `calculateTransform(screenX, screenY, visualSize, cellSize)` | Build the CSS `transform` string (translate + scale) for an element. |
| `linear(t)` | Linear easing (no interpolation). |
| `easeInCubic(t)` | Cubic ease-in: starts slowly, accelerates. |
| `easeOutCubic(t)` | Cubic ease-out: starts fast, decelerates. |
| `easeInOutCubic(t)` | Cubic ease-in-out: slow start, fast middle, slow end. |
| `resolveEasing(type: EasingType)` | Resolve an `EasingType` string to its `EasingFn`. |

### Type Guards

| Export | Purpose |
|---|---|
| `guardEntryAnimation(v)` | Narrow an unknown value to `EntryAnimation`; returns `undefined` if invalid. |
| `guardExitAnimation(v)` | Narrow an unknown value to `ExitAnimation`; returns `undefined` if invalid. |
| `guardLifecycleStatus(v)` | Narrow an unknown value to `LifecycleStatus`; returns `undefined` if invalid. |
