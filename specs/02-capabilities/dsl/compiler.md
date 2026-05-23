# Capability: DSL Compiler Pipeline

## Overview

The compiler transforms authored `.isostate.yaml` scene documents into browser runtime bundles. Authored YAML uses `header` plus `scenes` deltas; runtime data is deterministic, validated, and contains no parser/compiler code.

```text
Dev Time                                  Browser Runtime
────────                                  ───────────────
.isostate.yaml                            @sebastianwessel/isostate + RuntimeBundle
  header + scenes/deltas       ─────▶     no YAML parser, no validator

YAML → parse SceneDocument → validate → expand deltas → compile RuntimeBundle
```

## Stages

### 1. Parse

`parseScene(rawYaml)` returns a `SceneDocument`.

Parser responsibilities:

- parse YAML using the dev-time `yaml` package
- enforce known fields and primitive/container types
- reject old authored fields such as top-level `states`, top-level `elements`, `keyframes`, `pos`, and `lifecycle.status`
- return typed data without loading asset files

### 2. Validate

`validateScene(document)` validates the header and scene timeline.

Validator responsibilities:

- validate `header.assets`, `header.floor`, and `header.layers`
- validate first scene as a full `elements` snapshot plus optional
  `connections` snapshot
- validate later scenes as deltas only
- walk the element timeline to ensure `add.elements`, `update.elements`, and
  `remove.elements` operations target legal element presence states
- walk the connection timeline to ensure `add.connections`,
  `update.connections`, and `remove.connections` operations target legal
  connection presence states
- validate asset, layer, animation, ambient, size, and position references
- validate connector routes, style, endpoints, direction, animations, and
  connector-specific ambient classes such as `flow`
- validate `scenes[].camera` target shape, target element presence, grid area,
  padding, duration, and easing according to `02-capabilities/camera.md`
- resolve endpoint-routed connectors (`from`/`to`) into concrete route points
  using the dev-time connector router
- validate built-in generated elements: text and primitive placements require
  complete matching payloads, while text and primitive update patches may be
  sparse nested deltas; generated asset ids are not declared in `header.assets`
  and bypass URL resolution

### 3. Expand Deltas

The compiler expands authored deltas into complete resolved snapshots:

```ts
interface ResolvedSceneSnapshot {
  id: string;
  progress: number;
  elements: ResolvedElementState[];
  connectors: ResolvedConnectorState[];
  camera?: ResolvedCameraFocus;
}
```

Expansion rules:

- first scene initializes the resolved element map from `elements[]`
- first scene initializes the resolved connector map from `connections[]` when
  present
- `add.elements[]` inserts new element placements
- `update.elements[]` patches existing element properties
- `remove.elements[]` marks elements exiting at the current scene and absent after it
- `add.connections[]` inserts new connector placements
- `update.connections[]` patches existing connector properties
- `remove.connections[]` marks connectors exiting at the current scene and absent
  after it
- removing an element with active endpoint-routed connections requires explicit
  `remove.connections[]` entries for those connections in the same scene; the
  compiler never cascades connection removal
- omitted elements retain previous resolved properties
- omitted connectors retain previous resolved properties
- `text` and `primitive` payloads are carried forward like other element
  properties; `update.elements[].text` and
  `update.elements[].primitive.<kind>` are sparse nested patches that merge
  field-by-field with the previous resolved payload
- `update.elements[].size` may be `0`; the resolved runtime snapshot keeps the
  element present with `size: 0` so interpolation can scale it to zero without
  using a remove lifecycle transition
- `camera` is copied only to the resolved snapshot for the authored scene stop;
  it does not carry forward to later snapshots
- runtime progress values are deterministically derived from ordered scene steps

Connector style defaults are materialized during expansion/compilation so the
runtime receives a complete `RuntimeConnectorStyle`. Connectors authored with
`from` and `to` are routed during compilation and emitted with concrete `route`
points. Route points remain in grid coordinates and are projected by the browser
runtime.

### 4. Compile Runtime Bundle

`compileScene(document, options)` emits a `RuntimeBundle` with:

- `_format`, `_version`, `_digest`
- resolved `grid`, `floor`, `layout`, theme, root `className`, layers
- compiled `scenes[]` snapshots
- compiled connector snapshots under every scene's `connectors[]`
- optional normalized camera metadata under scene stops that authored `camera`
- compiled URL asset references for every external asset

