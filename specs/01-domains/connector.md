# Domain: Connectors

## Overview

Connectors are first-class authored scene objects for ground-plane routes such as
request flows, dependency lines, arrows, and road-like paths. They are generated
SVG geometry, not imported SVG assets. This keeps dash/dot patterns stable,
keeps arrowheads proportional, and avoids stretching arrow assets across long
routes.

Connectors are not logical graph edges. They represent visible route geometry
only. Authors may either provide explicit grid route points or provide visual
endpoint references (`from`/`to`) that the dev-time compiler resolves into
route points. The runtime always receives concrete route geometry and never
infers routes from graph semantics.

## Public DSL Naming

The public YAML DSL uses **connections** because authors describe a visible
connection between things. The rendering/runtime internals use **connectors**
because the engine renders generated connector geometry. Implementation agents
must not expose `addConnectors`, `updateConnectors`, or `removeConnectors` in
authored YAML.

## Authoring Shape

```ts
type ConnectorPattern = 'solid' | 'dashed' | 'dotted';
type ConnectorVariant = 'line' | 'road';
type ConnectorEndpoint = 'none' | 'arrow' | 'dot' | 'circle' | 'diamond' | 'bar';
type ConnectorDirection = 'route' | 'reverse';

interface ConnectorStyle {
  variant?: ConnectorVariant;
  pattern?: ConnectorPattern;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  dash?: [number, number];
  outline?: string;
  outlineWidth?: number;
  lane?: 'none' | 'center-dashed';
}

interface ConnectorEndpointRef {
  element?: string;
  at?: [number, number];
  side?: 'auto' | 'top' | 'right' | 'bottom' | 'left' | 'front' | 'back';
  offset?: number;
}

interface ConnectorRouting {
  mode?: 'straight' | 'orthogonal' | 'manual';
  avoid?: 'objects' | 'none' | string[];
  clearance?: number;
  gridStep?: number;
  maxBends?: number;
  prefer?: 'direct' | 'fewest-bends' | 'shortest';
}

interface ConnectionPlacement {
  id: string;
  route?: [number, number][];
  from?: ConnectorEndpointRef;
  to?: ConnectorEndpointRef;
  routing?: ConnectorRouting;
  layer?: string;
  style?: ConnectorStyle;
  start?: ConnectorEndpoint;
  end?: ConnectorEndpoint;
  direction?: ConnectorDirection;
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
}

interface ConnectionPatch {
  id: string;
  route?: [number, number][];
  from?: ConnectorEndpointRef;
  to?: ConnectorEndpointRef;
  routing?: ConnectorRouting;
  layer?: string;
  style?: ConnectorStyle;
  start?: ConnectorEndpoint;
  end?: ConnectorEndpoint;
  direction?: ConnectorDirection;
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
}

interface ConnectionRemoval {
  id: string;
  exit?: ExitAnimation;
}
```

## Defaults

| Field | Default |
|---|---|
| `layer` | first layer named `connectors`, otherwise `ground`, otherwise first layer |
| `style.variant` | `line` |
| `style.pattern` | `solid` |
| `style.stroke` | `#2563eb` |
| `style.strokeWidth` | `3` for `line`, `14` for `road` |
| `style.opacity` | `1` |
| `style.dash` | derived from `pattern` |
| `style.outline` | `#ffffff` for `road`, omitted for `line` |
| `style.outlineWidth` | `2` for `road`, `0` for `line` |
| `style.lane` | `none` |
| `start` | `none` |
| `end` | `arrow` |
| `direction` | `route` |
| `enter` | `fade-in` |
| `exit` | `fade-out` |

Default dash arrays are fixed SVG user units, not normalized to route length:

| Pattern | Dash Array | Stroke Linecap |
|---|---|---|
| `solid` | none | `round` |
| `dashed` | `[12, 8]` | `round` |
| `dotted` | `[0, 8]` | `round` |

This means a longer connector shows more dashes/dots rather than stretched
dashes/dots.

## Route Semantics

`route` is an ordered list of ground-plane grid intersection points. It must
contain at least two points. Points are projected with the same diamond
projection as elements.

