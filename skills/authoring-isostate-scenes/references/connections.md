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
  outline: "#ffffff"
  outlineWidth: 2
```

Supported:

- `variant`: `line`, `road`, `beam`
- `pattern`: `solid`, `dashed`, `dotted`
- `start`/`end`: `none`, `arrow`, `dot`, `circle`, `diamond`, `bar`
- `ambient: [{ name: flow }]` for dashed/dotted flow animation
- road paths may use `style.lane: center-dashed`
- `outline`/`outlineWidth`: draw a casing behind the connector shaft —
  `outline` is the casing color (defaults to `stroke` when unset, same color
  rules as `stroke`) and `outlineWidth` is the extra width added on each side
  of `strokeWidth`. `road` variant defaults to `outline: "#ffffff"`,
  `outlineWidth: 2`; `line` variant has no outline by default. `outlineWidth`
  must be a positive finite number when set.

## Animation And Camera

Use scene deltas for animation. Do not write keyframes.

- Move elements by updating `at`.
- Keep the same id when an object travels through a process. Endpoint-based
  routes follow its interpolated position; preview intermediate progress in
  both directions, not only the scene snapshots.
- Scale existing elements by updating `size`; `size: 0` is update-only.
- Animate connection flow with `ambient: [{ name: flow }]`.
- Use `enter`/`exit` for meaningful add/remove transitions.
- Use scene `camera` metadata when the narrative should zoom to an element or
  grid area. Stops without camera metadata inherit the previous camera focus;
  use `target.reset: true` to return to the full compiled view.

The host decides how readers navigate. `controller.setSceneIndex(index)`,
`nextScene()`, and `prevScene()` animate between stops; `setProgress(progress)`
is an exact seek for scroll and slider input and interrupts ongoing navigation.
Use `transitionDuration: 0` for reduced-motion step navigation. Pause controls
must pause the controller, including generated message and activity motion.

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

## Rounded Beams And Message Traffic

Use `style.variant: beam` for a dimensional generated SVG track. Set
`cornerRadius` in projected SVG units (`>= 0`, default `0`); `glow` is an optional
safe CSS color and `glowWidth` is positive (default `8`). Keep coordinates and
raster objects on the whole-cell grid; never stretch arrows or message images.

```yaml
style: { variant: beam, cornerRadius: 12, stroke: "#15997e", glow: "#63d9ba" }
message: { kind: envelope, color: "#ecfff7", size: 10, duration: 2200, count: 1 }
```

Message kinds are `packet`, `orb`, and `envelope`. Defaults: packet, size 10,
duration 1800 ms, count 1, enabled true. Valid size is 2..32 SVG units, duration
200..30000 ms, count integer 1..4. Motion follows the actual rounded route and
`direction`. Reduced motion is static; controller pause freezes motion.

Use messages selectively on the current handoff; most connections should be
quiet. Later stops must explicitly set `message: { enabled: false }` when a
stream should end. A supplied message replaces the entire previous object;
omitted members reset to defaults. Omitting message retains previous values.
