# Create Assets With An AI Assistant

The `creating-isostate-assets` skill gives an assistant the technical workflow
for creating, importing, repairing, and maintaining isostate artwork. You
choose the visual style. The skill handles formats, crops, anchors, stable IDs,
catalog metadata, provenance, and distribution.

## Install

```bash
npx skills add sebastianwessel/isostate --skill creating-isostate-assets
```

Install [the scene authoring skill](../guides/install-authoring-skill.md) as
well when your task includes scene YAML or a timeline. The asset skill supplies
artwork and catalog guidance; the scene skill supplies composition and the DSL.

## Supply The Style And Scope

Give the assistant your style description, reference images, or an existing
catalog to match. Include the concepts and variants you need, target viewing
size/backgrounds, and where the assets should be used. Photorealism, watercolor,
flat vector, pixel art, and other media are valid inputs; there is no required
palette or material treatment.

For example:

```text
Use $creating-isostate-assets to create browser, queue, and worker assets.
Style: soft watercolor, muted earth tones, paper texture, isometric perspective.
Match the attached reference. Keep the objects transparent and separate.
Use editable scene captions rather than painted labels. Add the catalog to
our website and verify desktop and mobile placement at one grid cell.
```

For maintenance, say which operation you want: add, replace, move, rename,
remove, or optimize. Specify IDs that must stay stable and any source/licence
constraints. An existing catalog can provide the style direction without a new
brief. A new family without a style reference requires a style choice first.

## Expected Deliverables

- Original artwork, prompts or source attribution, and separate derived exports
  when requested.
- Safe standalone SVGs, or raster sprite sheets with measured dimensions,
  explicit crop rectangles, and checked square-viewport anchors.
- `.isostate-assets.yaml` and a CLI-generated `manifest.json` with stable,
  distinct sheet and placeable sprite IDs.
- Licence and provenance notices identifying the actual source/provider. Credit
  OpenAI models for OpenAI-generated assets; preserve third-party credits for
  imported artwork. Record a model ID only when the tool exposes it.
- A validated and compiled scene using the changed objects, plus rendered checks
  for ground contact, clipping, caption spacing, and semantic variants.
- Updated package/website copies and notices wherever the catalog is distributed.

The skill includes focused references for generation, geometry, and catalog
lifecycle, and a standalone rendered-preview recipe, plus seven evaluation cases covering different styles, imports,
maintenance, licensing, and tasks that belong to scene authoring.

See [Assets Workflow](../guides/assets-workflow.md) for manifest commands and
[Asset Manifest](../examples/asset-manifest.md) for editor integration.
