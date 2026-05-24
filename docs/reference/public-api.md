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
	type MountedScene,
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

## Low-Level Escape Hatches

`buildSceneDOM`, `AnimationEngine`, `AnimationController`, projection helpers,
easing helpers, theme helpers, type guards, and structured error classes remain
exported for advanced integrations and tests. Start new applications with
`mountScene` unless you need to own the rendering and controller lifecycle
manually.
