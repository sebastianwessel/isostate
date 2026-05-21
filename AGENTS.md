# AGENTS.md

## Repo Structure

```
specs/                    ← all implementation details live here
  00-vision.md            product vision, capabilities, success metrics
  00-stack.md             technology choices: SVG+CSS, Bun, Biome, TypeScript 5.x
  00-conventions.md       naming, layout, error handling, git
  01-domains/             domain entities
  02-capabilities/{dsl,rendering,animation,controller}/  capability specs
  02-capabilities/dsl/compiler.md  compiler pipeline architecture
  03-contracts/           API/interface contracts
  03-flows/               user/interaction flows
  04-nfr/                 non-functional requirements
packages/
  core/                   core library source
    src/
      dsl/                # YAML parser, validator, compiler (dev-time only)
      rendering/          # SVG rendering layer
      animation/          # Animation engine
      types/              # Shared TypeScript types
      utils/              # Shared utilities
      index.ts            # Public API entry point
docs/                     end-user documentation
tests/                    shared test fixtures and helpers
skills/                   AI agent skills (workflow guides, not runtime code)
  authoring-isostate-scenes/  # Skill: writing/reviewing scene DSL, assets, examples
```

## Spec Hierarchy

Numbered prefixes indicate ordering: read `00-*` before `01-*` before `02-*`.

**All implementation-relevant information is in `specs/`.** This file contains only structural and workflow guidance.

## Required Sync Discipline

Any change to public DSL shape, runtime bundle shape, renderer behavior, asset
semantics, examples, or generated output must update the complete artifact set
in the same change:

- `specs/` source-of-truth contracts and capability docs
- `packages/core/src/types/*` public and runtime types
- parser, validator, compiler, renderer, animation/controller code as needed
- focused tests covering parse, validate, compile, render, controller/runtime
  behavior, and public type contracts
- `docs/` developer-facing docs and examples
- `skills/authoring-isostate-scenes/` references when authoring rules change
- generated demo bundles such as `examples/basic/scene.isostate.js` whenever
  the source YAML changes

Do not leave code, specs, docs, skills, or examples knowingly out of sync.

## Key Constraints

- **SVG + 2D diamond projection**, not Three.js. Target ≤50 objects.
- **Bun** — package manager, runtime, test runner (`bun:test`).
- **Biome** — lint + format (no ESLint/Prettier).
- **ESM only**, TypeScript 5.x. Zero runtime dependencies in browser bundle.
- Bundle target: <20KB gzipped (core without components).
- Browser-only library — no server component.
- **YAML DSL** — scene definitions use YAML format (`.isostate.yaml`).
- **Compiler pipeline** — dev-time YAML → validated DSL → compiled runtime bundle. Parser/validator/compiler never shipped to browser.
- **Skills** — `skills/` directory contains AI agent workflow guides for DSL authoring, asset creation, and format conversion.

## Compilation Pipeline

The project uses a multi-step compilation pipeline that separates dev-time tooling from runtime delivery:

```
Dev Time (Node.js / Build)                    Runtime (Browser)
─────────────────────────────────            ───────────────────

Input Sources:                                 Engine + Compiled Bundle
  • Human-written .isostate.yaml                (no parser, no validator)
  • Mermaid → DSL converter (mermaid2dsl)       <20KB gzipped total
  • LLM-generated YAML

Pipeline:
  YAML → Parse → Validate → Compile → Bundle
  (yaml) (semantic)  (optimization)  (.isostate.js/.json)
```

### Dev-Time Tooling

| Tool | Purpose | Shipped? |
|---|---|---|
| `yaml` package | Parse `.isostate.yaml` into typed `SceneDefinition` | No |
| DSL Validator | Semantic validation (4 phases) | No |
| DSL Compiler | Optimize + serialize to `RuntimeBundle` | No |
| `@isostate/cli` | CLI for validate, compile, bundle commands | No |
| `mermaid2dsl` | Convert Mermaid diagrams to YAML DSL | No |

### Browser Runtime

| Component | Content | Size |
|---|---|---|
| Engine | SVG rendering, projection, animation, controller | ~15KB gzipped |
| Bundle (`.isostate.js`) | Compiled scene data (JS module) | ~2KB gzipped |
| Bundle (`.isostate.json`) | Compiled scene data (JSON) + separate asset loading | ~2KB gzipped |

**Never** include `yaml` package, parser, validator, or compiler code in the browser bundle.

## Skills Directory

The `skills/` directory contains AI agent workflow guides. These are **not runtime code** — they are instruction sets that help AI agents assist with:

- **`authoring-isostate-scenes/`** — Writing and reviewing valid
  `.isostate.yaml` scene files, asset anchors, generated primitives, text
  labels, connections, examples, and converter outputs.

## Gotchas

- `04-backend/` is a placeholder — irrelevant, this is browser-only.
- **Never** include `yaml` package or validator/compiler code in the browser bundle — they are dev-time only.
- `02-capabilities/scroll.md` is superseded by `02-capabilities/controller.md`.
- Skills in `skills/` directory are AI agent workflow guides, not runtime code.
- Built-in generated assets (`text`, `rectangle`, `circle`, `polygon`, `line`)
  are reserved and must not be declared in `header.assets`.
- Hand-authored element `at`, manual routes, and `size` values use whole grid
  cells unless a spec explicitly says otherwise. Composite visual assets should
  be authored with explicit whole-cell `size` and correct `anchor`, or split
  into separate one-cell assets/elements.
