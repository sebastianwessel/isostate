# Story Mapping

Use this reference for all Mermaid-to-isostate story conversions. Diagram-type
references only add source extraction details and type-specific cautions.

## Contents

- `Fidelity First`: source-to-visual mapping and reconstruction checks.
- `Scene Model`: cumulative story beats and label timing.
- `Connection Semantics`: active/completed/optional/error/async routes,
  condition labels, branch markers, and edge fidelity.
- `Step-By-Step Rendered Verification`: scene-by-scene perception checks.
- `Decision Branches`: alternatives, unhappy paths, persistent options, and
  route lanes.
- `Layout Heuristics`: grid-first positioning, subgraph zones, labels, and
  auto-routed connections.
- `Camera And Motion`: attention, entrance animation, and active flow motion.
- `Asset Strategy`: primitive, text, generated, and enterprise-style assets.
- `Label And Asset Integrity`: label proximity and metaphor correctness.
- `Review Checklist`: final conversion checks.

## Fidelity First

Correct data display is the hard requirement. The scene may simplify visual
style, group minor steps, or choose creative placement, but it must not distort
the Mermaid information.

Before authoring YAML, write a source-to-visual map:

| Source item | Visual requirement |
|---|---|
| Node / participant | one visible element id, matching label, matching visual metaphor |
| Edge / message | one connection id, correct direction, correct source/target |
| Edge / message label | nearby route label text when it distinguishes branches or actions; otherwise explicit omission reason |
| Branch label | visual semantics such as happy, error, optional, async, retry |
| Subgraph / block | zone, group, or explicit omission reason |

If a node is merged, split, renamed, or omitted, state why. If an edge is not
drawn, state why. Do not silently drop or reinterpret source data.

Run this reconstruction test after drafting: could a viewer recover the Mermaid
nodes and edges from the final scene without seeing the source? If not, fix
labels, assets, connection direction, or scene grouping before polishing.

## Scene Model

An isostate story should accumulate:

| Scene role | Purpose | Common operation |
|---|---|---|
| `initial` | Establish the source, actor, or stable space before flow begins | Add first actor/source, optional context, and camera focus |
| `entry` | Show where the flow starts | Add receiving element with label, then first active connection when context is clear |
| `expansion` | Reveal the next meaningful system part | Add element and label first; add or activate the route as the action/context |
| `branch` | Show options, alternatives, retries, or error paths | Add dashed or color-coded connections; clear throwaway branches before continuing |
| `completion` | Show the full interpreted story | Mute active styles or reset camera |

Avoid a mechanical one-node or one-message-per-scene rule. Group small Mermaid
steps when they are part of the same conceptual movement, and split larger
steps when a reader needs time to understand a new actor, branch, or state.

When the diagram starts with an external request, event, user, or client, it is
often clearer to show that source actor alone first. The first connection should
usually appear only after the reader understands who or what initiates the flow.
It is acceptable to move the source actor in the next scene if that improves the
composition, as long as the movement supports the story rather than causing
confusion.

Elements and their labels should normally appear together. A reader should not
have to infer what a newly visible asset represents while also parsing a new
arrow. Prefer this order for each step: introduce the element with its label,
then show the action, connection, or contextual relationship. If a route would
look misleading because one endpoint is not yet explained, delay the route.

Text placement is part of label fidelity. Isostate scenes live on the grid:
place labels by cell, zone, edge, center, gutter, and camera focus area. The
renderer projects grid cells into SVG scene coordinates, then camera focus and
responsive scaling change the SVG `viewBox`. Do not solve authored scene layout
with screen pixels, pixel offsets, fractional nudges, or arbitrary visual
tuning; those assumptions can break under zoom, camera focus, different
containers, or responsive rendering.
For `asset: text`, choose the label position from the text role and placement
attributes, not by habit:

| Text placement | Use | Positioning rule |
|---|---|---|
| `placement: caption` | label attached to a one-cell icon or small asset | May share the icon's `at`; verify it does not collide with the icon or nearby route |
| `placement: cell` | standalone label, group label, callout, route/message caption, or label near a larger/scaled asset | Use a separate nearby grid cell; do not place it on top of the icon unless an overlay is intentional |

