# Capability: Rendering Engine

## Overview

The rendering engine consumes compiled scene data, builds the SVG DOM, places elements on a diamond-projected isometric grid, and manages depth sorting. It is responsible for translating element definitions into visible screen pixels. Parsing, validation, and compilation are dev-time responsibilities and are not shipped in the browser runtime.

## Architecture

The rendering engine operates in three phases:

```
Load → Build → Render
Data   DOM    Frame updates
```

### Phase 1: Load

The engine receives a `RuntimeBundle` or already-compiled scene data. It checks bundle format, version, digest, assets, and required runtime fields. It does not parse YAML and does not run the semantic validator.

### Phase 2: Build

The engine builds the SVG DOM from the scene definition:

1. Creates the root `<svg>` element with a viewport sized to fit the isometric grid.
2. Creates a `<g>` container for each layer, ordered by layer order (lowest first).
3. Builds generated connector paths from compiled connector states.
4. For each element, instantiates a URL-loaded image, a sprite viewport, or a
   built-in asset node and places it in the correct layer container.
5. Applies theme CSS variables to all elements and connectors.
6. Calculates initial screen positions using the isometric diamond projection formula.
7. Applies CSS classes for built-in entry/exit and ambient animations.

### Phase 3: Render

The engine updates element transforms, styles, and animation classes on each progress update from the controller:

1. Interpolates compiled scene snapshots based on current progress.
2. Detects lifecycle status changes between previous and current state.
3. Applies and plays entry animations on element addition.
4. Applies and plays exit animations on element removal; hides element after completion.
5. Updates ambient animation classes — adds new ones, removes obsolete ones.
6. Recomputes painter's-algorithm depth order for the current element
   positions and reconciles the depth group's DOM order; nodes whose relative
   order is unchanged are not moved.
7. Rebuilds or updates connector route paths and endpoint geometry.
8. Applies interpolated transforms (`translate`, `scale`) to each element's SVG.
9. Applies interpolated styles (opacity, color via CSS variables).
10. Triggers CSS transitions on changed properties for smooth animation.

## Depth Sorting

