# Mermaid Diagram Types

Use this reference to decide whether a Mermaid source can be converted into an
isostate story with high fidelity. The goal is not to support every Mermaid
renderer feature. The goal is to preserve source meaning in an animated
isometric story.

Mermaid's current syntax reference lists many diagram declarations, including
flowchart, sequence, class, state, ER, journey, gantt, pie, quadrant,
requirement, gitGraph, C4, mindmap, timeline, ZenUML, sankey, XY, block,
packet, kanban, architecture, radar, event modeling, treemap, venn, ishikawa,
Wardley, and treeView. Do not treat that list as a conversion backlog.

## Support Matrix

| Mermaid type | Fit | Default action |
|---|---|---|
| `flowchart`, `graph` | Direct | Use `flowcharts.md`; `graph` is a flowchart alias. |
| `sequenceDiagram` | Direct | Use `sequence-diagrams.md`. |
| `stateDiagram`, `stateDiagram-v2` | Direct | Use `state-diagrams.md`. |
| `gitGraph` | Conditional | Convert only as a timeline/story of commits, branches, merges, and releases; preserve branch names and commit order. |
| `journey` | Conditional | Convert only as a user-experience journey story; preserve actors, tasks, sections, and scores as visual state, not exact chart geometry. |
| `timeline` | Conditional | Convert only as a chronological story; preserve periods/events and order. |
| `requirement` | Conditional | Convert as a relationship map only when requirements, elements, and relationships are more important than exact notation. |
| `architecture`, `block` | Conditional | Convert as a system map or zone layout when nodes/groups/edges are present; explain any layout loss. |
| `classDiagram`, `erDiagram`, `C4Context`, C4 variants | Conditional/Usually avoid | Prefer a simplified system relationship story; do not promise full UML/ER/C4 fidelity. |
| `mindmap`, `treeView`, `kanban`, `eventModeling`, `ishikawa`, `Wardley` | Conditional/Usually avoid | Convert only when the user wants an explanatory story, not a faithful diagram. |
| `gantt`, `pie`, `quadrantChart`, `xychart`, `sankey`, `radar`, `treemap`, `venn`, `packet` | Out of scope for faithful conversion | Offer a summarized visual or recommend keeping Mermaid/chart rendering. |
| `zenuml` | Out of scope by default | Ask to convert to `sequenceDiagram` semantics first. |

## Decision Rule

Use direct conversion only when the Mermaid source describes:

- actors, participants, states, nodes, or components
- directed transitions, messages, relationships, or flow
- branch labels, conditions, alternatives, or lifecycle stages
- group/composite structure that can become zones or regions

Avoid direct conversion when the Mermaid source is primarily:

- quantitative chart geometry
- proportional area/angle/axis data
- dense schema/class notation where every field/member/cardinality is the data
- a specialized notation whose meaning would be lost if turned into generic
  arrows and boxes

When a type is conditional, state the tradeoff before authoring YAML:

```markdown
This can be turned into an isostate story, but not a faithful renderer for the
original Mermaid notation. I will preserve [specific semantics] and omit or
summarize [specific notation].
```

## Type Normalization

- Treat `graph` exactly like `flowchart`; Mermaid documents `graph` as an alias
  for flowcharts.
- Treat `stateDiagram` and `stateDiagram-v2` as state diagrams. Prefer the v2
  semantics when both are possible.
- Ignore Mermaid visual styling directives unless they encode meaning. Isostate
  should choose its own visual system while preserving source data.
- Keep frontmatter/configuration out of the browser runtime. Use it only as a
  hint for source interpretation.

## Unsupported-Type Fallback

When the source is not directly supported:

1. Identify the source's important information.
2. Ask whether to summarize it as a flow, sequence, state lifecycle, or static
   explanatory map.
3. Build the source fidelity table around the chosen summary contract.
4. Record every omitted notation detail.
5. Do not claim a viewer can reconstruct the original Mermaid diagram unless
   the final isostate scene genuinely preserves the required semantics.
