# Contracts: Public API Inventory

## Overview

The public API is split into two deployment surfaces:

1. Browser runtime entrypoint: `@sebastianwessel/isostate`
2. Dev-time DSL entrypoint: `@sebastianwessel/isostate/dsl`
3. Local process CLI entrypoint: `isostate` from `@sebastianwessel/isostate-cli`
4. Browser authoring entrypoint: `@sebastianwessel/isostate-editor`
5. Browser-safe authoring DSL entrypoint: `@sebastianwessel/isostate/dsl/browser`
6. Browser-safe editor support entrypoint: `@sebastianwessel/isostate/editor-support`

The browser runtime must not import the YAML parser, validator, compiler, `yaml`, `fs`, or any Node/Bun-only module. Dev-time APIs may use Node/Bun and the optional `yaml` peer dependency.

## Public API Inventory

execution_semantics:
  runtime: in_process
  dsl: local_process
  types: data_only

public_builder: `mountScene` is the browser high-level API. `parseScene` + `validateScene` + `compileScene` is the dev-time SDK high-level API. The same pure parser/validator/compiler functions are exported from `@sebastianwessel/isostate/dsl/browser` for editor authoring use, without filesystem or CLI helpers. `@sebastianwessel/isostate/editor-support` exposes runtime-safe geometry, hit-test, and metadata helpers for the editor. `isostate bundle` is the static deployment high-level CLI path. `buildSceneDOM`, `AnimationEngine`, and `AnimationController` are low_level_escape_hatch surfaces.
`mountEditor` is the browser authoring high-level API and is owned by the
separate editor package.

## Inventory

