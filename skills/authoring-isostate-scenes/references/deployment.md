# CLI And Static Deployment

Use this when reviewing examples, docs, or CI scripts that validate authored
YAML, compile runtime bundles, inspect generated metadata, or need deployable
browser assets.

## CLI Command Surface

```bash
npx --package @sebastianwessel/isostate-cli isostate validate scene.isostate.yaml
npx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml --out public/scene.isostate.js
npx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml --out public/scene.isostate.json --format json
npx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml --out public/isostate/scene
npx --package @sebastianwessel/isostate-cli isostate inspect public/isostate/scene/scene.isostate.js
```

- `validate` checks the authored YAML and semantic references.
- `compile` produces one compiled runtime bundle as `.isostate.js` or
  `.isostate.json`.
- `bundle` produces static website output with runtime, scene bundle, copied
  assets, and manifest.
- `inspect` reads compiled JS or JSON bundles and reports format, version,
  digest, scene count, layers, assets, and floor size.

After installing the CLI as a dev dependency, use the package binary directly:

```bash
isostate bundle examples/basic/source.isostate.yaml \
  --out examples/basic/static-bundle \
  --asset-dir examples/basic/assets \
  --public-asset-base ./assets
```

## Bundle Shape

```text
public/isostate/scene/
  isostate.runtime.js
  scene.isostate.js
  manifest.json
  assets/
    <referenced external asset source files>
```

- `scene.isostate.js` is compiled scene data.
- `isostate.runtime.js` is the standalone browser runtime.
- `assets/` contains only referenced external asset source files, including
  standalone SVG assets and sprite sheet image files.
- `manifest.json` records source, runtime, scene, asset paths, and digests.

## Review Rules

- Prefer documenting
  `npx --package @sebastianwessel/isostate-cli isostate ...` for one-off usage
  and `isostate ...` after users install the CLI as a dev dependency. Use Bun
  commands only when documenting this repository's own contributor workflow.
- Generate editor catalogs with
  `isostate assets manifest <asset-dir> --out <manifest> --asset-base-url <url>`.
  Keep one manifest per asset family when catalogs have separate source roots.
- Use `validate` before `compile` or `bundle` in CI examples unless the command
  being documented already validates internally.
- Use `inspect` when docs describe troubleshooting, cache checks, or generated
  artifact verification.
- Static output must not include authored YAML, parser, validator, compiler,
  CLI, or the `yaml` package.
- Built-in generated assets (`text`, `rectangle`, `circle`, `polygon`, `line`)
  are not copied into `assets/`.
- Use `--asset-dir` when YAML asset paths are relative to a shared source
  asset directory.
- Use `--public-asset-base` when copied assets are served from a non-default
  URL such as `/isostate/scene/assets`.
- Do not edit generated static bundle files by hand. Change the YAML or source
  assets and regenerate.
