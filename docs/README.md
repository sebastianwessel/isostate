# isostate Docs

isostate renders compiled isometric scene bundles in the browser. Author YAML at
build time, compile it into a runtime bundle, then mount that bundle with the
small browser runtime.

## AI Authoring Skill

Install the isostate authoring skill before asking an AI assistant to write or
review scene YAML:

```bash
bunx skills add sebastianwessel/isostate --skill authoring-isostate-scenes
```

See [Install The Authoring Skill](./guides/install-authoring-skill.md) for
package-runner variants, agent-specific installation, and verification.

## Start Here

- [Install The Authoring Skill](./guides/install-authoring-skill.md): give your
  AI assistant the isostate DSL, asset, connector, and deployment rules.
- [Getting Started](./getting-started.md): compile the demo and mount it in a
  browser page.
- [Author Scene Deltas](./guides/author-scene-deltas.md): write the YAML
  timeline model.
- [Deploy Static Bundle](./guides/deploy-static-bundle.md): generate
  public-folder output with the CLI.
- [Public API](./reference/public-api.md): runtime and dev-time imports.
- [Runtime Bundle](./reference/runtime-bundle.md): compiled artifact shape.
- [Errors](./reference/errors.md): structured error classes and common fixes.
- [Types Reference](./reference/types.md): exported TypeScript contracts.

## Examples

- [Examples Index](./examples/README.md): choose the focused workflow.
- [Runtime Basic](./examples/runtime-basic.md): mount a precompiled bundle.
- [Controller Scroll](./examples/controller-scroll.md): drive progress from a
  scroll container.
- [Compile YAML](./examples/compile-yaml.md): parse, validate, and compile
  `.isostate.yaml`.
- [Custom Assets](./examples/custom-assets.md): create browser-loadable SVG
  assets with explicit footprint anchors.
- [Custom Theme](./examples/custom-theme.md): use CSS variable themes.
- [Inspect Bundle](./examples/inspect-bundle.md): read compiled bundle metadata.
- [Low-Level Rendering](./examples/low-level-rendering.md): advanced rendering
  escape hatch.

## Browser Demo

The runnable demo lives in [`examples/basic`](../examples/basic/README.md). It
uses the same public API documented here.
