# Contracts: Editor Package

## Package

| Field | Value |
|---|---|
| Package | `@sebastianwessel/isostate-editor` |
| Directory | `packages/editor` |
| Runtime | browser authoring UI |
| Audience | scene authors, documentation authors, app developers |
| Stability | experimental |
| Depends on | `@sebastianwessel/isostate`, `@sebastianwessel/isostate/editor-support`, `@sebastianwessel/isostate/dsl/browser`, React, Radix primitives, code editor tooling |
| Must not be imported by | `@sebastianwessel/isostate` root runtime, static runtime bundle, `@sebastianwessel/isostate-cli` |

The editor package may ship browser authoring dependencies. Those dependencies
must remain outside the core runtime dependency graph.

The editor package renders scene previews through core runtime APIs and uses
`@sebastianwessel/isostate/editor-support` for projection, hit testing, object
metadata, and selection bounds. It owns authoring commands, YAML mutation,
selection state, overlays, and UI controls.

## Package Exports

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./react": {
      "types": "./dist/react.d.ts",
      "import": "./dist/react.js"
    },
    "./style.css": "./dist/style.css"
  },
  "peerDependencies": {
    "react": ">=19",
    "react-dom": ">=19"
  }
}
```

Rules:

- The package ships as an embeddable editor library, not as the only standalone
  app surface.
- `mountEditor` owns React mounting for non-React hosts.
- `IsostateEditor` is exported from both `.` and `./react`.
- Host applications import `@sebastianwessel/isostate-editor/style.css` once.
- shadcn-compatible CSS variable names may be used, but the package must not
  require Tailwind, a host shadcn project, or generated component source.
- A standalone app may wrap this package, but standalone persistence is outside
  the package contract.

## Public API Inventory

execution_semantics:
  editor: in_process browser UI
  data: data_only

public_builder: `mountEditor` is the high-level browser authoring API.
`IsostateEditor` is the React component API for applications that already own a
React tree.

| Entry | Kind | Owner | Audience | Stability | Execution Semantics | Contract Source | Example Path | Test Path |
|---|---|---|---|---|---|---|---|
| `mountEditor` | SDK function | `packages/editor/src/index.ts` | app developers | experimental | in_process | `03-contracts/editor.md` | `docs/examples/editor-basic.md` | `tests/editor/mount-editor.test.ts` |
| `IsostateEditor` | React component | `packages/editor/src/IsostateEditor.tsx` | React app developers | experimental | in_process | `03-contracts/editor.md` | `docs/examples/editor-react.md` | `tests/editor/isostate-editor.test.tsx` |
| `EditorWorkspace` and editor types | schema/types | `packages/editor/src/types.ts` | app and tool developers | experimental | data_only | `01-domains/editor-workspace.md` | `docs/reference/editor.md` | `tests/editor/types.test.ts` |
| `createEditorWorkspace` | SDK function | `packages/editor/src/workspace.ts` | app developers, tests | experimental | in_process | `03-contracts/editor.md` | `docs/examples/editor-basic.md` | `tests/editor/workspace.test.ts` |
| `serializeEditorWorkspace` | SDK function | `packages/editor/src/serialization.ts` | app developers, tests | experimental | in_process | `03-contracts/editor.md` | `docs/examples/editor-export.md` | `tests/editor/serialization.test.ts` |
| `serializeSceneDocument` | SDK function | `packages/editor/src/serialization.ts` | app developers, tests | experimental | in_process | `03-contracts/editor.md` | `docs/examples/editor-export.md` | `tests/editor/serialization.test.ts` |
| `applyEditorCommand` | SDK function | `packages/editor/src/commands.ts` | editor package, tests | experimental | in_process | `03-contracts/editor.md`, `02-capabilities/editor.md` | `docs/reference/editor.md` | `tests/editor/commands.test.ts` |

## Core Reuse Rules

- Rendering uses `mountScene` or a lower-level core runtime API.
- Camera preview uses core controller/camera helpers.
- Layer order and object metadata come from compiled runtime data and
  `editor-support`.
- Drag, selection, resize, nudge, route editing, inspector updates, undo/redo,
  and YAML serialization are editor-owned.
- The editor may request new core helpers when reuse would avoid duplicating
  projection, bounds, layer, camera, or runtime metadata logic.
- New core helpers must be runtime-safe and covered by tests before editor code
  depends on them.

## Command And Serialization API

```ts
function serializeSceneDocument(document: SceneDocument): string;
function applyEditorCommand(
  workspace: EditorWorkspace,
  command: EditorCommand,
): EditorCommandResult;
```

Rules:

- `serializeSceneDocument()` follows the canonical editor serialization rules in
  `02-capabilities/editor.md`.
- `applyEditorCommand()` is the only public helper that mutates workspace state.
  It returns a new workspace object and never mutates the input workspace.
- Commands must not access DOM APIs.
- Commands that update YAML parse, validate, and recompile through the
  browser-safe DSL entrypoint before reporting success.

## Mount API

```ts
interface MountEditorOptions {
  initialYaml?: string;
  initialWorkspace?: EditorWorkspaceInput;
  assetManifestUrl?: string;
  assetProvider?: EditorAssetProvider;
  theme?: 'light' | 'dark' | 'system';
  readonly?: boolean;
  onChange?: (event: EditorChangeEvent) => void;
  onValidate?: (diagnostics: EditorDiagnostic[]) => void;
  onExport?: (artifact: EditorExportArtifact) => void;
}

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

