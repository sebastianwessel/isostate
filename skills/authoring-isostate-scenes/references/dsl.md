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
- Scene progress is derived from order. Do not author `at`, `progress`, or timestamps.
- First scene is the full initial placement snapshot.
- Later scenes are deltas only.

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
- `asset` must be declared in `header.assets`, except `asset: text`.

