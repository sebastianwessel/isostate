# Architecture Overview

## Boundaries

isostate has two execution boundaries:

- Dev-time DSL tooling parses `.isostate.yaml`, validates it, expands scene deltas, and emits runtime bundles.
- Browser runtime loads compiled bundles, renders SVG, and applies controller-driven animation.

The browser runtime must not import YAML parsing, validation, compiler code, `fs`, or other Node-only modules.

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

## Public Builder

The high_level_api is `mountScene` for browser use and `parseScene` + `validateScene` + `compileScene` for build-time use. Low-level rendering and controller classes are low_level_escape_hatch surfaces for tests and advanced integrations.