Depth sorting (painter's algorithm) is handled in two levels:

### Ground, Connectors, Objects, and Labels

The generated floor/grid renders first. Scene objects then render in one global
Ground connectors render after the floor and before scene objects. Scene objects
then render in one global perspective-sorted display list. Text labels render
above scene objects.

Semantic layers remain available as CSS classes and `data-layer` attributes, but
their declaration order must not override perspective depth for scene objects.

### Object Depth

Scene objects are sorted by `(x + y)` ascending, then by element `id` ascending
as a deterministic tie-breaker. Elements further back in the isometric view
render first. Elements closer to the viewer render later and can overlap farther
objects.

## Fit-To-Container Layout

The default renderer behavior is optimized for embedding in normal web layouts:

- root SVG uses `width="100%"`, `height="100%"`, `display: block`
- root SVG explicitly sets `preserveAspectRatio="xMidYMid meet"`
- root SVG viewBox is tight to projected scene bounds plus configured padding
- content is centered by default
- unavoidable whitespace comes only from aspect-ratio mismatch between the viewBox and mount target
- camera focus changes use the same SVG coordinate system as the initial
  viewBox and must be applied by updating the root SVG `viewBox`

The renderer must not hard-code a minimum `800×600` viewBox or use large fixed whitespace. A small scene should appear centered and usable in the container without page-specific CSS hacks.

Layout is resolved from the compiled scene's internal layout contract:

```ts
interface CompiledLayout {
  fit: 'contain' | 'none';
  align: [number, number];
  padding: { x: number; y: number };
  bounds: 'floor' | 'content' | 'union';
}
```

Authored YAML does not expose `header.layout`; the compiler chooses defaults
that keep the scene centered and tightly fitted.

Bounds include all element positions and sizes that can be visible in any compiled scene snapshot. For linear interpolation, endpoints are sufficient. Future non-linear path motion that can overshoot must extend the bounds contract before implementation.
Bounds also include every connector route point, expanded by the connector's
maximum stroke width, outline width, and endpoint size. When route interpolation
uses equal point counts, endpoints are sufficient for linear interpolation.

## Camera Bounds Helpers

The renderer owns the canonical helpers for camera bounds. Controller code must
call these helpers instead of duplicating projection math. The editor-support
API may wrap or re-export these helpers for editor overlay and hit-test use.

```ts
interface ViewBoxRect {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

function getResolvedViewBox(bundle: RuntimeBundle): ViewBoxRect;
function getCurrentElementBounds(svg: SVGSVGElement, id: string): ViewBoxRect | undefined;
function getGridAreaBounds(bundle: RuntimeBundle, area: CameraGridArea): ViewBoxRect;
function applySceneViewBox(svg: SVGSVGElement, viewBox: ViewBoxRect): void;
```

Rules:

- `getResolvedViewBox()` returns the full scene viewBox computed from layout.
- `getCurrentElementBounds()` uses the element's current rendered frame state,
  including interpolated `pos` and `size`, and returns `undefined` if the element
  id is unknown or currently `removed`.
- `getGridAreaBounds()` projects the four corners of `area` with the same
  projection, selected bounds, and padding used by floor grid rendering.
- `applySceneViewBox()` writes the root SVG `viewBox` attribute in
  `minX minY width height` order and updates any internal camera state needed
  for future animation starts.
- Helper outputs use SVG user units, not CSS pixels.
- Helper outputs must have `width >= 1` and `height >= 1`; collapsed targets are
  expanded symmetrically around their center.
- The helpers do not clamp target viewBoxes to the full scene viewBox.

Element camera bounds use the same formula as content bounds:

```text
anchorRaw = projectRaw(pos.x + size, pos.y + size)
screenX = anchorRaw.x - selectedBounds.minX + padding.x
screenY = anchorRaw.y - selectedBounds.minY + padding.y
visualSize = cellSize * size
anchor = bundle.assets[element.asset].anchor ?? [0.5, 1]
minX = screenX - visualSize * anchor.x
minY = screenY - visualSize * anchor.y
maxX = screenX + visualSize * (1 - anchor.x)
maxY = screenY + visualSize * (1 - anchor.y)
```

## Isometric Grid Projection

The isometric grid uses a **diamond projection** to map 2D grid coordinates to screen coordinates. Assets are pre-rendered 2D illustrations designed to look isometric from a fixed perspective angle.

### Projection Formula

```
rawX = cellSize * (x - y) * 0.5
rawY = cellSize * (x + y) * 0.25
```

Where:
- `(x, y)` are the grid coordinates from the element's `pos`.
- `cellSize` is the grid spacing unit (default 64px).
- `(rawX, rawY)` are uncentered projected coordinates in scene space.
- The layout step translates raw coordinates into the final viewBox using computed bounds and padding.

### Visual Result

```
        screenY
           ↑
           │
    ┌──────┼──────┐
    │ \    │    / │
    │  \   │   /  │
    │   \  │  /   │
    │    \ │ /    │
    │     ◆      │  ← Diamond-shaped grid cells
    │    / │ \    │
    │   /  │  \   │
    │  /   │   \  │
    │ /    │    \ │
    └──────┼──────┘
           │
           └──→ screenX
```

Each grid cell appears as a diamond on screen. The `(x, y)` grid position maps to a projected grid intersection, not to a rectangular asset corner. Elements are positioned using the resolved layout transform, not viewport-centered projection.

## Element Transform Pipeline

Each element's screen transform is computed as:

```
transform = translate(screenX, screenY) scale(screenSize / cellSize)
anchorGrid = [x + size, y + size]
assetCanvas = anchored so its declared asset anchor point is at anchorGrid
```

Where:
- `rawX` = `cellSize * (x - y) * 0.5`
- `rawY` = `cellSize * (x + y) * 0.25`
- `screenX` = `rawX - bounds.minX + paddingX`
- `screenY` = `rawY - bounds.minY + paddingY`
- `screenSize` = `cellSize * size`

The authored position is the top-left grid coordinate of the element footprint. For `pos: [x, y]` and `size: n`, the renderer projects `[x + n, y + n]` and places the asset's normalized anchor point on that projected footprint vertex. The default anchor is bottom-center `[0.5, 1]`. Imported asset catalogs may override it with `header.assets[].anchor` when the real visual ground contact is intentionally not centered in the square runtime asset viewport.

Content bounds must include the anchored asset canvas:

```
anchorRawX = projectRaw(x + size, y + size).rawX
anchorRawY = projectRaw(x + size, y + size).rawY
minX = anchorRawX - screenSize * anchorX
minY = anchorRawY - screenSize * anchorY
maxX = anchorRawX + screenSize * (1 - anchorX)
maxY = anchorRawY + screenSize * (1 - anchorY)
```

## Element Lifecycle DOM Management

### Element Instantiation

When an element is instantiated (first appearance or re-addition after removal):

1. Create a normalized SVG `<image>` node for URL-loaded assets, or a generated built-in node such as `asset: text`, `asset: rectangle`, `asset: circle`, `asset: polygon`, or `asset: line`.
2. Apply the scene's theme CSS variables (via `style.setProperty()` on the root SVG element).
3. Assign the element a unique CSS class (`iso-element-<id>`) for targeted styling.
4. Apply the element's initial transform (position + scale).
5. Append the element to its layer's `<g>` container.
6. Apply and play the entry animation (one-shot CSS animation).

For `asset: text`, the renderer must not call the asset resolver. It creates a `<text>` node with one `<tspan>` child per normalized line in `text.value`, assigns line strings through `textContent`, applies the validated text style attributes, and then follows the same transform, class, layer, lifecycle, and animation pipeline as every other element. Missing runtime text content is terminal `TEXT_CONTENT_MISSING`.

## Connector Rendering

Connectors are generated SVG nodes, not URL-loaded assets.

For each runtime connector state the renderer creates:

```text
<g class="iso-connector iso-connector-<id> ...">
  <path class="iso-connector-outline" />
  <path class="iso-connector-shaft" />
  <path class="iso-connector-lane" />
  <path|circle|polygon|line class="iso-connector-start" />
  <path|circle|polygon|line class="iso-connector-end" />
</g>
```

Only nodes required by the style and endpoints are created. For example,
`variant: line` with no outline creates no outline path, and `start: none`
creates no start indicator.

### Route Projection

The renderer projects each connector `route` point with the same `projectToRaw`
and layout translation used by floor grid points:

```text
screenPoint = projectToScreen(route[i].x, route[i].y)
d = M point0.x point0.y L point1.x point1.y ...
```

The shaft is one SVG `<path>` for the full route. The renderer must not create
one path per segment for dashed/dotted connectors because dash patterns would
restart at bends.

### Dash And Dot Styling

Dash arrays are fixed SVG user units:

| Pattern | Dash Array | Linecap |
|---|---|---|
| `solid` | none | `round` |
| `dashed` | compiled `style.dash` or `[12, 8]` | `round` |
| `dotted` | compiled `style.dash` or `[0, 8]` | `round` |

The renderer must not use `pathLength` to stretch the dash pattern to a fixed
count. Longer routes naturally show more repeated dashes/dots.

### Endpoint Geometry

Endpoint indicators are separate generated geometry. Directional endpoint
geometry is built in grid space and then projected, so arrowheads visually lie
on the same ground plane as the route instead of floating as screen-space
triangles.

- `arrow`: fixed-size filled ground-plane polygon oriented along the adjacent
  route segment. Default length is `0.35` cells and width is `0.28` cells. The
  tip sits on the route endpoint.
- `dot`: filled projected ground-plane diamond/circle approximation.
- `circle`: stroked projected ground-plane diamond/circle approximation.
- `diamond`: fixed-size projected ground-plane diamond.
- `bar`: projected ground-plane line perpendicular to the adjacent route
  segment.

Endpoint dimensions are defined in grid units and do not scale with route
length. The final route segment determines `end` orientation. The first route
segment determines `start` orientation. `direction` controls which way a
directional endpoint points: `route` points from `route[0]` to the final point;
`reverse` points from the final point toward `route[0]`.

### Road Variant

`variant: road` renders a thick ground path. The renderer creates an optional
white outline path, a road body path, and an optional center lane path when
`style.lane === 'center-dashed'`. Road joins and caps are round. Road connectors
render in the same ground connector bucket as line connectors.

### Connector CSS Hooks

Connector groups expose:

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

The shaft path exposes `.iso-connector-shaft`; page CSS may target that class for
custom animations. Built-in `ambient: [{ name: flow }]` applies a dash-offset
animation to `.iso-connector-shaft` for dashed and dotted connectors.

Flow direction must match the connector's effective direction:

- `direction: route`: dash offset animates from `route[0]` toward the final
  route point.
- `direction: reverse`: dash offset animates from the final route point toward
  `route[0]`.

The built-in flow animation must use one CSS variable for travel distance and
flip only the sign by direction class:

```css
.iso-connector-pattern-dashed .iso-connector-shaft,
.iso-connector-pattern-dotted .iso-connector-shaft {
  --iso-flow-distance: 20;
}

.iso-connector-direction-route .iso-connector-shaft.iso-ambient-flow {
  animation: iso-connector-flow-route 900ms linear infinite;
}

.iso-connector-direction-reverse .iso-connector-shaft.iso-ambient-flow {
  animation: iso-connector-flow-reverse 900ms linear infinite;
}
```

Custom CSS may replace the animation, but the runtime-owned class names and
direction classes remain the stable API.

### Entry Animation Handling

Entry animations are implemented as one-shot CSS animations on the element's SVG. The animation runs once and sets the element to its final interpolated position.

```css
.iso-entry-fade-in {
  animation: iso-fade-in 400ms ease-out forwards;
}

@keyframes iso-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

After the entry animation completes (`animationend` event), the element is fully active and controlled by the scroll-driven interpolation. The animation's `animation-fill-mode: forwards` ensures the element stays visible.

**Note:** The entry animation runs **independently** of scroll position. If an element enters at scroll 0.25, the entry animation plays immediately when the state transition is detected, while the element's position is already interpolated to the current scroll position.

### Exit Animation Handling

Exit animations are implemented as one-shot CSS animations on the element's SVG.

```css
.iso-exit-fade-out {
  animation: iso-fade-out 300ms ease-in forwards;
}

@keyframes iso-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

After the exit animation completes (`animationend` event), the element is hidden via `visibility: hidden` (not removed from DOM). `exiting` is the animated leave state; `removed` means hidden. When scrubbing backward before an element's add scene, the animation engine must emit `removed`; the controller plays the opposite exit animation for that element's entry animation before hiding the node. If the element re-adds later, the hidden element is unhidden and re-instantiated with its entry animation. When scrubbing backward from `exiting` into a visible state, the controller plays the opposite entry animation for that element's exit animation.

### Re-addition

When an element transitions from `removed` to `entering`:

1. If the element's SVG DOM node is still hidden, remove it from DOM.
2. Create a fresh URL-loaded asset image or generated built-in node.
3. Apply theme CSS variables.
4. Apply the entry animation.
5. Append to the correct layer container.

This ensures the entry animation plays on re-addition.

### Ambient Animation Class Management

Ambient animations are applied as CSS classes on the element. The engine compares the current state's ambient animation set with the previous state's set and updates classes accordingly.

```ts
// On state change:
const prevAmbient = new Set(prevAmbientAnimations);
const nextAmbient = new Set(nextAmbientAnimations);

// Remove animations no longer active
for (const name of prevAmbient) {
  if (!nextAmbient.has(name)) {
    element.classList.remove(`iso-ambient-${name}`);
  }
}

// Add new ambient animations
for (const {name} of nextAmbient) {
  if (!prevAmbient.has(name)) {
    element.classList.add(`iso-ambient-${name}`);
  }
}
```

Built-in ambient animations have corresponding CSS classes and keyframes:

```css
.iso-ambient-pulse {
  animation: iso-anim-pulse 2s ease-in-out infinite;
}

@keyframes iso-anim-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1.0; }
}
```

Custom ambient animations follow the same naming convention: `iso-ambient-<custom-name>`. The developer defines the corresponding `@keyframes` and animation properties in their CSS.

## Layer Styling and State Propagation

CSS applied to a layer propagates to all child elements. This enables collective state changes:

- **Opacity**: Fade an entire layer in/out.
- **Color**: Change CSS variables on the layer to recolor all elements.
- **Animation class**: Apply a CSS animation class to the layer to animate all elements.

```css
/* Fade entire layer */
.iso-layer-structures {
  opacity: 0.8;
}

/* Recolor layer */
.iso-layer-structures {
  --color-primary: #ff0000;
}
```

When a state change applies a CSS property or animation class to a layer, the rendering engine applies it to the layer's `<g>` container. The CSS inheritance chain propagates the style to all child elements.

## Asset Canvas Requirement

Assets should fill their own canvas — no padding, no empty margins. Normal URL
assets are rendered into a normalized square allocation with
`preserveAspectRatio="xMidYMax meet"`. Sprite assets are rendered as nested SVG
viewports whose `viewBox` is the compiled sprite rectangle and whose child
`<image>` uses the compiled sheet size. By default, the runtime aligns the
normalized bottom-center point `[0.5, 1]` to the projected footprint anchor.
Asset catalogs may declare `anchor: [x, y]` with normalized `0..1` viewport
coordinates to align imported visuals whose real ground contact is left or
right of center. The renderer does not infer anchors from SVG path geometry or
image pixels.

Assets are **pre-rendered 2D isometric illustrations** — drawn to look 3D from a single fixed perspective angle (the same angle used for the diamond grid projection). They are not true 3D objects; they are flat SVGs with shading, perspective, and depth cues that simulate isometric depth.

## Error Handling

The rendering engine throws:

- **`RenderError`**: When asset instantiation fails (malformed SVG, missing asset).
- **`RenderError`**: When theme variables cannot be applied (invalid CSS variable name).
- **`RenderError`**: When layer references are missing (element references undefined layer).
- **`RenderError`**: When runtime bundle format, version, or digest checks fail.
