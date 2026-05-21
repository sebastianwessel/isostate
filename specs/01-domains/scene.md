# Domain: Scene Document

## Overview

A scene document is the top-level authored YAML artifact. It defines a reusable header plus an ordered scene timeline. The authored model is optimized for humans and converters:

- global catalogs and settings live in `header`
- the first scene is the initial placement snapshot
- every later scene is a delta from the previous scene

The old state/keyframe-per-element shape is not the authored domain model. It may exist only as compiler-generated runtime data during the migration.

## Scene Document

```ts
interface SceneDocument {
  header: SceneHeader;
  scenes: SceneStep[];
}

interface SceneHeader {
  version?: string;
  name?: string;
  className?: string;
  assetBaseUrl?: string;
  assets: AssetCatalogEntry[];
  grid?: GridConfig;
  floor?: FloorConfig;
  theme?: string;
  layers: LayerDefinition[];
}
```

## Header

The header owns document-wide settings:

- asset catalog available to element placements
- grid unit
- optional floor surface and bounds overrides
- visual theme and optional root SVG CSS class
- layer order

Asset catalog entries may include `anchor: [x, y]` with normalized viewport
coordinates. This lets imported SVG sets align their real ground contact point
to the projected grid footprint without changing the SVG file.

This makes the rest of the YAML timeline focused on what changes between scenes.

## Grid

The grid defines the authored spacing unit for isometric placement.

```ts
interface GridConfig {
  cellSize?: number; // default: 64
}
```

`cellSize` is used to project logical grid coordinates into SVG viewBox units. It is not a request for the final CSS pixel size. Final rendered size is controlled by the SVG viewBox and the mount container dimensions.

## Floor

```ts
interface FloorConfig {
  size?: [number, number];
  origin?: [number, number];
  layer?: string;
  visible?: boolean;
  asset?: string;
}
```

The floor is the optional logical placement surface and stable bound override for ordinary scenes. `size` is `[columns, rows]` in grid cells. If `size` is omitted, the compiler derives it from resolved scene element footprints. `origin` defaults to `[0, 0]`. If `visible` is true, the runtime must render a ground surface either from `asset` or from a built-in generated floor surface once that renderer is specified.

## Runtime Layout

Layout fitting is not authored in YAML. The compiler emits internal layout
metadata with `contain` fitting, centered alignment, union bounds, and a small
viewBox padding. The renderer computes tight projected bounds, sets the root SVG
viewBox to those bounds, and lets the browser scale the SVG into the mount
target. The renderer must not use arbitrary viewport-centered projection
offsets.

## Layers

Layers define render order and grouping.

```ts
interface LayerDefinition {
  name: string;
  order?: number;
}
```

Layer order defaults to declaration index. Built-in conventional names are:

| Layer Name | Purpose |
|---|---|
| `ground` | Floor, terrain, roads |
| `structures` | Buildings and primary objects |
| `details` | Small objects and labels |
| `overlay` | Connectors, floating hints, UI-like overlays |

## Scenes

```ts
interface SceneStep {
  id: string;
  elements?: ElementPlacement[];
  connections?: ConnectionPlacement[];
  add?: SceneAddDelta;
  update?: SceneUpdateDelta;
  remove?: SceneRemoveDelta;
}

interface SceneAddDelta {
  elements?: ElementPlacement[];
  connections?: ConnectionPlacement[];
}

interface SceneUpdateDelta {
  elements?: ElementPatch[];
  connections?: ConnectionPatch[];
}

interface SceneRemoveDelta {
  elements?: ElementRemoval[];
  connections?: ConnectionRemoval[];
}
```

The first scene declares `elements` and may declare `connections`. Later scenes
declare only operation deltas:

- `add.elements` places new elements
- `update.elements` changes existing elements
- `remove.elements` exits existing elements
- `add.connections` places new visual connections
- `update.connections` changes existing visual connections
- `remove.connections` exits existing visual connections

Omitted elements and connections persist unchanged from the previous resolved
scene.
The compiler assigns runtime progress from scene order: the first scene is `0`,
the last scene is `1`, and intermediate scenes are evenly spaced.

## Surface Styling

The renderer does not own page backgrounds. `header.className`, when present, is
added to the root SVG so applications can style the scene surface with normal
CSS, for example gradients, transparent backgrounds, or shadows.

## Theme

The active theme is resolved against built-in and user theme definitions to CSS variables applied at the root SVG/layer/element level. If omitted, `theme` defaults to `light`.
