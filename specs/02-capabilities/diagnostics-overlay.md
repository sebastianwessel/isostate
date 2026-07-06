# Capability: Diagnostics Overlay

Status: specified (wave 06)

A development-time visual overlay for a mounted scene: grid lines, cell
coordinates, element anchors, connector route points, and a scene/progress
readout. Helps authors verify alignment and routing without leaving the
browser.

## Placement

- Implementation module: `packages/core/src/runtime/diagnostics-overlay.ts`.
- Exported from the root entry only. MUST NOT be imported by
  `packages/core/src/browser-runtime.ts` — the overlay is not part of the
  standalone runtime or its size budget.

## Public API

```ts
interface DiagnosticsOverlayOptions {
  /** Draw grid lines across the floor extent. Default: true. */
  grid?: boolean;
  /** Draw cell coordinate labels at whole-cell intersections. Default: false. */
  coordinates?: boolean;
  /** Mark element anchor points. Default: true. */
  anchors?: boolean;
  /** Mark connector route points. Default: true. */
  routes?: boolean;
  /** Show the scene id / progress readout panel. Default: true. */
  readout?: boolean;
}

interface DiagnosticsOverlayHandle {
  /** Re-render the overlay from current scene state. */
  update(): void;
  /** Remove the overlay and its subscriptions. Safe to call twice. */
  destroy(): void;
}

function attachDiagnosticsOverlay(
  mounted: MountedScene,
  options?: DiagnosticsOverlayOptions,
): DiagnosticsOverlayHandle;
```

## Behavior (normative)

1. Attaching to a destroyed mount throws `RenderError("MOUNT_DESTROYED")`.
   Attaching twice to the same mount replaces the previous overlay (the
   first handle becomes a no-op).
2. The overlay renders into a single `<g data-iso-diagnostics>` appended as
   the LAST child of the root SVG (above all scene content). Snapshot
   export removes this group (see `02-capabilities/export.md`).
3. Grid: for the floor rectangle spanning `floor.origin` to
   `floor.origin + floor.size`, draw one path per whole-cell grid line in
   both axes using the same diamond projection as the floor. Style:
   `stroke: var(--iso-diag-grid, rgba(37, 99, 235, 0.35))`,
   `stroke-width: 1`, `fill: none`, attribute
   `vector-effect="non-scaling-stroke"`.
4. Coordinates (when enabled): a `<text>` per whole-cell intersection with
   content `x,y` (grid coordinates), `font-size: 8`,
   `fill: var(--iso-diag-text, #1e3a8a)`, anchored at the projected point.
5. Anchors: for every element whose presence is not `removed`, a
   `<circle r="3" fill="var(--iso-diag-anchor, #dc2626)">` at the element's
   projected anchor position.
6. Routes: for every connector whose presence is not `removed`, a
   `<rect width="4" height="4" fill="var(--iso-diag-route, #059669)">`
   centered on each projected route point.
7. Readout (when enabled): a `<text>` block pinned to the top-left corner of
   the viewBox (`viewBox.minX + 4`, `viewBox.minY + 10`), `font-size: 10`,
   `fill: var(--iso-diag-text, #1e3a8a)`, content
   `scene <id> · progress <p>` with `<p>` rounded to 3 decimals. Without a
   controller the scene id part is omitted and progress comes from the
   engine.
8. Live updates: when the mount has a controller, the overlay subscribes to
   `progress-change` and `camera-change` and re-renders itself (full
   rebuild of the overlay group's children — overlay simplicity beats
   incremental updates here). Without a controller, consumers call
   `update()` manually.
9. `destroy()` removes the group and unsubscribes; it never touches other
   scene DOM. `mounted.destroy()` also removes the overlay implicitly
   (group is inside the SVG).

## Error Codes

Reuses `MOUNT_DESTROYED` (defined by `02-capabilities/interactivity.md`).
No new codes.

## Testing (required)

`tests/runtime/diagnostics-overlay.test.ts` (mount-scene DOM shim):

- attach renders one `[data-iso-diagnostics]` group as last SVG child with
  grid paths, anchor circles, and route rects matching the fixture bundle's
  element/connector counts;
- `coordinates: true` adds intersection labels; defaults omit them;
- readout shows scene id and progress; progress-change re-renders (with
  controller); `update()` re-renders without controller;
- second attach replaces the first (only one group present; first handle's
  `destroy()` is a no-op);
- `destroy()` removes the group and stops re-rendering; attach on destroyed
  mount throws `MOUNT_DESTROYED`;
- overlay elements never carry `data-id` (they must not trigger
  interactivity events).

## Documentation (required)

- `docs/reference/public-api.md`: "Diagnostics Overlay" section.
- `docs/guides/plan-a-scene.md`: short "Verify with the diagnostics
  overlay" subsection with a snippet.

## Out of Scope (v1)

- Interactive inspection (click-to-select, measurements).
- Rendering into a separate canvas/HTML layer.
- Persisting overlay settings.
