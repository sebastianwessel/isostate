# Capability: Connector Routing

## Overview

Connector routing computes visually plausible ground-plane routes between scene
objects or explicit grid points. Routing is dev-time behavior: the browser
runtime receives compiled connector `route` points and only renders them. This
keeps the runtime small, deterministic, and dependency-free.

The router exists to answer:

- where a connector leaves the source object
- where it enters the target object
- how it avoids unrelated objects that sit between source and target
- how the path stays visually aligned with the isometric grid

## Routing Model

Connectors may be authored in two modes:

1. `route`: manual explicit route points. No auto-routing is performed.
2. `from` + `to`: routed endpoints. The compiler or converter computes `route`
   before emitting the runtime bundle.

```yaml
connections:
  - id: request-flow
    from:
      element: client
      side: auto
    to:
      element: api-gateway
      side: auto
    routing:
      mode: orthogonal
      avoid: objects
      clearance: 1
    style:
      pattern: dotted
    end: arrow
    ambient:
      - name: flow
```

Manual route:

```yaml
connections:
  - id: request-flow
    route: [[1, 5], [3, 5], [3, 4], [5, 4]]
    style:
      pattern: dashed
```

Exactly one of these forms is valid in authored YAML:

- `route`
- both `from` and `to`

If `route` is authored, `from`, `to`, and `routing` are rejected by the initial
compiler to avoid ambiguous source of truth.

Manual route points in human-authored `.isostate.yaml` are whole grid
coordinates, and every segment must move along exactly one grid axis. Dev-time
converters may call router internals with fractional points, but the public YAML
validator rejects fractional manual route points and diagonal manual segments.
The compiler may emit fractional runtime route points after resolving element
side ports.

## Endpoint References

```ts
type ConnectorSide =
  | 'auto'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'front'
  | 'back';

interface ConnectorEndpointRef {
  element?: string;
  at?: [number, number];
  side?: ConnectorSide;
  offset?: number;
}
```

Rules:

- Endpoint refs use exactly one of `element` or `at`.
- `element` references an element id present in the resolved scene at the
  connector's scene step.
- `at` references an explicit ground-plane grid point.
- `side` defaults to `auto`.
- `offset` is a normalized side offset from `-0.5` to `0.5`; default `0`.

Endpoint references are lifecycle-checked. If a later scene removes a referenced
element, every still-present connection that references that element must be
removed in the same scene. Otherwise validation fails with
`CONNECTION_ENDPOINT_REMOVED`.

## Element Connection Ports

The router derives candidate connection ports from an element footprint, not from
SVG pixels. This avoids inspecting asset markup and keeps routing stable.

For an element at `[x, y]` with `size = n`, the footprint corners are:

```text
top    = [x, y]
right  = [x + n, y]
bottom = [x + n, y + n]
left   = [x, y + n]
```

Side aliases:

| Side | Grid Point |
|---|---|
| `top` / `back` | midpoint between `top` and `right` |
| `right` | midpoint between `right` and `bottom` |
| `bottom` / `front` | midpoint between `bottom` and `left` |
| `left` | midpoint between `left` and `top` |

`side: auto` evaluates all four side candidates and chooses the route with the
lowest total cost.

`offset` moves the port along the selected side before routing:

```text
top/back:    port = midpoint(top,right)    + offset * (right - top)
right:       port = midpoint(right,bottom) + offset * (bottom - right)
bottom/front:port = midpoint(bottom,left)  + offset * (left - bottom)
left:        port = midpoint(left,top)     + offset * (top - left)
```

For `side: auto`, the same offset is applied to each candidate side before path
scoring. Ports may be fractional grid coordinates; emitted runtime routes may
therefore start or end on half-cell positions even though hand-authored manual
routes use whole grid points.

Endpoint-routed connections must not run along an object edge before entering or
leaving a side port. For element endpoints, the router inserts a short outside
stub along the side normal before searching the orthogonal path:

| Side | Outside Stub Direction |
|---|---|
| `top` / `back` | negative `y` |
| `right` | positive `x` |
| `bottom` / `front` | positive `y` |
| `left` | negative `x` |

The default stub length equals `routing.clearance` (`0.5` cells by default).
The final emitted route keeps the real side port as the first or last point so
arrowheads target the visible side midpoint, while the previous/next route point
sits outside the footprint. This makes arrowheads point into the side port
instead of sliding along the object boundary.

## Obstacle Model

Elements are obstacles on the ground plane by default. A connector may touch its
source and target element footprints but must avoid all unrelated visible element
footprints in the same resolved scene.

