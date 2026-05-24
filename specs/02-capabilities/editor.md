# Capability: Browser Visual Editor

## Overview

`@sebastianwessel/isostate-editor` is a browser-based visual editor for creating
and maintaining `.isostate.yaml` scene documents. It provides drag-and-drop
placement, scene timeline editing, layer and object management, camera focus
authoring, YAML editing, preview, validation, and export.

The editor must support every authored feature in
`03-contracts/scene-schema.md`: assets, asset anchors, grid, floor, theme,
layers, scene deltas, elements, built-in text and primitives, connections,
routing options, animations, and camera focus.

## Package Boundary

The editor package is an authoring application/library and may use React, Radix
primitives, shadcn/ui component patterns copied into the package, CodeMirror 6,
YAML language tooling, and the browser-safe DSL parser, validator, and compiler
from `@sebastianwessel/isostate/dsl/browser`. These dependencies must remain
isolated to `packages/editor` and must not be imported by
`@sebastianwessel/isostate`, the static runtime bundle, or
`@sebastianwessel/isostate-cli`.

Published consumers must not need Tailwind or a shadcn setup. The editor ships
its own CSS file based on CSS variables and ordinary CSS selectors.

The existing core browser runtime remains dependency-free and keeps the current
size budget. The editor has its own build and size expectations.

## V1 Scope

The first editor implementation is intentionally broad enough to author real
scenes but avoids bespoke visual tools where ordinary form controls are enough.

V1 visual and form-supported scope:

- manifest-backed asset browser and drag-to-place external assets;
- built-in `text`, `rectangle`, `circle`, `polygon`, and `line` placement;
- element select, multi-select, move, resize, nudge, layer assignment, delete,
  duplicate, and visibility toggles;
- layer create, rename, order, lock, visibility, and assign-selection controls;
- scene selector, add scene, duplicate scene, rename scene, remove scene, and
  active scene validation status;
- connection create/edit through inspector controls using `from` and `to`
  dropdowns, endpoint side dropdowns, routing dropdowns, layer dropdown, style
  fields, and start/end endpoint type dropdowns;
- camera target selection, area fields, reset, padding, duration, and easing;
- YAML editing, validation, formatting, import, and export.

V1 YAML-supported scope:

- manual connector route arrays can be edited in YAML and previewed by the
  runtime;
- complex animation arrays are preserved, validated, previewed, and editable in
  YAML, with basic inspector controls for choosing supported entry, exit, and
  ambient presets;
- advanced primitive point arrays are editable in YAML and through numeric
  inspector fields, not through freeform vertex dragging.

V1 excludes custom visual route dragging and animation timeline editors. These
features remain fully supported through YAML and runtime preview.

## Primary Layout

