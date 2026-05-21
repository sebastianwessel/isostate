# Capability: Rendering DSL

## Overview

The rendering DSL is the human-authored YAML syntax for defining an isometric scene timeline. It is **not** a logical graph definition language; semantic nodes, edges, and relations belong to converter tools such as Mermaid adapters. The DSL does include explicit visual connectors for authored ground-plane routes.

The DSL is intentionally organized for authors:

- `header` declares the document catalog and global settings.
- `header.assets` lists the asset ids this document is allowed to use.
- `header.floor`, `header.grid`, `header.layers`, `header.theme`, and optional `header.className` define required render settings.
- `scenes` declares the timeline.
- The first scene is a complete placement snapshot.
- Every later scene is a delta from the previous scene.

Per-element authored `keyframes` are not allowed in `.isostate.yaml`. The compiler owns any expansion into keyframes or snapshots needed by the runtime.

## YAML Shape

```yaml
header:
  version: "0.1"
  name: basic-infrastructure
  theme: light
  assetBaseUrl: ./assets
  assets:
    - id: platform
      path: iso-platform
    - id: server
      path: iso-server
    - id: database
      path: iso-database
    - id: cloud
      path: iso-cloud
  grid:
    cellSize: 64
  floor:
    visible: true
    layer: ground
    asset: iso-platform
  className: demo-surface
  layers:
    - name: ground
    - name: structures
    - name: overlay

scenes:
  - id: initial
    elements:
      - id: platform
        asset: iso-platform
        layer: ground
        at: [1, 2]
        size: 3
      - id: app-server
        asset: iso-server
        layer: structures
        at: [2, 2]
      - id: database
        asset: iso-database
        layer: structures
        at: [3, 2]
    connections:
      - id: request-flow
        route: [[2, 3], [3, 3], [3, 2], [4, 2]]
        layer: ground
        style:
          pattern: dotted
          stroke: "#2563eb"
          strokeWidth: 3
        end: arrow
        ambient:
          - name: flow

  - id: connected
    update:
      elements:
        - id: app-server
          at: [2, 1]
        - id: database
          at: [3, 1]
      connections:
        - id: request-flow
          route: [[2, 3], [3, 3], [3, 2], [5, 2]]

  - id: scaled
    add:
      elements:
        - id: cloud
          asset: iso-cloud
          layer: overlay
          at: [2, 0]
          enter: fade-in-grow
          ambient:
            - name: float
      connections:
        - id: service-road
          route: [[1, 4], [4, 4]]
          style:
            variant: road
            lane: center-dashed
          start: none
          end: none
    update:
      elements:
        - id: app-server
          at: [1, 1]
          ambient:
            - name: pulse
```

## Header

The header is the document-level contract. It prevents examples from scattering global configuration throughout the timeline and gives converters one obvious place to write catalogs and defaults.

### Assets

`header.assets` is a local id catalog, not SVG content. With `assetBaseUrl`, the compiler emits browser-loadable SVG URLs from each asset `path`.

```yaml
assets:
  - id: server
    path: equipment/server
    anchor: [0.5, 1]
```

An element can reference only assets declared in `header.assets`, except
reserved built-in generated assets: `text`, `rectangle`, `circle`, `polygon`,
and `line`. If an external asset has no URL source from `assetBaseUrl`,
validation fails before compilation.

URL-loaded files must be standalone SVG documents with `xmlns="http://www.w3.org/2000/svg"` and a valid `viewBox`.

`anchor` is optional and defaults to `[0.5, 1]`. It is the normalized point
inside the square runtime SVG image viewport that the renderer places on the
projected footprint anchor. Shared asset catalogs should declare it explicitly
for every asset so unchecked imported SVG geometry does not drift from the grid.

### Built-In Text

Text labels use the reserved asset id `text` and an element-level `text` object. They are not listed in `header.assets`.

```yaml
- id: auth-gateway-label
  asset: text
  layer: labels
  at: [2, 3]
  text:
    value: |
      Authentication
      Gateway
    align: middle
    fontSize: 12
    fontWeight: 700
    lineHeight: 1.2
    fill: "#111111"
```

`text.value` supports line breaks. The compiler preserves the text payload in runtime scene snapshots and excludes `text` from asset URL generation. The runtime renderer creates SVG text nodes directly; it never treats `text.value` as SVG or HTML.

### Built-In Primitives

Primitive geometry uses reserved asset ids and an element-level `primitive`
object. Primitive assets are not listed in `header.assets` and are generated
directly with SVG DOM APIs.

```yaml
- id: service-zone
  asset: rectangle
  layer: ground
  at: [1, 1]
  size: 3
  primitive:
    rectangle:
      fill: "#2563eb"
      stroke: "#1d4ed8"
      strokeWidth: 1
      opacity: 0.16
```

Rules:

- `primitive` must contain exactly one child matching the asset id.
- `rectangle`, `circle`, and `polygon` accept `fill`, `stroke`,
  `strokeWidth`, `opacity`, and `dash`.
- `line` accepts `points`, `stroke`, `strokeWidth`, `opacity`, `dash`,
  `lineCap`, and `lineJoin`.
- `polygon.points` and `line.points` are normalized local grid coordinates from
  `0` to `1`; polygons require at least three points and lines require at least
  two.
- Element `size` is a positive whole-grid-cell count. Use larger sizes only for
  assets or primitives intentionally authored for larger footprints. Imported
  composite SVGs must not be enlarged with `size` as an alignment workaround;
  split multi-object SVGs when possible, or keep the source asset at `size: 1`
  with a checked `anchor`.

## Visual Connectors

Connectors are first-class visual routes rendered as generated SVG paths on the
ground plane. They are not external SVG assets and are not logical graph edges.
Converter tools may accept semantic edges, but they must compile them to
explicit connector routes before validation.

