# Editor Basic

Mount the editor on a plain HTML element with `mountEditor`.

```ts
import { mountEditor } from '@sebastianwessel/isostate-editor';

const initialYaml = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: initial
    add:
      elements:
        - id: box-1
          asset: rectangle
          at: [1, 1]
          primitive:
            rectangle:
              fill: "#3b82f6"
`;

const target = document.getElementById('editor');
if (!target) throw new Error('Missing #editor mount target');

const editor = mountEditor(target, {
  initialYaml,
  theme: 'system',
  onChange(event) {
    console.log('Operation:', event.operation.type);
    console.log('Diagnostics:', event.diagnostics.length);
  }
});

// Later: save current YAML
const yaml = editor.exportYaml();

// Cleanup when the page unloads
window.addEventListener('beforeunload', () => editor.destroy(), { once: true });
```

`mountEditor` owns the React root and all DOM below `target`. Call `destroy()`
when removing the host page or component to unmount React and remove event
listeners.
