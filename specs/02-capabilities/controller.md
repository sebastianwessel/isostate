# Capability: Animation Controller

## Overview

The animation controller provides a decoupled interface between scroll/trigger logic and the animation engine. It manages the current scene state and scroll progress as a single source of truth, exposing high-level navigation methods that abstract away raw scroll position manipulation. This enables both scroll-driven and presentation-style workflows (next/prev/pause/resume) without modifying the rendering engine.

## Architecture

The controller sits between external triggers and the animation engine:

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Triggers   │────>│  Controller  │────>│ Animation    │
│  (scroll,   │     │  (state mgmt)│     │  Engine      │
│   buttons,  │     └──────────────┘     └──────────────┘
│   API)      │            │                    │
└─────────────┘            │                    │
                           ▼                    ▼
                    ┌──────────────┐     ┌──────────────┐
                    │  Scene       │     │  SVG DOM     │
                    │  State       │     │  Updates     │
                    └──────────────┘     └──────────────┘
```

The controller:
- Maintains the current `progress` (0–1) and `currentScene` index.
- Accepts passive state updates from any trigger source.
- Interpolates between scene states based on scroll progress.
- Emits state change events for debugging and integration.

The animation engine:
- Receives only normalized `progress` updates and compiled scene stops.
- Does not know about scroll events, buttons, or presentation logic.
- Updates the SVG DOM based solely on the progress value.

## Controller API

```ts
interface AnimationController {
  /** Initialize controller with a compiled runtime bundle and scroll configuration */
  init(bundle: RuntimeBundle, config: ControllerConfig): void;

  /** Set scroll progress and trigger frame update (0–1, clamped) */
  setProgress(progress: number): void;

  /** Get current scroll progress */
  getProgress(): number;

  /** Navigate to next scene and move progress to that scene stop */
  nextScene(): void;

  /** Navigate to previous scene and move progress to that scene stop */
  prevScene(): void;

  /** Get current scene index */
  getSceneIndex(): number;

  /** Set scene index directly */
  setSceneIndex(index: number): void;

  /** Pause all animations (freezes current frame) */
  pause(): void;

  /** Resume from paused state (continues from current progress) */
  resume(): void;

  /** Check if controller is paused */
  isPaused(): boolean;

  /** Destroy controller and clean up listeners */
  destroy(): void;
}
```

## Controller Configuration

```ts
interface ControllerConfig {
  /** Scroll container element (optional; omit for non-scroll usage) */
  container?: HTMLElement;
  /** Exact SVG scene to update; mountScene supplies this automatically */
  sceneElement?: SVGSVGElement;
  /** Scroll direction ('vertical' | 'horizontal', default: 'vertical') */
  scrollDirection?: 'vertical' | 'horizontal';
  /** Scroll offset from container edges */
  scrollOffset?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  /** Minimum scroll progress threshold (0–1), default: 0 */
  minProgress?: number;
  /** Maximum scroll progress threshold (0–1), default: 1 */
  maxProgress?: number;
  /** Enable keyboard navigation (arrow keys, space for next/prev) */
  keyboardControls?: boolean;
  /** Enable touch swipe navigation */
  touchControls?: boolean;
  /** Scroll sensitivity multiplier (default: 1.0) */
  scrollSensitivity?: number;
  /** Animation transition duration for next/prev scene (ms, default: 600) */
  transitionDuration?: number;
  /** Easing for next/prev scene transitions */
  transitionEasing?: 'linear' | 'ease-in-out' | 'ease-out';
}
```

## Scroll Integration

When `container` is provided, the controller binds to scroll events on the container and maps scroll position to normalized progress (0–1). This uses the same logic as the scroll capability but is internal to the controller.

```ts
// Scroll → progress mapping
const minScroll = direction === 'horizontal' ? offset.left ?? 0 : offset.top ?? 0;
const maxScroll = direction === 'horizontal'
  ? container.scrollWidth - container.clientWidth - (offset.right ?? 0)
  : container.scrollHeight - container.clientHeight - (offset.bottom ?? 0);