The default screen uses a work-focused split layout:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Topbar: workspace, import/export, undo/redo, theme, validate, preview mode │
├───────────────────────────────────────────────┬────────────────────────────┤
│ Left main editor area                         │ Resizable right sidebar    │
│                                               │                            │
│ Canvas tab:                                   │ Inspector tab              │
│ - large projected canvas                      │ - selection properties     │
│ - SVG preview + edit overlays                 │ - layer/object visibility  │
│ - zoom/pan controls                           │ - camera controls          │
│ - toggleable projected grid                   │                            │
│                                               │ Scenes tab                 │
│ YAML tab:                                     │ - ordered scene timeline   │
│ - code editor with folding                    │ - add/duplicate/remove     │
│ - syntax highlighting                         │ - camera markers           │
│ - diagnostics gutter                          │                            │
│ - format action                               │ Assets tab                 │
│                                               │ - asset catalog            │
└───────────────────────────────────────────────┴────────────────────────────┘
```

Rules:

- The visual canvas is the default active tab.
- The YAML editor is available in the same main area as a tab or split view.
- A split view mode shows canvas and YAML side by side inside the main editor
  area when there is enough width.
- The right sidebar is resizable, collapsible, and remembers width in local UI
  state.
- The topbar is persistent and uses editor CSS variables aligned with shadcn
  theme token names.
- Light and dark mode are available from the topbar and follow the standard
  root `.dark` class mechanism.

## Topbar

The topbar contains:

- workspace name
- import YAML
- export YAML
- export compiled JS/JSON bundle
- undo and redo
- validation status
- active scene selector
- canvas/YAML/split mode selector
- light/dark/system theme selector
- preview/presentation toggle
- edit/runtime preview toggle

Topbar commands must be reachable by mouse and keyboard. Destructive commands
such as replacing current YAML or removing a scene require confirmation.

## Canvas

The canvas is an SVG-backed authoring surface that reuses the core runtime
renderer. The editor must mount compiled scene previews through `mountScene` or
an equivalent core runtime entrypoint and place editor-owned overlays above the
runtime SVG.

The editor must not implement a second renderer, duplicate layer/depth sorting,
duplicate camera viewBox logic, or duplicate projection math. When additional
geometry is needed for hit testing, drag handles, grid overlays, or selection
bounds, the editor uses the core support API in
`03-contracts/editor-support-api.md`.

Canvas features:

- drag external assets, built-in primitives, text, and existing objects onto the
  grid
- select one object, multiple objects, one layer, or mixed object sets
- marquee select by projected bounds
- move selected elements by dragging
- move selected layers as groups
- resize element `size` by whole grid-cell values
- select existing connections from the rendered preview
- create and edit endpoint-based connections through inspector controls
- pan by middle mouse, trackpad gesture, or space-drag
- zoom with wheel/trackpad and toolbar controls
- fit scene, fit selection, and reset authoring viewport
- toggle background grid
- toggle snap-to-grid
- preview active scene camera focus

Rules:

- Hand-authored element `at`, manual route points, floor sizes, and camera areas
  use whole grid cells unless the referenced schema allows otherwise.
- Dragging in the first scene writes `elements` or `connections`.
- Dragging in later scenes writes the minimal valid delta against the previous
  resolved scene.
- Delta generation is deterministic:

| User edit in later scene | Authored delta |
|---|---|
| Move or resize an object present in the previous resolved scene | `update.elements[]` |
| Change style, text, primitive, animation, or layer for a present object | `update.elements[]` |
| Place a new object | `add.elements[]` |
| Delete an object present in the previous resolved scene | `remove.elements[]`, plus required removal of still-present endpoint connections in the same scene |
| Delete an object newly added in the same scene | Remove it from `add.elements[]` instead of writing `remove.elements[]` |
| Edit a connection | Same add/update/remove rules under `connections` |
| Perform an edit that would require rewriting multiple previous scenes | Block the operation and focus YAML editing |
- Moving a selected element with endpoint-based connections does not rewrite the
  connection unless the connection itself is selected and the user commits a
  route edit.
- Manual route editing is YAML-first in v1. When a manual route is edited in
  YAML, the inspector displays it as read-only route points and still allows
  layer, style, endpoint decoration, animation, and visibility changes.
- Hidden editor-only objects are not selectable from the canvas until made
  visible again from the sidebar.
- Locked layers and locked objects reject drag, resize, delete, and property
  edits with a non-blocking diagnostic.
- Editor overlays are temporary SVG or HTML UI layers. They must not be written
  into the core runtime SVG DOM as scene objects.
- On visual edit commit, the editor updates authored YAML, recompiles through
  browser-safe DSL APIs, and refreshes the mounted runtime preview.
- V1 preview refresh is remount-after-commit: after each committed semantic
  edit, the editor destroys the previous mounted core runtime preview, compiles
  the updated document, mounts a fresh preview, then restores editor selection
  and viewport state. Incremental runtime patching is not part of v1.

## Object And Layer Visibility

The editor supports visibility toggles for:

- individual elements
- individual connections
- layers
- background grid
- floor

Editor-only visibility controls are for authoring convenience and must not be
serialized except when the user edits an existing authored field such as
`floor.visible`.

Layer visibility hides all present elements and connections assigned to that
layer in the canvas and preview. Object visibility overrides are editor-only and
can be cleared globally.

The editor has two preview modes:

- Edit preview applies editor-only visibility, locks, overlays, selection, and
  grid settings.
- Runtime preview ignores editor-only visibility and overlays, uses authored
  `floor.visible`, and shows the scene as the runtime would render it.

## Inspector

The inspector shows context-aware controls.

Element controls:

- id
- asset
- position `at`
- size
- layer
- entry, exit, and ambient animations
- text content and text style for `asset: text`
- primitive style for generated primitives

Connection controls:

- id
- route source (`from`/`to` or manual `route`)
- `from` and `to` endpoint dropdowns listing present elements plus grid-point
  endpoint fields
- endpoint side dropdowns and numeric offsets
- routing mode, avoid, clearance, grid step, max bends, prefer
- layer
- style, endpoints, direction
- entry, exit, and ambient animations

Connection creation in v1 is inspector-driven: the user clicks "add
connection", selects `from`, selects `to`, chooses endpoint decorations such as
arrow, dot, circle, diamond, or none, and saves. The editor validates the
connection before writing YAML.

Scene controls:

- scene id
- scene operation summary
- camera target (`element`, `area`, or `reset`)
- camera padding, duration, and easing

Layer controls:

- name
- order
- edit visibility
- lock state
- assign selected objects to layer
- move selected layer contents in the active scene

Shared multi-selection controls:

- nudge by grid cell
- move to layer
- delete
- duplicate into active scene
- set visibility
- common animation edits

Controls must disable or hide fields that are invalid for the current object
type rather than allowing invalid YAML to be generated.

## Scene Timeline

The sidebar scene timeline manages `scenes[]` with simple structured controls.

Required features:

- active scene dropdown in the topbar
- add scene after active scene
- duplicate scene as a new delta
- rename scene id
- remove scene
- reorder scenes when valid
- show validation status per scene
- show counts for add/update/remove operations
- show a camera marker when `scenes[].camera` exists
- scrub or select active scene

Rules:

- Removing the first scene is blocked unless another scene is promoted and
  rewritten into a full initial scene.
- Reordering across the first scene boundary must rewrite affected scenes or be
  blocked. The default behavior is block with a clear diagnostic.
- Duplicate scene creates a later delta that reproduces the selected scene's
  resolved state relative to the previous scene with minimal `add`, `update`,
  and `remove` sections.
- Scene add/remove/rename/reorder operations are command operations and must not
  directly mutate UI state outside the command pipeline.

## YAML Editor

The YAML editor uses a code editor component with:

- YAML syntax highlighting
- line numbers
- folding/collapse
- search
- diagnostics gutter
- parse/validate on edit debounce
- format action
- dark/light theme integration

CodeMirror 6 with YAML language support is the preferred implementation. The
editor package should use focused CodeMirror extensions for YAML highlighting,
folding, diagnostics, search, bracket matching, indentation, and light/dark
themes. Monaco is not a v1 dependency.

Format behavior:

- Format is explicit from toolbar or command palette.
- Format parses the current YAML, serializes through the canonical editor YAML
  serializer, and preserves the same `SceneDocument` semantics.
- If parsing fails, format is disabled and the first parse diagnostic is shown.
- If validation fails but parsing succeeds, format is allowed only when it does
  not drop unknown fields or reorder semantically meaningful arrays.

Synchronization rules:

- YAML edits update the visual canvas after parse succeeds.
- Visual edits update YAML immediately through deterministic serialization.
- While YAML is invalid, visual edits are disabled against stale source. The
  canvas may continue showing the last valid preview in read-only mode.
- Diagnostics link both ways: selecting a YAML diagnostic highlights the related
  canvas object when available; selecting an invalid canvas object highlights
  the YAML range when available.

## Camera Authoring

Camera tools let users set `scenes[].camera` without writing YAML manually.

Required tools:

- focus selected element
- draw camera area on grid
- reset camera
- edit padding, duration, and easing
- preview camera transition from previous scene to active scene
- clear active scene camera

Rules:

- Element target choices are limited to elements present, entering, or exiting
  in the active resolved scene.
- Area targets use whole grid-cell coordinates and positive whole-cell sizes.
- Reset targets omit padding.
- Camera preview changes the editor viewport only until committed.

## Asset Management

The asset panel manages manifest-discovered assets, `header.assets[]`, and
built-in generated asset types.

Required features:

- load an asset manifest from a URL
- list external URL assets and logical sprites from sprite sheet manifest entries
- group assets by the manifest's first folder segment
- search assets by id, label, path, and tag
- filter by group and tag
- show recently used assets
- show YAML-declared assets missing from the active manifest
- show declared assets unused by any scene
- reconcile YAML asset declarations with the active manifest without changing
  object placements
- add asset id/path/anchor
- edit anchor values with numeric fields and visual anchor picker
- remove unused asset declarations
- show all reserved built-ins: `text`, `rectangle`, `circle`, `polygon`, `line`
- prevent declaring reserved built-ins in `header.assets`
- drag assets and built-ins onto canvas

Manifest behavior:

- The primary browser discovery path is an `isostate.asset-manifest` JSON URL.
- The CLI owns filesystem scanning and manifest generation.
- The expected source folder shape is `assets/group-folder/asset.svg` for URL
  SVG assets and metadata-declared raster or SVG sprite sheet files for grouped
  sprites.
- The editor never depends on HTTP directory listings.
- User-selected local files are outside v1. Manifest URL is the required
  default workflow.
- Dragging a URL manifest asset into a scene adds the corresponding
  `header.assets[]` entry when missing and sets `header.assetBaseUrl` from the
  manifest when the YAML has no asset base URL.
- Dragging a sprite into a scene adds or reuses exactly one containing
  `type: sprite-sheet` declaration and places the nested sprite id on the
  element. The sheet namespace id is never placed as `element.asset`.
- The asset panel must surface `EDITOR_ASSET_CONFLICT` instead of silently
  merging when an existing YAML asset declaration conflicts with manifest
  metadata.

The editor must not enlarge imported composite SVGs with `size` by default.
New external-asset placements default to `size: 1` and use the asset's checked
anchor.

## YAML Round Trip

The editor treats structured visual edits as semantic edits, not text-preserving
patches.

Rules:

- YAML typing preserves the user's text until a visual edit, explicit format, or
  export serialization occurs.
- Visual edits reserialize the full `SceneDocument` through the canonical editor
  serializer.
- Comments, blank-line grouping, anchors, aliases, and original scalar quoting
  are not preserved after visual edits or format.
- Field order follows the authored schema order from
  `03-contracts/scene-schema.md`.
- Arrays whose order has semantic meaning, such as `header.layers` and
  `scenes`, keep their current order unless the user performs an explicit
  reorder command.

Canonical editor serialization rules:

- `header` is emitted before `scenes`.
- Header field order is `version`, `name`, `className`, `assetBaseUrl`,
  `assets`, `grid`, `floor`, `theme`, `layers`.
- Scene field order is `id`, `elements`, `connections`, `add`, `update`,
  `remove`, `camera`.
- Indentation is two spaces.
- Tuples such as `at`, `size`, `anchor`, `route` points, and camera area
  coordinates use flow sequence style, for example `[1, 2]`.
- `text.value` uses a block scalar when it contains line breaks and a quoted
  scalar otherwise.
- Empty optional arrays and objects are omitted unless required by the authored
  schema.

## Command Model

All editor mutations run through semantic commands. UI components dispatch
commands and never mutate `sourceYaml`, `document`, history, or runtime preview
directly.

```ts
interface EditorCommand {
  id: string;
  label: string;
  apply(workspace: EditorWorkspace): EditorCommandResult;
}

