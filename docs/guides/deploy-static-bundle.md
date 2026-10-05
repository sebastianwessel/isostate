# Deploy Static Bundle

Use the CLI bundle workflow when a website should load isostate without running
YAML parsing or compilation in the browser.

## Generate Public Output

```bash
npx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml --out public/isostate/scene
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

The module imports resolve relative to the importing page or script, but the
asset URLs inside the compiled scene do not: the renderer resolves each asset
URL against the page's base URL (`document.baseURI`). For the page above,
which sits in the public root while the bundle lives in `isostate/scene/`,
generate the bundle with a matching asset base, otherwise the default
`./assets` points at `/assets/` and every image is missing:

```bash
npx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml \
  --out public/isostate/scene \
  --public-asset-base ./isostate/scene/assets
```

The default `--public-asset-base ./assets` fits a page served from the bundle
directory itself.

## Asset Paths

By default, copied external asset source files are referenced as
`./assets/<file>` in the compiled scene bundle. The browser resolves these URLs
against the page that mounts the scene, not against the bundle module, so the
default only works for a page served from the bundle directory. Normal SVG
assets still append `.svg` during resolution when omitted; sprite sheet paths
keep their explicit image extension. Use `--public-asset-base` with the path
from the page to the copied `assets/` directory, a root-relative path, or a CDN
prefix.

```bash
npx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml \
  --out public/isostate/scene \
  --public-asset-base /isostate/scene/assets
```

For assets declared with paths that are relative to a shared source directory,
set `--asset-dir` explicitly:

```bash
npx --package @sebastianwessel/isostate-cli isostate bundle examples/basic/source.isostate.yaml \
  --out examples/basic/static-bundle \
  --asset-dir assets/aws-3d \
  --public-asset-base ./assets
```

That command produces the same static bundle shape shown above, rooted at
`examples/basic/static-bundle/`.

## Inspect Output

```bash
npx --package @sebastianwessel/isostate-cli isostate inspect public/isostate/scene/scene.isostate.js
```

Inspection verifies the runtime bundle digest and reports scene, layer, asset,
floor, and version metadata.
