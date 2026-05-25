# City Growth Example

This example mirrors the visual-editor advertisement composition with a small
city scene: streets, a canal bridge, park space, towers, traffic, and animated
preview routes.

Source:

- `source.isostate.yaml` is the authored scene.
- `assets/` contains one-cell SVG assets for editor placement.
- `scene.isostate.js` is generated from the source YAML.

Regenerate:

```bash
~/.bun/bin/bun packages/cli/src/bin.ts compile examples/city-growth/source.isostate.yaml --out examples/city-growth/scene.isostate.js
```