```ts
interface ConnectorRouting {
  mode?: 'straight' | 'orthogonal' | 'manual';
  avoid?: 'objects' | 'none' | string[];
  clearance?: number;
  gridStep?: number;
  maxBends?: number;
  prefer?: 'direct' | 'fewest-bends' | 'shortest';
}
```

Defaults:

| Field | Default |
|---|---|
| `mode` | `orthogonal` for `from`/`to`, `manual` for authored `route` |
| `avoid` | `objects` |
| `clearance` | `0.5` cells |
| `gridStep` | `1` |
| `maxBends` | no hard limit |
| `prefer` | `fewest-bends` |

Obstacle rules:

- `objects`: all visible non-text elements except source and target.
- `none`: no obstacles; route may pass through objects.
- string array: avoid only the listed element ids, except source/target are
  still allowed endpoints.
- Obstacles are inflated by `clearance`.
- Text labels do not block routes.
- Existing connectors do not block routes in v1.

## Routing Algorithm Contract

The default dev-time router uses an orthogonal grid path:

1. Resolve source and target candidate ports.
2. Convert element footprints plus clearance into blocked grid cells/segments.
3. For each source/target port pair, create outside stubs along the selected side
   normals, then find a path between the outside stub points using 4-neighbor
   grid movement along the authored grid axes. If a selected port is fractional,
   the outside stub remains fractional on the same side-normal line and is
   included in the emitted route.
4. Score paths by:
   - obstacle violations: terminally invalid unless `avoid: none`
   - fewer bends
   - shorter total grid length
   - side preference from authored `side`
   - deterministic lexical tie-break by connector id
5. Simplify collinear points, preserving source and target ports.
6. Emit the simplified route into `RuntimeConnectorState.route`.

`mode: straight` attempts a direct segment first. If the segment intersects an
unrelated inflated obstacle and `avoid !== none`, validation/compilation fails
with `CONNECTOR_ROUTE_BLOCKED` unless a converter changes the mode to
`orthogonal`.

`mode: manual` uses authored `route` as-is after validation. It still receives
warnings if it intersects obstacles.

## Isometric Visual Fit

The route is calculated in logical grid space and rendered after projection.
Segments should follow grid axes because grid-axis segments project to the two
visible diamond directions. This makes routes look like they lie on the ground
instead of floating across the scene.

The router must not create screen-horizontal or screen-vertical segments unless
they are the projected result of valid grid-axis movement.

## Handling Intervening Elements

When an unrelated element lies between two connected elements:

- `mode: orthogonal` routes around the inflated footprint.
- `mode: straight` fails unless `avoid: none`.
- `mode: manual` is allowed but receives a `CONNECTOR_INTERSECTS_OBJECT` warning.

This means a connector never silently cuts through a visible object when the
author asked for object avoidance.

## Package Strategy

The browser runtime must not depend on a routing package. Routing packages are
allowed only in dev-time tooling or converter packages.

Recommended approach:

- Define a small `ConnectorRouter` interface in dev-time tooling.
- Provide a default grid-router adapter based on A* or Jump Point Search.
- Allow advanced converter users to plug in ELK, libavoid, or another router and
  emit the same connector `route` contract.

Package evaluation:

| Package | Fit | Role |
|---|---|---|
| grid A* package such as `pathfinding` / PathFinding.js | Good fit for our grid obstacle model | Candidate dev-time default or reference adapter |
| ELK / elkjs | Strong graph layout and edge routing, heavier and graph-oriented | Optional external converter/layout integration |
| libavoid | Strong orthogonal/object-avoiding connector routing, C++ ecosystem and no runtime fit | Optional native/tooling integration, not browser runtime |

The implementation may start with a tiny internal dev-time A* router if package
size, maintenance, or module format makes a dependency unattractive. That router
must remain outside the browser runtime entrypoint.

## Errors And Warnings

| Code | Severity | Meaning |
|---|---|---|
| `CONNECTOR_ENDPOINT_NOT_FOUND` | error | `from.element` or `to.element` does not resolve in the scene. |
| `CONNECTOR_ROUTE_BLOCKED` | error | Requested auto route cannot avoid required obstacles. |
| `INVALID_CONNECTOR_ROUTING` | error | Routing config is malformed. |
| `CONNECTOR_INTERSECTS_OBJECT` | warning | Manual route crosses an unrelated visible object. |
| `CONNECTOR_ROUTE_DETOUR` | warning | Auto route exists but exceeds direct length by more than 3x. |

## Verification Requirements

Default tests must cover:

- direct route with no obstacles
- orthogonal route around a blocking object
- source/target footprints are allowed endpoints but not obstacles
- `avoid: none` permits direct crossings
- manual route crossing emits warning
- deterministic route output for equal-cost paths
- route simplification removes collinear interior points
- routing code is absent from browser runtime bundle
