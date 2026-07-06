# Capability: mermaid2dsl Converter

Status: specified (wave 06)

Converts a Mermaid flowchart definition into a valid `.isostate.yaml`
`SceneDocument`. Dev-time only. Delivers the converter input source promised
in `00-vision.md` (C7 input sources) for the flowchart subset below —
nothing more.

## Placement

- Implementation module: `packages/cli/src/mermaid2dsl.ts` (pure conversion
  logic, no filesystem access) plus command wiring in
  `packages/cli/src/commands.ts`.
- Public CLI command: `isostate mermaid2dsl` (see `03-contracts/cli.md`).
- The conversion function is exported from `packages/cli/src/index.ts` as
  `convertMermaidToDsl(source: string): MermaidConversionResult`.
- MUST NOT be imported by `packages/core` or shipped to the browser.
- Zero new dependencies: the Mermaid subset below is parsed with a
  hand-written line parser. The `mermaid` npm package is NOT used.

```ts
interface MermaidConversionResult {
  /** Serialized .isostate.yaml document text. */
  yaml: string;
  /** Non-fatal conversion notices (see warning codes). */
  warnings: Array<{ code: string; message: string; line: number }>;
}
```

## Supported Input (exhaustive)

Line-oriented parsing after trimming; blank lines and lines starting with
`%%` (comments) are skipped.

1. Header (first non-blank, non-comment line, required):
   `graph <DIR>` or `flowchart <DIR>` where `<DIR>` is one of
   `TD`, `TB` (synonyms, top-down) or `LR` (left-right). `RL` and `BT` are
   NOT supported.
2. Node statements — a bare node reference, either alone on a line or inside
   an edge statement:
   - `id` (plain, no label)
   - `id[text]` → shape `rectangle`
   - `id(text)` → shape `circle`
   - `id((text))` → shape `circle`
   - `id{text}` → shape `polygon` (diamond)
   Node ids match `/^[A-Za-z0-9_-]+$/`. Label text is everything between the
   brackets, with surrounding double quotes stripped when present. A node's
   shape/label is fixed by its first bracketed occurrence; later bracketed
   occurrences with a different shape or label fail with
   `MERMAID_NODE_REDEFINED`.
3. Edge statements:
   - `A --> B` (directed)
   - `A --- B` (undirected)
   - `A -->|text| B` and `A ---|text| B` (edge label)
   - `A -- text --> B` and `A -- text --- B` (edge label)
   Whitespace around tokens is flexible. Chained edges
   (`A --> B --> C`) are supported and expand pairwise left to right.
   Multiple edges on one line separated by `&` are NOT supported.

Any other statement (subgraphs, `classDef`, `class`, `style`, `click`,
`linkStyle`, `direction`, other arrow types like `-.->`/`==>`, other node
shapes like `[[..]]`/`[(..)]`/`>..]`) fails with `MERMAID_UNSUPPORTED` and
the 1-based line number in `details.line`. An input with zero nodes fails
with `MERMAID_EMPTY`.

## Id Normalization (deterministic)

Mermaid node id → DSL element id:

1. lowercase;
2. every character outside `[a-z0-9]` becomes `-`;
3. consecutive `-` collapse to one; leading/trailing `-` stripped;
4. if the result starts with a digit, prefix `n-`;
5. if the result is empty, fail `MERMAID_PARSE_ERROR`.

If two distinct Mermaid ids normalize to the same DSL id, fail
`MERMAID_ID_COLLISION` naming both originals. The label element for node
`x` is `x-label`; if that collides with another normalized node id, fail
`MERMAID_ID_COLLISION` as well.

## Layout Algorithm (deterministic)

1. Build the directed graph from all edges (undirected edges count as
   directed for layering, using their written order).
2. `layer(node)` = longest-path distance from any source node (node with
   in-degree 0). Nodes on a cycle: break cycles by ignoring the edge that
   closes a cycle in document order (depth-first from sources in
   first-appearance order); emit warning `MERMAID_CYCLE_BROKEN` for each
   ignored edge.
3. Within a layer, nodes are ordered by first appearance in the document.
4. Grid placement with spacing of 2 whole cells starting at `[0, 0]`:
   - `TD`/`TB`: `at = [indexInLayer * 2, layer * 2]`
   - `LR`: `at = [layer * 2, indexInLayer * 2]`
5. Every node emits two elements:
   - the shape element: `id`, `asset` per shape mapping, `at` as computed,
     `layer: nodes`, and the primitive payload below;
   - when the node has a label: a text element `<id>-label`,
     `asset: text`, same `at`, `layer: labels`,
     `text: { value: <label>, align: middle, placement: caption }`.