function mountEditor(
  target: HTMLElement,
  options?: MountEditorOptions,
): MountedEditor;
```

Rules:

- `initialYaml` and `initialWorkspace` are mutually exclusive.
- When neither is provided, the editor starts with a minimal valid scene
  document containing one layer, one empty first scene, and default grid/floor
  settings.
- `mountEditor` owns the React root and all DOM below `target`.
- `destroy()` unmounts React, removes event listeners, cancels editor workers,
  and leaves `target` empty.
- `exportRuntimeBundle()` validates and compiles the current YAML before
  returning canonical JS or JSON. It throws structured editor errors when the
  document is invalid.

## React Component API

```ts
interface IsostateEditorProps {
  value?: string;
  defaultValue?: string;
  assetManifestUrl?: string;
  assetProvider?: EditorAssetProvider;
  theme?: 'light' | 'dark' | 'system';
  readonly?: boolean;
  onChange?: (event: EditorChangeEvent) => void;
  onValidate?: (diagnostics: EditorDiagnostic[]) => void;
  onExport?: (artifact: EditorExportArtifact) => void;
}
```

Rules:

- `value` makes YAML source controlled by the host app.
- `defaultValue` initializes uncontrolled YAML source.
- Controlled mode emits `onChange` but does not mutate `value`.
- The editor always renders canvas, inspector/sidebar, and YAML editor panes
  from left to right. The canvas pane must clip rather than scroll; the
  inspector/sidebar and YAML editor panes scroll independently. Hosts do not
  choose canvas-only or YAML-only modes.
- The scene sidebar has three tabs: Inspector, Scene Tree, and Assets. Scene
  Tree combines scenes, layers, and elements in a collapsible drag-sortable
  tree.
- Uncontrolled mode owns `sourceYaml` internally.
- Component styling uses editor CSS variables and does not require global CSS,
  Tailwind, or shadcn setup beyond the editor package stylesheet.

## Workspace Input

```ts
interface EditorWorkspaceInput {
  name?: string;
  sourceYaml: string;
  activeSceneId?: string;
}
```

The input intentionally excludes editor-only visibility, lock, pan, zoom, and
selection state. Host applications cannot initialize persistent editor-only UI
state through v1 workspace input.

## Persistence Contract

The editor package owns in-memory authoring state only. It does not write files,
use browser storage by default, or call remote APIs by itself.

Persistence is host-owned:

- Non-React hosts call `exportYaml()` or listen to `onChange`.
- React hosts use controlled `value` or `onChange`.
- Standalone file workflows use browser import/export actions provided by the
  host shell.
- Editor-only UI state such as visibility, locks, selection, pan, zoom, and
  sidebar width is not persisted by v1 APIs and must not be written to authored
  YAML.

## Change Events

```ts
interface EditorChangeEvent {
  sourceYaml: string;
  document?: SceneDocument;
  diagnostics: EditorDiagnostic[];
  operation: EditorOperation;
}

