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
| `tsc` | ^7.0.2 | Native TypeScript compiler and declaration generation |
| `rollup` | ^4.64.0 | Bundle generation (ESM) |
| `esbuild` | ^0.28.2 | TypeScript/TSX transforms and source maps for Rollup |
| `tsx` | ^4.23.15 | Run TypeScript files directly (scripts) |
| `bun` | 1.4.2 | Development runtime, package manager, and test runner |
| `yaml` | ^2.9.1 | YAML parsing (dev-time only, not shipped to browser) |

TypeScript 7 provides the native `tsc` executable but no stable JavaScript
compiler API. The Rollup build uses esbuild for syntax transforms instead of
the removed `transpileModule` API; type checking and declarations remain the
responsibility of TypeScript. TSConfig paths are explicitly relative, without
the removed `baseUrl` option or deprecated interop overrides.

Website tooling uses Astro 7.3.5, `@astrojs/sitemap` ^3.7.4,
`astro-og-canvas` ^0.13.2, and `canvaskit-wasm` ^0.42.0. Development CI uses
Node 24 (Astro requires Node >=22.12 and size-limit requires Node >=22.19 on
the Node 22 release line). The published core and CLI retain their Node >=18
consumer requirement; development tooling does not ship with those packages.

`site:dev` passes Astro's `--ignore-lock` flag to keep the development server
in the foreground, including when an agent launches it. This avoids Astro's
automatic agent backgrounding and gives the invoking process ownership of
the server's lifetime.

## Dev-Time Packages

These modules belong to the build pipeline or isolated authoring tools and
are **never included in the browser playback runtime**:

| Package | Purpose |
|---|---|
| `yaml` | Parse `.isostate.yaml` files into typed `SceneDocument` objects |
| `@sebastianwessel/isostate-cli` (approved next wave) | CLI for validate, compile, bundle, inspect commands |
| `mermaid2dsl` | Convert supported flowcharts to `.isostate.yaml`; a dependency-free source adapter also powers the isolated website authoring workbench |

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
// "optionalDependencies": { "yaml": "^2.9.1" }
```

For bundling, Rollup should use `external: ['yaml']` or tree-shake to exclude it from the output bundle.

## Testing

| Tool | Version | Purpose |
|---|---|---|
| `bun:test` | built-in | Unit and integration tests (included with Bun) |
| `happy-dom` | 20.14.5 | DOM environment for browser and editor tests |

## Linting & Formatting

| Tool | Version | Purpose |
|---|---|---|
| `@biomejs/biome` | ^2.5.15 | Linting and code formatting (replaces ESLint + Prettier) |

## Package Manager

**Bun** — chosen for fast installs, built-in test runner, and zero-config TypeScript support.

The workspace declares `packageManager: "bun@1.4.2"`; CI follows the stable
Bun release. Updating this declaration does not change an existing global Bun
installation.

TypeScript should be kept on the most recent stable major release supported by
the project toolchain. When upgrading TypeScript, update package manifests,
lockfiles, generated declarations, and any affected compiler or lint guidance in
the same change.

## Package Publishing

| Tool | Version | Purpose |
|---|---|---|
| `publint` | ^0.3.25 | Validate package.json for npm publishing |
| `size-limit` | ^14.1.0 | Monitor bundle size |

Published packages:

| Package | Published | Purpose |
|---|---|---|
| `@sebastianwessel/isostate` | yes | Browser runtime and dev-time DSL entrypoint |
| `@sebastianwessel/isostate-cli` | approved next wave | Local process CLI for validation, compilation, static bundling, and inspection |
| `@sebastianwessel/isostate-editor` | planned | Browser authoring UI for visual editing, YAML editing, validation, preview, and export |

The repository root remains private. Browser runtime artifacts must continue to
exclude `@sebastianwessel/isostate-cli`, `yaml`, parser, validator, compiler, and filesystem
code.

## Editor Package Stack

`@sebastianwessel/isostate-editor` is a separate authoring package under
`packages/editor`. It may use browser UI dependencies that are not allowed in
the core runtime package:

| Dependency Family | Purpose |
|---|---|
| React | Component runtime for the editor package and Astro React islands |
| Radix primitives | Accessible controls used directly or through copied shadcn/ui component patterns |
| CodeMirror 6 | YAML code editing, folding, diagnostics, search, and formatting actions |
| YAML language tooling | Browser authoring parse/format support inside the editor package only |

The editor and website development toolchain track React/React DOM ^19.3.0,
Radix UI ^1.6.7, `react-resizable-panels` ^4.14.2, `lucide-react` ^1.52.0,
and Tailwind CSS/CLI ^4.3.3. CodeMirror packages retain their individual
current stable 6.x versions in the workspace manifest and Bun lockfile.

These dependencies are editor-only. They must not be imported by
`@sebastianwessel/isostate`, included in static runtime bundles, or counted
against the core browser runtime size budget.

The editor may use shadcn/ui component source as implementation scaffolding, but
published consumers must not need Tailwind, a shadcn project, or generated
component files. The editor ships compiled CSS through
`@sebastianwessel/isostate-editor/style.css` using CSS variables and ordinary
CSS selectors. Light/dark mode follows a root `.dark` class plus editor CSS
variables.

CodeMirror 6 is the preferred YAML editor because it is modular, browser-first,
and better suited to static Astro embedding than Monaco. Monaco is not part of
the v1 dependency plan.

The editor imports browser-safe DSL APIs from
`@sebastianwessel/isostate/dsl/browser`. That entrypoint may include YAML
parsing and pure validation/compilation code for authoring UI use, but it must
not import `fs`, `path`, Bun APIs, Node-only modules, CLI code, or static bundle
filesystem helpers. The existing `@sebastianwessel/isostate/dsl` entrypoint
remains the local-process build/CLI entrypoint.

## Architecture Decision: SVG + CSS over Three.js

We use **SVG + CSS** (not Three.js) as the rendering backend because:

- The target scene complexity is ≤50 objects, well within SVG/DOM performance limits.
- Native responsive layouts via `viewBox` — no manual resize handling.
- Zero runtime dependencies — only web standards, no 150KB+ 3D engine.
- CSS transitions and `@keyframes` for element animations.
- Hover, focus, and accessibility work out of the box.
- Easier to style with CSS variables and media queries.

The isometric projection is achieved via 2D diamond projection — pre-rendered 2D isometric assets are placed on a flat SVG plane using calculated screen coordinates, with manual depth sorting via DOM order for correct painter's algorithm ordering. No CSS 3D transforms are used.
