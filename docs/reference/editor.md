# Editor Package Reference

The editor package is `@sebastianwessel/isostate-editor`. It provides a browser
visual editor for `.isostate.yaml` scene documents.

## Package Exports

| Export | Use | Description |
|---|---|---|
| `@sebastianwessel/isostate-editor` | Non-React hosts, generic embedding | `mountEditor`, `IsostateEditor`, commands, serialization, asset helpers |
| `@sebastianwessel/isostate-editor/react` | React hosts | `IsostateEditor` component and props only |
| `@sebastianwessel/isostate-editor/style.css` | All hosts | Editor stylesheet (import once) |

Peer dependencies: `react >=19` and `react-dom >=19`.

No Tailwind CSS or shadcn project setup is required.

## `mountEditor`

```ts
import { mountEditor } from '@sebastianwessel/isostate-editor';

const editor = mountEditor(target, {
  initialYaml?: string;
  initialWorkspace?: EditorWorkspaceInput;
  assetManifestUrl?: string;
  assetManifestUrls?: string[];
  assetProvider?: EditorAssetProvider;
  theme?: 'light' | 'dark' | 'system';
  readonly?: boolean;
  onChange?: (event: EditorChangeEvent) => void;
  onValidate?: (diagnostics: EditorDiagnostic[]) => void;
  onExport?: (artifact: EditorExportArtifact) => void;
});
```

`mountEditor` creates a React root inside `target`, renders the editor, and
returns a `MountedEditor` handle.

`initialYaml` and `initialWorkspace` are mutually exclusive. When neither is
provided, the editor starts with a minimal valid scene document.

### `MountedEditor`

```ts
interface MountedEditor {
  element: HTMLElement;
  getWorkspace(): EditorWorkspace;
  setYaml(sourceYaml: string): void;
  setTheme(theme: 'light' | 'dark' | 'system'): void;
  validate(): EditorDiagnostic[];
  formatYaml(): boolean;
  exportYaml(): string;
  exportRuntimeBundle(format: 'js' | 'json'): string;
  destroy(): void;
}
```

- `destroy()` unmounts React, removes listeners, and leaves `target` empty.
- `exportRuntimeBundle()` validates and compiles the current YAML before
  returning canonical JS or JSON. It throws structured editor errors when the
  document is invalid.

## `IsostateEditor` (React)

```ts
import { IsostateEditor } from '@sebastianwessel/isostate-editor/react';
// or from '@sebastianwessel/isostate-editor'
```

```ts
interface IsostateEditorProps {
  value?: string;
  defaultValue?: string;
  assetManifestUrl?: string;
  assetManifestUrls?: string[];
  assetProvider?: EditorAssetProvider;
  theme?: 'light' | 'dark' | 'system';
  readonly?: boolean;
  onChange?: (event: EditorChangeEvent) => void;
  onValidate?: (diagnostics: EditorDiagnostic[]) => void;
  onExport?: (artifact: EditorExportArtifact) => void;
}
```

- `value` makes the component controlled.
- `defaultValue` makes it uncontrolled.
- Controlled mode emits `onChange` but does not mutate `value`.
- The editor always shows canvas, inspector/sidebar, and YAML editor panes from
  left to right. The canvas pane does not scroll; inspector/sidebar and editor
  content scroll independently. The scene tree combines scenes, layers, and
  elements in one collapsible panel.
- Use `assetManifestUrl` for one catalog or `assetManifestUrls` for separate
  catalogs. The asset browser merges them only in memory for browsing, preserves
  each manifest's own `assetBaseUrl`, and shows manifest groups as collapsible
  alphabetized categories.

## Workspace Types

### `EditorWorkspace`

```ts
interface EditorWorkspace {
  name: string;
  sourceYaml: string;
  document?: SceneDocument;
  activeSceneId?: string;
  selection: EditorSelection;
  viewport: EditorViewport;
  editState: EditorEditState;
  uiState: EditorUiState;
  history: EditorCommandResult[];
  diagnostics: EditorDiagnostic[];
  lockedLayers?: string[];
}
```

### `EditorSelection`

```ts
interface EditorSelection {
  sceneId?: string;
  objectIds: string[];
  connectionIds: string[];
  layerNames: string[];
}
```

