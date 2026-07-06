# Use The CLI

Use `@sebastianwessel/isostate-cli` when you want repeatable build-time checks
for `.isostate.yaml` files, compiled runtime bundles, or static website output.
The CLI is dev-time tooling. Do not ship it to the browser.

## Run Without Installing

```bash
npx --package @sebastianwessel/isostate-cli isostate validate scene.isostate.yaml
npx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml --out public/scene.isostate.js
npx --package @sebastianwessel/isostate-cli isostate inspect public/scene.isostate.js
```

If your project uses Bun, the same package can also be run with `bunx`.

## Install In A Project

```bash
npm install --save-dev @sebastianwessel/isostate-cli
```

Then call the `isostate` binary from package scripts or CI:

```bash
isostate validate scene.isostate.yaml
isostate compile scene.isostate.yaml --out public/scene.isostate.js
isostate bundle scene.isostate.yaml --out public/isostate/scene
isostate inspect public/isostate/scene/scene.isostate.js
isostate mermaid2dsl flow.mmd
```

## Commands

### validate

Checks YAML syntax, scene schema, semantic references, asset declarations,
routes, layers, and lifecycle deltas.

```bash
npx --package @sebastianwessel/isostate-cli isostate validate scene.isostate.yaml
```

Use this as the fastest CI check for authored YAML.

### compile

Compiles a YAML scene into a browser-loadable runtime bundle. Use JavaScript
output when you want direct `import` usage.

```bash
npx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml \
  --out public/scene.isostate.js
```

Use JSON output when your app loads scene data separately:

```bash
npx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml \
  --out public/scene.isostate.json \
  --format json
```

### bundle

Writes deployable static output: the standalone browser runtime, compiled scene
bundle, copied referenced assets, and a manifest with digests.

```bash
npx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml \
  --out public/isostate/scene \
  --asset-dir assets/isostate \
  --public-asset-base ./assets
```

See [Deploy Static Bundle](./deploy-static-bundle.md) for the full output
layout and runtime boundary.

### inspect

Reads a compiled bundle and prints metadata such as format, version, digest,
scene count, layers, assets, and floor size.

```bash
npx --package @sebastianwessel/isostate-cli isostate inspect public/scene.isostate.js
npx --package @sebastianwessel/isostate-cli isostate inspect public/scene.isostate.json
```

Use this in troubleshooting when a deployed page loads a stale or unexpected
bundle.

### mermaid2dsl

Converts a supported Mermaid flowchart subset into a starting
`.isostate.yaml` scene: shapes, labels, grid layout, and connections. Dev-time
only; never adds the `mermaid` package as a dependency.

```bash
npx --package @sebastianwessel/isostate-cli isostate mermaid2dsl flow.mmd
npx --package @sebastianwessel/isostate-cli isostate mermaid2dsl flow.mmd --out scenes/flow.isostate.yaml
```

`--out` defaults to the input path with its extension replaced by
`.isostate.yaml`. The generated document is validated before writing;
conversion warnings (`MERMAID_LABEL_DROPPED`, `MERMAID_CYCLE_BROKEN`) print
but do not fail the command. See
[Convert A Mermaid Flowchart](./convert-mermaid.md) for the supported input
subset and a worked example.

## CI Pattern

```bash
npx --package @sebastianwessel/isostate-cli isostate validate scene.isostate.yaml
npx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml --out public/scene.isostate.js
npx --package @sebastianwessel/isostate-cli isostate inspect public/scene.isostate.js
```

For static sites, prefer `bundle` over hand-copying files.
