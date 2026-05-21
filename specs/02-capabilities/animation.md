# Capability: Animation

## Overview

The animation engine maps normalized progress to compiled scene transitions. Authored YAML expresses animation through ordered scenes and deltas; the compiler resolves those deltas into complete runtime snapshots.

The engine handles:

1. Scroll/API-driven interpolation between compiled snapshots.
2. Entry and exit animations derived from `add.elements` and
   `remove.elements` operations.
3. Entry and exit animations derived from `add.connections` and
   `remove.connections` operations.
4. Ambient animations active on resolved elements and connectors.

## Authored Source Model

Authors do not write per-element keyframes. They write:

- first scene: full `elements[]` snapshot
- first scene: optional full `connections[]` snapshot
- later scenes: `add.elements[]`, `update.elements[]`, `remove.elements[]`
  deltas
- later scenes: `add.connections[]`, `update.connections[]`,
  `remove.connections[]` deltas

The compiler derives lifecycle:

| Authored Operation | Runtime Meaning |
|---|---|
| first-scene `elements[]` | present at timeline start |
| `add.elements[]` | absent before scene, entering at scene |
| `update.elements[]` | present before and after scene, properties may interpolate |
| `remove.elements[]` | present before scene, exiting at scene, absent after scene |
| first-scene `connections[]` | connector present at timeline start |
| `add.connections[]` | connector absent before scene, entering at scene |
| `update.connections[]` | connector present before and after scene, properties may interpolate |
| `remove.connections[]` | connector present before scene, exiting at scene, absent after scene |

## Runtime Snapshot Model

The runtime receives resolved scene snapshots from the compiler:

```ts
interface RuntimeSceneStop {
  id: string;
  progress: number;
  elements: RuntimeElementState[];
  connectors: RuntimeConnectorState[];
}

interface RuntimeElementState {
  id: string;
  asset: string;
  pos: [number, number];
  size: number;
  layer: string;
  presence: 'present' | 'entering' | 'exiting' | 'removed';
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
}

interface RuntimeConnectorState {
  id: string;
  route: [number, number][];
  layer: string;
  style: RuntimeConnectorStyle;
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  direction: 'route' | 'reverse';
  presence: 'present' | 'entering' | 'exiting' | 'removed';
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
}
```

`presence` is compiler-generated. It is not authored YAML.

## Scroll-Driven Interpolation

For each progress update:

1. Find the previous and next compiled scene stops.
2. Compute interpolation factor `t`.
3. For elements present in both stops, interpolate `pos` and `size`.
4. For connectors present in both stops, interpolate route points when the
   previous and next route have the same point count.
5. Emit a frame for every element and connector id known anywhere in the
   compiled timeline.
6. For elements or connectors added at the destination stop, keep lifecycle
   `removed` until `t === 1`, then transition `removed -> entering` and render
   at destination placement.
7. For elements or connectors removed at the destination stop, keep the previous
   placement until `t === 1`, then transition to `removed` after the exit
   lifecycle.
8. Apply discrete layer, style, endpoint, direction, and ambient changes at the
   destination stop.

Connector route interpolation rule:

- Equal route point counts: interpolate each corresponding point linearly in
  grid space, then project the interpolated route.
- Different route point counts: keep the previous route for `t < 1`, then switch
  discretely to the destination route at `t === 1`.

This avoids implicit route morphing decisions that would change topology or
produce self-crossing paths.

Seeking backward must be symmetric: if progress moves before an element's add
scene, the engine emits `removed` for that element. The controller must play the
opposite exit animation for the element's configured entry animation before
hiding it. If progress moves backward from an `exiting` state into a visible
state, the controller must play the opposite entry animation for the configured
exit animation. This also applies when seeking exactly back to the first scene.

## Entry Animations

```ts
type EntryAnimation =
  | 'fade-in'
  | 'fade-in-grow'
  | 'fall-in'
  | 'rise-from-ground'
  | 'slide-in-left'
  | 'slide-in-right'
  | 'flip-in'
  | 'none';
```

Default duration is `400ms`; default easing is `ease-out`.
Added elements and connectors default to `fade-in` when `enter` is omitted.
Authors can use `enter: none` to disable the entry animation for a specific
object.

Entry animations must compose with the placement transform. They must not clear the scroll-driven `translate(...) scale(...)` transform.

## Exit Animations

```ts
type ExitAnimation =
  | 'fade-out'
  | 'fade-out-shrink'
  | 'fall-through-ground'
  | 'rise-away'
  | 'slide-out-left'
  | 'slide-out-right'
  | 'flip-out'
  | 'none';
```

Default duration is `300ms`; default easing is `ease-in`. Removed elements and
connectors default to `fade-out` when `exit` is omitted. Authors can use
`exit: none` to hide the object without an exit animation. After exit completes,
the object is hidden or removed from the active render tree.

## Opposite Animation Pairs

Backward scrubbing derives the opposite animation automatically:

| Entry | Opposite exit |
|---|---|
| `fade-in` | `fade-out` |
| `fade-in-grow` | `fade-out-shrink` |
| `fall-in` | `rise-away` |
| `rise-from-ground` | `fall-through-ground` |
| `slide-in-left` | `slide-out-left` |
| `slide-in-right` | `slide-out-right` |
| `flip-in` | `flip-out` |
| `none` | `none` |

The inverse mapping is used when scrubbing backward from an exit animation into
a visible state.

## Ambient Animations

Ambient animations run while an element or connector is present.

```ts
interface AmbientAnimation {
  name: string;
  infinite?: boolean;
  iterations?: number;
}
```

Built-ins for elements: `pulse`, `float`, `shake`, `glow`, `spin`, `blink`,
`bounce`.

Built-ins for connectors: `flow`, plus generic opacity-oriented classes such as
`pulse` when the renderer can apply them without changing geometry.

`flow` animates dashed and dotted connector shafts by changing
`stroke-dashoffset`. The animation direction must match the connector's
effective direction:

- `direction: route`: movement follows the route order and the default end arrow.
- `direction: reverse`: movement follows the reverse route order and a start
  arrow if present.
- If both endpoints are arrows or no endpoint is an arrow, `direction` remains
  the source of truth.

## Controller Integration

The controller owns scroll binding and sends normalized progress to the animation engine. The engine is agnostic to whether progress came from scroll, a slider, keyboard controls, or direct API calls.

## Frame Update Cycle

1. Receive normalized progress.
2. Resolve surrounding compiled scene stops.
3. Apply lifecycle changes derived from scene operations.
4. Interpolate active element transforms and connector routes.
5. Recalculate positions using the layout-resolved projection contract.
6. Update ambient animation classes.
7. Emit DOM updates.

Default verification must cover add, update, remove, re-add, interpolation,
ambient changes, connector route interpolation, connector flow direction, and
paused/resumed controller updates.
