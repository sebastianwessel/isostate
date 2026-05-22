# Capability: Camera Focus

## Overview

Camera focus lets presentation and slide-style flows direct attention to one
scene element or one authored grid area without changing scene geometry. The
runtime implements focus by changing the root SVG `viewBox`. It must not scale,
translate, or reorder element groups.

The feature has two public surfaces:

- Authored scene camera metadata: `scenes[].camera`.
- Runtime controller methods: `zoomToElement()`, `zoomToArea()`, and
  `resetZoom()`.

The word `camera` refers to data on scene stops. The word `zoom` refers to
controller actions that animate the SVG camera.

## Non-Goals

- No Three.js or CSS 3D transforms.
- No browser-side YAML parsing, validation, or compilation.
- No automatic object highlighting, dimming, masking, callouts, or labels.
- No connector target support in this version.
- No per-axis camera rotation or perspective changes.

## Authored DSL

Each scene step may declare at most one `camera` object:

```yaml
scenes:
  - id: initial
    elements: []
    camera:
      target:
        area:
          at: [0, 0]
          size: [6, 4]

  - id: focus-api
    update:
      elements:
        - id: api
          ambient:
            - name: pulse
    camera:
      target:
        element: api
      padding: 32
      duration: 600
      easing: ease-in-out

  - id: overview-again
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

### Camera Shape

```ts
interface CameraFocus {
  target: CameraTarget;
  padding?: number;
  duration?: number;
  easing?: CameraEasing;
}

type CameraTarget =
  | { element: string }
  | { area: CameraGridArea }
  | { reset: true };

interface CameraGridArea {
  at: [number, number];
  size: [number, number];
}

type CameraEasing = 'linear' | 'ease-in-out' | 'ease-out';
```

Validation rules:

- `camera` is allowed on the first scene and on later delta scenes.
- `camera.target` is required.
- `camera.target` must contain exactly one of `element`, `area`, or `reset`.
- `target.element` must reference an element that is present, entering, or
  exiting in the resolved scene snapshot for the same scene stop. It must not
  reference an element whose resolved presence is `removed`.
- `target.element` must reference an element id, not a connector id.
- `target.area.at` must be a two-number tuple with finite values `>= 0`.
- `target.area.size` must be a two-number tuple with finite positive values.
- Hand-authored area coordinates and sizes use whole grid cells.
- `target.reset` must be the boolean literal `true`. It means "return to the
  compiled full scene viewBox".
- `padding`, when omitted, defaults to `32` SVG user units.
- `padding` must be a finite number `>= 0` and `<= 2048`.
- `padding` must be omitted when `target.reset: true`; reset targets use the
  exact compiled full scene viewBox without extra padding.
- `duration`, when omitted, defaults to the active controller
  `transitionDuration`.
- `duration` must be a finite integer number of milliseconds `>= 0` and
  `<= 10000`.
- `easing`, when omitted, defaults to the active controller
  `transitionEasing`.
- `easing` must be `linear`, `ease-in-out`, or `ease-out`.
- Unknown camera fields produce `UNKNOWN_FIELD`.

## Runtime Bundle

The compiler emits camera metadata on the matching `RuntimeSceneStop`:

```ts
interface RuntimeSceneStop {
  id: string;
  progress: number;
  elements: RuntimeElementState[];
  connectors: RuntimeConnectorState[];
  camera?: RuntimeCameraFocus;
}

interface RuntimeCameraFocus {
  target: RuntimeCameraTarget;
  padding?: number;
  duration?: number;
  easing?: CameraEasing;
}

type RuntimeCameraTarget =
  | { type: 'element'; id: string }
  | { type: 'area'; at: [number, number]; size: [number, number] }
  | { type: 'reset' };
