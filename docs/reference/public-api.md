# Public API

isostate has two public entrypoints:

| Entrypoint | Use In | Purpose |
|---|---|---|
| `@isostate/core` | browser/runtime code | Mount compiled bundles, control progress, provide assets and themes. |
| `@isostate/core/runtime` | browser/runtime code | Minimal runtime-only entrypoint for applications that want the smallest import surface. |
| `@isostate/core/dsl` | build scripts, tests, CI | Parse, validate, compile, and serialize YAML scene documents. |

Do not import `@isostate/core/dsl` from browser code.

## Browser Runtime

```ts
import {
	mountScene,
	type ControllerConfig,
	type MountedScene,
	type MountSceneOptions,
	type ResolvedRuntimeConfig,
	type RuntimeBundle
} from '@isostate/core';
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
theme, viewBox, scene stops, and layer order.

Use `mounted.destroy()` when removing the host page or component.

## Assets

External assets are browser-loadable SVG files. Author them in YAML with
`header.assetBaseUrl` and `header.assets[].path`; the compiler emits URL entries
in the runtime bundle and the renderer loads them with SVG `<image>` nodes.
Use `header.assets[].anchor` to align imported SVGs whose visual ground contact
is not centered in the viewport.

The reserved built-in `asset: text` does not use an external asset URL:

```yaml
- id: service-label
  asset: text
  at: [2, 1]
  text:
    value: "Service\nAPI"
```

Connections also do not use external asset URLs. They are authored under
`connections` or nested connection delta fields and render as generated SVG
connector paths.

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
} from '@isostate/core/dsl';
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
