# Vision: Isostate

## Product Name

**isostate** — A TypeScript/JavaScript library for creating scroll-driven animated isometric illustrations.

## Problem

Web developers and designers need a way to create engaging, interactive isometric illustrations that respond to user interactions (especially scroll) and can be defined declaratively through a textual DSL.

Existing solutions are split:

- **Static isometric SVG libraries** (e.g., `@elchininet/isometric`) support isometric shapes but lack scroll-driven animation and a textual DSL.
- **3D diagram tools** (e.g., iCraft) convert Mermaid into 3D, but are not library-grade for embedding in custom web apps with scroll-driven animation.
- **Three.js** provides powerful 3D rendering but requires verbose imperative code — no declarative DSL, no isometric convention, no scroll-animation system. Three.js is also heavy (~150KB) and not needed for simple isometric illustrations.

## Solution

A library that combines:

1. **A Mermaid-inspired DSL** for declaratively defining isometric 3D scenes with elements and layers.
2. **SVG isometric rendering** — Assets are pre-rendered 2D isometric illustrations (like SimCity, Factorio, Diablo). They are placed on a diamond-projected grid with painter's algorithm depth sorting. No CSS 3D transforms — the isometric illusion is baked into the assets and grid placement.
3. **A scroll-driven animation engine** that maps scroll position to scene state transitions — elements fade in, resize, move, and animate based on scroll position.

### Architectural Layers

The library separates concerns across distinct layers. A **compilation pipeline** ensures that only minimal code ships to the browser — all parsing, validation, and compilation happen at dev time.

```
Dev Time (Node.js / Build Tool)
┌──────────────────────────────────────────────────┐
│  Input Sources                                    │
│  ─────────────────────────────────────────────   │
│  • Human-written .isostate.yaml                  │
│  • Mermaid → DSL converter (mermaid2dsl)         │
│  • LLM-generated YAML                            │
├──────────────────────────────────────────────────┤
│  Parser → Validator → Compiler → RuntimeBundle   │
│  (yaml lib)  (semantic)  (optimization)          │
│  ─────────────────────────────────────────────   │
│  All dev-time tooling — never shipped to browser │
└──────────────────────────────────────────────────┘

Runtime (Browser)
┌──────────────────────────────────────────────────┐
│  Engine + RuntimeBundle (.isostate.js / .json)  │
│  ─────────────────────────────────────────────   │
│  Renders elements/connectors on isometric grid, │
│  depth-sorts via painter's algorithm,           │
│  builds SVG DOM, drives animations              │
│  Total payload: <20KB gzipped                   │
└──────────────────────────────────────────────────┘
```

#### Dev-Time Pipeline

1. **Input** — YAML DSL from any source (human, Mermaid converter, LLM).
2. **Parse** — `yaml` package converts YAML text into a typed `SceneDocument` object.
3. **Validate** — DSL validator checks semantic correctness (4 phases). Errors block compilation.
4. **Compile** — Expands scene deltas, optimizes, and serializes a `SceneDocument` into a `RuntimeBundle` (JS module or JSON).
5. **Deliver** — Browser loads only the runtime bundle + engine. No parser, no validator, no compiler.

#### Runtime

The browser bundle contains only:
- The rendering engine (SVG DOM, projection, animation, controller)
- Compiled scene data (`.isostate.js` or `.isostate.json`)

No YAML parsing, no validation, no compilation logic is shipped.

The rendering DSL does **not** include logical graph nodes, graph edges, or semantic relations. Those concepts belong to converter layers. The DSL does include **elements** (placed assets), **connectors** (explicit ground-plane rendered routes), and **layers** (render grouping and CSS hooks).

## Target Audience

- Web developers building interactive product pages, documentation, or marketing sites.
- Designers who want to create scroll-animated isometric illustrations without writing imperative code.
- Engineers who need to embed animated isometric illustrations inside applications with zero dependencies.
- Teams that want to convert diagram tools (e.g., Mermaid) into animated isometric visuals via a converter adapter.

## Key Capabilities

### C1: Textual Scene Definition (DSL)

Define scenes using a compact YAML syntax (`.isostate.yaml`). A header declares assets and required render settings; the first scene places elements and optional connectors; later scenes define only deltas. The DSL does not include logical graph edges or relations, but it does include explicit connector routes for visual arrows, flows, and road-like ground paths.

### C2: Isometric SVG Rendering

Render scene graphs as isometric SVG visuals using diamond-projected 2D grid placement with painter's algorithm depth sorting. Assets are pre-rendered 2D isometric illustrations (think SimCity, Diablo, Factorio) — drawn to look 3D from one perspective. Connectors are generated SVG paths on the ground plane. No CSS 3D transforms — the isometric illusion is baked into the assets, grid placement, and projected connector geometry.

### C3: Scroll-Driven Animation

Map scroll position (0–1 normalized) to scene state. Animate elements and connectors entering/exiting, resizing, repositioning, rerouting, and fading based on scroll progress. Connector dash/dot flow animation can also run via CSS classes in the connector's effective direction.

### C4: Scene Deltas

The first scene is a complete placement snapshot. Each following scene declares only what changes: elements and connectors to add, update, or remove. The compiler expands deltas into runtime snapshots for interpolation.

### C5: Component Library

Provide a built-in library of reusable isometric SVG components: buildings, servers, trees, roads, clouds, and more — all styled for an isometric aesthetic.

### C6: Export & Embed

Export static snapshots (PNG/SVG) and embed the animated scene inside any web page or React/Vue component.

### C7: Compilation Pipeline

A dev-time compilation pipeline transforms human-readable YAML into optimized runtime bundles (`.isostate.js` or `.isostate.json`). The browser receives only the rendering engine and compiled data — no parser, validator, or compiler code. Input sources include human-written YAML, Mermaid diagram converters, and LLM-generated scenes.

## AI Skills

The project includes a `skills/` directory containing AI agent workflow guides that help developers:
- Write valid YAML scene DSL (`dsl-writer/`)
- Create isometric assets (`asset-creator/`)
- Build format converters (`converter/`)

These skills encode domain knowledge, best practices, and step-by-step workflows so AI agents can assist with scene authoring, asset creation, and format conversion.

## Non-Goals (v1)

- Real-time collaborative editing of scenes.
- Visual drag-and-drop editor (text-only DSL in v1).
- Server-side rendering of scenes.
- Support for non-isometric camera projections.
- Logical graph edge/relationship semantics in the DSL. The DSL supports visual connector routes only.
- CSS 3D transforms or true 3D rendering.

## Success Metrics

- Bundle size under 20KB gzipped (core without components).
- DSL parses and renders a scene with 50+ elements in under 200ms on mid-range devices.
- Scroll animation runs at 60fps on scenes with up to 50 objects.
- API is usable without any 3D knowledge (encapsulation layer).
- Zero runtime dependencies — only web standards (SVG + CSS).