| Entry | Kind | Owner | Audience | Stability | Execution Semantics | Contract Source | Example Path | Test Path |
|---|---|---|---|---|---|---|---|---|
| `mountScene` | SDK function | `packages/core/src/index.ts` | App developers | experimental | in_process | `03-contracts/public-api.md` | `docs/examples/runtime-basic.md` | `tests/runtime/mount-scene.test.ts` |
| `AnimationEngine` | SDK class | `packages/core/src/animation/animation-engine.ts` | App developers | experimental | in_process | `03-contracts/public-api.md` | `docs/examples/runtime-basic.md` | `tests/runtime/animation-engine.test.ts` |
| `AnimationController` | SDK class | `packages/core/src/animation/controller.ts` | App developers | experimental | in_process | `03-contracts/public-api.md` | `docs/examples/controller-scroll.md` | `tests/runtime/controller.test.ts` |
| `CameraZoomOptions`, `CameraGridArea`, `CameraState` | schema/types | `packages/core/src/animation/controller.ts` | App developers | experimental | data_only | `02-capabilities/camera.md` | `docs/examples/camera-focus.md` | `tests/contracts/types.test.ts` |
| `exportSceneSvg`, `exportScenePng` | SDK functions | `packages/core/src/runtime/export.ts` | App developers | experimental | in_process | `02-capabilities/export.md` | `docs/examples/export-snapshot.md` | `tests/runtime/export.test.ts` |
| `attachDiagnosticsOverlay` | SDK function | `packages/core/src/runtime/diagnostics-overlay.ts` | App developers | experimental | in_process | `02-capabilities/diagnostics-overlay.md` | `docs/guides/plan-a-scene.md` | `tests/runtime/diagnostics-overlay.test.ts` |
| `MountedScene.on`, `ElementPointerEvent`, `MountedSceneEvents` | SDK member + types | `packages/core/src/runtime/mount-scene.ts` | App developers | experimental | in_process | `02-capabilities/interactivity.md` | `docs/examples/interactive-elements.md` | `tests/runtime/interactivity.test.ts` |
| `buildSceneDOM` | low-level helper | `packages/core/src/rendering/rendering-engine.ts` | Advanced users/tests | internal | in_process | `03-contracts/public-api.md` | `docs/examples/low-level-rendering.md` | `tests/runtime/rendering-engine.test.ts` |
| `@sebastianwessel/isostate/editor-support` | SDK subpath | `packages/core/src/editor-support/index.ts` | Editor package and advanced tools | experimental | in_process | `03-contracts/editor-support-api.md` | `docs/examples/editor-basic.md` | `tests/editor-support` |
| `parseScene` | dev-time SDK function | `packages/core/src/dsl/scene-parser.ts` | Build tools, CLI, tests | experimental | local_process | `03-contracts/public-api.md` | `docs/examples/compile-yaml.md` | `tests/scene-parser.test.ts` |
| `validateScene` | dev-time SDK function | `packages/core/src/dsl/scene-validator.ts` | Build tools, CLI, tests | experimental | local_process | `03-contracts/public-api.md` | `docs/examples/compile-yaml.md` | `tests/scene-validator.test.ts` |
| `compileScene` | dev-time SDK function | `packages/core/src/dsl/compiler.ts` | Build tools, CLI, tests | experimental | local_process | `03-contracts/runtime-bundle.md` | `docs/examples/compile-yaml.md` | `tests/compiler.test.ts` |
| `@sebastianwessel/isostate/dsl/browser` | SDK subpath | `packages/core/src/dsl/browser.ts` | Editor package and browser authoring apps | experimental | in_process | `03-contracts/public-api.md` | `docs/examples/editor-basic.md` | `tests/editor/browser-dsl.test.ts` |
| `toJs`, `toJson` | serializer functions | `packages/core/src/dsl/compiler.ts` | Build tools, CLI, tests | experimental | local_process | `03-contracts/runtime-bundle.md` | `docs/examples/compile-yaml.md` | `tests/compiler.test.ts` |
| `fromJs`, `fromJson` | test/dev helpers | `packages/core/src/dsl/compiler.ts` | Tests, diagnostics | internal | local_process | `03-contracts/runtime-bundle.md` | `docs/examples/inspect-bundle.md` | `tests/compiler.test.ts` |
| `isostate validate` | CLI command | `packages/cli` | App developers, CI | experimental | local_process | `03-contracts/cli.md` | `docs/guides/deploy-static-bundle.md` | `tests/cli/validate.test.ts` |
| `isostate compile` | CLI command | `packages/cli` | App developers, CI | experimental | local_process | `03-contracts/cli.md` | `docs/examples/compile-yaml.md` | `tests/cli/compile.test.ts` |
| `isostate bundle` | CLI command | `packages/cli` | Static-site developers | experimental | local_process | `03-contracts/cli.md`, `03-contracts/static-bundle.md` | `docs/guides/deploy-static-bundle.md` | `tests/cli/bundle.test.ts` |
| `isostate assets manifest` | CLI command | `packages/cli` | App developers and editor users | experimental | local_process | `03-contracts/cli.md`, `03-contracts/asset-manifest.md` | `docs/examples/asset-manifest.md` | `tests/cli/assets-manifest.test.ts` |
| `isostate inspect` | CLI command | `packages/cli` | App developers, diagnostics | experimental | local_process | `03-contracts/cli.md`, `03-contracts/runtime-bundle.md` | `docs/examples/inspect-bundle.md` | `tests/cli/inspect.test.ts` |
| `createAssetRegistry`, `AssetRegistryImpl`, `createDefaultRegistry` | metadata helper | `packages/core/src/types/asset-registry.ts` | Tooling/tests | experimental | data_only | `01-domains/assets.md` | `docs/examples/custom-assets.md` | `tests/runtime/public-helpers.test.ts` |
| `resolveTheme`, `composeTheme` | SDK function | `packages/core/src/types/asset-registry.ts` | App developers | experimental | in_process | `01-domains/assets.md` | `docs/examples/custom-theme.md` | `tests/runtime/theme.test.ts` |
| Type exports | schema/types | `packages/core/src/types/` | App and tool developers | experimental | data_only | `03-contracts/scene-schema.md` | `docs/reference/types.md` | `tests/contracts/types.test.ts` |
| `mountEditor` | SDK function | `packages/editor/src/index.ts` | Scene authors and app developers | experimental | in_process | `03-contracts/editor.md` | `docs/examples/editor-basic.md` | `tests/editor/mount-editor.test.ts` |
| `IsostateEditor` | React component | `packages/editor/src/IsostateEditor.tsx` | React app developers | experimental | in_process | `03-contracts/editor.md` | `docs/examples/editor-react.md` | `tests/editor/isostate-editor.test.tsx` |

## Primary Developer Paths

### Runtime Embed

Minimal browser usage loads precompiled data and uses only runtime APIs:

```ts
import { mountScene } from '@sebastianwessel/isostate';
import sceneData from './scene.isostate.js';

const runtime = mountScene(document.querySelector('#scene'), sceneData, {
  controller: { container: document.documentElement },
});
```

