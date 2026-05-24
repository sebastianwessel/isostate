# How isostate Works

isostate separates authoring from runtime. YAML, validation, compilation, asset
catalogs, and the editor are development tools. The browser runtime only mounts
a compiled bundle and loads browser-safe assets.

```mermaid
flowchart LR
  subgraph Authoring [Development and CI]
    Brief[Story brief] --> YAML[scene.isostate.yaml]
    Editor[Website editor] --> YAML
    AI[AI assistant with skill] --> YAML
    Assets[SVG assets and sprite sheets] --> Manifest[Asset manifests]
    YAML --> Validate[Validate]
    Manifest --> Validate
    Validate --> Compile[Compile]
    Compile --> Bundle[Runtime bundle]
  end

  subgraph Browser [Browser runtime]
    Bundle --> Mount[mountScene]
    PublishedAssets[Published assets] --> Mount
    Mount --> SVG[Interactive SVG scene]
  end
```

## Source And Output

| File | Role | Edited By |
|---|---|---|
| `.isostate.yaml` | Source scene document | Human, editor, or AI assistant |
| SVG/PNG/WebP assets | Source visual assets | Designer, generator, or catalog maintainer |
| `*.manifest.json` | Editor catalog metadata | CLI or tooling |
| `scene.isostate.js` / `.json` | Compiled runtime bundle | CLI/compiler |
| `isostate.runtime.js` | Standalone browser runtime for static bundles | CLI bundle command |
| `manifest.json` in static output | Deployment metadata and digests | CLI bundle command |

Do not edit generated static output by hand. Change the YAML or source assets,
then validate and regenerate.

## The Three Authoring Modes

All authoring modes produce the same YAML:

```mermaid
flowchart TD
  Editor[Use the editor] --> YAML[Shared YAML source]
  Manual[Write YAML] --> YAML
  Skill[Ask AI with the authoring skill] --> YAML
  YAML --> CLI[Validate and compile]
  CLI --> Runtime[Browser runtime]
```

Use the editor when placement and anchors matter. Write YAML when the structure
is already clear. Use AI when you have a written story brief and want a draft or
review pass.

## Runtime Boundary

The browser runtime does not include:

- YAML parsing
- DSL validation
- compilation
- CLI code
- editor code
- asset manifest scanning
- the `yaml` package

That boundary keeps production pages small and makes validation a build-time
responsibility.

Next: [Plan A Scene](../guides/plan-a-scene.md).