const progress = clamp((currentScroll - minScroll) / (maxScroll - minScroll), 0, 1);
```

Scroll events are debounced to the browser's `requestAnimationFrame` cycle. Only `scrollY`/`scrollX` (GPU-composited properties) are read.

## Scene Navigation

### nextScene()

Increments the current scene index by 1. If the current scene is the last scene, the index wraps to 0. Progress moves to the destination scene stop progress.

### prevScene()

Decrements the current scene index by 1. If the current scene is the first scene, the index wraps to the last scene. Progress moves to the destination scene stop progress.

### Transition Animation

When navigating scenes (not via scroll), the controller can animate the progress change over `transitionDuration` ms using the specified easing. This creates a smooth transition effect between scenes.

If `transitionDuration` is `0`, the transition is instant.

## Pause / Resume

### pause()

Freezes the current frame. The animation engine stops processing progress updates. Elements remain in their current visual state. Ambient animations stop (via CSS `animation-play-state: paused` on all ambient animation classes).

### resume()

Restores animation processing. Ambient animations resume from their current frame (CSS `animation-play-state: running`). Scroll tracking resumes if a container is configured.

### isPaused()

Returns `true` if the controller is in the paused state.

## State Events

The controller emits the following events for integration and debugging:

```ts
interface ControllerEvents {
  /** Fired when scroll progress changes */
  'progress-change': (progress: number) => void;

  /** Fired when scene index changes */
  'scene-change': (index: number) => void;

  /** Fired when controller is paused */
  'paused': () => void;

  /** Fired when controller is resumed */
  'resumed': () => void;
}
```

## Non-Scroll Usage

When `container` is omitted from `ControllerConfig`, the controller operates in pure presentation mode. All progress changes come from explicit `setProgress()` calls or scene navigation (`nextScene()` / `prevScene()`). This is the intended mode for:

- Slide decks
- Interactive presentations
- Auto-playing animations
- API-controlled animations (e.g., triggered by user actions other than scroll)

## Integration Example

### Scroll-Driven Mode

```ts
const controller = new AnimationController();
controller.init(scenes, { container: document.querySelector('#scroll-container') });

// Controller automatically tracks scroll and feeds progress to animation engine
controller.setProgress(0.5); // or let scroll drive it
```

### Presentation Mode

```ts
const controller = new AnimationController();
controller.init(scenes, { transitionDuration: 600, transitionEasing: 'ease-in-out' });

document.querySelector('#next-btn').addEventListener('click', () => {
  controller.nextScene();
});

document.querySelector('#prev-btn').addEventListener('click', () => {
  controller.prevScene();
});
```

### External Control

```ts
const controller = new AnimationController();
controller.init(scenes, { container: document.querySelector('#scroll-container') });

// External code can set progress directly (e.g., from a slider UI)
document.querySelector('#progress-slider').addEventListener('input', (e) => {
  controller.setProgress(Number(e.target.value));
});

// Pause during video playback, resume afterward
video.addEventListener('play', () => controller.resume());
video.addEventListener('pause', () => controller.pause());
```

## Performance

- Progress updates are batched within `requestAnimationFrame` to avoid redundant DOM updates.
- The controller does not query layout properties on progress changes.
- Event listeners are cleaned up on `destroy()` to prevent memory leaks.
- Transition animations use CSS transitions (GPU-composited) rather than JS animation loops.

## Error Handling

The controller throws:

- **`ControllerError`** with `CONTROLLER_SCENE_INDEX_OUT_OF_RANGE` when scene index is out of bounds for `setSceneIndex()`.
- **`ControllerError`** with `CONTROLLER_NO_SCENES` when `init()` is called without any scenes defined.
- **`ControllerError`** with `CONTROLLER_DESTROYED` when methods are called after `destroy()`.

`setProgress()` clamps finite numbers to [0.0, 1.0]. Non-finite values throw `CONTROLLER_PROGRESS_OUT_OF_RANGE`.
