# Contracts: Core Editor Support API

## Overview

The editor must reuse the core rendering, projection, camera, layer, and runtime
bundle behavior instead of duplicating it. The core package exposes a small
browser-safe support surface for editor overlays, hit testing, geometry, and
metadata inspection.

These APIs live in `@sebastianwessel/isostate/editor-support`. They are
runtime-safe and may be imported by `@sebastianwessel/isostate-editor`, but they
must not import YAML parsing, validation, compilation, filesystem, CLI, or
Node/Bun-only modules.

## Public API Inventory

| Entry | Kind | Owner | Audience | Stability | Execution Semantics | Contract Source | Example Path | Test Path |
|---|---|---|---|---|---|---|---|---|
| `createEditorRuntimeAdapter` | SDK function | `packages/core/src/editor-support/index.ts` | editor package | experimental | in_process | `03-contracts/editor-support-api.md` | `docs/examples/editor-basic.md` | `tests/editor-support/adapter.test.ts` |
| `projectGridPoint`, `unprojectScreenPoint`, `clientPointToSvgPoint`, `getGridCellPolygon` | geometry helpers | `packages/core/src/editor-support/geometry.ts` | editor package, advanced tools | experimental | in_process | `03-contracts/editor-support-api.md` | `docs/examples/editor-basic.md` | `tests/editor-support/geometry.test.ts` |
| `getRuntimeObjectAtPoint`, `getRuntimeSelectionBounds` | hit-test helpers | `packages/core/src/editor-support/hit-test.ts` | editor package | experimental | in_process | `03-contracts/editor-support-api.md` | `docs/examples/editor-basic.md` | `tests/editor-support/hit-test.test.ts` |

## Runtime Adapter

```ts
interface EditorRuntimeAdapter {
  mounted: MountedScene;
  getObjects(sceneId: string): RuntimeObjectMetadata[];
  getObject(id: string): RuntimeObjectMetadata | undefined;
  getLayerOrder(): Array<{ name: string; order: number }>;
  getResolvedViewBox(): ViewBoxRect;
  projectGridPoint(point: [number, number]): EditorScreenPoint;
  unprojectScreenPoint(point: EditorScreenPoint): [number, number];
  clientPointToSvgPoint(point: EditorClientPoint): EditorScreenPoint;
  getGridCellPolygon(cell: [number, number]): EditorScreenPoint[];
  getObjectAtPoint(point: EditorScreenPoint, options?: HitTestOptions): RuntimeObjectHit | undefined;
  getSelectionBounds(ids: string[]): ViewBoxRect | undefined;
  destroy(): void;
}

function createEditorRuntimeAdapter(mounted: MountedScene): EditorRuntimeAdapter;
```

Rules:

- The adapter wraps an already mounted core runtime scene.
- It reads compiled runtime data and rendered SVG DOM owned by `MountedScene`.
- It does not mutate authored YAML.
- It does not create editor UI.
- `destroy()` removes only adapter-owned listeners and cached metadata. It must
  not destroy the wrapped `MountedScene`; the editor owns mounted scene cleanup.
- All coordinates use SVG user units unless explicitly named CSS pixels.

## Object Metadata

```ts
interface RuntimeObjectMetadata {
  id: string;
  kind: 'element' | 'connection';
  sceneId: string;
  layer: string;
  present: boolean;
  bounds: ViewBoxRect;
  grid:
    | { kind: 'element'; at: [number, number]; size: number }
    | { kind: 'connection'; route: [number, number][] };
}
```

Rules:

- Metadata reflects the current rendered runtime frame.
- Hidden editor-only visibility is not represented here; the editor applies it
  as an overlay concern.
- Element metadata uses authored grid coordinates after runtime state
  resolution.
- Connection metadata uses resolved runtime route points.
- Bounds are computed by core geometry helpers and match renderer behavior.

## Geometry Helpers

```ts
interface EditorScreenPoint {
  x: number;
  y: number;
}

interface EditorClientPoint {
  clientX: number;
  clientY: number;
}

function projectGridPoint(bundle: RuntimeBundle, point: [number, number]): EditorScreenPoint;
function unprojectScreenPoint(bundle: RuntimeBundle, point: EditorScreenPoint): [number, number];
function clientPointToSvgPoint(svg: SVGSVGElement, point: EditorClientPoint): EditorScreenPoint;
function getGridCellPolygon(bundle: RuntimeBundle, cell: [number, number]): EditorScreenPoint[];
```

Rules:

- Projection and unprojection use the same cell size, selected bounds, padding,
  and diamond projection as the renderer.
- `unprojectScreenPoint()` returns fractional grid coordinates. The editor owns
  snap-to-grid rounding.
- `clientPointToSvgPoint()` converts browser pointer coordinates into SVG user
  units using the root SVG screen CTM inverse. It throws `EDITOR_GEOMETRY_UNAVAILABLE`
  when the SVG is detached or the CTM is not invertible.
- `getGridCellPolygon()` returns four projected corners in clockwise order.
- Helpers are deterministic and side-effect free.

Pointer editing pipeline:

1. Browser event provides `clientX` and `clientY`.
2. Editor calls `clientPointToSvgPoint(svg, event)`.
3. Editor calls `unprojectScreenPoint(bundle, svgPoint)`.
4. Editor applies snap-to-grid rules for authored whole-cell coordinates.
5. Editor dispatches a semantic command on commit.

## Hit Testing

```ts
interface HitTestOptions {
  includeHidden?: boolean;
  includeLocked?: boolean;
  kinds?: Array<'element' | 'connection'>;
}

interface RuntimeObjectHit {
  id: string;
  kind: 'element' | 'connection';
  layer: string;
  bounds: ViewBoxRect;
}

function getRuntimeObjectAtPoint(
  adapter: EditorRuntimeAdapter,
  point: EditorScreenPoint,
  options?: HitTestOptions,
): RuntimeObjectHit | undefined;

function getRuntimeSelectionBounds(
  adapter: EditorRuntimeAdapter,
  ids: string[],
): ViewBoxRect | undefined;
```

Rules:

- Hit testing follows the current rendered depth order so the visually topmost
  object wins.
- The editor applies editor-only visibility and lock filters before calling hit
  testing unless `includeHidden` or `includeLocked` is explicitly true.
- Connections are hit by expanded projected stroke bounds, not by exact path
  pixels.
- Missing ids are ignored for selection bounds. If no ids resolve, return
  `undefined`.

## V1 Helper Subset

The first editor implementation must include:

- `createEditorRuntimeAdapter`;
- element metadata and bounds;
- `projectGridPoint`;
- `unprojectScreenPoint`;
- `clientPointToSvgPoint`;
- `getGridCellPolygon`;
- element hit testing;
- element selection bounds.

Connection metadata is required for v1 inspector editing. Pointer-based
connection hit testing is not required for v1 because connection creation and
editing use endpoint dropdowns and form controls.
