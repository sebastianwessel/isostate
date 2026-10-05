# Capability: mermaid2dsl Converter

Status: implemented

Converts the explicitly supported Mermaid flowchart syntax into a deterministic
single-scene `.isostate.yaml`. It is an authoring adapter, not a Mermaid renderer
or a replacement for a designed multi-scene story.

## Placement And Boundary

- `packages/cli/src/mermaid-source.ts`: dependency-free, filesystem-free
  `convertMermaidSource(source, { name? })` for isolated authoring tools.
- Parser, layout, emitter, and conversion types live in neighboring
  `mermaid-*.ts` modules; structured errors retain code/message/details.line.
- `packages/cli/src/mermaid2dsl.ts`: public `convertMermaidToDsl` wrapper;
  parses and validates the emitted YAML before returning it.
- `packages/cli/src/commands.ts`: filesystem CLI command wiring.
- The website Mermaid workbench may import the pure source converter. This
  authoring-only exception does not add parsing to scene playback. Neither
  converter nor YAML/parser/validator/compiler belongs in the core runtime or
  precompiled scene embeds. The editor validates handed-off YAML independently.
- No Mermaid dependency or full Mermaid layout engine is added.

```ts
interface MermaidConversionResult {
  yaml: string;
  warnings: Array<{ code: string; message: string; line: number }>;
}
interface MermaidConversionOptions { name?: string }
```

## Supported Input (exhaustive)

The syntax follows the [official Mermaid flowchart reference](https://mermaid.js.org/syntax/flowchart.html)
within this intentionally bounded subset:

- Required `graph` or `flowchart` header with `TD`, `TB`, `LR`, `RL`, or `BT`.
  `TB` normalizes to `TD`; reverse directions mirror layers without negatives.
- Statements separated by newlines or semicolons; blank lines and `%%` comments
  are ignored outside labels. Quoted delimiter characters remain label text.
- Node identifiers contain letters, digits, underscores, and hyphens. IDs are
  normalized to DSL identifiers as described below.
- Bare `A` uses a rectangle and visible original-id caption.
- Shapes: `A[text]` rectangle, `A(text)` rounded rectangle, `A([text])`
  stadium, `A((text))` circle, `A{text}` diamond, `A{{text}}` hexagon,
  `A[/text/]`/`A[\text\]` parallelograms, and
  `A[/text\]`/`A[\text/]` trapezoids.
- Labels may be double-quoted, including delimiters inside the quotes. Escaped
  quotes and backslashes are decoded. HTML, Markdown, and entity labels are
  rejected rather than silently changing their meaning.
- Ordinary `-->`/`---`, dotted `-.->`/`-.-`, and thick `==>`/`===` links.
  Arrow forms are directed; the others are undirected.
- Pipe labels after operators (`A -->|yes| B`) and infix labels (`A -- yes --> B`,
  `A -. async .-> B`, `A == main ==> B`) are preserved as visible text.
- Chains expand pairwise. `A & B --> C & D` expands the Cartesian product,
  preserving all four connections and their labels/styles.

Subgraphs, local `direction`, class/style/click/linkStyle directives, frontmatter,
configuration directives, cylinder/subroutine/flag/double-circle/new `@{}`
shapes, other diagram types, and other arrowheads/edge annotations are outside
this subset. They produce a structured error; unsupported features must not be
silently discarded. Later contradictory definitions of an existing node fail
with `MERMAID_NODE_REDEFINED`.

## Identifiers

Node ID normalization: lowercase, replace non-`[a-z0-9]` characters with `-`,
collapse hyphens and trim their ends, prefix `n-` for a leading digit, and reject
an empty result. Different original IDs that normalize to the same value fail
with `MERMAID_ID_COLLISION`. Every node reserves `<node-id>-label`; a collision
with another node is also an error.

Connection IDs use `<from>-to-<to>` with deterministic `-2`, `-3`, … suffixes
for repeated edges. Edge-caption IDs derive from the connection ID and are
uniquified against node and caption IDs, preserving authored node identity.

## Layout And Emission

1. Build layering using written edge order (undirected links also contribute).
   Ignore only DFS cycle-closing edges for longest-path layering; emit
   `MERMAID_CYCLE_BROKEN` per ignored edge. Every edge remains in output.
   Start DFS from zero-indegree sources in document order; when there are none,
   start from the first node. Process disconnected components deterministically.
2. Within each layer, retain first node appearance order. Four-cell spacing:
   TD/TB/BT use `[index * 4, layer * 4]`; LR/RL use
   `[layer * 4, index * 4]`. RL/BT replace layer with `maxLayer - layer`.
3. Emit every shape with its primitive payload and a text caption at the
   same `at` on `labels`, `align: middle`, `placement: caption`. An explicit
   label overrides the bare original ID, and an explicitly empty label suppresses that caption.
4. Shape colors use `var(--iso-node-fill, #dbeafe)` and
   `var(--iso-node-stroke, #2563eb)`, stroke width 1, opacity 0.9. Rounded rectangles and stadiums use polygons with 20 sampled corner points,
   rounded to six decimals. Corner radii are 0.15 and 0.25 respectively; stadium
   bounds are x=[0,1], y=[0.25,0.75] for a 2:1 pill. Quarter arcs use
   22.5-degree sampling. Polygon point arrays approximate these silhouettes
   without relying on unsupported rectangle rounding in the renderer. These are generic starter primitives.
5. Connections go on `ground`, with element endpoints and `end: arrow` or
   `none`; dotted links use `style.pattern: dotted`, thick links use
   `style.strokeWidth: 4`.
6. Nonempty edge captions occupy a rounded whole-cell midpoint between endpoint
   coordinates; move to the next free x cell if another node/caption already
   occupies that cell. This is deterministic starter placement, not a guarantee
   against measured text overlap or route ambiguity; review the rendered draft.
7. Header contains normalized name (default `mermaid-scene`), empty assets, and
   `ground`, `nodes`, `labels` layers. Scene ID is `initial`. No floor, camera,
   custom asset mapping, activity, or scene deltas are inferred.

Emission uses two-space YAML indentation and flow-style numeric tuples. Strings
are quoted when needed to avoid YAML type coercion or syntax ambiguity. Same
source/options yields byte-identical YAML.

## Diagnostics And Verification

Errors: `MERMAID_PARSE_ERROR`, `MERMAID_UNSUPPORTED`, `MERMAID_EMPTY`,
`MERMAID_NODE_REDEFINED`, `MERMAID_ID_COLLISION`, `MERMAID_INTERNAL`.
Line-specific errors expose the one-based line in `details.line` and append it
to the readable message. Cycle notices use `MERMAID_CYCLE_BROKEN`.
`MERMAID_LABEL_DROPPED` is no longer emitted: edge labels are text elements.

The validating CLI wrapper MUST parse and validate with zero DSL errors. An
invalid generated document fails with `MERMAID_INTERNAL` and underlying issues.
The pure website converter emits the same YAML; opening it in the editor runs
editor validation. CLI warnings print `WARN <code> ...`, exit 0 on success, and
exit 1 on an error. See `03-contracts/cli.md`.

Focused tests cover supported shapes/directions/operator styles, exact labels,
quoting and statement boundaries, Cartesian fan-out/chains, ID collisions,
cycle connection retention, byte determinism, pure/wrapper parity, CLI output,
and unsupported or malformed input with lines. Website tests cover invalid
input disabling exports, copy/download result identity, and editor handoff.
`examples/mermaid/` keeps source, generated YAML, and compiled JS together.

Docs, error references, both authoring skills, website examples, and generated
bundles must change together when this contract changes.