If an icon is scaled larger than one cell, if the label is long, or if the label
collides with the asset, use `placement: cell` in a separate adjacent cell or
move the asset/label pair. Do not fix label ambiguity by leaving text floating
far away from the element it describes.

Use text style only for hierarchy after the grid position is correct. Larger,
heavier text may introduce an empty region or major actor; smaller, quieter
text may keep region context in later scenes. Font size, opacity, and color must
not compensate for wrong cell placement or poor route spacing.

Route and condition labels are lane labels. Place them in a clear grid cell
beside the route segment they explain. For labels that describe a branch
outcome or result, such as `ok`, `denied`, `hit`, or `miss`, prefer the
receiving/terminal side of the branch so the label reads as the outcome reached
by that path. Use source-side placement only when it is needed to disambiguate
multiple outgoing lanes from the same decision point. Keep at least one cell of
breathing room from node labels, group labels, and other route labels when the
layout allows it. If a label would float in empty space or appear closer to a
different edge, move the route endpoints, split the branch into another scene,
or use a semantic marker plus nearby label.

## Connection Semantics

Connections are the main timeline. Use consistent visual language:

| Meaning | Suggested connection style |
|---|---|
| Active/current flow | dotted or dashed, bright stroke, `ambient: [{ name: flow }]`, arrow end |
| Completed flow | thinner gray or subdued semantic variable, no ambient flow |
| Optional path | dashed secondary accent, lower opacity, arrow end |
| Alternative path | dashed with distinct color per branch and lower opacity when inactive |
| Error/failure | dashed red or warning accent, arrow end |
| Retry | curved or orthogonal return route, dashed warning/accent |
| Async/enqueue | dotted accent route to queue/worker, label if needed |
| Data/storage | calmer stroke, often blue or neutral, arrow end only when direction matters |

When a new scene makes a route active, update the previously active connection
to completed styling in the same scene if the DSL supports the needed update.
If styling updates become too noisy, keep the current route active and add the
next route with clear visual contrast.

Connections should explain an action or relationship, not merely connect nearby
objects. Before drawing an arrow, check that both endpoint elements and labels
are visible and that the arrow direction matches the story verb. If a connection
could be read as the wrong actor initiating the action, change the scene order,
move the endpoint, or delay the connection.

Mermaid edge labels are part of the data contract. Labels that distinguish
branches or message meaning, such as `ok`, `denied`, `hit`, `miss`, `retry`, or
`async`, should usually become small route-adjacent text elements placed in a
clear grid cell near the relevant connection. Style can reinforce the meaning,
but should not be the only carrier when two outgoing routes need different
conditions. If a label is intentionally omitted because it would add clutter,
record that omission in the source fidelity map and make sure the distinction is
still recoverable.

When an edge label changes the path meaning, prefer a story beat over a mere
annotation. A decision such as `ok`/`denied`, `hit`/`miss`, or `yes`/`no`
should usually become separate active scenes: activate one labeled branch,
settle it into its later-state styling, then activate the next branch. This
keeps the output a Mermaid-to-story conversion instead of a static graph with
labels pasted onto it.

Consider semantic branch markers when they improve comprehension. A small
check, cross, warning, retry, async, or decision marker near the branch source
or terminal can help the viewer recognize success/failure/optional semantics
before reading the text. Use dedicated one-cell marker assets or generated
primitive marker shapes. Do not use `asset: text` for marker iconography:
the runtime text primitive is for labels, uses the built-in SVG text/font
pipeline, and is not a reliable icon system. Avoid textual `OK` or `X` markers
next to labels such as `ok`, `denied`, `hit`, or `miss`; that reads as
duplicated labeling. Do not use emoji or font glyph markers for generated
Mermaid conversions, because font fallback, monochrome/color emoji rendering,
glyph metrics, and cross-platform sizing are not controlled by the DSL. If a
user explicitly wants an emoji-like symbol, turn it into a checked SVG/PNG
asset first. Markers supplement source labels; they must not replace required
Mermaid labels, reverse the meaning, or add semantics not present in the
source. Place outcome markers near the target/end of the branch they qualify,
not at the decision source, unless the branch split itself is the focus. Use
them sparingly when they reduce visual load, and omit them when they would
compete with arrows or labels.

