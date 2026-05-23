# Domain: Editor Workspace

## Overview

An editor workspace is the browser-authoring state owned by
`@sebastianwessel/isostate-editor`. It lets users visually compose one
`.isostate.yaml` document, manage its scene timeline, edit raw YAML, preview the
compiled runtime result, and export valid authored YAML or compiled bundles.

The editor workspace is an authoring tool domain. It is not part of the
dependency-free browser runtime package and does not change the authored
`.isostate.yaml` schema by itself.

## Entities

### Workspace

```ts
interface EditorWorkspace {
  id: string;
  name: string;
  sourceYaml: string;
  document: SceneDocument | undefined;
  diagnostics: EditorDiagnostic[];
  activeSceneId: string;
  selection: EditorSelection;
  viewport: EditorViewport;
  editState: EditorEditState;
  ui: EditorUiState;
}
```

Rules:

- A workspace owns exactly one `SceneDocument`.
- Multiple scenes are represented by `document.scenes[]`, not by separate files.
- `sourceYaml` is the canonical editable text. Structured visual edits update
  `sourceYaml` through deterministic serialization.
- `document` is updated only after parsing succeeds. If YAML is invalid, the
  last valid `document` remains available for preview with diagnostics shown.
- The editor must not invent fields outside the contracts in
  `03-contracts/scene-schema.md`.

### Scene Stop

The editor treats each authored `scenes[]` entry as one scene stop in a timeline.

Editable scene-stop state:

- id
- initial `elements` and `connections` on the first scene
- `add`, `update`, and `remove` deltas on later scenes
- camera focus metadata

Rules:

- The first scene is the only scene that exposes full initial placement editors.
- Later scenes expose delta editors. Visual changes made while a later scene is
  active are written as `update`, `add`, or `remove` operations relative to the
  previous resolved scene.
- Scene reordering is allowed only when it keeps the first-scene and delta
  constraints valid. Invalid reorder attempts are blocked with a diagnostic.

### Layer

Layers are authored in `header.layers[]`.

```ts
interface EditorLayerState {
  name: string;
  order: number;
  editVisible: boolean;
  locked: boolean;
}
```

Rules:

- `editVisible` is an editor-only visibility toggle. It must not be serialized
  into `.isostate.yaml`.
- `locked` is editor-only and prevents selection, drag, resize, route editing,
  and property changes for objects on that layer.
- Layer order edits update `header.layers[].order` or declaration order using
  the existing schema rules.

### Selection

```ts
interface EditorSelection {
  kind: 'none' | 'element' | 'connection' | 'layer' | 'mixed';
  ids: string[];
  anchorId?: string;
}
```

Rules:

- Single selection shows the exact property editor for that object type.
- Multiple selection supports group move, layer assignment, visibility toggling,
  deletion, and shared animation edits.
- Mixed element and connection selections support only commands valid for every
  selected item.
- Selecting a layer selects the layer as a grouping unit; moving a layer moves
  all present elements and manual-route connections in that layer for the active
  scene delta.

### Viewport

```ts
interface EditorViewport {
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  snapToGrid: boolean;
  cameraPreview:
    | { type: 'scene'; sceneId: string }
    | { type: 'manual'; target: RuntimeCameraTarget }
    | { type: 'reset' };
}
```

Rules:

- Editor zoom and pan affect the authoring canvas only. They do not change
  authored camera metadata.
- Camera preview uses the runtime camera contract and can be committed to
  `scenes[].camera`.
- The background grid is projected with the same diamond formula, cell size,
  floor origin, and floor size used by the renderer. It is an editor overlay and
  must be toggleable.

### Diagnostics

```ts
interface EditorDiagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  sceneId?: string;
  objectId?: string;
  yamlRange?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}
```

Diagnostics merge parser errors, validator errors, compiler errors, and
editor-only warnings such as hidden selected objects or non-editable generated
route points.

