# Static Deployment

Use this when reviewing examples or docs that need deployable browser assets.

## CLI Commands

```bash
bunx --package @sebastianwessel/isostate-cli isostate validate scene.isostate.yaml
bunx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml --out public/scene.isostate.js
bunx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml --out public/isostate/scene
bunx --package @sebastianwessel/isostate-cli isostate inspect public/isostate/scene/scene.isostate.js
```

For local workspace checks, use:

```bash
bun run isostate -- bundle examples/basic/source.isostate.yaml \
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
    <referenced external SVG assets>
```

- `scene.isostate.js` is compiled scene data.
- `isostate.runtime.js` is the standalone browser runtime.
- `assets/` contains only referenced external SVG assets.
- `manifest.json` records source, runtime, scene, asset paths, and digests.

## Review Rules

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
