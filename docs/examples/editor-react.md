# Editor React

Use `IsostateEditor` as a controlled React component inside an existing React
tree.

```tsx
import '@sebastianwessel/isostate-editor/style.css';
import { IsostateEditor } from '@sebastianwessel/isostate-editor/react';
import { useCallback, useState } from 'react';

const DEFAULT_YAML = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
`;

export function SceneEditor() {
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [diagnostics, setDiagnostics] = useState<EditorDiagnostic[]>([]);

  const handleChange = useCallback((event: EditorChangeEvent) => {
    setYaml(event.sourceYaml);
    setDiagnostics(event.diagnostics);
  }, []);

  return (
    <div>
      <IsostateEditor
        value={yaml}
        onChange={handleChange}
        mode="split"
        theme="system"
      />
      <p>Diagnostics: {diagnostics.length}</p>
    </div>
  );
}
```

Import `@sebastianwessel/isostate-editor/style.css` once at the application
level. The component does not require Tailwind CSS or a shadcn setup.

In Astro, mount with `client:only="react"` because the editor accesses DOM APIs
on mount:

```astro
---
import { SceneEditor } from '../components/SceneEditor.tsx';
---

<SceneEditor client:only="react" />
```