interface EditorCommandResult {
  workspace: EditorWorkspace;
  inverse?: EditorCommand;
  diagnostics: EditorDiagnostic[];
  changed: boolean;
}
```

Rules:

- Commands are pure with respect to DOM. They may read workspace state and
  return new workspace state, diagnostics, and an inverse command.
- Commands validate the resulting document before committing.
- Commands that cannot preserve schema rules return `changed: false` with a
  diagnostic.
- Undo executes the stored inverse command or restores a full workspace snapshot
  when an inverse command is not compact.
- Continuous pointer drag produces transient overlay state; only pointer-up
  dispatches a committed command.
- YAML edits dispatch a debounced `yaml.edit` command.
- Format dispatches `yaml.format`.

## Undo And Redo

Undo/redo operates on semantic document operations, not DOM events.

Required operation types:

- YAML replacement
- scene add/remove/reorder/rename
- object add/update/remove
- connection add/update/remove
- layer add/update/remove/reorder
- asset catalog update
- camera update
- format YAML

Undo restores both `sourceYaml` and editor UI selection when possible.

## Accessibility And Keyboard

The editor must support:

- keyboard focus management through topbar, canvas tools, sidebar, and YAML
  editor
- arrow-key nudge for selected elements
- shift-arrow larger nudge
- delete selected objects
- escape clears current drag/tool/selection
- visible focus rings using editor CSS variables
- readable contrast in light and dark mode

Canvas object editing remains primarily visual, but every authored property must
also be editable through forms or YAML.

## Non-Goals

- No collaborative multi-user editing in the initial package.
- No hosted cloud storage.
- No server component is required for the default editor.
- No new authored DSL fields for editor-only state.
- No duplicate editor renderer. Core rendering remains the visual source of
  truth.
- No Three.js or CSS 3D.

## Verification

Default verification for editor work:

```bash
bun test tests/editor
bun run typecheck
bun run lint
```

Browser UI automation is not required for v1 implementation. Interaction work
must be covered by unit tests for workspace operations, serialization, command
reducers, manifest handling, and component-level behavior where practical. V1
acceptance does not depend on Playwright.