```yaml
connections:
  - id: request-flow
    route: [[1, 5], [3, 5], [3, 4], [5, 4]]
    layer: ground
    style:
      pattern: dashed
      stroke: "#111111"
      strokeWidth: 3
    start: dot
    end: arrow
    ambient:
      - name: flow
```

Connector style supports:

- `pattern: solid | dashed | dotted`
- `variant: line | road`
- `start` and `end` endpoint indicators: `none`, `arrow`, `dot`, `circle`,
  `diamond`, or `bar`
- fixed dash arrays in SVG user units so route length does not stretch dots or
  dashes
- generated arrowhead geometry separate from the shaft path
- `ambient: [{ name: flow }]` for CSS dash/dot animation in the connector's
  effective direction

Later scenes use `add.connections`, `update.connections`, and
`remove.connections`. Element and connection deltas share the same operation
sections but remain separated by object kind.

Connectors can be manual or routed. Manual connectors author `route` directly.
Routed connectors author `from` and `to`; dev-time routing resolves the concrete
route before the runtime bundle is emitted.

Manual `route` points in hand-written YAML use whole grid coordinates. To attach
to an element side midpoint, use `from`/`to`; the compiler resolves those ports
and may emit fractional runtime route points.

```yaml
connections:
  - id: api-to-db
    from:
      element: api-server
      side: auto
    to:
      element: database
      side: auto
    routing:
      mode: orthogonal
      avoid: objects
      clearance: 1
    style:
      pattern: dashed
    end: arrow
```

When an unrelated object lies between the endpoints, `routing.mode: orthogonal`
routes around that object's inflated footprint. `routing.mode: straight` fails
if the direct segment is blocked, unless `avoid: none` is set.

### Floor

`header.floor` defines optional logical ground-plane overrides. If `size` is omitted, the compiler derives it from resolved scene element footprints.

```yaml
floor:
  origin: [0, 0]
  visible: true
  layer: ground
  asset: iso-platform
```

`size` is measured in grid cells. When `visible` is true and `asset` is set, the compiler may create a floor element or the runtime may render a generated floor surface, depending on the runtime-bundle contract. The important invariant is that floor bounds participate in fitting the scene to the container.

### Runtime Layout

Layout integration is compiler/runtime behavior, not authored YAML. The compiled
bundle carries internal layout metadata so the SVG fills the mount target while
preserving aspect ratio, centers the projected content, and adds only minimal
viewBox padding around the union of floor and content bounds. The renderer must
not hard-code an `800×600` viewport or large fixed whitespace.

## Scenes As Deltas

The first scene is a full snapshot:

```yaml
scenes:
  - id: initial
    elements:
      - id: server
        asset: iso-server
        at: [2, 2]
    connections:
      - id: request-flow
        route: [[1, 2], [2, 2]]
```

Every following scene is a delta:

```yaml
  - id: connected
    update:
      elements:
        - id: server
          at: [1, 2]
      connections:
        - id: request-flow
          route: [[1, 2], [2, 2], [3, 2]]
    remove:
      elements:
        - id: old-label
          exit: fade-out
      connections:
        - id: old-flow
          exit: fade-out
```

Omitted elements and connections keep their resolved state from the previous
scene. Scene order is the step order; authors do not write numeric progress
values. This keeps authored YAML small and prevents the “same object repeated
under every keyframe” shape.

Connections do not auto-disappear when an endpoint element is removed. Remove
the endpoint element and its connections in the same scene:

```yaml
  - id: remove-cache
    remove:
      elements:
        - id: cache
      connections:
        - id: api-to-cache
```

If a still-present connection references a removed endpoint element, validation
fails with `CONNECTION_ENDPOINT_REMOVED`.

## Element Operations

### Placement

`elements[]` and `add.elements[]` use the same placement object:

```yaml
- id: app-server
  asset: iso-server
  layer: structures
  at: [2, 2]
  size: 1
  enter: rise-from-ground
  exit: fade-out
  ambient:
    - name: pulse
```

### Update

`update.elements[]` can include only changed properties:

```yaml
- id: app-server
  at: [2, 1]
  size: 2
```

### Remove

`remove.elements[]` identifies elements leaving the resolved scene:

```yaml
- id: app-server
  exit: fall-through-ground
```

## Compiler Responsibility

The compiler must:

1. Parse the header and scene deltas.
2. Validate asset, layer, scene, element, and connector references.
3. Resolve defaults.
4. Expand scenes into complete snapshots.
5. Compute lifecycle transitions from element and connector delta operations.
6. Produce a deterministic `RuntimeBundle`.

Lifecycle animation defaults are part of this expansion: added elements compile
with `enter: fade-in` unless authored otherwise, and removed elements compile
with `exit: fade-out` unless authored otherwise.
The same defaults apply to connections added with `add.connections` and removed
with `remove.connections`.

The browser runtime never parses YAML and never receives ambiguous deltas unless the runtime-bundle spec explicitly adds delta playback support.

## Validation Summary

- First scene: `elements` required; `add`, `update`, `remove` forbidden.
- First scene may include `connections`.
- Later scenes: top-level `elements` and `connections` forbidden; operation
  sections are allowed.
- `add.elements` and `add.connections` may only introduce absent IDs.
- `update.elements`, `remove.elements`, `update.connections`, and
  `remove.connections` may only reference currently present IDs.
- Remove and update operations may not reference the same ID for the same object
  kind in one scene.
- Removing an element requires explicitly removing every present connection that
  references that element through `from.element` or `to.element`.
- `pos` is not an authored YAML field; use `at`.
- `keyframes` is not an authored YAML field; use scene deltas.