Human-authored `.isostate.yaml` route points must use whole grid coordinates.
Each manual route segment must change only one grid axis at a time. Segments
where both `x` and `y` change are invalid because they project to
screen-horizontal or screen-vertical shortcuts instead of the two visible
isometric ground directions.
Authors should use `from`/`to` when a connector needs to attach to the midpoint
of an object side. The compiler may emit fractional runtime route points for
derived side ports, but those fractions are compiled output, not the preferred
hand-authored syntax.

Instead of `route`, authors may provide `from` and `to` endpoint refs. In that
case dev-time routing computes the concrete `route` before runtime bundle
emission. The browser runtime never computes routes.

The route order defines the natural flow direction. `direction: reverse` keeps
the visible geometry in the same place but reverses directional styling,
including animated dash movement and endpoint orientation.

## Endpoint Geometry

Endpoint indicators are generated as separate SVG geometry, never as SVG
markers and never as part of the shaft path.

- `arrow` uses a fixed-size ground-plane polygon oriented along the first or
  last route segment, then projected with the same diamond projection as the
  route.
- `dot` and `circle` use fixed-size ground-plane diamonds approximating a
  projected circular contact. `dot` is filled; `circle` is open.
- `diamond` uses a fixed-size ground-plane diamond.
- `bar` uses a fixed-size ground-plane line perpendicular to the route segment.

Endpoint size is measured in grid units and is independent of route length.
Arrowheads must not scale when a route gets longer. The default arrowhead is
`0.35` cells long and `0.28` cells wide, centered on the route endpoint. The
arrow tip sits exactly on the route endpoint and points in the effective
connector direction.

## Line And Road Variants

`variant: line` renders a single stroked shaft path plus optional endpoints.

`variant: road` renders a road-like ground path:

1. Optional outline path, wider than the road body.
2. Road body path with round joins and caps.
3. Optional `lane: center-dashed` path using a short dashed white center line.
4. Optional endpoint indicators.

Road connectors are still connectors, not assets. They participate in connector
lifecycle, route interpolation, bounds, and CSS class behavior.

## CSS Classes And Animation Hooks

Every connector root must expose stable CSS hooks:

```text
.iso-connector
.iso-connector-<id>
.iso-connector-variant-line | .iso-connector-variant-road
.iso-connector-pattern-solid | .iso-connector-pattern-dashed | .iso-connector-pattern-dotted
.iso-connector-direction-route | .iso-connector-direction-reverse
.iso-layer-<layer>
[data-id="<id>"]
[data-layer="<layer>"]
```

Generated child nodes must expose:

```text
.iso-connector-outline
.iso-connector-shaft
.iso-connector-lane
.iso-connector-start
.iso-connector-end
```

Ambient animation `flow` is reserved for connector dash movement. When a
connector has `ambient: [{ name: flow }]` and `pattern` is `dashed` or `dotted`,
the runtime applies a CSS animation to `.iso-connector-shaft`. The dash offset
direction must match the connector's effective direction:

- `direction: route`: movement travels from `route[0]` toward the last point.
- `direction: reverse`: movement travels from the last point toward `route[0]`.

If both endpoints are arrows, `direction` remains the source of truth for flow
animation. If no endpoint is an arrow, `direction` still controls animation.

## Auto Routing

Auto-routed connectors use `from`, `to`, and optional `routing`:

```yaml
- id: request-flow
  from:
    element: client
    side: auto
  to:
    element: api
    side: auto
  routing:
    mode: orthogonal
    avoid: objects
    clearance: 1
```

See `specs/02-capabilities/rendering/connector-routing.md` for endpoint ports,
obstacle avoidance, routing algorithms, package strategy, and blocked-route
behavior.

## Endpoint Lifecycle

Connections do not auto-remove themselves. A connection with `from.element` or
`to.element` may exist only while both referenced elements are present, or while
the endpoint element and the connection are both exiting in the same scene. If a
scene removes an endpoint element, that scene must also remove every present
connection that references the element.

The compiler must reject a dangling endpoint with `CONNECTION_ENDPOINT_REMOVED`.
This keeps lifecycle behavior explicit and avoids hidden cascades that would make
scene deltas harder to review.

## Depth And Layering

Connectors render on the ground plane. The default render bucket is:

1. generated floor
2. ground connectors
3. perspective-sorted scene elements
4. text labels

`layer` is still preserved as a CSS class and `data-layer` for styling and
selection, but it does not make a connector participate in object depth sorting.
Future overlay connectors require a separate explicit contract and are out of
scope for this primitive.
