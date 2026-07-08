# Flowcharts

Use this reference only for Mermaid `flowchart` or `graph` extraction details.
Apply shared storytelling, branch, label, marker, camera, layout, and
verification rules from `story-mapping.md`.

For a plain `graph`/`flowchart` with direction `TD`/`TB`/`LR`, only
rectangle/circle/diamond nodes, and `-->`/`---` edges, the deterministic
`isostate mermaid2dsl` CLI (`docs/guides/convert-mermaid.md`) can generate a
starting `.isostate.yaml` directly. This reference is for richer or cumulative
story conversion, semantic styling, subgraph zones, and diagram features the
CLI does not support (`RL`/`BT` direction, other node shapes, `&`-separated
edges, edge labels as visible text). See
`specs/02-capabilities/dsl/mermaid2dsl.md` for the exact CLI subset.

## Interpret The Flow

Extract:

- direction hint: `TD`, `TB`, `LR`, `RL`, or `BT`
- nodes and labels
- edges and labels
- subgraphs as zones or grouped regions
- branch labels such as yes/no, success/failure, cache hit/miss
- repeated edge patterns such as retries, fan-out, and fan-in

Create an edge inventory before designing the scene:

| Edge | Required visual check |
|---|---|
| `A --> B` | connection from visual A to visual B, arrow toward B |
| `A -- label --> B` | same direction plus label semantics reflected in style or text |
| dashed Mermaid edge | optional/async/secondary styling unless source says otherwise |
| decision branch | branch style and endpoint must match the branch label |

The conversion fails if a required edge is missing, reversed, attached to the
wrong visual element, or visually reads as a different relationship. Use
`story-mapping.md` for branch beats, condition labels, semantic markers, and
decision lanes.

Use Mermaid declaration order only as a fallback. Prefer the visible or intended
flow to understand the story order, not to force the spatial layout:

- top-to-bottom for `TD` / `TB`
- left-to-right for `LR`
- reverse only when the Mermaid direction explicitly says so
- top-left to bottom-right reading order for mixed or unclear diagrams

After identifying that order, choose a compact square-canvas composition. It may
use clusters, zones, hubs, or staged rows when those communicate the flow better
than a long diagonal chain.

For `TD` / `TB`, prefer upper-to-lower bands when they fit: start near the upper
perimeter, decisions and transformations through middle bands, and terminal
outcomes near lower or side exits. Use left/right space for branches,
alternatives, side effects, and supporting services. Do not put the whole main
path on one visual diagonal. For `LR`, invert that preference: use left-to-right
bands and vertical space for branches.

For flowcharts, entry and terminal outputs often read best near the canvas
perimeter: start nodes can sit at an edge where the flow enters, and success,
error, or cancellation endpoints can sit near different exits. Keep decisions
and shared processing closer to the center so branches have room to route
without crossing elements or each other.

## Mapping Rules

| Mermaid concept | Isostate mapping |
|---|---|
| Node | element plus optional text label |
| Edge | connection with `from`/`to`; manual route only as a last resort |
| Edge label | nearby `text` element in a clear route-adjacent grid cell, or explicit omission reason |
| Subgraph | translucent `rectangle` zone plus label |
| Decision | distinct asset or diamond-like primitive if useful |
| Parallel fan-out | multiple optional or active routes from one source |
| Merge/fan-in | muted completed branch routes into one target |
| Start/end node | perimeter element that reads as an entrance or exit |

## Questions To Ask When Ambiguous

- Which path is the happy path?
- What actor or event initiates the flow?
- Should the next step introduce a new element first, or is the element already
  clear enough for the action/connection to appear?
- Should branches appear as alternatives, optional paths, or error paths?
- Are subgraphs visual zones or just Mermaid source organization?
- Should any node use a recognizable external asset instead of a primitive?
