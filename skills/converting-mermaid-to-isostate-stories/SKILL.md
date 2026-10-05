---
name: converting-mermaid-to-isostate-stories
description: Converts Mermaid flowcharts, graph aliases, sequence diagrams, and state diagrams into cumulative isostate story scenes, storyboards, and .isostate.yaml drafts. Use when the user provides Mermaid, asks to turn diagrams into isometric visuals, wants Mermaid diagrams represented as animated scene steps, or needs AI-assisted converter output instead of a deterministic Mermaid parser.
---

# Converting Mermaid To Isostate Stories

Use this skill when Mermaid is the source material and the goal is an isostate
visual story, not a literal diagram renderer.

## Core Idea

Treat Mermaid as a structured story brief. Preserve the logical flow, but author
an isometric scene that grows cumulatively: each scene adds or emphasizes more
of the visualization while previous context stays visible. Connections carry the
timeline through active, completed, optional, alternative, async, and error
states.

Correct data display is the highest priority. A beautiful scene that mislabels
nodes, swaps asset meanings, drops edges, reverses message direction, or makes
the Mermaid flow unreconstructable is a failed conversion.

## Relationship To `isostate mermaid2dsl`

The CLI ships a deterministic converter, `isostate mermaid2dsl`
(`docs/guides/convert-mermaid.md`), for supported flowcharts. The website's
Mermaid workbench uses the same source converter to produce YAML locally.

- Use the CLI or workbench for a reproducible single-scene starting point:
  `TD`/`TB`/`LR`/`RL`/`BT`, supported primitive shapes, ordinary/dotted/thick
  links, chains, and `&` fan-out. Node names and edge labels remain visible.
  The CLI validates before writing. The workbench offers copy, download, and
  opening the exact result in the editor for validation and refinement.
- Use this skill for cumulative story beats, recognizable assets, semantic
  emphasis, subgraph zones, sequence/state diagrams, or features the converter
  explicitly rejects. Do not promise full Mermaid syntax support. Read
  `specs/02-capabilities/dsl/mermaid2dsl.md` for the exhaustive support list.

A common path is to convert a supported source first, review all diagnostics,
then replace primitives with checked assets and author cumulative scenes.
Keep the original `.mmd` alongside generated YAML so fidelity stays reviewable.

## Workflow

1. Read the shared story guidance in `references/story-mapping.md`. This is
   the main conversion contract for scene beats, labels, branches, lanes,
   markers, camera, layout, and verification.
2. Read `references/diagram-types.md` to classify the Mermaid diagram type as
   directly supported, conditionally supported, or out of scope for faithful
   conversion.
3. Identify the Mermaid type only to choose the extraction reference:
   - `flowchart` / `graph`: read `references/flowcharts.md`
   - `sequenceDiagram`: read `references/sequence-diagrams.md`
   - `stateDiagram` / `stateDiagram-v2`: read `references/state-diagrams.md`
   - conditionally supported type: convert only after explaining the semantic
     loss or asking whether to summarize it into flow, sequence, or state
     semantics
   - out-of-scope type: do not fake a faithful converter; offer a summarized
     story visual instead
4. Read `references/examples.md` when you need a concrete storyboard or
   connection-style pattern.
5. Use the Mermaid-type reference only for source extraction and type-specific
   syntax. Do not duplicate shared storytelling rules there.
6. If writing YAML, also use `skills/authoring-isostate-scenes/` as the DSL
   contract source and read only the relevant reference files there.
   For creating or maintaining external artwork, use
   `skills/creating-isostate-assets/` with the user's chosen style or reference.
7. Build a source fidelity table before writing YAML:
   - every Mermaid node/participant/message/edge
   - every Mermaid state, transition, start/end marker, composite state, or
     branch/fork/join when using state diagrams
   - its intended visual element/connection id
   - its label text
   - its scene where it first appears
   - its semantic style such as main, completed, optional, async, or error
8. Build a short storyboard before writing YAML:
   - scene id
   - reader takeaway
   - elements added or emphasized
   - connections added or restyled
   - camera behavior, if any
