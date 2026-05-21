# Stack

## Language & Runtime

- **Language**: TypeScript, tracking the current stable major release
- **Runtime**: Browser (ES2022), Bun (for development/tooling only)
- **Module format**: ESM primary

## Runtime Dependencies (Browser)

| Dependency | Version | Purpose |
|---|---|---|
| *(none)* | — | Zero runtime dependencies — SVG + CSS standards only |

## Build & Dev Tooling

| Tool | Version | Purpose |
|---|---|---|
| `tsc` | ^6.0.3 | TypeScript compiler |
| `rollup` | ^4.60.4 | Bundle generation (ESM) |
| `tsx` | ^4.22.3 | Run TypeScript files directly (scripts) |
| `bun` | ^1.1.0 | Development runtime, package manager, and test runner |
| `yaml` | ^2.9.0 | YAML parsing (dev-time only, not shipped to browser) |

## Dev-Time Packages

These packages are used only in the build/dev pipeline and **never shipped to the browser**:

| Package | Purpose |
|---|---|
| `yaml` | Parse `.isostate.yaml` files into typed `SceneDocument` objects |
| `@sebastianwessel/isostate-cli` (approved next wave) | CLI for validate, compile, bundle, inspect commands |
| `mermaid2dsl` (planned) | Convert Mermaid diagrams to `.isostate.yaml` DSL |

## Runtime Packages

The browser bundle contains **zero external packages**. Scene data is loaded as pre-compiled JS/JSON (`.isostate.js` or `.isostate.json`).

## YAML Parsing

The `yaml` npm package is used for parsing `.isostate.yaml` files. It is a **dev-time dependency only** and is **never included in the browser bundle**. The compiler pipeline ensures that the parser is stripped from the final runtime output.

### Deployment Model

```
Dev Time:          .isostate.yaml → parse → validate → compile → .isostate.js/.json
Browser:           Engine + .isostate.js/.json (no parser, no yaml package)
```

In the browser runtime, scene data is loaded directly as pre-compiled JavaScript/JSON (`.isostate.js` or `.isostate.json`), bypassing the parser entirely.

The `yaml` package should be declared as a **peer dependency** or **optional dependency** to avoid accidental bundling:

```ts
// In package.json:
// "peerDependencies": { "yaml": ">=2.0.0" }
// OR
// "optionalDependencies": { "yaml": "^2.9.0" }
```

For bundling, Rollup should use `external: ['yaml']` or tree-shake to exclude it from the output bundle.

## Testing

| Tool | Version | Purpose |
|---|---|---|
| `bun:test` | built-in | Unit and integration tests (included with Bun) |

## Linting & Formatting

| Tool | Version | Purpose |
|---|---|---|
| `@biomejs/biome` | ^2.4.15 | Linting and code formatting (replaces ESLint + Prettier) |

## Package Manager

**Bun** — chosen for fast installs, built-in test runner, and zero-config TypeScript support.

TypeScript should be kept on the most recent stable major release supported by
the project toolchain. When upgrading TypeScript, update package manifests,
lockfiles, generated declarations, and any affected compiler or lint guidance in
the same change.

## Package Publishing

| Tool | Version | Purpose |
|---|---|---|
| `publint` | ^0.3.21 | Validate package.json for npm publishing |
| `size-limit` | ^12.1.0 | Monitor bundle size |

Published packages:

| Package | Published | Purpose |
|---|---|---|
| `@sebastianwessel/isostate` | yes | Browser runtime and dev-time DSL entrypoint |
| `@sebastianwessel/isostate-cli` | approved next wave | Local process CLI for validation, compilation, static bundling, and inspection |

The repository root remains private. Browser runtime artifacts must continue to
exclude `@sebastianwessel/isostate-cli`, `yaml`, parser, validator, compiler, and filesystem
code.

## Architecture Decision: SVG + CSS over Three.js

We use **SVG + CSS** (not Three.js) as the rendering backend because:

- The target scene complexity is ≤50 objects, well within SVG/DOM performance limits.
- Native responsive layouts via `viewBox` — no manual resize handling.
- Zero runtime dependencies — only web standards, no 150KB+ 3D engine.
- CSS transitions and `@keyframes` for element animations.
- Hover, focus, and accessibility work out of the box.
- Easier to style with CSS variables and media queries.

The isometric projection is achieved via 2D diamond projection — pre-rendered 2D isometric assets are placed on a flat SVG plane using calculated screen coordinates, with manual depth sorting via DOM order for correct painter's algorithm ordering. No CSS 3D transforms are used.
