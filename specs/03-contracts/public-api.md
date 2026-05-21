# Contracts: Public API Inventory

## Overview

The public API is split into two deployment surfaces:

1. Browser runtime entrypoint: `@isostate/core`
2. Dev-time DSL entrypoint: `@isostate/core/dsl`

The browser runtime must not import the YAML parser, validator, compiler, `yaml`, `fs`, or any Node/Bun-only module. Dev-time APIs may use Node/Bun and the optional `yaml` peer dependency.

## Public API Inventory

execution_semantics:
  runtime: in_process
  dsl: local_process
  types: data_only

public_builder: `mountScene` is the browser high-level API. `parseScene` + `validateScene` + `compileScene` is the dev-time high-level API. `buildSceneDOM`, `AnimationEngine`, and `AnimationController` are low_level_escape_hatch surfaces.

## Inventory

| Entry | Kind | Owner | Audience | Stability | Execution Semantics | Contract Source | Example Path | Test Path |
|---|---|---|---|---|---|---|---|---|
| `mountScene` | SDK function | `packages/core/src/index.ts` | App developers | experimental | in_process | `03-contracts/public-api.md` | `docs/examples/runtime-basic.md` | `tests/runtime/mount-scene.test.ts` |
| `AnimationEngine` | SDK class | `packages/core/src/animation/animation-engine.ts` | App developers | experimental | in_process | `03-contracts/public-api.md` | `docs/examples/runtime-basic.md` | `tests/runtime/animation-engine.test.ts` |
| `AnimationController` | SDK class | `packages/core/src/animation/controller.ts` | App developers | experimental | in_process | `03-contracts/public-api.md` | `docs/examples/controller-scroll.md` | `tests/runtime/controller.test.ts` |
| `buildSceneDOM` | low-level helper | `packages/core/src/rendering/rendering-engine.ts` | Advanced users/tests | internal | in_process | `03-contracts/public-api.md` | `docs/examples/low-level-rendering.md` | `tests/runtime/rendering-engine.test.ts` |
| `parseScene` | dev-time SDK function | `packages/core/src/dsl/scene-parser.ts` | Build tools, CLI, tests | experimental | local_process | `03-contracts/public-api.md` | `docs/examples/compile-yaml.md` | `tests/scene-parser.test.ts` |
| `validateScene` | dev-time SDK function | `packages/core/src/dsl/scene-validator.ts` | Build tools, CLI, tests | experimental | local_process | `03-contracts/public-api.md` | `docs/examples/compile-yaml.md` | `tests/scene-validator.test.ts` |
| `compileScene` | dev-time SDK function | `packages/core/src/dsl/compiler.ts` | Build tools, CLI, tests | experimental | local_process | `03-contracts/runtime-bundle.md` | `docs/examples/compile-yaml.md` | `tests/compiler.test.ts` |
| `toJs`, `toJson` | serializer functions | `packages/core/src/dsl/compiler.ts` | Build tools, CLI, tests | experimental | local_process | `03-contracts/runtime-bundle.md` | `docs/examples/compile-yaml.md` | `tests/compiler.test.ts` |
| `fromJs`, `fromJson` | test/dev helpers | `packages/core/src/dsl/compiler.ts` | Tests, diagnostics | internal | local_process | `03-contracts/runtime-bundle.md` | `docs/examples/inspect-bundle.md` | `tests/compiler.test.ts` |
| `createAssetRegistry`, `AssetRegistryImpl`, `createDefaultRegistry` | metadata helper | `packages/core/src/types/asset-registry.ts` | Tooling/tests | experimental | data_only | `01-domains/assets.md` | `docs/examples/custom-assets.md` | `tests/runtime/public-helpers.test.ts` |
| `resolveTheme`, `composeTheme` | SDK function | `packages/core/src/types/asset-registry.ts` | App developers | experimental | in_process | `01-domains/assets.md` | `docs/examples/custom-theme.md` | `tests/runtime/theme.test.ts` |
| Type exports | schema/types | `packages/core/src/types/` | App and tool developers | experimental | data_only | `03-contracts/scene-schema.md` | `docs/reference/types.md` | `tests/contracts/types.test.ts` |

## Primary Developer Paths

### Runtime Embed

Minimal browser usage loads precompiled data and uses only runtime APIs:

```ts
import { mountScene } from '@isostate/core';
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

### Dev-Time Compile

Minimal build usage may import the dev-time entrypoint:

```ts
import { compileScene, parseScene, toJs, validateScene } from '@isostate/core/dsl';

const document = parseScene(yamlText);
const report = validateScene(document);
if (!report.isValid) throw new Error(report.errors[0]?.message ?? 'Invalid scene');

const bundle = compileScene(document);
const moduleText = toJs(bundle);
```

## Public API Rules

- `@isostate/core` may export runtime-safe types and helpers, but its browser bundle must tree-shake away `@isostate/core/dsl`.
- `@isostate/core/dsl` is dev-time only and may depend on the optional `yaml` peer dependency.
- Root examples must not parse YAML in the browser.
- Low-level rendering helpers are exported for tests and advanced integrations, but docs must present engine/controller APIs as the primary path.
- All public functions throw structured errors listed in `03-contracts/errors.md`.
- Every runtime public API receives plain data objects and DOM objects only; external assets must be present in the compiled bundle as URL references.

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
  layerOrder: Array<{ name: string; order: number }>;
}
```

`MountedScene.getResolvedConfig()` is the required inspection surface. Lower-level APIs may expose the same data as a convenience.