9. Author cumulative scene stops:
   - first scene establishes the space and stable participants
   - later scenes use `add` and `update`; do not replace the whole scene
   - make layout decisions in whole grid cells and zones; use text style only
     for hierarchy, not for fixing placement
   - completed routes remain visible but muted
   - the current route is visually active
   - optional branches and alternatives use distinct styling
10. Validate and compile before visual review when a YAML file exists:
   - run `isostate validate <file>` when the CLI is installed, or use the
     repository-local CLI command documented by the project
   - compile when producing a runnable example
   - fix validation errors before treating the output as reviewable
11. Run a step-by-step rendered verification before calling the output done:
   - inspect each scene stop in order, not only the final overview
   - compare the scene against the source fidelity table and storyboard
   - verify each newly active connection visually appears to originate from the
     intended source and terminate at the intended target
   - fail the conversion if an arrow can reasonably be read as connecting a
     different nearby element, even when the YAML `from`/`to` values are correct
   - verify element labels appear with the elements before their connections or
     actions depend on them
   - verify previous active routes are muted, removed, or clearly no longer the
     current action
12. Run a final fidelity review:
   - every Mermaid node/participant is represented exactly once unless the
     storyboard explicitly explains a merge or split
   - every visible element has the correct label and visual metaphor
   - every Mermaid edge/message is represented by a connection in the correct
     direction or explicitly omitted with a reason
   - active/completed/optional/async/error styles match the Mermaid semantics
   - a viewer could reconstruct the original Mermaid flow from the final scene
     without seeing the source
13. Iterate until structural validation, rendered step verification, and final
    fidelity review all pass.

## Output Shape

When the user asks for a design or plan, return:

```markdown
## Mermaid Interpretation
[diagram type, actors/nodes, main flow, branches/options]

## Source Fidelity Map
| Mermaid item | Visual id | Label | First scene | Semantics |

## Storyboard
| Scene | Purpose | Visual change | Active flow |

## Fidelity Review
[edge coverage, label/asset checks, known omissions]

## Rendered Verification
[scene-by-scene visual checks, especially perceived edge source/target issues]

## Authoring Notes
[asset choices, connection styles, camera, validation commands]
```

When the user asks for files, create a `.isostate.yaml` draft and include the
validation result. Choose assets that fit the requested visual style. For polished architecture
stories, use recognizable catalog artwork or coordinated image-generated
assets with checked one-cell anchors; generic primitives are appropriate for
a structural converter draft. Give captions their own clear whole-cell band
and verify they do not intersect any artwork at desktop and mobile sizes.

## Guardrails

- Do not create one isolated scene per Mermaid node or message. Build a growing
  visualization where previous context remains useful.
- Do not prioritize visual creativity over Mermaid fidelity. Correct labels,
  asset meanings, edge/message direction, and branch semantics are hard
  requirements.
- Do not treat Mermaid edge syntax as enough. Infer visual semantics from labels
  such as auth, verify, fetch, enqueue, error, retry, optional, and async.
- Do not let an asset's visual metaphor contradict its label or Mermaid role.
  A shield-like asset should not be labeled as an app service if the Mermaid
  role is auth, for example.
- Do not turn reading direction into a rigid diagonal layout. Use reading order
  to understand the story, then choose a compact, legible composition that fits
  the canvas and isometric perspective.
- Do not use pixel offsets or fractional nudges as the layout model. Mermaid
  conversion should reason in grid cells, grouped zones, gutters, edge/corner
  cells, and routed connections.
- Do not encode logical graph semantics into the isostate DSL. Convert them into
  elements, generated text labels, connections, styles, and scene deltas.
- Do not stretch SVG arrow assets for message paths. Use isostate
  `connections`.
- Do not add parser, Mermaid renderer, layout engine, or converter dependencies
  to the browser runtime.
- Do not overuse camera focus. Use it only when attention would otherwise be
  ambiguous; reset for the final overview when helpful.