```

Compiler rules:

- The compiler normalizes authored `{ element: id }` to
  `{ type: 'element', id }`.
- The compiler normalizes authored `{ area: { at, size } }` to
  `{ type: 'area', at, size }`.
- The compiler normalizes authored `{ reset: true }` to `{ type: 'reset' }`.
- The compiler emits the resolved numeric `padding` for `element` and `area`
  targets.
- The compiler omits `padding` for `reset` targets.
- The compiler emits `duration` only when authored.
- The compiler emits `easing` only when authored.
- Camera metadata is data-only. It must not contain preprojected pixel
  coordinates, DOM ids, CSS selectors, or callback code.
- Camera metadata participates in canonical bundle digest generation.

## Effective Camera Timeline

Camera focus is part of the normalized scene-progress timeline. This makes
scroll down/up and forward/backward playback deterministic.

The controller resolves an effective camera state for every runtime scene stop:

1. The implicit camera before the first stop is `{ type: 'reset' }`.
2. If a scene stop has `camera`, that camera becomes the effective camera for
   that stop.
3. If a scene stop omits `camera`, it inherits the previous effective camera.

Examples:

| Scene | Authored Camera | Effective Camera |
|---|---|---|
| `scene-1` | omitted | reset/full scene |
| `scene-2` | omitted | reset/full scene |
| `scene-3` | `element: api` | focus `api` |
| `scene-4` | omitted | focus `api` |
| `scene-5` | omitted | focus `api` |
| `scene-6` | `reset: true` | reset/full scene |

For progress between two adjacent scene stops, the controller resolves the
previous stop's effective camera viewBox and the next stop's effective camera
viewBox, then interpolates `minX`, `minY`, `width`, and `height`:

```text
segmentT = (progress - previous.progress) / (next.progress - previous.progress)
cameraT = easingForSegment(segmentT)
viewBox = lerp(previousEffectiveViewBox, nextEffectiveViewBox, cameraT)
```

This formula is symmetric. Scrolling upward or playing backward through the same
progress range must produce the same viewBox values in reverse order. The
controller must not use one-shot camera animations for scroll-driven or direct
`setProgress()` updates.

Segment easing rules:

- If the next scene stop authored `camera.easing`, use that easing for the
  segment ending at that stop.
- Otherwise use `linear` for scroll-driven and direct `setProgress()` camera
  interpolation.
- `camera.duration` is ignored for scroll-driven and direct `setProgress()`
  interpolation because scroll position is the clock.

Segment duration rules:

- `camera.duration` applies only to discrete presentation navigation methods
  (`nextScene()`, `prevScene()`, `setSceneIndex()`) when the destination scene
  stop authored `camera`.
- During presentation navigation, progress and camera remain synchronized by
  deriving camera viewBox from the animated progress value whenever possible.
- If an implementation uses a separate camera RAF for an authored destination
  camera, it must cancel it on any scroll event, `setProgress()` call, or
  opposite navigation command and immediately rejoin the progress-derived camera
  timeline.
- Scenes that inherit camera metadata do not inherit `duration`; inherited
  camera state is a target state only.

## Runtime Controller API

```ts
interface CameraZoomOptions {
  padding?: number;
  duration?: number;
  easing?: CameraEasing;
}

interface CameraGridArea {
  at: [number, number];
  size: [number, number];
}

interface AnimationController {
  zoomToElement(id: string, options?: CameraZoomOptions): void;
  zoomToArea(area: CameraGridArea, options?: CameraZoomOptions): void;
  resetZoom(options?: CameraZoomOptions): void;
  getCameraState(): CameraState;
}

interface CameraState {
  viewBox: { minX: number; minY: number; width: number; height: number };
  target?: RuntimeCameraTarget;
  isZoomed: boolean;
}
```

Method semantics:

- `zoomToElement(id)` focuses the element's current frame bounds. If the
  controller has a pending progress frame, it first applies that frame before
  resolving bounds.
- `zoomToArea(area)` focuses the projected bounds of the grid area.
- `resetZoom()` animates back to the full scene viewBox computed from the
  bundle layout.
- `getCameraState()` returns a defensive copy of the current camera state.
- All zoom methods throw `CONTROLLER_DESTROYED` after `destroy()`.
- All zoom methods require an initialized bundle and scene SVG. Missing runtime
  resources throw `CAMERA_NOT_INITIALIZED`.
- Calling a zoom method cancels any in-flight camera animation and starts the
  new one from the current SVG viewBox.
- `duration: 0` applies the destination viewBox synchronously.
- Direct camera API animations use `requestAnimationFrame`; they do not call the
  animation engine and do not change scene progress.
- The next scroll, `setProgress()`, `nextScene()`, `prevScene()`, or
  `setSceneIndex()` call cancels a direct camera API animation and returns the
  camera to the progress-derived effective camera timeline.
- `pause()` pauses progress and ambient animations only. It does not pause or
  cancel an in-flight camera animation.
- `destroy()` cancels any pending camera animation.

## Scene Navigation Integration

When scroll or explicit progress lands between scene stops, the controller
applies the interpolated effective camera viewBox for that progress.

When `nextScene()`, `prevScene()`, or `setSceneIndex()` changes progress, the
controller applies camera focus through the same effective camera timeline used
by scroll. This guarantees forward and backward scene navigation follows the
same camera path as scroll.

Ordering:

1. The controller emits `scene-change`.
2. The controller starts the configured progress transition.
3. Every progress frame resolves and applies the effective camera viewBox for
   that progress.

If the destination scene has no `camera`, navigation leaves the current camera
target unchanged because it inherits the previous effective camera. A scene that
should return to the full compiled view must author `camera.target.reset: true`;
application code can call `resetZoom()` for the same behavior outside the
authored timeline.

## Bounds Math

All camera target bounds are computed in the same SVG user coordinate system as
the root SVG `viewBox`.

### Element Bounds

Element focus uses the resolved element state for the active frame:

```text
anchorGrid = [pos.x + size, pos.y + size]
anchorRaw = projectToRaw(anchorGrid.x, anchorGrid.y, cellSize)
screenX = anchorRaw.x - selectedBounds.minX + layout.padding.x
screenY = anchorRaw.y - selectedBounds.minY + layout.padding.y
visualSize = cellSize * size
anchor = bundle.assets[element.asset].anchor ?? [0.5, 1]

