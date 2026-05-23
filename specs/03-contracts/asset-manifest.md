# Contracts: Asset Manifest

## Overview

An asset manifest is a browser-readable catalog of URL-loaded assets available
to the visual editor. It supports standalone SVG assets and sprite sheet assets.
It solves asset discovery without requiring the browser to read a server
directory listing or local filesystem path.

The manifest is editor tooling metadata. Authored `.isostate.yaml` still stores
only the existing DSL fields under `header.assetBaseUrl` and `header.assets[]`.

## File Layout

The primary source layout is a user-selected asset root:

```text
assets/
  group-folder/
    asset.svg
    nested-asset.svg
  sprites/
    app-icons.png
  other-group/
    asset.svg
```

The generated manifest should usually be hosted next to that root:

```text
public/
  assets/
    group-folder/
      asset.svg
    sprites/
      app-icons.png
  isostate-assets.manifest.json
```

The editor receives the manifest URL, fetches it, and uses the manifest entries
to populate the asset browser.

## Manifest Shape

```ts
interface AssetManifest {
  format: 'isostate.asset-manifest';
  version: 1;
  generatedAt: string;
  assetBaseUrl: string;
  assets: AssetManifestEntry[];
}

type AssetManifestEntry = UrlAssetManifestEntry | SpriteSheetManifestEntry;

interface UrlAssetManifestEntry {
  id: string;
  type?: 'url';
  path: string;
  group: string;
  name: string;
  label?: string;
  anchor?: [number, number];
  tags?: string[];
  width?: number;
  height?: number;
  digest: string;
}

interface SpriteSheetManifestEntry {
  id: string;
  type: 'sprite-sheet';
  path: string;
  group: string;
  name: string;
  label?: string;
  anchor?: [number, number];
  tags?: string[];
  width: number;
  height: number;
  sheetSize: [number, number];
  tileSize?: [number, number];
  sprites: Record<string, SpriteManifestDefinition>;
  digest: string;
}

type SpriteManifestDefinition =
  | [number, number]
  | {
      at?: [number, number];
      rect?: [number, number, number, number];
      anchor?: [number, number];
      label?: string;
      tags?: string[];
    };
```

Rules:

- `format` is the exact string `isostate.asset-manifest`.
- `version` is the integer `1`.
- `generatedAt` is an ISO 8601 timestamp.
- `assetBaseUrl` is the URL/path prefix that authored YAML should place in
  `header.assetBaseUrl` when using this manifest.
- `assets[]` is sorted by `group`, then `name`, then `path`.
- URL asset entries omit `type` or set `type: 'url'`.
- Sprite sheet entries must set `type: 'sprite-sheet'`.
- URL `assets[].id` is a DSL-safe kebab-case id derived from the relative SVG
  path without extension by normalizing every path segment and joining segments
  with `-`.
- Sprite sheet `assets[].id` is a DSL-safe kebab-case namespace id derived from
  the relative image path without extension. Nested `sprites` keys are the
  placeable asset ids.
- `assets[].path` is the slash-separated path relative to `assetBaseUrl`.
- `assets[].group` is the normalized first directory segment. Assets directly
  below the root use `ungrouped`.
- `assets[].name` is the filename stem normalized for display without the group
  prefix.
- `label` is optional display text from metadata. It must not affect generated
  ids or authored YAML.
- `anchor`, when omitted, means the DSL default `[0.5, 1]`.
- `tags` is optional editor metadata and must not be copied into authored YAML.
- URL `width` and `height` are optional SVG viewport dimensions for editor
  display.
- Sprite sheet `width`, `height`, and `sheetSize` are required and must match
  the source image pixel dimensions recorded by manifest generation.
- Sprite sheet `tileSize` is optional unless at least one sprite uses tuple or
  `at` addressing.
- Sprite sheet sprite definitions use the same semantics as authored YAML:
  tuple and `at` values are tile coordinates; `rect` values are source-image
  pixels; sprite-level `anchor` overrides sheet-level `anchor`.
- `digest` is the lowercase `sha256:<hex>` digest of the source file bytes.
- Relative `assetBaseUrl` values resolve relative to the manifest URL for editor
  preview loading. The editor writes the literal manifest `assetBaseUrl` into
  YAML.

Example:

```json
{
  "format": "isostate.asset-manifest",
  "version": 1,
  "generatedAt": "2026-05-22T17:00:00.000Z",
  "assetBaseUrl": "./assets",
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
        "database": { "at": [1, 0], "anchor": [0.5, 0.92] },
        "wide-service": { "rect": [128, 0, 96, 64] }
      },
      "digest": "sha256:0f74f5a7c2a0a4d8ec4c9e9956d8f3b56d087a1ef71b36f9d5fa9a9177ab7f60"
    }
  ]
}
```

## Optional Metadata File

The CLI reads optional metadata from `<asset-dir>/.isostate-assets.yaml` when
present:

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
      wide-service:
        rect: [128, 0, 96, 64]
