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

## Help

Run `isostate` with no arguments, `isostate --help`, or `isostate -h` to print
global usage and exit `0`. The listing covers every command, in this order:
`validate`, `compile`, `bundle`, `assets manifest`, `inspect`, `mermaid2dsl`.

```bash
isostate --help
```

Run `isostate <command> --help` (or `-h`) for a specific command's synopsis,
description, and options; this exits `0` without executing the command, for
example `isostate validate --help` or `isostate assets manifest --help`.

An unknown command prints `ERROR CLI_UNKNOWN_COMMAND <name>` plus the global
usage text to stderr and exits `1`.

## Commands

### validate

Checks YAML syntax, scene schema, semantic references, asset declarations,
routes, layers, and lifecycle deltas.

```bash
npx --package @sebastianwessel/isostate-cli isostate validate scene.isostate.yaml
```

Use this as the fastest CI check for authored YAML.

Diagnostics are grouped: errors print first under an `Errors (<n>)` header on
stderr, warnings print after under a `Warnings (<n>)` header on stdout, and a
summary line follows on stdout — `OK`, `OK (<n> warnings)`, or
`FAILED (<e> errors, <w> warnings)`.

```text
$ isostate validate scene.isostate.yaml
OK
```

```text
$ isostate validate scene.isostate.yaml
Warnings (1)
WARN UNREFERENCED_ASSET asset=gateway Asset "gateway" is declared but never used
OK (1 warnings)
```

A failing document (errors on stderr, warnings and summary on stdout):

```text
$ isostate validate scene.isostate.yaml 1>stdout.log 2>stderr.log; cat stderr.log
Errors (1)
ERROR ASSET_NOT_DECLARED scene=initial element=server-1 Asset "server" is not declared in header.assets
$ cat stdout.log
FAILED (1 errors, 0 warnings)
```

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

Add `--pretty` for unminified, indented output (useful when diffing generated
bundles or debugging):

```bash
npx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml \
  --out public/scene.isostate.js \
  --pretty
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

`--scene-name <name>` sets the output scene bundle basename (default `scene`,
producing `<name>.isostate.js`). `--runtime <copy|external|none>` controls the
runtime artifact (default `copy`): `copy` writes `isostate.runtime.js` into the
bundle, `external` omits it and assumes the host page loads the runtime some
other way, and `none` omits it entirely.

```bash
npx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml \
  --out public/isostate/scene \
  --scene-name lobby \
  --runtime external
```

See [Deploy Static Bundle](./deploy-static-bundle.md) for the full output
layout and runtime boundary.

### assets manifest

Recursively scans a directory of SVG and sprite sheet assets and writes an
`isostate.asset-manifest` JSON file for the visual editor's asset browser.

```bash
npx --package @sebastianwessel/isostate-cli isostate assets manifest assets \
  --out public/isostate-assets.manifest.json \
  --asset-base-url ./assets
```

Options: `--out <path>` (default `isostate-assets.manifest.json`),
`--asset-base-url <url>` written into the manifest's `assetBaseUrl` (default
`./assets`), `--metadata <path>` for optional labels/anchors/tags/sprite sheet
definitions (default `<asset-dir>/.isostate-assets.yaml` when present), and
`--pretty` to write indented JSON (on by default). See
[Asset Manifest](../examples/asset-manifest.md) for the manifest output shape
and a worked example.

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
