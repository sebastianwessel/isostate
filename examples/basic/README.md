# Basic Browser Demo

This demo loads the built browser runtime from `packages/core/dist/index.js` and
a precompiled `scene.isostate.js` bundle. The YAML source is included as
`source.isostate.yaml` for reference; the browser does not parse YAML. SVG
assets are shared from `../../assets/aws-3d` and are referenced through
`header.assetBaseUrl`.
The demo also draws a lightweight projected grid overlay so anchor placement is
visible in the browser.

Note: `source.isostate.yaml` uses the approved header + scenes/deltas authoring
shape. `scene.isostate.js` shows the generated runtime shape consumed by the
browser: compiled floor/layout metadata plus ordered scene snapshots.

Run from the repository root:

```bash
bun run build
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173/examples/basic/
```

To jump directly to a compiled scene progress for visual checks:

```text
http://localhost:4173/examples/basic/?progress=1
```

To generate the static deployment bundle for this example:

```bash
bun run examples:basic:bundle
```

The command writes:

```text
examples/basic/static-bundle/
  isostate.runtime.js
  scene.isostate.js
  manifest.json
  assets/
```