The compiler must not emit generated compatibility `states`, top-level `elements`, or per-element `keyframes`. `scenes[]` snapshots are the only runtime timeline.

### 5. Serialize

`toJs(bundle)` emits:

```ts
export default <canonical-json>;
```

`toJson(bundle)` emits canonical JSON. `fromJs` and `fromJson` are dev/test helpers only and never evaluate arbitrary JavaScript.

## Compiler API

```ts
interface SceneCompiler {
  parseScene(yamlText: string): SceneDocument;
  validateScene(document: SceneDocument): ValidationReport;
  compileScene(document: SceneDocument, options?: CompileOptions): RuntimeBundle;
  toJs(bundle: RuntimeBundle, options?: { minify?: boolean }): string;
  toJson(bundle: RuntimeBundle): string;
  fromJs(moduleString: string): RuntimeBundle;
  fromJson(jsonString: string): RuntimeBundle;
}

interface CompileOptions {
  minify?: boolean;
  version?: string;
}
```

## Asset URL Compilation

The compiler emits one URL asset entry for every external asset referenced by
resolved scene elements and the visible floor asset.

For normal URL assets, URLs are derived from `header.assetBaseUrl` plus each
asset `path` or `id`, with `.svg` appended when missing.

For sprite sheets, the compiler treats nested sprite ids as the referenced
external asset ids. It emits one flat `CompiledAsset` entry per referenced
sprite id. Each sprite entry uses the containing sheet URL, the compiled
`sprite.sheetSize`, the compiled pixel `sprite.rect`, and the inherited or
overridden anchor. Sprite sheet `path` values must include an explicit
extension; the compiler must not append `.svg` to sprite sheet paths.

If an external asset cannot resolve to a URL, compilation fails with `ASSET_URL_REQUIRED`.

Built-in generated assets are never URL-generated. `text` data remains on
runtime element snapshots as `text`; primitive data remains as `primitive`.

Connectors are never URL-generated and never appear under `RuntimeBundle.assets`.
They compile to route/style data under each runtime scene stop.

Connector routing logic and any routing dependency are dev-time only. They must
not be imported by the browser runtime entrypoint.

## Camera Compilation

Camera metadata is dev-time validated and runtime-normalized, but target bounds
are resolved by the browser runtime. The compiler must not precompute viewBox
rectangles because runtime API zoom and authored scene camera must use the same
renderer-owned bounds helpers.

Compilation rules:

- Authored `{ target: { element: '<id>' } }` emits
  `{ target: { type: 'element', id: '<id>' }, padding }`.
- Authored `{ target: { area: { at, size } } }` emits
  `{ target: { type: 'area', at, size }, padding }`.
- Authored `{ target: { reset: true } }` emits
  `{ target: { type: 'reset' } }`.
- `padding` is defaulted to `32` and emitted for element and area targets.
- `padding` is invalid and omitted for reset targets.
- `duration` and `easing` are emitted only when authored.
- Camera metadata is included in canonical JSON and digest input.
- Camera metadata must not import or reference DOM APIs, CSS selectors, callback
  names, or browser-only objects.

The compiler validates element targets against the resolved snapshot for the
same scene stop after deltas have been applied. A target element removed in that
same scene is invalid unless the resolved snapshot still marks it as `exiting`
for the scene stop.

The compiler emits only authored camera metadata. Effective camera inheritance is
a browser runtime/controller responsibility so scroll, direct progress updates,
and presentation navigation use one camera timeline implementation.

## Determinism

Compiling the same semantic `SceneDocument` with the same compiler version and options must produce byte-equivalent canonical JSON before JS module wrapping.

## Build Commands

The CLI contract is deferred, but the intended workflow is:

```bash
isostate validate scene.isostate.yaml
isostate compile scene.isostate.yaml --output build/scene.isostate.js
```

Until the CLI is fully specified, examples may use the dev-time SDK directly.

## Runtime Boundary

The compiler, parser, validator, `yaml`, and filesystem access are dev-time only. The browser runtime consumes only `RuntimeBundle` data, browser-loadable asset URLs, and generated built-ins such as `asset: text` and primitive assets.
