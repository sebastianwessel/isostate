# Formats, Crops, And Anchors

## Supported Sources

- URL assets: self-contained SVG, correct `xmlns`, valid `viewBox`, no scripts,
  event handlers, or external references. Current CLI limit: 512 KiB per SVG.
- Sprite sheets: PNG, WebP, JPG/JPEG, or SVG. Current raster limit: 2 MiB per
  sheet. Use alpha-capable PNG/WebP for transparent objects; JPEG is suitable
  only when an opaque background is intentional. GIF is not supported.
- A standalone raster object is a one-sprite sheet, with `rect` spanning the
  full source image and actual `sheetSize`. Do not invent a URL-PNG DSL type.
- Default one-cell SVG blueprint: square `viewBox="0 0 64 64"`, centered mass,
  visual contact point at bottom center for `[0.5, 1]`. Existing artwork can use
  other source dimensions when its checked viewport anchor is retained.

## Crops

Use `rect: [x, y, width, height]` in whole source-image pixels. Rectangles must
fit inside actual `sheetSize`. Include the complete logical object and its
intended contact shadow without including a neighboring object. Avoid oversized
transparent margins that make one asset read smaller than the family.

Tuple `[column, row]` or `at` addressing requires `tileSize` and genuinely
regular tiles. Measure explicit rectangles for irregular generated sheets.
Check every sprite independently on light and dark backgrounds. Confirm actual
alpha with image metadata/pixels rather than judging a checkerboard screenshot.
Keep the source image intact when only its viewport needs adjustment.

## Anchors In The Runtime Viewport

`anchor: [ax, ay]` is normalized within the square runtime viewport, not the
raw image rectangle. Default `[0.5, 1]` is bottom center. The renderer applies
`preserveAspectRatio="xMidYMax meet"`; it never infers ground contact.

For a crop of width W and height H, and a chosen contact point (px, py)
measured relative to the crop's top-left, the bottom-aligned square fit gives:

```text
m = max(W, H)
ax = (1 - W/m)/2 + px/m
ay = 1 - H/m + py/m
```

For square crops this reduces to `[px/W, py/H]`. For a source viewBox with a
nonzero origin, first subtract that origin from the contact point. Treat the
formula as a starting measurement; verify the contact on the rendered grid.
Choose the object's physical contact point, not its shadow's outermost pixel.
Declare per-sprite anchors when contact points differ. Do not copy `[0.5, 0.9]`
into every entry without checking it.

## Rendered Evidence

Place changed assets at native `size: 1` on an isometric grid beside existing
family objects. Review proportions, contact, sprite clipping, and all variants.
Use separate caption cells/bands and sufficient spacing; text's local baseline
means a one-cell move may still place it over the object. Measure real rendered
bounds and adjust grid layout/wrapping to keep captions clear of every image.
A contrast outline can improve text readability after spacing is correct.

Review the actual desktop/mobile canvas and every affected scene stop. Camera
focus must keep relevant artwork and captions within the viewport. Compare
actual screen font sizes rather than authored SVG font sizes alone.

Scope host sizing rules to the root scene SVG (`.scene-target > svg`), because
sprite assets use nested SVG viewports. Broad SVG width/height rules can expose
neighboring tiles. When measuring nested crops, transform their x/y/width/height
using the parent group's screen matrix; the nested SVG's bounding rectangle may
include the full sheet. Use text's actual rendered bounds for captions.
