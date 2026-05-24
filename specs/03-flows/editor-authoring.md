# Flow: Browser Editor Authoring

## Actor

Scene author creating or maintaining an isostate scene document.

## Trigger

The author opens the browser editor, imports YAML, or starts a new scene.

## Preconditions

- The editor package is loaded by a browser application.
- Editor CSS from `@sebastianwessel/isostate-editor/style.css` is loaded.
- The editor package can access the browser-safe
  `@sebastianwessel/isostate/dsl/browser` parser, validator, and compiler APIs
  from its own dependency graph.
- External SVG previews are discoverable through an asset manifest URL or
  provided through the host application's `EditorAssetProvider`.

## Happy Path

1. Author opens the editor with no document or imports existing
   `.isostate.yaml`.
2. Editor parses the YAML. If parsing succeeds, it validates and compiles the
   document for preview.
3. Editor mounts the compiled runtime bundle through the core runtime renderer
   and creates editor-owned overlays above the runtime SVG.
4. Editor shows the canvas tab in the main area, the active scene in the
   timeline, and the inspector/sidebar on the right.
5. Editor fetches the configured asset manifest URL, groups assets by folder,
   and shows the asset browser.
6. Author toggles the projected grid on, drags an asset or built-in primitive
   onto a whole grid cell, and commits the placement.
7. Editor writes the asset declaration when missing, then writes the placement
   to the first scene's `elements[]` or to a later
   scene's `add`/`update` delta as required by the active scene.
8. Author multi-selects objects or a layer, moves them, and assigns shared
   properties in the inspector.
9. Editor serializes the semantic change to YAML, validates it, recompiles, and
   refreshes the mounted core runtime preview.
10. Author adds a later scene, edits deltas, and sets camera focus by selecting
   an element, drawing an area, or choosing reset.
11. Author opens the YAML tab or split view, edits raw YAML with folding,
   syntax highlighting, diagnostics, and optional format.
12. After YAML parse succeeds, the canvas updates to reflect the edited source.
13. Author validates, previews, and exports YAML or a compiled runtime JS/JSON
    bundle.

## Failure Paths

| Step | Failure | Result |
|---|---|---|
| import | invalid YAML syntax | YAML editor shows parser diagnostic; canvas remains empty or last valid read-only preview. |
| validate | schema or semantic error | Diagnostics appear in topbar, gutter, timeline, and inspector; export runtime bundle is blocked. |
| drag | target layer hidden or locked | Drag is rejected and `EDITOR_LOCKED_TARGET` or visibility diagnostic is shown. |
| scene edit | first-scene/delta rule would be violated | Operation is blocked before YAML mutation. |
| route edit | route would contain diagonal or negative manual points | Operation is blocked or snapped to nearest valid orthogonal whole-grid route. |
| camera edit | target element is not present in active resolved scene | Camera target is rejected. |
| asset manifest | manifest URL is missing or invalid | Asset browser shows an empty state with `EDITOR_ASSET_MANIFEST_INVALID`; built-in assets remain available. |
| asset reconciliation | YAML declares an asset missing from manifest | Inspector shows `EDITOR_ASSET_NOT_IN_MANIFEST`; existing YAML stays valid if the DSL asset path is otherwise valid. |
| asset preview | provider preview fails | Canvas shows placeholder; YAML remains editable; export may still succeed if authored asset path is valid. |
| format | YAML cannot be parsed | Format is disabled and the first parser diagnostic is focused. |
| export | current document invalid | Export is blocked with `EDITOR_INVALID_SOURCE`. |

## Split-Screen Usage

The author can use three main modes:

- `canvas`: visual editor fills the main area.
- `yaml`: code editor fills the main area.
- `split`: canvas and YAML share the main area.

In split mode, visual edits update YAML after commit and YAML edits update the
canvas after parse. If YAML becomes invalid, the canvas side becomes read-only
and keeps the last valid scene preview.

## Cleanup

- Closing the editor calls `destroy()` on the mounted editor.
- `destroy()` unmounts React, removes event listeners, clears pending drag
  state, destroys the mounted core runtime preview, cancels
  parse/validate/compile workers, and releases object URLs created for asset
  previews.
- Editor-only UI state is discarded unless the host app persisted it
  separately.

## Verification

Default tests:

```bash
bun test tests/editor
bun run typecheck
bun run lint
```

Browser automation is not required for v1. Default verification uses unit and
component-level tests only.
