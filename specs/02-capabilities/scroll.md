# Capability: Scroll (Superseded)

## Status

**Superseded by:** `02-capabilities/controller.md`

## Migration

All scroll tracking logic from this file is now internal to the `AnimationController`. When `ControllerConfig.container` is provided, the controller automatically binds to scroll events, normalizes progress to 0–1, and feeds it to the animation engine.

### What Changed

| Before (Scroll Tracker) | After (Controller) |
|---|---|
| `new ScrollTracker(config)` | `controller.init(scenes, { container })` |
| `scroll.start()` / `scroll.stop()` | Handled by `init()` / `destroy()` |
| `scroll.getProgress()` | `controller.getProgress()` |
| Scroll events → animation engine | Controller → `setProgress()` → engine |

### No Migration Needed for New Code

New implementations should use `AnimationController` exclusively. Do not import or reference `ScrollTracker` or `ScrollConfig`.

## Legacy Reference

The scroll progress calculation formula is unchanged and documented in `controller.md` under "Scroll Integration":

```
progress = clamp((currentScroll - minScroll) / (maxScroll - minScroll), 0, 1)
```

Scroll events are debounced to `requestAnimationFrame`. Only `scrollY`/`scrollX` are read.