Use active-flow animation sparingly. `ambient: [{ name: flow }]` should mark
only the current route or a small number of simultaneous current routes. If the
runtime supports a moving flow token, bead, or dot on routed connections, use it
only for active/current routes where direction needs extra help. The token must
follow the real rendered connection path; do not fake a separate moving line
that can contradict the arrow geometry.

Flowchart edges, sequence messages, and state transitions use the same
storytelling rules. Mermaid `alt`, `else`, `opt`, `par`, `loop`, `break`,
labeled sequence messages, and labeled state transitions are not exempt from
branch treatment: preserve their labels, split meaningful alternatives into
active story beats, use distinct lanes/ports when alternatives branch, and keep
final state reconstructable from the visualization. Only the source extraction
differs by Mermaid type.

Edge fidelity checks:

- Source and target must match the Mermaid edge/message direction.
- Arrowheads must visually point toward the target.
- A connection must not appear to originate from a different nearby object.
- Optional, async, error, and retry routes must use distinct styles that match
  their Mermaid labels or syntax.
- Conditional branch labels must be visible or explicitly justified as omitted.
- If multiple routes meet near one element, labels and styles must make the
  relationship unambiguous.

## Step-By-Step Rendered Verification

Do not rely only on YAML validation or the final overview. Rendered perception
is part of fidelity: if the route is structurally correct but visually reads as
the wrong relationship, the conversion is wrong.

Before calling the work done, build a per-scene verification checklist from the
source fidelity map:

| Check | Question |
|---|---|
| New elements | Which elements and labels should appear in this scene? |
| Active edge/message | Which exact Mermaid edge/message should be active now? |
| Perceived source | Ignoring YAML, which visible element does the arrow look like it leaves? |
| Perceived target | Ignoring YAML, which visible element does the arrow look like it enters? |
| Prior state | Are previous active routes muted, removed, or clearly completed? |
| Branch state | Are optional, error, async, and completed paths styled correctly? |

For each scene, pause at the stop and compare the rendered view to the
checklist. The perceived source and target must match the Mermaid source and
target. If a route passes near another label, asset, or lane and a viewer could
read it as a different edge, fix the layout before polishing.

Fixes should usually be spatial or staged:

- move one endpoint or its label away from the confusing route
- reveal the target before activating the connection
- delay or mute a previous route that competes with the current edge
- separate routes into lanes with more spacing
- adjust camera focus only when it clarifies the current step
- use manual route points only after positioning and staging fail

Example failure: Mermaid says `Request --> Router` and `Router --> Auth`, but
the rendered `Router --> Auth` route visually appears to leave the `Request`
label or entry lane. This must be fixed even if the connection object says
`from: router` and `to: auth`.

## Decision Branches

For decisions with an unhappy path and a happy path, prefer teaching the unhappy
path first. Show the failure, denial, retry, or fallback as the active branch,
then choose whether it should remain visible before continuing with the happy
path. The default is to keep the branch visible but de-emphasized, because it is
still source data. Remove it only when it is a clearly temporary teaching aid or
when keeping it would make the next step visually misleading.

Decision branches should leave the decision through distinct visual ports or
lanes. Do not stack success, failure, optional, and async branches on the same
side of the decision just because the router can draw them. Reserve different
directions when the layout allows it: for example, failure/denial can exit
toward a side or perimeter "unhappy" lane, success can continue toward the main
processing lane, optional/cache-hit can go toward a nearby return/exit lane, and
miss/fallback can continue toward dependency/data lanes. Treat these as semantic
direction hints, not hard compass rules; Mermaid fidelity and readable routing
win over a fixed west/east convention.