6. Shape payloads (fixed, no options):
   - `rectangle` → `primitive: { rectangle: { fill: "var(--iso-node-fill, #dbeafe)", stroke: "var(--iso-node-stroke, #2563eb)", strokeWidth: 1, opacity: 0.9 } }`
   - `circle` → `primitive: { circle: { fill: "var(--iso-node-fill, #dbeafe)", stroke: "var(--iso-node-stroke, #2563eb)", strokeWidth: 1, opacity: 0.9 } }`
   - `polygon` (diamond) → `primitive: { polygon: { points: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], fill: "var(--iso-node-fill, #dbeafe)", stroke: "var(--iso-node-stroke, #2563eb)", strokeWidth: 1, opacity: 0.9 } }`
7. Edges → connections in document order:
   `id: <fromId>-to-<toId>` (on duplicate connection ids append `-2`, `-3`,
   ... in document order), `from: { element: <fromId> }`,
   `to: { element: <toId> }`, `layer: ground`, and `end: arrow` for `-->`
   or `end: none` for `---`. Edge labels are dropped with warning
   `MERMAID_LABEL_DROPPED` (the DSL has no connection labels).
8. Header of the generated document:

```yaml
header:
  name: <basename of the input file without extension, id-normalized; "mermaid-scene" when converting from a string>
  assets: []
  layers:
    - name: ground
    - name: nodes
    - name: labels
scenes:
  - id: initial
    elements: [...]
    connections: [...]
```

Single scene only. No `grid`, `floor`, `assetBaseUrl`, camera, or ambient
output in v1.

## Output Contract

- The generated YAML MUST parse via `parseScene` and validate via
  `validateScene` with zero errors. The converter runs both before
  returning; an internal failure here is a converter bug and surfaces as
  `MERMAID_INTERNAL` with the underlying issue list in `details`.
- Conversion is deterministic: identical input text yields byte-identical
  YAML.
- YAML is emitted with 2-space indentation, keys in the exact order shown
  in this spec, flow-style `[x, y]` tuples and `points`, and double-quoted
  strings only when YAML requires quoting.

## Error and Warning Codes

Errors (thrown as `ParseError`-shaped structured errors with `code`,
`message`, `details.line` where applicable):
`MERMAID_PARSE_ERROR`, `MERMAID_UNSUPPORTED`, `MERMAID_EMPTY`,
`MERMAID_NODE_REDEFINED`, `MERMAID_ID_COLLISION`, `MERMAID_INTERNAL`.

Warnings (returned, never thrown): `MERMAID_LABEL_DROPPED`,
`MERMAID_CYCLE_BROKEN`.

All codes are added to `03-contracts/errors.md` (new "Converter" section)
and `docs/reference/errors.md`.

## CLI Command

See `03-contracts/cli.md` "isostate mermaid2dsl". Summary:
`isostate mermaid2dsl <input.mmd> [--out <file>]`, default `--out` is the
input path with its extension replaced by `.isostate.yaml`; prints warnings
with the standard `WARN <code> ...` format; exit 0 on success (with or
without warnings), exit 1 on any error.

## Testing (required)

`tests/cli/mermaid2dsl.test.ts`:

- full happy path: a TD flowchart with all three shapes, labeled and
  unlabeled nodes, chained edges, and an undirected edge converts to YAML
  that parses, validates with zero errors, and matches an inline expected
  YAML snapshot byte-for-byte;
- LR direction transposes coordinates;
- id normalization cases (`Web_Server` → `web-server`, `2tier` → `n-2tier`),
  collision error;
- node redefinition error, unsupported statement error with line number,
  empty input error;
- cycle input produces `MERMAID_CYCLE_BROKEN` warning and still lays out;
- edge label produces `MERMAID_LABEL_DROPPED` warning;
- CLI command writes the output file, honors `--out`, exits 1 with
  `MERMAID_UNSUPPORTED` on a subgraph input.

## Documentation (required)

- `docs/guides/convert-mermaid.md`: guide with a worked example (input
  flowchart, generated YAML, rendered result description).
- `docs/guides/use-the-cli.md`: command section.
- README doc tree link.

## Out of Scope (v1)

- Sequence/class/state/ER diagrams, subgraphs, styling statements.
- Edge labels rendered as text elements.
- Multi-scene output, scene deltas, custom spacing or asset mapping.
- Using the `mermaid` npm package for parsing.
