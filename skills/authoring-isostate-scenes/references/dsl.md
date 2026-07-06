# Isostate DSL Reference

Use this when authoring `.isostate.yaml` scene structure or reviewing scene deltas.

## Document Shape

```yaml
header:
  version: "0.1"
  name: example
  assetBaseUrl: ./assets
  assets: []
  grid:
    cellSize: 64
  floor:
    visible: true
    layer: ground
  layers:
    - name: ground
    - name: structures
    - name: labels

scenes:
  - id: initial
    elements: []
    connections: []
```

Rules:

- `header` and `scenes` are required.
- `scenes[].id`, asset ids, element ids, connection ids, and layer names are kebab-case.
- All numeric values must be finite (`.inf`, `-.inf`, and `.nan` are rejected);
  `grid.cellSize` must additionally be greater than zero.
- Scene progress is derived from order. Do not author `at`, `progress`, or timestamps.
- First scene is the full initial placement snapshot.
- Later scenes are deltas only.
- Any scene may include optional `camera` metadata to focus presentation
  navigation on one element or one grid area.

## Scene Deltas

First scene:

```yaml
- id: initial
  elements:
    - id: api
      asset: aws-service
      at: [2, 2]
  connections:
    - id: client-to-api
      from:
        element: client
      to:
        element: api
```

Later scenes:

```yaml
- id: connected
  add:
    elements:
      - id: database
        asset: aws-database
        at: [5, 2]
    connections:
      - id: api-to-db
        from:
          element: api
        to:
          element: database
  update:
    elements:
      - id: api
        at: [3, 2]
    connections:
      - id: client-to-api
        style:
          pattern: dotted
  remove:
    elements:
      - id: old-cache
    connections:
      - id: old-flow
```

Operation rules:

- `add.elements` and `add.connections` introduce absent ids.
- `update.elements` and `update.connections` patch present ids.
- `remove.elements` and `remove.connections` remove present ids.
- The same id cannot be both updated and removed for the same object kind in one scene.
- Omitted objects persist unchanged from the previous resolved scene.
- Omitted fields inside `update.elements[].text`,
  `update.elements[].primitive.<kind>`, and `update.connections[].style`
  persist unchanged too; nested patches are merged field-by-field.
- Validator diagnostics identify the scene/object/field when possible. Use
  `scene=...`, `element=...` or `connection=...`, `field=...`, and `value=...`
  in CLI output to fix the exact authored field rather than guessing.

## Camera Focus

Use `camera` when a scene step should focus attention during presentation
navigation. Camera metadata does not change scene geometry and does not persist
to later scenes.

Focus an element:

```yaml
- id: focus-api
  update:
    elements:
      - id: api
        ambient:
          - name: pulse
  camera:
    target:
      element: api
    padding: 48
    duration: 600
    easing: ease-in-out
```

Focus a grid area:

```yaml
- id: overview
  elements:
    - id: api
      asset: service
      at: [2, 2]
  camera:
    target:
      area:
        at: [0, 0]
        size: [5, 4]
```

Reset to the full compiled scene view:

```yaml
- id: zoom-out
  update:
    elements:
      - id: api
        ambient: []
  camera:
    target:
      reset: true
    duration: 500
    easing: ease-out
```

Rules:

- Use exactly one target kind: `target.element`, `target.area`, or
  `target.reset`.
- `target.element` must reference an element visible in the same resolved scene
  stop.
- `target.area.at` and `target.area.size` use grid cells.
- `target.reset: true` returns to the compiled full scene view and must not use
  `padding`.
- `padding` defaults to `32` SVG user units.
- `duration` defaults to the controller transition duration.
- `easing` defaults to the controller transition easing and may be `linear`,
  `ease-in-out`, or `ease-out`.
- Scenes without `camera` inherit the previous camera focus. This lets a scene
  zoom in, keep that focus across later scenes, and then zoom out with
  `target.reset: true`.
- Scroll playback interpolates camera viewBoxes between adjacent scene stops.
  Scrolling backward uses the same path in reverse.

## Elements

```yaml
- id: api
  asset: aws-service
  layer: structures
  at: [2, 2]
  size: 1
  enter: fade-in
  exit: fade-out
  ambient:
    - name: pulse
```

Rules:

- Use `at`, not `pos`, in authored YAML.
- Hand-authored examples use whole grid-cell coordinates.
- `size` defaults to `1`.
- `layer` defaults to `structures` if present, otherwise first declared layer.
- `asset` must be declared in `header.assets`, except built-in generated assets:
  `text`, `rectangle`, `circle`, `polygon`, and `line`.
- `size` defaults to `1` and placements must use a positive whole-grid-cell
  count. `update.elements[].size: 0` is allowed to scale an existing element to
  zero without removing it.

## Generated Built-Ins

Text labels:

```yaml
- id: api-label
  asset: text
  layer: labels
  at: [2, 1]
  text:
    value: |
      Public
      API
```

Primitive underlays and markers:

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

Primitive ids are `rectangle`, `circle`, `polygon`, and `line`. The
`primitive` object must contain exactly one child matching the asset id.
`polygon.points` and `line.points` use normalized local coordinates from `0` to
`1`.

When updating text or primitive elements, author only the nested fields that
change. For example, `text: { fill: "#eeeeee" }` keeps the previous
`text.value`, and `primitive.rectangle.opacity` keeps the previous rectangle
fill/stroke fields.
