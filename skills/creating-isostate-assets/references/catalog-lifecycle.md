# Catalog Creation, Maintenance, And Distribution

## Sources And Metadata

Own each family in a separate asset root. Keep image/SVG sources, prompts or
source attribution, `.isostate-assets.yaml`, generated `manifest.json`, and
licence/provenance notices together. Metadata paths are relative to that root.

Example for a single 512 × 512 transparent image:

```yaml
assets:
  review/handoff-sheet.png:
    type: sprite-sheet
    sheetSize: [512, 512]
    label: Review handoff
    sprites:
      review-handoff:
        rect: [0, 0, 512, 512]
        anchor: [0.5, 0.94]
        label: Review handoff
        tags: [review, handoff]
```

The example anchor is illustrative; measure the actual artwork. This source
path derives the sheet namespace `review-handoff-sheet`, distinct from the
placeable sprite ID `review-handoff`.

Choose filename stems and sprite IDs that are unique together. Derived URL or
sheet IDs normalize relative path segments to kebab case. Stable logical sprite
IDs belong to metadata; moving a sheet must not silently rename those IDs.
Reserved built-ins `text`, `rectangle`, `circle`, `polygon`, and `line` cannot
be declared. Labels are nonempty, at most 80 characters; tags are unique kebab
case. Sprite-level labels/tags are editor metadata, not scene YAML fields.

## Generate And Exercise The Catalog

```bash
isostate assets manifest public/assets/my-family \
  --out public/assets/my-family/manifest.json --asset-base-url ./ --pretty
isostate validate scene.isostate.yaml
isostate compile scene.isostate.yaml --out public/scene.isostate.js
```

Use the installed CLI or the repository's Bun runner; do not assume global
installation. In the isostate repository, `bun run isostate` runs the local CLI.
The manifest generator rejects unsafe SVG, path/ID collisions, orphaned
metadata, missing raster metadata, mismatched dimensions, invalid rectangles,
and oversized files. Do not hand-edit generated digests to bypass a failure.

A colocated manifest's `assetBaseUrl: ./` resolves relative to its URL for editor
loading. Scene `header.assetBaseUrl` resolves from the hosted scene/application
context; account for the site prefix. Pass a real hosted manifest URL through
`mountEditor({ assetManifestUrls: [...] })` and verify sprite discovery, import,
and rendered loading. The sheet namespace is never a placeable element asset.

## Add, Replace, Rename, Or Remove

- Add: supply source and metadata, generate manifest, place the logical ID in
  an actual sample, validate/compile, then review rendered output.
- Replace pixels: retain logical IDs when meaning is unchanged, remeasure
  dimensions/crops/anchors, regenerate byte digests and affected bundles.
- Rename/move: inventory references before changing paths or IDs. Migrate
  scene declarations, later-scene asset swaps, downloads, and authored examples
  explicitly. Prefer stable public sprite IDs; explain any breaking rename.
- Remove: update metadata and all references, including later-scene additions
  and asset swaps; delete obsolete hosted/packaged copies through the sync path.
- Optimize/derive: keep original source bytes; record derived filenames and
  measurements, preserve requested alpha/style, and regenerate their digests.

In this repository, software catalogs use `scripts/software-catalog-files.ts`
for the shared distribution list, `bun run assets:build` for npm/website copies,
and `bun run site:build` for the website. Other families need their own existing
sync wiring or an explicit addition to it. Keep notices/prompts in the copied
file list, editor manifest URLs working, and changed source scene bundles fresh.
Verify copied bytes and packaging paths instead of assuming an old copy is new.

## Scope And Completion

Keep asset maintenance separate from redesigning scene behavior. Use the scene
or Mermaid authoring skill for story composition. Do not change the DSL/runtime
schema to store style briefs, licence text, or generated-image service config.
Return changed IDs/files, validation, visual review, and any migration impact.