Keep persistent alternatives visible when they remain operationally useful, such
as cache hit/miss, active routing choices, feature flags, or long-lived async
options. Use reduced opacity, thinner strokes, dashed patterns, or calmer colors
so optional paths are present without competing with the main active route.

For each unhappy path, explicitly classify it before authoring later scenes:

| Classification | Later-scene treatment |
|---|---|
| Persistent outcome | Keep visible, muted or styled as an alternate exit |
| Operational alternative | Keep visible with optional/secondary styling |
| Temporary teaching aid | May remove after it has been explained |
| Visual obstruction | Move, mute, or remove only after noting why |

Do not remove unhappy or optional paths just because they are not the current
happy path. Removal is a deliberate storyboard decision, not the default.

## Layout Heuristics

- Treat reading direction as an interpretation heuristic, not a placement rule.
  It helps identify what the reader should understand first, next, and last.
- Assume a square planning canvas unless the user gives another format. A
  16x16 grid is a good default planning budget for Mermaid conversions because
  it leaves room for labels, return lanes, branch outcomes, and camera focus
  while still encouraging compact composition. Do not force `floor.size: [16,
  16]` into authored YAML just because this is the planning budget; when the
  scene can derive its true footprint from used cells, let the compiler compute
  the real floor size.
- Use intelligent positioning instead of a fixed diagonal: respect isometric
  perspective, logical proximity, route clarity, labels, and visual hierarchy.
- Respect strong Mermaid direction hints as composition bias without forcing a
  literal line. For `TD`/`TB`, prefer horizontal bands or rows that progress
  from upper context to lower outcomes, with left/right used for branches. For
  `LR`, prefer vertical bands that progress from left entry to right outcomes.
  Avoid placing the whole main path on a single diagonal.
- Let the AI be visually creative when the diagram is abstract. Clusters,
  lanes, rings, zones, hubs, staged rows, or compact service neighborhoods can
  all be better than a literal top-left to bottom-right chain.
- Keep the main flow easy to follow, but avoid stretching every diagram across
  the full canvas just to match Mermaid reading order.
- Put entry, exit, terminal success, and terminal unhappy states near the
  canvas perimeter when it helps the scene read as entering or leaving the
  system. Keep the center for ongoing decisions, shared services, and active
  transformation.
- Avoid element/edge and edge/edge overlap. Move endpoints, add spacing, or
  introduce lanes before reaching for manual routes.
- For Mermaid subgraphs, render zones as visually separated regions, not as
  touching rectangles. Leave at least one empty grid cell between subgraph
  footprints by default; use more than one cell when labels, icons, or routed
  connections still feel cramped. A visible projected gutter matters more than
  merely satisfying coordinate math.
- Give each subgraph a distinct but quiet fill/stroke pair and use a matching
  label color. Group labels should read as part of the region, not as generic
  scene labels floating over every zone.
- When a subgraph is empty or being introduced, its label may occupy the
  subgraph's center cell or center band as the main content of that region.
  Once real elements appear inside that subgraph, demote the group label using
  grid semantics: move it to a stable edge or corner cell inside the region,
  keep at least one clear cell between it and active elements when possible,
  and style it as quiet region context. The group label should no longer compete
  with the active element and route.
- When subgraph zones are the main spatial structure, make the floor grid very
  light or hide it. The zones should carry grouping; the grid should only help
  orientation and must not compete with group boundaries or labels.
- Give each subgraph enough internal breathing room for its contained nodes and
  labels. Avoid placing two important labeled elements in adjacent cells when
  more space is available.
- Stable participants should not jump between scenes unless movement is the
  point of the story.
- Put branching options near the element that decides between them.
- Keep text labels close to assets but avoid letting labels become obstacles for
  connector routing.
- Match `asset: text` placement to label intent: `caption` can share a small
  icon's grid position, while `cell` needs its own readable grid position.
- Prefer `from`/`to` routed connections for generated Mermaid conversions. Use
  manual `route` only as a last resort after positioning fails, because manual
  routes can hide arrows, collapse visually, and stop testing the converter's
  routing behavior.

## Camera And Motion

