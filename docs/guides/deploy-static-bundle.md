# Deploy Static Bundle

Use the CLI bundle workflow when a website should load isostate without running
YAML parsing or compilation in the browser.

## Generate Public Output

```bash
bunx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml --out public/isostate/scene
```

Copy or generate the output under the website public folder. The generated
directory contains:

```text
public/isostate/scene/
  isostate.runtime.js
  scene.isostate.js
  manifest.json
  assets/
    service.svg
    gateway.svg
```

Only browser-safe files are deployed. The YAML parser, validator, compiler, CLI,
and `yaml` package stay in development tooling.

`scene.isostate.js` contains compiled runtime scene data. It does not include
authored YAML, YAML parsing, DSL validation, or compiler code.

## Browser Usage

```html
<div id="scene"></div>
<script type="module">
  import { mountScene } from './isostate/scene/isostate.runtime.js';
  import sceneBundle from './isostate/scene/scene.isostate.js';

  mountScene(document.querySelector('#scene'), sceneBundle, {
    controller: {}
  });
</script>
```

Adjust the import paths to match the final public URL for the generated
directory. For example, output written to `public/diagrams/network` should be
imported from `./diagrams/network/isostate.runtime.js` and
`./diagrams/network/scene.isostate.js` when the page is served from the public
root.

## Asset Paths

By default, copied SVG assets are referenced as `./assets/<file>.svg` from the
compiled scene bundle. Use `--public-asset-base` when the website serves assets
from a different relative path or CDN prefix.

```bash
bunx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml \
  --out public/isostate/scene \
  --public-asset-base /isostate/scene/assets
```

For assets declared with paths that are relative to a shared source directory,
set `--asset-dir` explicitly:

```bash
bunx --package @sebastianwessel/isostate-cli isostate bundle examples/basic/source.isostate.yaml \
  --out examples/basic/static-bundle \
  --asset-dir assets/aws-3d \
  --public-asset-base ./assets
```

That command produces the same static bundle shape shown above, rooted at
`examples/basic/static-bundle/`.

## Inspect Output

```bash
bunx --package @sebastianwessel/isostate-cli isostate inspect public/isostate/scene/scene.isostate.js
```

Inspection verifies the runtime bundle digest and reports scene, layer, asset,
floor, and version metadata.
