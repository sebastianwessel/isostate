# Isostate Connections Reference

Use this when authoring arrows, flows, routes, road-like paths, endpoint markers, or connection lifecycle.

## Naming

Public YAML uses `connections`. Runtime/rendering internals may call the generated geometry `connectors`.

## Routed Connections

Prefer `from`/`to` for object-to-object connections:

```yaml
connections:
  - id: client-to-api
    from:
      element: client
      side: auto
    to:
      element: api
      side: auto
    routing:
      mode: orthogonal
      avoid: objects
      clearance: 0.5
    style:
      pattern: dotted
      stroke: "#2563eb"
      strokeWidth: 3
    start: dot
    end: arrow
    direction: route
    ambient:
      - name: flow
```

Endpoint refs:

- use exactly one of `element` or `at`
- `side`: `auto`, `top`, `right`, `bottom`, `left`, `front`, `back`
- `offset`: normalized side offset from `-0.5` to `0.5`

`direction: route` means flow and directional markers follow `from`/`route[0]` toward `to`/last point. `direction: reverse` keeps geometry but reverses directional styling.

## Manual Routes

Use manual routes only when exact geometry matters:

```yaml
connections:
  - id: manual-flow
    route: [[1, 5], [3, 5], [3, 3], [5, 3]]
    end: arrow
```

Rules:

- Manual `route` must have at least two points.
- Hand-authored route coordinates are whole grid numbers.
- Use `from`/`to` instead of fractional manual routes for side midpoints.

## Style

```yaml
style:
  variant: line
  pattern: dashed
  stroke: "#111111"
  strokeWidth: 3
  opacity: 1
  dash: [12, 8]
```

Supported:

- `variant`: `line`, `road`
- `pattern`: `solid`, `dashed`, `dotted`
- `start`/`end`: `none`, `arrow`, `dot`, `circle`, `diamond`, `bar`
- `ambient: [{ name: flow }]` for dashed/dotted flow animation
- road paths may use `style.lane: center-dashed`

## Endpoint Removal Rule

Connections do not auto-disappear. If a scene removes an endpoint element, remove every present connection that references it in the same scene:

```yaml
- id: remove-cache
  remove:
    elements:
      - id: cache
    connections:
      - id: api-to-cache
```

Leaving a connection attached to a removed endpoint is invalid and should produce `CONNECTION_ENDPOINT_REMOVED`.

