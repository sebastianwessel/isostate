# Mermaid conversion example

`request-flow.mmd` preserves an authenticated request, cache hit/miss branches,
and asynchronous queue processing. `request-flow.isostate.yaml` is the
converter's deterministic starting scene; `request-flow.isostate.js` is its
compiled browser bundle. Both files are generated from the Mermaid source.

From the repository root:

```bash
bun run isostate mermaid2dsl examples/mermaid/request-flow.mmd
bun run validate examples/mermaid/request-flow.isostate.yaml
bun run compile examples/mermaid/request-flow.isostate.yaml --output examples/mermaid/request-flow.isostate.js
```

Every node has a visible label. Every connection retains its source and target;
`ok`, `denied`, `hit`, `miss`, and `async` become separate text elements. The
async link remains dotted. This generic output is a structural starting point:
replace primitives with checked catalog assets and author scene deltas for a
polished story.

The website's Mermaid workbench lets you paste this source, download YAML, or
open the result in the editor. Its six-step illustrated tutorial is a separate
authoring story, not a representation of this request graph.