### `EditorViewport`

```ts
interface EditorViewport {
  pan: { x: number; y: number };
  zoom: number;
  showGrid: boolean;
  showFloor: boolean;
}
```

### `EditorEditState`

```ts
interface EditorEditState {
  readonly: boolean;
  dragging: boolean;
  dragPayload?:
    | { kind: 'asset'; assetId: string }
    | { kind: 'move'; objectId: string };
}
```

### `EditorUiState`

```ts
interface EditorUiState {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  sidebarTab: 'inspector' | 'scenes' | 'assets';
  theme: 'light' | 'dark' | 'system';
  previewMode: 'edit' | 'runtime';
  assetBrowser: EditorAssetBrowserState;
  hiddenLayers?: string[];
}
```

### `EditorWorkspaceInput`

```ts
interface EditorWorkspaceInput {
  name?: string;
  sourceYaml: string;
  activeSceneId?: string;
}
```

Host applications cannot initialize persistent editor-only UI state through v1
workspace input.

## Command API

```ts
import { applyEditorCommand } from '@sebastianwessel/isostate-editor';
```

```ts
function applyEditorCommand(
  workspace: EditorWorkspace,
  command: EditorCommand,
): EditorCommandResult;
```

`applyEditorCommand` is the only public helper that mutates workspace state. It
returns a new workspace object and never mutates the input workspace.

Commands include:

- `createYamlEditCommand`, `createYamlFormatCommand`
- `createSceneAddCommand`, `createSceneUpdateCommand`, `createSceneRemoveCommand`, `createSceneReorderCommand`
- `createObjectAddCommand`, `createObjectUpdateCommand`, `createObjectRemoveCommand`
- `createConnectionAddCommand`, `createConnectionUpdateCommand`, `createConnectionRemoveCommand`
- `createLayerAddCommand`, `createLayerUpdateCommand`, `createLayerRemoveCommand`, `createLayerReorderCommand`
- `createAssetAddCommand`, `createAssetUpdateCommand`, `createAssetRemoveCommand`
- `createCameraUpdateCommand`, `createCameraRemoveCommand`

Commands must not access DOM APIs.

## Serialization

```ts
import {
  serializeEditorWorkspace,
  serializeSceneDocument
} from '@sebastianwessel/isostate-editor';
```

```ts
function serializeSceneDocument(document: SceneDocument): string;
function serializeEditorWorkspace(workspace: EditorWorkspace): string;
```

`serializeSceneDocument()` follows canonical editor serialization rules.
`serializeEditorWorkspace()` returns the workspace source YAML when the
document is unavailable, otherwise returns canonical serialized scene YAML.

## Change Events

```ts
interface EditorChangeEvent {
  sourceYaml: string;
  document?: SceneDocument;
  diagnostics: EditorDiagnostic[];
  operation: EditorOperation;
}
```

Every semantic visual edit emits exactly one `EditorChangeEvent`.

## Export Artifacts

```ts
interface EditorExportArtifact {
  kind: 'yaml' | 'runtime-js' | 'runtime-json';
  filename: string;
  content: string;
  diagnostics: EditorDiagnostic[];
}
```

Export commands never download automatically. They return artifacts to the host
app or trigger `onExport`.

## Error Codes

| Code | Meaning |
|---|---|
| `EDITOR_INVALID_SOURCE` | Current YAML cannot be parsed or validated for the requested operation. |
| `EDITOR_READONLY` | A mutation was requested while the editor is readonly. |
| `EDITOR_DESTROYED` | Public API was called after `destroy()`. |
| `EDITOR_INVALID_SELECTION` | Command requires a compatible selection. |
| `EDITOR_LOCKED_TARGET` | Command targets a locked layer or object. |
| `EDITOR_ASSET_PREVIEW_FAILED` | Asset preview provider failed. |
| `EDITOR_ASSET_MANIFEST_INVALID` | Asset manifest URL returned invalid manifest data. |
| `EDITOR_ASSET_NOT_IN_MANIFEST` | YAML declares an external asset not found in the active manifest. |

Core parser, validator, compiler, runtime, and CLI error codes are preserved in
diagnostics when those subsystems report failures.
