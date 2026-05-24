# isostate

isostate is a small toolkit for creating isometric visual storytelling:
architecture explanations, product walkthroughs, infrastructure diagrams,
process flows, and presentation-style scene progressions that can be embedded
in websites.

Scenes are authored as `.isostate.yaml`, compiled into browser-ready SVG
runtime data, and then controlled from application code. The same scene can be
driven by scroll position for scrollytelling, by a timeline or slider for
presentations, or by custom UI in a documentation page. YAML parsing,
validation, compilation, and static packaging happen at build time; the browser
only loads the runtime, compiled scene data, and referenced SVG assets.

## Docs

- [Documentation](./docs/README.md)
  - Start
    - [How isostate Works](./docs/concepts/how-isostate-works.md)
  - [Getting Started](./docs/getting-started.md)
  - Create
    - [Plan A Scene](./docs/guides/plan-a-scene.md)
    - [Author Scene Deltas](./docs/guides/author-scene-deltas.md)
    - [Assets Workflow](./docs/guides/assets-workflow.md)
    - [Animation And Connections](./docs/guides/animation-and-connections.md)
  - Ship
    - [Use The CLI](./docs/guides/use-the-cli.md)
    - [Deploy Static Bundle](./docs/guides/deploy-static-bundle.md)
  - Examples
    - [Runtime Basic](./docs/examples/runtime-basic.md)
    - [Compile YAML](./docs/examples/compile-yaml.md)
    - [Custom Assets](./docs/examples/custom-assets.md)
    - [Inspect Bundle](./docs/examples/inspect-bundle.md)
  - Reference
    - [Public API](./docs/reference/public-api.md)
    - [Runtime Bundle](./docs/reference/runtime-bundle.md)
    - [Types](./docs/reference/types.md)
    - [Errors](./docs/reference/errors.md)
- [Basic Browser Demo](./examples/basic/README.md)

## Quickstart

From the repository root:

```bash
bun install
bun run build
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173/examples/basic/
```

The demo loads `examples/basic/scene.isostate.js`, which is generated from
`examples/basic/source.isostate.yaml`. The browser does not parse YAML.

To generate a deployable static bundle for the demo:

```bash
bun run examples:basic:bundle
```

That writes:

```text
examples/basic/static-bundle/
  isostate.runtime.js
  scene.isostate.js
  manifest.json
  assets/
```

Use the CLI directly for your own scene:

```bash
bunx --package @sebastianwessel/isostate-cli isostate bundle scene.isostate.yaml --out public/isostate/scene
```