`mountScene` is the primary API. It owns the ordinary setup path: validate runtime bundle compatibility, build SVG DOM, initialize animation state, and create a controller when requested.

```ts
interface MountSceneOptions {
  controller?: ControllerConfig | false;
  label?: string;
  themeVars?: Record<string, string>;
}

interface MountedScene {
  svg: SVGSVGElement;
  engine: AnimationEngine;
  controller?: AnimationController;
  getResolvedConfig(): ResolvedRuntimeConfig;
  destroy(): void;
}
```

Advanced users may call `buildSceneDOM`, `AnimationEngine`, and `AnimationController` directly, but examples and docs must start with `mountScene`.

### Camera Focus

The primary runtime camera path is the mounted controller:

```ts
const mounted = mountScene(target, sceneBundle, {
  controller: { transitionDuration: 600, transitionEasing: 'ease-in-out' }
});

mounted.controller?.zoomToElement('api-gateway', { padding: 48 });
mounted.controller?.zoomToArea({ at: [0, 0], size: [4, 3] });
mounted.controller?.resetZoom();
```

Public controller camera surface:

```ts
type CameraEasing = 'linear' | 'ease-in-out' | 'ease-out';

interface CameraZoomOptions {
  padding?: number;
  duration?: number;
  easing?: CameraEasing;
}

interface CameraGridArea {
  at: [number, number];
  size: [number, number];
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

`zoomToElement`, `zoomToArea`, and `resetZoom` are in-process browser runtime
APIs. They accept only plain data and DOM-backed controller state. They must not
parse YAML or import dev-time DSL modules.

### Dev-Time Compile

Minimal build usage may import the dev-time entrypoint:

```ts
import { compileScene, parseScene, toJs, validateScene } from '@sebastianwessel/isostate/dsl';

const document = parseScene(yamlText);
const report = validateScene(document);
if (!report.isValid) throw new Error(report.errors[0]?.message ?? 'Invalid scene');

const bundle = compileScene(document);
const moduleText = toJs(bundle);
```

### Static Deployment Bundle

The primary no-build browser deployment path is the CLI:

```bash
isostate bundle scene.isostate.yaml --out public/isostate/scene
```

The generated directory contains browser runtime code, compiled scene data,
copied external asset source files, and a manifest. The browser imports only
generated ESM files and copied assets; it never parses YAML.

## Public API Rules

- `@sebastianwessel/isostate` may export runtime-safe types and helpers, but its browser bundle must tree-shake away `@sebastianwessel/isostate/dsl`.
- `@sebastianwessel/isostate/dsl` is dev-time only and may depend on the optional `yaml` peer dependency.
- `@sebastianwessel/isostate/dsl/browser` is browser-authoring only. It may
  depend on browser-bundleable YAML parsing code, but it must not import
  filesystem, CLI, static-bundle, or Node/Bun-only modules.
- `@sebastianwessel/isostate/editor-support` is browser-runtime safe. It may
  expose projection, hit-test, bounds, and metadata helpers used by editor
  overlays, but it must not parse YAML or import dev-time DSL modules.
- Root examples must not parse YAML in the browser.
- Low-level rendering helpers are exported for tests and advanced integrations, but docs must present engine/controller APIs as the primary path.
- Core public APIs may be modularized or extended when doing so lets the editor
  reuse runtime projection, rendering, layer, camera, bounds, or metadata logic
  instead of duplicating it.
- All public functions throw structured errors listed in `03-contracts/errors.md`.
- Every runtime public API receives plain data objects and DOM objects only; external assets must be present in the compiled bundle as URL references.
- CLI commands are local-process developer tooling and may use filesystem APIs,
  but their output must preserve the runtime boundary.
- `@sebastianwessel/isostate-editor` is an authoring package. It may import
  editor-only browser dependencies, browser-safe DSL APIs, and editor-support
  APIs, but those imports must not be reachable from the core runtime or static
  deployment runtime unless explicitly imported by an application.

## Effective Configuration Inspection

Runtime APIs must expose resolved values for debugging:

```ts
interface ResolvedRuntimeConfig {
  grid: { cellSize: number };
  floor: {
    size: [number, number];
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
  theme: string;
  themeVars: Record<string, string>;
  scenes: Array<{ id: string; progress: number }>;
  camera: CameraState;
  layerOrder: Array<{ name: string; order: number }>;
}
```

`MountedScene.getResolvedConfig()` is the required inspection surface. Lower-level APIs may expose the same data as a convenience.