type EditorOperation =
  | { type: 'yaml.edit' }
  | { type: 'yaml.format' }
  | { type: 'scene.add' | 'scene.update' | 'scene.remove' | 'scene.reorder'; sceneId: string }
  | { type: 'object.add' | 'object.update' | 'object.remove' | 'object.reorder'; sceneId: string; objectId: string }
  | { type: 'connection.add' | 'connection.update' | 'connection.remove'; sceneId: string; connectionId: string }
  | { type: 'layer.add' | 'layer.update' | 'layer.remove' | 'layer.reorder'; layer: string }
  | { type: 'asset.add' | 'asset.update' | 'asset.remove'; assetId: string }
  | { type: 'camera.update' | 'camera.remove'; sceneId: string };
```

Rules:

- Every semantic visual edit emits exactly one `EditorChangeEvent`.
- Continuous drag emits preview state internally and emits one semantic change
  when the drag commits.
- YAML typing is debounced and emits `yaml.edit` changes.

## Asset Provider

```ts
interface EditorAssetProvider {
  listAssets(): Promise<EditorAssetCatalog>;
  resolveAssetPreview(asset: AssetManifestEntry | AssetCatalogEntry): Promise<EditorAssetPreview>;
}

interface EditorAssetCatalog {
  assetBaseUrl: string;
  assets: AssetManifestEntry[];
}

interface EditorAssetPreview {
  url: string;
  width?: number;
  height?: number;
  sprite?: {
    sheetSize: [number, number];
    rect: [number, number, number, number];
  };
}
```

Rules:

- Manifest URL loading is the default asset provider. The host passes
  `assetManifestUrl` or an `EditorAssetProvider`; the editor fetches and
  validates the manifest described in `03-contracts/asset-manifest.md`.
- The provider is used only for editor discovery and previews.
- Exported YAML keeps authored `assetBaseUrl`, `path`, `anchor`, `type`,
  `sheetSize`, `tileSize`, and `sprites` values.
- Built-in assets do not call the provider.
- Provider failures create non-fatal diagnostics and show a missing-asset
  placeholder in the canvas.
- When a URL manifest asset is dragged into the scene, the editor writes
  `header.assetBaseUrl` from the catalog when missing and adds the selected
  asset to `header.assets[]` with `id`, `path`, and optional `anchor`.
- When a sprite manifest asset is dragged into the scene, the editor writes or
  reuses the containing `type: sprite-sheet` declaration with `id`, `path`,
  `sheetSize`, optional `tileSize`, optional sheet `anchor`, and the full
  manifest `sprites` map. The placed element uses the nested sprite id as
  `asset`.
- If YAML already declares the same sheet id with different sprite sheet
  metadata, the editor reports `EDITOR_ASSET_CONFLICT` and leaves YAML
  unchanged.
- Relative preview URLs resolve against the manifest URL. The literal
  `assetBaseUrl` value from the manifest is what the editor writes into YAML.
- External previews must be rendered as URL-backed image content. Sprite
  previews use the same nested SVG `viewBox` cropping contract as runtime. The
  editor must not inline untrusted SVG markup into the DOM.
- The asset browser supports search, group filtering, recently used assets,
  missing asset diagnostics, unused declared assets, and reconciliation of YAML
  asset declarations against the loaded manifest.

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

Editor-specific errors use structured codes:

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
| `EDITOR_ASSET_CONFLICT` | Manifest drag would merge with an existing asset or sprite sheet id whose URL, sheet size, tile size, anchor, or sprite definitions differ. |

Core parser, validator, compiler, runtime, and CLI error codes are preserved in
diagnostics when those subsystems report failures.
