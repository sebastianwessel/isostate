# Use The Editor In Astro

The `@sebastianwessel/isostate-editor` package renders a visual scene editor in
the browser. In Astro, mount it as a React island so it hydrates only in the
client.

## Prerequisites

- Astro project with React support (`@astrojs/react`)
- Assets hosted under `public/` so they are served as static files

No Tailwind CSS or shadcn setup is required. The editor ships its own
stylesheet.

## Generate An Asset Manifest

If you want the editor to show a browsable asset catalog, generate a manifest
from your asset directory:

```bash
npx --package @sebastianwessel/isostate-cli isostate assets manifest assets/isostate \
  --out public/isostate-assets.manifest.json \
  --asset-base-url ./assets/isostate
```

`assets/isostate` is the source directory containing grouped SVG files.
`public/isostate-assets.manifest.json` becomes a static URL that the editor
fetches at runtime.

See [Asset Manifest Example](../examples/asset-manifest.md) for the full
command surface and output shape.

## Mount As A React Island

Import the editor stylesheet once in your Astro layout or page:

```astro
---
// src/pages/editor.astro
---

<link rel="stylesheet" href="/node_modules/@sebastianwessel/isostate-editor/dist/style.css" />
<div id="editor-mount"></div>

<script>
  import { mountEditor } from '@sebastianwessel/isostate-editor';

  const target = document.getElementById('editor-mount');
  if (!target) throw new Error('Missing mount target');

  const editor = mountEditor(target, {
    assetManifestUrl: '/isostate-assets.manifest.json',
    theme: 'system',
    onChange(event) {
      console.log('Changed:', event.operation.type);
    }
  });

  window.addEventListener('beforeunload', () => editor.destroy(), { once: true });
</script>
```

For separate catalogs, keep each manifest and asset folder independent and pass
all manifest URLs:

```js
const editor = mountEditor(target, {
  assetManifestUrls: [
    '/assets/aws-3d.manifest.json',
    '/assets/traffic.manifest.json'
  ]
});
```

Or use an Astro React island component:

```astro
---
import IsostateEditorPage from '../components/IsostateEditorPage.tsx';
---

<IsostateEditorPage client:only="react" />
```

```tsx
// src/components/IsostateEditorPage.tsx
import '@sebastianwessel/isostate-editor/style.css';
import { IsostateEditor } from '@sebastianwessel/isostate-editor/react';

export default function IsostateEditorPage() {
  return (
    <IsostateEditor
      defaultValue={`header:\n  version: "1"\n  assets: []\n  layers:\n    - name: default\nscenes:\n  - id: scene-1\n`}
      assetManifestUrl="/isostate-assets.manifest.json"
      theme="system"
    />
  );
}
```

`client:only="react"` is required because the editor accesses DOM APIs
immediately on mount.

## Persistence

The editor does not persist to files or browser storage by itself. The host
application owns persistence:

- Listen to `onChange` and write `event.sourceYaml` to your backend, file, or
  storage layer.
- Call `editor.exportYaml()` or `editor.exportRuntimeBundle('js')` before save
  actions.
- In React, use controlled `value` with `onChange` to keep YAML in Astro state
  or a store.

Editor-only UI state such as pan, zoom, selection, pane sizing, and the active
sidebar tab is not persisted by v1 APIs.

## Editing Text Labels

The inspector shows text controls when the selected element uses `asset: text`.
`placement: cell` keeps text centered in its own grid cell and is best for
standalone labels, group labels, callouts, and labels beside larger assets.
`placement: caption` keeps a label attached above a one-cell icon and can share
the icon's `at` position.

Placement changes only the text anchor inside the text element. Move the text
element's `at` position when switching between standalone labels and icon
captions.
