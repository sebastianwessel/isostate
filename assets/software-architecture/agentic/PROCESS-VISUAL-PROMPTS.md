# Process visual generation prompts

Generated with the built-in ImageGen tool on 2026-10-05. All four final PNGs are unaltered generated outputs with actual RGBA transparency. Each sheet is 1774 × 887 pixels and contains eight logical sprites in row-major order. No CLI or external API generation was used.

The canonical source `../.isostate-assets.yaml` and distributed `../manifest.json` record image paths relative to `assets/software-architecture`, pixel rectangles `[x, y, width, height]`, normalized anchors within each rectangle, labels, and tags. Anchors were visually checked at the lower ground contact of each sculpture. Independent crop partitions account for generated spacing; they are deliberately not assumed to be equal square cells.

Visual review confirmed distinct subjects, no lettering, and no visible clipping or neighboring-object bleed. Alpha inspection confirmed 0–255 channels and that all pixels with alpha at least 16 lie inside their assigned crop boundaries. Extremely faint generation fringe pixels may remain outside visible object silhouettes; source bytes are preserved.

## Orchestration

File: `orchestration-sprites.png`

Logical sprites: `agent-workflow`, `agent-parallel`, `agent-router`, `agent-condition`, `agent-loop`, `agent-retry`, `agent-timeout`, `agent-error`.

Exact submitted prompt:

```text
Use case: stylized-concept.
Asset type: production PNG sprite atlas for an isometric software architecture library.
Create exactly EIGHT separate photorealistic miniature 3D product sculptures in a perfectly regular FOUR COLUMN by TWO ROW grid. Wide 2:1 canvas, ideally 2048x1024. Each grid cell contains exactly one freestanding compact sculpture, visually centered, same scale, fitting a one-cell diamond ground footprint. All eight objects have identical orthographic isometric camera (view down about 30 degrees, visible top and front/right), realistic bevels, brushed gunmetal and silver, frosted cyan glass, beautiful precise PBR studio lighting, restrained amber indicator lights. Actual transparent RGBA background, no floor, no backdrop, no fake checkerboard. Each sculpture is entirely contained within the central 75% of its grid cell: at least 12% clear transparent margin around every cell, no touching neighbors or canvas borders, no connecting elements between sprites, no cast shadows beyond its own compact contact shadow. Each is physically detailed and volumetric, like premium collectible industrial hardware, not a flat symbol or a simple rectangle. Do not include words, letters, digits, labels, typography, captions, watermarks, decorative background, frames or grid lines. Symbols described below are substantial sculptural parts, never printed labels. Exact row-major subjects follow:
TOP ROW left to right:
1. Workflow: three small cyan glass step podiums joined in sequence by short silver mechanical bridges, ascending slightly on one compact dark base.
2. Parallel: one central silver inlet manifold dividing into three equally prominent cyan glass processing branches on a compact mechanical base, clearly parallel.
3. Router: a hefty central rotary metal junction with three cyan glass pipe outlets in diverging directions and one amber selected outlet, a physical switching mechanism.
4. Condition: a standing diamond-shaped cyan glass decision prism held inside a substantial metal pivot frame; two short exit channels, one green and one amber.
BOTTOM ROW left to right:
5. Loop: a thick circular cyan glass processing ring fitted into a horizontal metal turntable, clockwise sculptural arrow integrated into the ring.
6. Retry: a silver flywheel with a prominent amber curved return arrow wrapping halfway around a small cyan processor; clearly an industrial return/restart mechanism.
7. Timeout: a large realistic hourglass with luminous amber grains, thick brushed metal top and bottom collars, compact cyan timing control at foot.
8. Error: a rugged diagnostic console with a substantial red translucent upright warning triangle containing a sculptural exclamation mark, no written screen text.
Ensure all eight silhouettes are distinctive and separated by generous fully transparent gutters.
```

## Lifecycle

File: `lifecycle-sprites.png`

Logical sprites: `agent-trigger`, `agent-schedule`, `agent-await-human`, `agent-approval`, `agent-rejection`, `agent-escalation`, `agent-audit`, `agent-complete`.

Exact submitted prompt:

