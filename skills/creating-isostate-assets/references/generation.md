# Generation And Style Inputs

## Record The Brief

Record the user's visual reference or description, objects and semantic roles,
output medium, intended cell scale, variants, and backgrounds. For a family,
keep the selected perspective, lighting, relative physical scale, palette, and
material treatment consistent across batches. These values come from the user
or their reference catalog; no fixed palette or photorealistic default applies.

Choose SVG for editable vector artwork when that matches the brief. Choose
raster generation for painterly, photographic, textured, or rendered materials.
Use the available image-generation/editing tool and its instructions for raster
work; use an imagegen skill when available. Do not generate or edit images with
an unrelated fallback that contradicts the selected tool's rules. When tools
are unavailable, produce clearly identified prompts or metadata drafts rather
than pretending that images exist.

## Compose A Prompt

Combine three distinct pieces:

1. **User style:** reference artwork, medium, perspective, palette, materials,
   lighting, and level of detail.
2. **Semantic inventory:** one recognizable concept per tile/file, named role,
   explicit variants and their differences, consistent relative scale.
3. **Delivery requirements:** pre-rendered 2D imagery, isolated logical objects,
   target file/sheet layout, clear gutters, no clipped parts or shadows,
   no scene labels or long arrows baked into art, true alpha when requested.

For sheets, enumerate row/column positions and any deliberately empty tiles.
Generated output may not follow the proposed equal grid: measure actual object
extents before declaring rectangles. Separate difficult objects into individual
images when a sheet cannot keep them isolated. Expose each individual image as
one full-image sprite instead of changing the DSL.

Preserve useful reference detail. Simplifying a photorealistic brief to shaded
cubes fails the style request; imposing photorealism on a flat-vector brief also
fails it. A white/checkerboard-painted background is not alpha transparency.

## Inspect Before Integrating

Inspect the full output and every intended crop. Check the requested style,
logical meaning, intended variant direction, consistent perspective/scale,
alpha, shadows, tile boundaries, and any unintentionally generated lettering.
Regenerate a defective crop/sheet with the same style reference; do not hide
clipping with a larger scene size or relabel a mismatched visual metaphor.

## Preserve Provenance

Keep original source images and generation prompts with the catalog. Record the
provider/tool, date, supplied style references, and model identifier only when
it is actually exposed. Keep source versus derived image files distinguishable.
Do not store credentials, private transcripts, or unrelated customer material.

Include the applicable project/third-party licence and a provenance notice in
source, hosted downloads, and packaged catalog copies. Credit OpenAI models for
artwork actually created with OpenAI Image Gen; credit other providers or
artists according to the real source. Keep notice links with individual-file
website downloads. Generation credit does not itself choose or change a licence;
follow the user's licence choice and established catalog terms.
