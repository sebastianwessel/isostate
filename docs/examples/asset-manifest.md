# Asset Manifest

Generate a browser-readable asset manifest from standalone SVG files and
metadata-declared sprite sheet image files. The editor uses this manifest to
populate the asset browser and discover draggable assets.

## Generate A Manifest

```bash
npx --package @sebastianwessel/isostate-cli isostate assets manifest assets/isostate \
  --out public/isostate-assets.manifest.json \
  --asset-base-url ./assets/isostate
```

Arguments:

- `assets/isostate` — source directory containing SVG files, sprite sheet image
  files declared in metadata, and subdirectories
- `--out` — output path for the generated manifest (default:
  `isostate-assets.manifest.json`)
- `--asset-base-url` — URL prefix written into the manifest and used by the
  editor when declaring assets in YAML (default: `./assets`)
- `--metadata` — optional path to a `.isostate-assets.yaml` metadata file

## Manifest Output Shape

```json
{
  "format": "isostate.asset-manifest",
  "version": 1,
  "generatedAt": "2026-05-22T17:00:00.000Z",
  "assetBaseUrl": "./assets/isostate",
  "assets": [
    {
      "id": "servers-api",
      "type": "url",
      "path": "servers/api.svg",
      "group": "servers",
      "name": "api",
      "digest": "sha256:7b346904f63abe8a1ebfb8aa11895365c70462cf58d1a698861b90116ba23f4c"
    },
    {
      "id": "sprites-app-icons",
      "type": "sprite-sheet",
      "path": "sprites/app-icons.png",
      "group": "sprites",
      "name": "app-icons",
      "width": 512,
      "height": 256,
      "sheetSize": [512, 256],
      "tileSize": [64, 64],
      "sprites": {
        "server": [0, 0],
        "database": { "at": [1, 0], "anchor": [0.5, 0.92] }
      },
      "digest": "sha256:0f74f5a7c2a0a4d8ec4c9e9956d8f3b56d087a1ef71b36f9d5fa9a9177ab7f60"
    }
  ]
}
```

Fields:

- `format` — exact string `isostate.asset-manifest`
- `version` — integer `1`
- `generatedAt` — ISO 8601 timestamp
- `assetBaseUrl` — URL prefix for authored YAML `header.assetBaseUrl`
- `assets[]` — sorted by `group`, then `name`, then `path`
- `assets[].id` — kebab-case URL asset id or sprite sheet namespace id
- `assets[].type` — omitted/`url` for standalone SVG assets,
  `sprite-sheet` for sprite sheets
- `assets[].path` — path relative to `assetBaseUrl`
- `assets[].group` — first directory segment, or `ungrouped` for root files
- `assets[].sprites` — logical placeable sprite ids for sprite sheet entries
- `assets[].digest` — `sha256:<hex>` of the source file bytes

## Optional Metadata

Create `<asset-dir>/.isostate-assets.yaml` to override labels, anchors, and
 tags:

```yaml
assets:
  servers/api.svg:
    label: API Server
    anchor: [0.5, 0.92]
    tags: [server, backend]
  sprites/app-icons.png:
    type: sprite-sheet
    tileSize: [64, 64]
    anchor: [0.5, 1]
    sprites:
      server: [0, 0]
      database:
        at: [1, 0]
        anchor: [0.5, 0.92]
```

Metadata never changes generated ids or manifest paths. Invalid metadata causes
manifest generation to exit non-zero with no output.

## Editor Integration

Pass the manifest URL to the editor:

```ts
mountEditor(target, {
  assetManifestUrl: '/isostate-assets.manifest.json'
});
```

When a user drags a manifest asset into the scene, the editor writes:

```yaml
header:
  assetBaseUrl: ./assets/isostate
  assets:
    - id: servers-api
      path: servers/api.svg
```

The editor never writes `group`, `name`, or `tags` into authored YAML.

When a user drags a sprite, the editor writes or reuses the containing
`type: sprite-sheet` declaration and places the nested sprite id on the element.
