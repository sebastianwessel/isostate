# City Growth Example

This example mirrors the visual-editor advertisement composition with a small
city scene: streets, a canal bridge, park space, towers, traffic, and animated
preview routes.

This demo loads the built browser runtime from `packages/core/dist/index.js` and
a precompiled `scene.isostate.js` bundle. The YAML source is included as
`source.isostate.yaml` for reference; the browser does not parse YAML. SVG
assets are shared from `./assets` and are referenced through
`header.assetBaseUrl`.

Note: `source.isostate.yaml` uses the approved header + scenes/deltas authoring
shape. `scene.isostate.js` shows the generated runtime shape consumed by the
browser: compiled floor/layout metadata plus ordered scene snapshots.

Do not open `index.html` through `file://`. Browsers restrict local ES module
imports and linked SVG assets in that mode, so the example must be served over
HTTP.

Run from the repository root:

```bash
bun run examples:city-growth:serve
```

Then open:

```text
http://localhost:4175/examples/city-growth/
```

If port `4175` is already in use, run the two steps manually with another port:

```bash
bun run build
python3 -m http.server 4176
```

Then open `http://localhost:4176/examples/city-growth/`. The server must be
started from the repository root, not from `examples/city-growth`, because
the demo imports the built runtime from `packages/core/dist` and loads shared
assets from `assets/`.

To generate the static deployment bundle for this example:

```bash
bun run examples:city-growth:bundle
```

The command writes:

```text
examples/city-growth/static-bundle/
  isostate.runtime.js
  scene.isostate.js
  manifest.json
  assets/
```

Source:

- `source.isostate.yaml` is the authored scene.
- `assets/` contains one-cell SVG assets for editor placement.
- `scene.isostate.js` is generated from the source YAML.

Regenerate:

```bash
~/.bun/bin/bun packages/cli/src/bin.ts compile examples/city-growth/source.isostate.yaml --out examples/city-growth/scene.isostate.js --pretty
```
