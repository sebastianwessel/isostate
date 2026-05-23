# Editor Export

Export YAML source and compiled runtime bundles from an editor instance.

## Export From `mountEditor`

```ts
import { mountEditor } from '@sebastianwessel/isostate-editor';

const editor = mountEditor(document.getElementById('editor')!, {
  initialYaml: await Bun.file('scene.isostate.yaml').text()
});

// Export canonical YAML
const yaml = editor.exportYaml();
await Bun.write('scene-exported.isostate.yaml', yaml);

// Export compiled JS bundle
try {
  const jsBundle = editor.exportRuntimeBundle('js');
  await Bun.write('scene.isostate.js', jsBundle);
} catch (error) {
  console.error('Compile failed:', (error as Error).message);
}

// Export compiled JSON bundle
try {
  const jsonBundle = editor.exportRuntimeBundle('json');
  await Bun.write('scene.isostate.json', jsonBundle);
} catch (error) {
  console.error('Compile failed:', (error as Error).message);
}
```

## Export With `onExport`

```tsx
import '@sebastianwessel/isostate-editor/style.css';
import { IsostateEditor } from '@sebastianwessel/isostate-editor/react';

function handleExport(artifact: EditorExportArtifact) {
  const blob = new Blob([artifact.content], {
    type: artifact.kind === 'yaml' ? 'text/yaml' : 'application/javascript'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = artifact.filename;
  a.click();
  URL.revokeObjectURL(url);
}

<IsostateEditor
  defaultValue={defaultYaml}
  onExport={handleExport}
  mode="split"
/>
```

## Serialize Workspace And Document

```ts
import {
  serializeEditorWorkspace,
  serializeSceneDocument
} from '@sebastianwessel/isostate-editor';

// From a workspace handle
const yaml = serializeEditorWorkspace(workspace);

// From a parsed document
const yaml = serializeSceneDocument(document);
```

`serializeSceneDocument()` follows canonical editor serialization rules.
`serializeEditorWorkspace()` returns the workspace source YAML when the
document is unavailable, otherwise returns canonical serialized scene YAML.

Export commands never download automatically. They return artifacts to the host
app or trigger `onExport`.
