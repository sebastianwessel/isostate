# @sebastianwessel/isostate-cli

Command line tools for validating, compiling, inspecting, and bundling
Isostate `.isostate.yaml` scene files.

## Links

- Website: https://sebastianwessel.github.io/isostate
- Repository: https://github.com/sebastianwessel/isostate
- Issues: https://github.com/sebastianwessel/isostate/issues
- Documentation: https://sebastianwessel.github.io/isostate/docs/getting-started.md/

## Use With npx

```bash
npx --package @sebastianwessel/isostate-cli isostate validate scene.isostate.yaml
npx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml --output scene.isostate.js
npx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml --out public/isostate/scene
```

## Install

```bash
npm install --save-dev @sebastianwessel/isostate-cli
```

Then run:

```bash
isostate validate scene.isostate.yaml
isostate compile scene.isostate.yaml --output scene.isostate.js
isostate bundle scene.isostate.yaml --out public/isostate/scene
```

The bundle command writes a browser-ready runtime, compiled scene module,
referenced assets, and a manifest for static hosting.
