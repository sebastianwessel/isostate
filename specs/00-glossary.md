# Glossary

## Product Terms

| Term | Definition | Avoided Aliases |
|---|---|---|
| isostate | Browser library for compiled, scroll-driven isometric SVG scenes. | iso-state |
| SceneDocument | Top-level declarative description containing a header and ordered scenes. | diagram, canvas |
| Scene | One timeline stop; first scene is a full snapshot, later scenes are deltas. | slide, frame |
| Runtime bundle | Validated and compiled scene data loaded by the browser runtime. | manifest, scene config |
| Engine | Browser runtime that builds SVG DOM and applies animation frames from a runtime bundle. | renderer, player |
| Controller | Runtime object that owns progress, scene index, scroll binding, pause/resume, and scene navigation. | scroll tracker |

## DSL Terms

| Term | Definition | Avoided Aliases |
|---|---|---|
| Rendering DSL | YAML scene syntax for header settings and scene delta operations. | diagram DSL |
| Header | Document section containing assets, grid, floor, layout, theme, root CSS class, and layers. | globals |
| Element | Placed asset instance with grid coordinate, size, layer, and animation metadata. | node |
| Connector | Generated SVG ground-plane route with style, endpoints, direction, lifecycle, and animation metadata. | arrow, flow, road |
| Asset | Reusable SVG source registered by name and cloned into elements. | component, sprite |
| Layer | Ordered SVG group used for render order, grouping, and inherited CSS variables/classes. | group |
| Delta | Scene operation that adds, updates, or removes elements relative to the previous scene. | patch |
| Runtime snapshot | Compiler-generated complete scene stop used by the runtime. | keyframe |
| Lifecycle status | Compiler-derived element presence status. | visibility |

## Projection Terms

| Term | Definition |
|---|---|
| Grid position | Logical `[x, y]` coordinate in scene space, authored as `at`. |
| Cell size | Pixel unit used to project grid coordinates and scale elements. |
| Diamond projection | 2D isometric projection using `x - y` for screen X and `x + y` for screen Y. |
| Footprint anchor | Derived projected grid point for an element footprint. Authored `at` is the top-left grid coordinate of the footprint; the render anchor is projected from `[at.x + size, at.y + size]`. The asset's normalized `anchor` point is placed on this projected point. |

## Tooling Terms

| Term | Definition |
|---|---|
| Parser | Dev-time YAML adapter that turns `.isostate.yaml` text into `SceneDocument`. |
| Validator | Dev-time semantic checker that returns a `ValidationReport`. |
| Compiler | Dev-time transformer from validated `SceneDocument` to `RuntimeBundle`. |
| CLI | Planned dev-time commands for `validate`, `compile`, and bundle inspection. |
| Converter | Dev-time adapter that maps another format, such as Mermaid, into the rendering DSL. |
