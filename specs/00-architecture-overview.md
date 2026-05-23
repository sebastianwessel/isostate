# Architecture Overview

## Boundaries

isostate has two execution boundaries:

- Dev-time DSL tooling parses `.isostate.yaml`, validates it, expands scene deltas, and emits runtime bundles.
- Browser runtime loads compiled bundles, renders SVG, and applies controller-driven animation.

The browser runtime must not import YAML parsing, validation, compiler code, `fs`, or other Node-only modules.

A third package boundary is planned for authoring:

- Browser editor loads a React authoring UI, parses and validates YAML in the
  editor package, previews with the runtime renderer, and exports YAML or
  compiled bundles.

The editor package is intentionally outside the core runtime graph. Its YAML,
React, Radix/component, and code-editor dependencies must never become imports
of the runtime entrypoint or static deployment runtime.

## Data Flow

```text
.isostate.yaml
  header + scenes/deltas
      |
      v
SceneDocument
      |
      v
validated + expanded snapshots
      |
      v
RuntimeBundle
      |
      v
mountScene(container, bundle)
```

Scene camera focus follows the same boundary: authored YAML may declare
`scenes[].camera`, dev-time tooling validates and normalizes it into the
runtime bundle, and the browser controller applies it by changing the SVG
`viewBox`. The browser runtime must not parse or validate authored camera YAML.

## Public Builder

The high_level_api is `mountScene` for browser runtime use,
`parseScene` + `validateScene` + `compileScene` for build-time use, and
`mountEditor` for browser authoring use. Low-level rendering and controller
classes are low_level_escape_hatch surfaces for tests and advanced integrations.
