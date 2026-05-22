# Flow: Controller-Driven Runtime

## Actor

Application developer embedding an animated scene.

## Trigger Sources

- Scroll container movement
- Explicit `setProgress(progress)` API calls
- `nextScene()` / `prevScene()` navigation
- `zoomToElement()` / `zoomToArea()` / `resetZoom()` camera calls
- Keyboard controls when enabled
- Touch controls when enabled

## State Owned by Controller

| State | Description |
|---|---|
| `sceneIndex` | Current scene in the initialized scene list. |
| `progress` | Normalized active scene progress in `[0, 1]`. |
| `paused` | Whether progress updates are ignored and ambient animations are paused. |
| `pendingFrame` | RAF handle for batched progress update. |
| `cameraState` | Current SVG viewBox, current focus target if any, and whether the camera is zoomed away from the full scene viewBox. |
| `pendingCameraFrame` | RAF handle for animated viewBox transitions. |
| `effectiveCameraStops` | Per-scene camera targets after applying inheritance from previous authored camera stops. |

## Happy Path: Scroll

1. `init()` receives a `RuntimeBundle`, optional runtime resources, and `ControllerConfig`.
2. Controller validates scene list and scroll config.
3. If `container` exists, controller adds a passive scroll listener.
4. Scroll listener reads only `scrollTop` or `scrollLeft`.
5. Controller maps scroll position to progress with configured offsets and min/max bounds.
6. Controller batches the latest progress into one `requestAnimationFrame`.
7. Controller forwards progress to the engine.
8. Controller resolves the effective camera viewBox for the same progress and
   applies it to the root SVG.
9. Controller emits `progress-change` and `camera-change` when the viewBox
   changed.

Camera during scroll is progress-derived. The controller must not start a
time-based camera animation while scroll is the trigger source.

## Happy Path: Presentation Mode

1. `init()` receives a `RuntimeBundle` without a scroll container.
2. External code calls `setProgress()`, `nextScene()`, or `prevScene()`.
3. Controller clamps navigation to valid scene indices with wraparound for next/previous.
4. Controller moves progress to the destination scene stop, either instantly or through the configured transition duration/easing.
5. Controller emits `scene-change` and forwards the active scene/progress to the engine.
6. Each progress frame resolves the effective camera viewBox for that progress
   and applies it to the root SVG. Forward and backward navigation use the same
   camera interpolation as scroll.

## Happy Path: Direct Camera Focus

1. External code calls `zoomToElement(id)`, `zoomToArea(area)`, or
   `resetZoom()`.
2. Controller validates initialization, SVG availability, target, and options.
3. Controller cancels any pending camera RAF.
4. Controller resolves the destination viewBox using renderer-owned bounds
   helpers.
5. Controller animates the root SVG `viewBox` from the current viewBox to the
   destination viewBox, or applies it synchronously when `duration: 0`.
6. Controller updates `cameraState` and emits `camera-change` for each applied
   viewBox.
7. The next scroll, `setProgress()`, or scene navigation call cancels this
   direct camera override and rejoins the authored effective camera timeline.

## Pause and Resume

- `pause()` sets `paused = true`, cancels pending progress forwarding, calls `engine.pause()`, and emits `paused`.
- `resume()` sets `paused = false`, calls `engine.resume()`, schedules one frame at current progress, and emits `resumed`.
- While paused, `setProgress()` updates stored progress but does not forward to the engine until resume.
- Camera transitions continue while paused because camera focus is not animation
  engine progress and does not change ambient animation play state.

## Failure Paths

| Failure | Result |
|---|---|
| `init([])` | throw `CONTROLLER_NO_SCENES` |
| invalid scene index in `setSceneIndex()` | throw `CONTROLLER_SCENE_INDEX_OUT_OF_RANGE` |
| invalid container object | throw `DSL_SCHEMA_TYPE_ERROR` |
| `minProgress > maxProgress` | throw `DSL_SCHEMA_TYPE_ERROR` |
| destroyed controller receives API call | throw `CONTROLLER_DESTROYED` |
| zoom before controller init or without scene SVG | throw `CAMERA_NOT_INITIALIZED` |
| `zoomToElement()` unknown id | throw `CAMERA_TARGET_NOT_FOUND` |
| `zoomToElement()` currently removed id | throw `CAMERA_TARGET_NOT_VISIBLE` |
| invalid camera area or options | throw `INVALID_CAMERA_OPTIONS` |

## Cancellation and Cleanup

`destroy()`:

- removes scroll, keyboard, and touch listeners;
- cancels pending RAF;
- cancels pending camera RAF;
- clears event subscribers;
- calls `engine.destroy()` only when the controller created/owns the engine. If the caller provided the engine, ownership remains with the caller.

## Events

```ts
type ControllerEvent =
  | { type: 'progress-change'; progress: number }
  | { type: 'scene-change'; index: number }
  | { type: 'camera-change'; state: CameraState }
  | { type: 'paused' }
  | { type: 'resumed' };
```

Event callbacks must not block rendering. If a callback throws, the controller catches it, schedules a microtask to rethrow in development builds, and continues processing other callbacks.