Camera movement should clarify the current scene stop. Use a `camera.target.area`
around the newly introduced element, active route, or active branch when the
full composition would make the step hard to read. Keep enough surrounding
context to understand source and target. Use `reset` for final overview or when
the next scene needs the whole diagram again.

Do not apply the same entrance animation mechanically to every element. Choose
animation from semantic role:

| Role | Suggested entrance |
|---|---|
| Group/subgraph zone | subtle `fade-in`, usually before contained elements |
| Stable service/component | `fade-in` or `rise-from-ground` |
| External actor/source | `rise-from-ground` or camera focus when it starts the story |
| Decision or important branch node | `fade-in-grow` if emphasis helps |
| Error/unhappy terminal | `fade-in-grow` with error styling, used sparingly |
| Optional/secondary path | simple `fade-in` with low-contrast style |
| Async queue/worker | staged `fade-in` or `rise-from-ground` to communicate handoff |
| Active connection | `ambient: flow`; moving token only if supported and useful |

Animation must explain sequence and attention, not decorate. If varied motion
competes with labels, arrow direction, or source fidelity, simplify it.

## Asset Strategy

Start with generated primitives and labels:

- `rectangle` zones for subsystems, regions, queues, and stages
- `text` for labels and message captions
- external one-cell SVG assets for recognizable services or personas
- sprite sheets only when a catalog already exists or many small assets are
  needed

Use enterprise-quality visual assets for system diagrams:

- Keep a consistent isometric angle, lighting direction, stroke weight, shadow
  softness, and visual scale across all assets in one diagram.
- Prefer restrained palettes, subtle gradients, bevels, and small status glyphs
  over cartoon-like saturated blocks.
- Make assets recognizable at one-cell size: browser/client, router, auth,
  service, cache, database, queue, worker, and warning should each have a clear
  silhouette before labels are read.
- Use one-cell assets by default and preserve checked anchors. Do not hide poor
  asset composition by scaling icons larger unless the asset was authored for a
  larger footprint.
- Avoid decorative complexity that competes with labels, arrows, and subgraph
  regions. Enterprise style means polished and calm, not visually busy.

Use generated or custom images only when the visual metaphor matters. If image
generation is used, keep every asset as a separate one-cell object unless it was
intentionally authored for a larger footprint.

## Label And Asset Integrity

Labels are data, not decoration. Keep them close enough to their element that a
viewer cannot assign them to another asset. If the scene is crowded, move the
element or reduce the number of simultaneous labels instead of accepting
ambiguous labels.

Choose assets whose metaphor matches the source role. Examples:

- auth / verify / token: shield, lock, or gate metaphor
- app / service / API: service block, server, or application tile
- database / DB / storage: database cylinder or storage block
- queue / async / enqueue: queue/message pipe, conveyor, or message block
- user / client / request source: user, browser, device, or terminal
- error / denied / failure: warning or error marker

Do not reuse a visually strong metaphor for the wrong role just because it is
available. Misleading assets are worse than simple primitives.

## Review Checklist

- Does each scene add, emphasize, or clarify one useful part of the story?
- Does every Mermaid node/participant have a matching visual element with the
  correct label and metaphor?
- Does every Mermaid edge/message have a correct visual connection or an
  explicit omission reason?
- Could someone reconstruct the original Mermaid graph/sequence from the final
  scene without seeing the source?
- Do new elements appear with their labels before or at the same time as the
  action that uses them?
- Are connections delayed until both endpoints and the relationship are clear?
- Are previous flows still understandable after the active flow advances?
- Are active, completed, optional, and error paths visually distinct?
- Do decision branches show the unhappy path first when useful, then keep,
  mute, move, or remove it according to its explicit classification?
- Are entry/exit and terminal states placed near the perimeter when that makes
  the flow clearer?
- Are overlapping edges and element-edge collisions avoided or intentionally
  styled so they remain readable?
- Is the composition compact and well structured on a square canvas unless the
  user requested another aspect ratio?
- Does the final scene communicate the whole Mermaid diagram without needing the
  original source?
- Does the YAML validate and compile without shipping converter dependencies to
  the browser runtime?
