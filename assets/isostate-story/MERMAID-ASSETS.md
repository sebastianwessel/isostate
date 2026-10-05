# Mermaid workflow illustrations

`mermaid-workflow-sheet.png` is the photorealistic replacement for the original
seven shaded cube illustrations. It retains their mint, gold, violet, blue,
orange, green, and slate palettes, their isometric camera, and soft studio
lighting. Distinct silhouettes communicate source, skills, AI, YAML, assets,
validation, and visual editing before the viewer reads the captions.

`mermaid-workflow.manifest.json` records the seven logical sprite ids, exact
source rectangles, checked anchors, and source digest. The sheet is RGBA,
1774 × 887 pixels, with real transparency. Its bottom-right tile is empty.
The orange organizer has a wider crop to retain the side handle and models;
the green bundle has a narrower crop to exclude its neighbors. These are
viewport crops, without modifying the generated image pixels.

Place each sprite at `size: 1` and retain its manifest anchor. The website scene
uses separate whole-cell caption bands below the artwork and quiet ground
plates. Scope host SVG sizing to the scene root so nested sprite viewports
retain their native crop and clipping.

The original seven `mermaid-*.svg` cube assets have been retired. The website
workflow consumes the sprite sheet through the same seven logical ids.

## Generation

Created with the built-in Image Gen tool on 2026-10-05. The final prompt follows.

Use case: stylized-concept. Asset type: transparent sprite sheet for an enterprise isometric website workflow. Create a beautiful photorealistic miniature product-render catalog of seven distinctly recognizable one-object assets. Uniform fixed 3D isometric orthographic camera (30-degree elevation), softly lit from upper left, realistic brushed metal, matte ceramic/plastic, glass, subtle bevels and contact shadows. Retain the calm existing palette: mint source terminal, warm gold skill manuals, violet AI workstation, blue YAML blueprint/document, orange asset organizer, green validated software bundle, slate visual editor console. No generic colored cubes, no toy/cartoon look, no flat vector geometric icons. Exactly a 4-column by 2-row grid of equally sized isolated tiles, no borders or grid marks, generous transparent gutters, each object entirely within its own tile. Tile positions: row1 column1 compact mint desktop terminal with a clear branching-node diagram screen; row1 column2 a gold collection of three technical skill manuals with page tabs; row1 column3 a violet AI workstation with a sculptural glowing neural processor on a sleek workstation base; row1 column4 a blue rolled blueprint beside a standing structured document with subtle code-like lines. Row2 column1 an orange open asset organizer tray holding miniature polished isometric models (tree, server, office); row2 column2 a green downloadable software module package with a prominent white checkmark seal; row2 column3 a slate desktop editor console with two side-by-side panels, code lines and a small isometric preview on screen; row2 column4 completely empty. Absolutely no labels, letters, numbers, logos, watermark or background. Real alpha transparency, small soft isolated contact shadows only. Cohesive high-end enterprise diagram assets, same physical scale, ground level, orientation and material treatment across all tiles. Output wide landscape sheet suitable for cropping independent tiles.
