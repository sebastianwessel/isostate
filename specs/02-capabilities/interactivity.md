# Capability: Element Interactivity

Status: specified (wave 06)

Opt-in pointer interactivity for mounted scenes: hover and click events on
scene elements, exposed as subscriptions on `MountedScene`. Runtime-level
configuration only — the DSL, validator, compiler, and runtime bundle format
are NOT changed by this capability.

## Placement

- Implementation: `packages/core/src/runtime/interactivity.ts`, wired inside
  `mountScene()` (`packages/core/src/runtime/mount-scene.ts`).
- Part of the standalone browser runtime (imported via `mountScene`), so it
  counts against the 20KB gzip budget. Implementation must stay under ~1KB
  gzipped; no dependencies.

## Public API

```ts
interface MountSceneOptions {
  // ...existing options...
  /** Enable pointer interactivity on scene elements. Default: false. */
  interactive?: boolean;
}

/** Payload for element pointer events. */
interface ElementPointerEvent {
  /** Element id from the scene definition. */
  id: string;
  /** The native DOM event that triggered this notification. */
  originalEvent: Event;
}

interface MountedSceneEvents {
  "element-click": (event: ElementPointerEvent) => void;
  "element-enter": (event: ElementPointerEvent) => void;
  "element-leave": (event: ElementPointerEvent) => void;
}

interface MountedScene {
  // ...existing members...
  /**
   * Subscribe to interactivity events. Returns an unsubscribe function.
   * Callable regardless of the `interactive` option; without it no events
   * fire.
   */
  on<K extends keyof MountedSceneEvents>(event: K, listener: MountedSceneEvents[K]): () => void;
}
```

`ElementPointerEvent` and `MountedSceneEvents` are exported public types.

## Behavior (normative)

When `interactive: true`:

1. `mountScene` attaches exactly three delegated listeners to the root SVG:
   `click`, `pointerover`, `pointerout`. No per-element listeners.
2. Event resolution: from `event.target`, walk up `parentNode` until the
   root SVG; the first ancestor `<g>` carrying a `data-id` attribute whose
   node is a scene element group identifies the element. Floor, connectors,
   defs, and the diagnostics overlay never produce events (connector groups
   are excluded even if they carry `data-id`; exclusion is by membership in
   the element state map, not by DOM heuristics).
3. Elements whose current presence is `removed` (group `visibility: hidden`)
   never produce events.
4. `pointerover`/`pointerout` pairs are translated to enter/leave semantics:
   an `element-enter` fires only when the pointer enters an element group
   from outside it, `element-leave` only when leaving it entirely
   (compare the resolved element id of `event.target` and
   `event.relatedTarget`; identical ids produce no event).
5. On `element-enter` the engine adds the class `iso-hover` to the element
   group; on `element-leave` it removes it. The runtime stylesheet gains:
   `.iso-interactive g[data-id] { cursor: pointer; }` scoped by the root
   class `iso-interactive` that is set on the SVG only when
   `interactive: true`.
6. `destroy()` removes the three listeners and all subscriptions. `on()`
   after destroy throws `RenderError("MOUNT_DESTROYED")` (new code).
7. Listener exceptions are not caught (consistent with controller events).
8. When `interactive` is false/omitted: no listeners, no `iso-interactive`
   class, `on()` still registers (and never fires).

## Error Codes

| Code | Meaning | Action |
|---|---|---|
| `MOUNT_DESTROYED` | `MountedScene.on()` called after `destroy()`. | Subscribe while the scene is mounted. |

Added to `03-contracts/errors.md` (Runtime) and `docs/reference/errors.md`.

## Testing (required)

`tests/runtime/interactivity.test.ts` using the mount-scene DOM shim
(extend the shim with `dispatchEvent`-style manual listener invocation as
needed — match real DOM semantics, do not invent convenience behavior):

- click on a node inside an element group fires `element-click` with the
  element id; click on floor/connector/defs fires nothing;
- enter/leave fire once per group crossing; moving between two child nodes
  of the same group fires nothing; `iso-hover` class toggles accordingly;
- hidden (removed-presence) elements fire nothing;
- unsubscribe function stops delivery; `destroy()` removes listeners;
  `on()` after destroy throws `MOUNT_DESTROYED`;
- `interactive` omitted: no `iso-interactive` class on the SVG and no events
  after dispatching a click;
- size check still passes (`bun run size`).

## Documentation (required)

- `docs/reference/public-api.md`: "Interactivity" section (option, `on()`,
  payload type, `iso-hover`/`iso-interactive` CSS hooks).
- `docs/examples/interactive-elements.md`: tooltip-on-hover +
  click-to-zoom example (combining `on("element-click")` with
  `controller.zoomToElement`).
- README/docs tree links.

## Out of Scope (v1)

- Keyboard focus/activation and ARIA roles.
- Connector interactivity.
- Authored (YAML-level) interactivity declarations.
- Touch-specific gestures beyond what pointer events provide.