```text
Use case: stylized-concept.
Asset type: production PNG sprite atlas for an isometric software architecture library.
Create exactly EIGHT separate photorealistic miniature 3D product sculptures in a perfectly regular FOUR COLUMN by TWO ROW grid. Wide 2:1 canvas, ideally 2048x1024. Each grid cell contains exactly one freestanding compact sculpture, visually centered, same scale, fitting a one-cell diamond ground footprint. All eight objects have identical orthographic isometric camera (view down about 30 degrees, visible top and front/right), realistic bevels, brushed gunmetal and silver, frosted cyan glass, beautiful precise PBR studio lighting, restrained amber indicator lights. Actual transparent RGBA background, no floor, no backdrop, no fake checkerboard. Each sculpture is entirely contained within the central 75% of its grid cell: at least 12% clear transparent margin around every cell, no touching neighbors or canvas borders, no connecting elements between sprites, no cast shadows beyond its own compact contact shadow. Each is physically detailed and volumetric, like premium collectible industrial hardware, not a flat symbol or a simple rectangle. Do not include words, letters, digits, labels, typography, captions, watermarks, decorative background, frames or grid lines. Symbols described below are substantial sculptural parts, never printed labels. Exact row-major subjects follow:
TOP ROW left to right:
1. Trigger: a spring-loaded industrial pushbutton mechanism, oversized amber tactile button on a small dark steel base, cyan spark-shaped glass actuator rising behind it.
2. Schedule: a substantial upright analog clock with cyan glass face, simple hour and minute hands but no numerals, brushed silver frame, attached to a miniature calendar-like metal rack with blank tabs.
3. Await human: a friendly realistic miniature silver human bust, shoulders and head, beside a small slanted cyan console with two substantial amber pause bars rising from it, both share one compact base.
4. Approval: a large green translucent checkmark mounted as a thick physical seal inside a circular silver inspection-stamp frame, small cyan dock at foot.
BOTTOM ROW left to right:
5. Rejection: a substantial red horizontal barrier boom lowered across a small dark checkpoint gate, frosted red shield with a physical silver X behind it, compact base.
6. Escalation: a stepped metal tower with three increasingly taller cyan glass sections and an amber upward arrow rail climbing its side; reads as raised priority.
7. Audit: a beautiful thick open ledger with realistic ivory pages, cyan metal binding and a small magnifying glass over check-shaped indentations; no written words or glyphs.
8. Complete: a finished silver trophy-like circular green glass medallion with raised silver checkmark, mounted over neatly stacked closed cyan document trays, celebratory but no confetti.
Ensure all eight silhouettes are distinctive and separated by generous fully transparent gutters.
```

## Servicenow

File: `servicenow-sprites.png`

Logical sprites: `servicenow-interaction`, `servicenow-request`, `servicenow-requested-item`, `servicenow-request-task`, `servicenow-catalog-item`, `servicenow-incident`, `servicenow-problem`, `servicenow-change`.

Exact submitted prompt:

```text
Use case: stylized-concept.
Asset type: production PNG sprite atlas for an isometric software architecture library.
Create exactly EIGHT separate photorealistic miniature 3D product sculptures in a perfectly regular FOUR COLUMN by TWO ROW grid. Wide 2:1 canvas, ideally 2048x1024. Each grid cell contains exactly one freestanding compact sculpture, visually centered, same scale, fitting a one-cell diamond ground footprint. All eight objects have identical orthographic isometric camera (view down about 30 degrees, visible top and front/right), realistic bevels, brushed gunmetal and silver, frosted cyan glass, beautiful precise PBR studio lighting, restrained amber indicator lights. Actual transparent RGBA background, no floor, no backdrop, no fake checkerboard. Each sculpture is entirely contained within the central 75% of its grid cell: at least 12% clear transparent margin around every cell, no touching neighbors or canvas borders, no connecting elements between sprites, no cast shadows beyond its own compact contact shadow. Each is physically detailed and volumetric, like premium collectible industrial hardware, not a flat symbol or a simple rectangle. Do not include words, letters, digits, labels, typography, captions, watermarks, decorative background, frames or grid lines. Symbols described below are substantial sculptural parts, never printed labels. Exact row-major subjects follow:
This sheet is a ServiceNow business-workflow family. Use distinctive ServiceNow-inspired emerald green glass in place of cyan for the main record panels, with silver metal and restrained lime accents. The eight physical objects must be medium-small, occupying at most 65% of their allocated cell, with EXTRA generous margins including above tall objects.
TOP ROW left to right:
1. Interaction: a substantial emerald glass conversation bubble nested with a smaller clear reply bubble, mounted in a silver cradle; a compact sculptural conversation record.
2. Request: a silver intake tray holding one upright green glass document envelope with a substantial plus-shaped silver seal, looks like an incoming business request.
3. Requested item: a compact emerald glass product cube inside an open silver parcel cradle, with one dangling unlettered green ticket tag showing a circular recessed mark.
4. Request task: a realistic freestanding green metal clipboard with an ivory inset panel, three substantial silver checkmarks and shallow horizontal engraved lines, no letters.
BOTTOM ROW left to right:
5. Catalog item: a single polished green glass package showcased on a miniature circular rotating product pedestal under a curved silver showcase arm, premium purchasable catalog product.
6. Incident: a miniature rugged emerald service console with a red emergency beacon and a substantial silver warning triangle on front, no text.
7. Problem: a realistic handheld silver magnifying glass leaning against an emerald glass mechanical gear with branching root-like silver traces underneath; physical root-cause investigation.
8. Change: interlocking emerald and silver gears on a dark metal base with a realistic upright silver wrench crossing one gear; physical change management.
Keep top and bottom rows fully separate. Do not show words or brand logos. Distinct tangible recognizable metaphors, not repeated generic ticket rectangles.
```