```

Rules:

- Metadata keys are slash-separated paths relative to `asset-dir`.
- Unknown metadata paths produce `ASSET_MANIFEST_METADATA_ORPHAN`.
- `label` must be a non-empty string at most 80 characters.
- `anchor` uses the same validation rules as `header.assets[].anchor`.
- `tags` is a list of unique kebab-case strings.
- `type` may be omitted for URL SVG assets and must be `sprite-sheet` for
  sprite sheet metadata.
- Sprite sheet metadata is required for raster sprite sheet files; the generator
  does not infer sprite rectangles.
- Sprite sheet metadata follows the authored YAML sprite sheet rules for
  `tileSize`, `anchor`, `sprites`, `at`, `rect`, and sprite-level anchors.
- Metadata never changes generated ids or manifest `path`.
- If metadata is invalid, manifest generation exits non-zero and writes no
  output.

## Id Derivation

For `assets/<relative>.svg` URL assets:

1. Remove `.svg`.
2. Split the relative path into path segments.
3. Normalize each segment to lowercase kebab-case using the same identifier
   rules as authored DSL ids.
4. Join normalized segments with `-`.
5. If two files resolve to the same id, manifest generation fails with
   `ASSET_MANIFEST_ID_COLLISION`.

Normalization rules:

- Non-ASCII letters are transliterated when the platform provides stable
  Unicode normalization; otherwise they are removed.
- Consecutive separators collapse to one hyphen.
- Empty normalized segments fail with `ASSET_MANIFEST_INVALID_FILENAME`.
- Case-only path collisions fail with `ASSET_MANIFEST_PATH_COLLISION` so
  manifests are portable across case-insensitive filesystems.

Examples:

| Relative path | id | group | name |
|---|---|---|---|
| `servers/api.svg` | `servers-api` | `servers` | `api` |
| `network/load-balancer.svg` | `network-load-balancer` | `network` | `load-balancer` |
| `database.svg` | `database` | `ungrouped` | `database` |

For sprite sheet files, id derivation removes the full supported extension
(`.png`, `.webp`, `.jpg`, `.jpeg`, or `.svg`) and follows the same path-segment
normalization. Sprite ids are read from metadata and are not derived from the
sheet filename. If a sprite id collides with any URL asset id, sheet namespace
id, built-in generated asset id, or another sprite id, manifest generation fails
with `ASSET_MANIFEST_ID_COLLISION`.

## Editor Use

When a user drags an asset from a manifest-backed browser into the scene, the
editor writes or reuses:

```yaml
header:
  assetBaseUrl: ./assets
  assets:
    - id: servers-api
      path: servers/api.svg
```

Rules:

- The editor adds a `header.assets[]` entry only when the selected manifest
  asset is not already declared.
- The editor copies `anchor` into the YAML entry only when the manifest entry
  declares one.
- The editor never writes `group`, `name`, or `tags` into YAML.
- Manifest assets with ids reserved by built-in generated assets are rejected.

When a user drags a sprite manifest entry into the scene, the editor writes or
reuses the containing sprite sheet declaration and places the logical sprite id
on the element:

```yaml
header:
  assetBaseUrl: ./assets
  assets:
    - id: sprites-app-icons
      type: sprite-sheet
      path: sprites/app-icons.png
      sheetSize: [512, 256]
      tileSize: [64, 64]
      anchor: [0.5, 1]
      sprites:
        server: [0, 0]
        database:
          at: [1, 0]
          anchor: [0.5, 0.92]
        wide-service:
          rect: [128, 0, 96, 64]

scenes:
  - id: initial
    elements:
      - id: api
        asset: server
        at: [1, 1]
```

Editor rules for sprite manifests:

- The asset browser displays each nested sprite as a draggable logical asset.
- Dragging any sprite from a sheet adds or reuses exactly one
  `type: sprite-sheet` entry in `header.assets`.
- The editor writes the sheet declaration from the manifest without `group`,
  `name`, sheet `label`, sheet `tags`, sprite `label`, or sprite `tags`.
- The element's `asset` value is the nested sprite id, never the sheet id.
- If a YAML document already declares the same sheet id with different `path`,
  `sheetSize`, `tileSize`, or sprite definitions, the editor must not merge
  silently; it reports `EDITOR_ASSET_CONFLICT` and leaves YAML unchanged.

## SVG Safety

The manifest does not make asset files trusted markup.

Rules:

- Editors and previews must load assets by URL-backed image mechanisms.
- Editors must not inject SVG file contents into `innerHTML`.
- Manifest generation treats asset files as opaque bytes for digesting. It may
  parse URL SVG root dimensions/viewBox and may read raster image dimensions to
  populate required sprite sheet `sheetSize`.
- SVG files containing `<script>` or event-handler attributes produce
  `ASSET_MANIFEST_UNSAFE_SVG` by default.
- External references inside SVG files are not allowed in v1 and are rejected
  with `ASSET_MANIFEST_EXTERNAL_REFERENCE`.
- Raster sprite sheet files are never decoded into canvas pixels by the editor
  runtime; only manifest generation reads dimensions.
