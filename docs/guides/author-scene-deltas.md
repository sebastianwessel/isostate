# Author Scene Deltas

Scene YAML is optimized for authors and converters. Define shared settings in
`header`, then describe a timeline with `scenes`.

The DSL has placed elements and generated visual connections. If a higher-level
authoring tool has semantic arrows or relations, convert each relation into an
explicit connection `route` before writing YAML. Do not stretch a single arrow
SVG with an embedded head across long distances.

## Header

The header declares assets, floor, theme, layers, and an optional root
SVG `className` for page-owned CSS styling.

```yaml
header:
  theme: light
  assetBaseUrl: ./assets
  assets:
    - id: iso-server
      path: equipment/iso-server
  floor:
    visible: true
    layer: ground
  layers:
    - name: ground
    - name: structures
```

`header.assets` is the catalog of local ids the document may reference. When
`assetBaseUrl` is set, `path` is combined with that base URL and `.svg` is added
when omitted.

`asset: text` is reserved for generated labels and is not listed in
`header.assets`.

## First Scene

The first scene is a complete placement snapshot.

```yaml
scenes:
  - id: initial
    elements:
      - id: app-server
        asset: iso-server
        layer: structures
        at: [2, 2]
        size: 1
    connections:
      - id: request-flow
        route: [[1, 3], [2, 3], [2, 2], [3, 2]]
        layer: ground
        style:
          pattern: dotted
        end: arrow
        ambient:
          - name: flow
```

Authors use `at` for grid position. The compiler writes runtime `pos`.

## Connectors

Use connections for arrows, flows, dashed/dotted relationships, and road-like
ground paths. Connectors are generated SVG geometry, not assets.

```yaml
connections:
  - id: request-flow
    route: [[1, 5], [3, 5], [3, 4], [5, 4]]
    style:
      pattern: dashed
      stroke: "#2563eb"
      strokeWidth: 3
    start: dot
    end: arrow
    ambient:
      - name: flow
```

`ambient: [{ name: flow }]` animates dashed and dotted connector shafts in the
connector's effective direction. Use `direction: reverse` when the visible flow
should move from the last route point back to the first.

For object-to-object connections, use routed endpoints. The compiler resolves
them to concrete route points and avoids unrelated object footprints by default:

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
```

Road-like paths use `variant: road`:

```yaml
connections:
  - id: service-road
    route: [[1, 4], [4, 4], [4, 3], [6, 3]]
    style:
      variant: road
      lane: center-dashed
    start: none
    end: none
```

## Text Labels

Use the built-in `text` asset for labels instead of creating SVG files for
plain text.

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

`text.value` supports line breaks. Updates may change only the nested text
fields that differ; omitted text fields keep their previous resolved values:

```yaml
update:
  elements:
    - id: auth-gateway-label
      text:
        fill: "#eeeeee"
```

Use `text.value` in an update only when the label text itself changes.

## Primitive Underlays And Markers

Use built-in primitive assets for simple generated SVG geometry. They are not
declared in `header.assets`.

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

Available primitive asset ids are `rectangle`, `circle`, `polygon`, and `line`.
`polygon.points` and `line.points` use normalized local coordinates from `0` to
`1`. Use whole-cell `size` values to scale primitives over the grid.

Primitive updates are also nested sparse patches. Changing only
`primitive.rectangle.opacity` preserves the rectangle's previous fill, stroke,
stroke width, and other fields.

## Later Scenes

Every later scene is a delta from the previous resolved scene.

```yaml
  - id: scaled
    add:
      elements:
        - id: database
          asset: iso-database
          layer: structures
          at: [3, 2]
          enter: fade-in
      connections:
        - id: data-flow
          route: [[3, 2], [5, 2]]
    update:
      elements:
        - id: app-server
          at: [1, 2]
          size: 2
      connections:
        - id: request-flow
          route: [[1, 3], [2, 3], [2, 2], [4, 2]]
    remove:
      elements:
        - id: old-cache
          exit: fade-out
      connections:
        - id: old-flow
          exit: fade-out
```

- `add.elements` and `add.connections` create new objects.
- `update.elements` and `update.connections` change existing objects.
- `remove.elements` and `remove.connections` exit existing objects.
- Omitted elements and connections persist unchanged.
- Omitted fields inside `update.elements[].text`,
  `update.elements[].primitive.<kind>`, and `update.connections[].style` also
  persist unchanged.
- `update.elements[].size` may be `0` to scale an existing element down without
  removing it. New placements still require positive whole-cell `size` values.
- Added elements/connections default to `enter: fade-in`; removed
  elements/connections default to
  `exit: fade-out`. Use `none` to disable either animation.
- When removing an element, also remove every present connection that references
  it through `from.element` or `to.element` in the same scene. Connections do not
  disappear automatically.
- When a user scrubs backward, the runtime automatically uses the opposite
  animation pair. For example, reversing `fade-in` plays `fade-out`, and
  reversing `fade-out-shrink` plays `fade-in-grow`.
- Scene order is the step order. Do not write scene progress values such as
  `at: 0.5`; the compiler derives runtime progress from scene order.

The authored DSL does not accept top-level `states`, top-level `elements`,
per-element `keyframes`, `pos`, `lifecycle.status`, header `layout`, or
scene-level progress fields.

## Validation

Common validation failures:

| Error | Fix |
|---|---|
| `INVALID_INITIAL_SCENE` | Put `elements` and optional `connections` in the first scene and no delta operations there. |
| `INVALID_SCENE_DELTA` | Use `add`, `update`, and `remove` operation sections after the first scene. |
| `ASSET_NOT_DECLARED` | Add the asset id to `header.assets`. |
| `ASSET_URL_REQUIRED` | Add `assetBaseUrl` or fix the asset `path`. |
| `ASSET_NOT_FOUND` | Recompile so every external asset has a URL entry. |
| `TEXT_CONTENT_REQUIRED` | Add `text.value` to an `asset: text` element. |
| `INVALID_TEXT_STYLE` | Use supported text style values. |
| `INVALID_CONNECTOR_ROUTE` | Provide at least two valid route points. |
| `INVALID_CONNECTOR_STYLE` | Use supported connector style values. |
| `INVALID_CONNECTOR_ENDPOINT` | Use a supported start/end endpoint value. |
| `LAYER_NOT_FOUND` | Declare the layer in `header.layers`. |
| `DUPLICATE_ELEMENT_ID` | Use unique element ids in the resolved timeline. |
