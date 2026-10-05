# Standalone Rendered Preview

Use the target application's existing preview when available. Otherwise this
recipe exercises the single-image metadata example from the catalog reference.
Replace its source path, dimensions, crop, anchor, and IDs with the actual
manifest values; these illustrative values are not universal defaults.

## Minimal Scene

Save `scene.isostate.yaml` in the project root:

```yaml
header:
  version: "0.1"
  name: asset-inspection
  assetBaseUrl: ./assets
  assets:
    - id: review-handoff-sheet
      type: sprite-sheet
      path: review/handoff-sheet.png
      sheetSize: [512, 512]
      sprites:
        review-handoff:
          rect: [0, 0, 512, 512]
          anchor: [0.5, 0.94]
  grid:
    cellSize: 192
  floor:
    visible: true
    size: [4, 4]
    layer: ground
  layers:
    - name: ground
    - name: structures
    - name: labels
scenes:
  - id: inspection
    elements:
      - id: artwork
        asset: review-handoff
        at: [1, 1]
        size: 1
        layer: structures
      - id: caption
        asset: text
        at: [3, 3]
        layer: labels
        text:
          value: Review handoff
          placement: cell
          align: middle
          fontSize: 30
          fill: var(--asset-caption)
```

## Bundle And Host

```bash
bun run isostate validate scene.isostate.yaml
bun run isostate bundle scene.isostate.yaml \
  --asset-dir public/assets/my-family --out .tmp/asset-preview
```

Here `--asset-dir` is the catalog root containing `review/handoff-sheet.png`;
it is not the YAML's parent. Explicit bundling resolves declared asset paths
against that directory and rewrites them for copied browser assets.

Bundling replaces the output directory. Keep host templates outside it and copy
or recreate `index.html` after every bundle. The bundle copies referenced art,
not the catalog's provenance/licence files: also copy the applicable notices
and licence into the distributed asset directory through the project's sync path.

After bundling, write `.tmp/asset-preview/index.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>Asset inspection</title>
<style>
  #scene { width: 100%; height: 540px; --asset-caption: #334155; }
  #scene > svg { width: 100%; height: 100%; }
</style>
<div id="scene"></div>
<script type="module">
  import { mountScene } from './isostate.runtime.js';
  import bundle from './scene.isostate.js';
  mountScene(document.querySelector('#scene'), bundle);
</script>
```

Serve the folder over HTTP with the project's server or
`python3 -m http.server 4173 --directory .tmp/asset-preview`. Inspect the actual
render at desktop and narrow widths, then the product's light/dark backgrounds.
Adjust whole-cell caption placement, font size, and camera/layout for the actual
art rather than assuming this sample proves readability. Record what was viewed;
a narrow desktop canvas is not evidence of a real mobile-device test.