minX = screenX - visualSize * anchor.x
minY = screenY - visualSize * anchor.y
maxX = screenX + visualSize * (1 - anchor.x)
maxY = screenY + visualSize * (1 - anchor.y)
```

Generated text and primitive elements use the same bounds formula. This version
does not measure rendered text glyph extents.

### Grid Area Bounds

Area focus projects all four corners of the grid rectangle:

```text
[x, y] = area.at
[w, h] = area.size
corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]
```

Each corner is projected with the normal diamond projection and layout
translation. The target bounds are the min/max screen coordinates of those four
projected points.

### Padding And Minimum Size

After resolving target bounds, the runtime applies padding:

```text
minX = target.minX - padding
minY = target.minY - padding
maxX = target.maxX + padding
maxY = target.maxY + padding
```

The final width and height must each be at least `1` SVG user unit. If the
target bounds collapse to a line or point, the runtime expands them symmetrically
around the center to satisfy the minimum.

The runtime does not clamp camera viewBoxes to the full scene viewBox. Padding
near the edge may intentionally show empty space outside the full scene bounds.

### Reset Bounds

Reset focus uses the full scene viewBox computed from the bundle layout. It is
the same destination as runtime `resetZoom()`. Reset focus does not apply
padding and does not inspect scene elements.

## Events

The controller emits camera events:

```ts
interface ControllerEvents {
  'camera-change': (state: CameraState) => void;
}
```

`camera-change` fires once for a synchronous camera change and once per
animation frame during animated camera changes. Event listeners follow the same
error isolation rule as existing controller events.

## Errors

| Code | When |
|---|---|
| `INVALID_CAMERA_TARGET` | Authored camera target or runtime zoom target shape is invalid. |
| `CAMERA_TARGET_NOT_FOUND` | Target element id does not exist in the relevant resolved scene/frame. |
| `CAMERA_TARGET_NOT_VISIBLE` | Target element exists but is `removed` in the relevant resolved scene/frame. |
| `INVALID_CAMERA_OPTIONS` | Padding, duration, easing, or area dimensions are invalid. |
| `CAMERA_NOT_INITIALIZED` | Runtime zoom is called before controller init or without an SVG scene. |

Validator failures use the same code strings in `ValidationReport`.
Controller failures throw `ControllerError`.

## Verification Requirements

Implementation must include focused tests for:

- parser accepts valid `scene.camera` and rejects unknown camera fields;
- validator rejects missing targets, dual targets, absent element targets,
  removed element targets, invalid areas, reset targets with padding, invalid
  padding, invalid duration, and invalid easing;
- compiler emits normalized `RuntimeCameraFocus` and includes camera metadata in
  digest input;
- runtime bundle type tests cover optional `scene.camera`;
- renderer helper tests cover element bounds and grid area bounds using the
  exact projection formulas above;
- controller API tests cover `zoomToElement`, `zoomToArea`, `resetZoom`,
  cancellation, `duration: 0`, default option resolution, `camera-change`, and
  destroy cleanup;
- scene navigation tests cover automatic camera application on destination
  scenes, explicit `target.reset` zoom-out, inherited camera state for omitted
  camera stops, scroll interpolation between adjacent effective camera stops,
  reverse scroll/playback symmetry, cancellation of direct camera animations by
  progress updates, and no automatic reset when a destination scene omits camera
  metadata;
- docs examples compile and generated demo bundles are regenerated when example
  YAML adopts camera metadata.