## Infrastructure

File: `infrastructure-sprites.png`

Logical sprites: `infra-redis-cache`, `infra-redis-stream`, `infra-redis-pubsub`, `infra-vector-database`, `infra-object-storage`, `infra-knowledge-base`, `infra-api-tool`, `infra-secret-vault`.

Exact submitted prompt:

```text
Use case: stylized-concept.
Asset type: production PNG sprite atlas for an isometric software architecture library.
Create exactly EIGHT separate photorealistic miniature 3D product sculptures in a perfectly regular FOUR COLUMN by TWO ROW grid. Wide 2:1 canvas, ideally 2048x1024. Each grid cell contains exactly one freestanding compact sculpture, visually centered, same scale, fitting a one-cell diamond ground footprint. All eight objects have identical orthographic isometric camera (view down about 30 degrees, visible top and front/right), realistic bevels, brushed gunmetal and silver, frosted cyan glass, beautiful precise PBR studio lighting, restrained amber indicator lights. Actual transparent RGBA background, no floor, no backdrop, no fake checkerboard. Each sculpture is entirely contained within the central 75% of its grid cell: at least 12% clear transparent margin around every cell, no touching neighbors or canvas borders, no connecting elements between sprites, no cast shadows beyond its own compact contact shadow. Each is physically detailed and volumetric, like premium collectible industrial hardware, not a flat symbol or a simple rectangle. Do not include words, letters, digits, labels, typography, captions, watermarks, decorative background, frames or grid lines. Symbols described below are substantial sculptural parts, never printed labels. Exact row-major subjects follow:
Objects occupy at most 70% of each grid cell. Redis-family first three objects share a recognizable stack of three red rounded square slabs, but their machinery and silhouettes differ unmistakably. No actual letters or logos.
TOP ROW left to right:
1. Redis cache: three red enamel rounded square cache slabs stacked as a compact low machine, one open front glass chamber reveals three cyan glowing stored data cubes; brushed silver enclosure.
2. Redis stream: three red rounded square slabs forming a compact stack alongside a short horizontal transparent cyan glass conveyor tube carrying a visible orderly single file of four small glowing amber data beads; integrated machine on one base.
3. Redis pub/sub: three small red rounded square slabs stacked as a central hub, from it three short cyan glass tubes branch radially into three tiny metal receiving pods; compact and self contained.
4. Vector database: a substantial clear cyan cubic crystal chamber containing an orderly spatial lattice of floating metal points joined by fine cyan rods, sits over two brushed silver cylindrical database tiers.
BOTTOM ROW left to right:
5. Object storage: a rugged dark steel open storage crate holding three clearly separated luminous cyan glass cubes, visible lid hinges, realistic industrial details.
6. Knowledge base: three thick upright technical books with pale pages and cyan glass covers, varied heights, held in a dark metal archival rack, tiny amber light at foot, no spine text.
7. API tool: a realistic compact silver articulated robot tool arm with cyan joints, gripping a small gold wrench over a cyan input/output socket console, all one freestanding machine.
8. Secret vault: a thick square brushed silver safe with a massive round vault door partially inset, realistic wheel lock and bolts, a cyan key-shaped glass sculptural insert on the door; dark pedestal base.
Ensure eight detailed premium 3D product cutouts, generous empty transparent gutters and a consistent camera and lighting.
```
