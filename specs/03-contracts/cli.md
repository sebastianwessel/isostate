# Contracts: CLI

## Overview

`@sebastianwessel/isostate-cli` is the dev-time command package for validating authored YAML,
compiling runtime scene data, and producing static website deployment folders.
It is never imported by the browser runtime.

## Package

| Field | Value |
|---|---|
| Package | `@sebastianwessel/isostate-cli` |
| Binary | `isostate` |
| Runtime | local Node/Bun-compatible process |
| Audience | application developers, documentation authors, CI |
| Stability | experimental |
| Depends on | `@sebastianwessel/isostate/dsl`, filesystem APIs |
| Must not ship in | browser runtime bundle |

The CLI owns argument parsing, filesystem reads/writes, asset copying, and
terminal diagnostics. The DSL package owns YAML parsing, semantic validation,
runtime bundle compilation, and canonical serialization.

## Commands

### `isostate validate`

```bash
isostate validate scene.isostate.yaml
```

Behavior:

- reads one `.isostate.yaml` input file;
- parses and validates it through `@sebastianwessel/isostate/dsl`;
- prints a compact success summary for valid input;
- prints validation errors and warnings with stable error codes and available
  context such as `scene=...`, `element=...`, `field=...`, and `value=...`;
- exits `0` when validation has no errors;
- exits `1` when parsing, validation, or file access fails.

### `isostate compile`

```bash
isostate compile scene.isostate.yaml --out public/scene.isostate.js
isostate compile scene.isostate.yaml --out public/scene.isostate.json --format json
```

Options:

| Option | Values | Default | Rule |
|---|---|---|---|
| `--out` | path | `build/scene.isostate.js` | parent directories are created |
| `--format` | `js`, `json` | inferred from `--out`, otherwise `js` | unsupported values fail |
| `--pretty` | flag | off | JSON/JS payload uses pretty serialization where supported |

Behavior:

- validates before writing output;
- writes canonical JS default export or canonical JSON;
- never copies external asset source files;
- exits non-zero without writing partial output when parse, validate, compile,
  or write fails.

### `isostate bundle`

```bash
isostate bundle scene.isostate.yaml --out public/isostate/scene
```

Options:

| Option | Values | Default | Rule |
|---|---|---|---|
| `--out` | directory | required | deployment directory to create |
| `--asset-dir` | directory | directory containing the YAML input | source root for local external assets |
| `--public-asset-base` | URL/path | `./assets` | URL prefix written into compiled scene data |
| `--scene-name` | filename stem | `scene` | output scene bundle basename |
| `--runtime` | `copy`, `external`, `none` | `copy` | controls runtime artifact output |

Output with default options:

```text
<out>/
  isostate.runtime.js
  scene.isostate.js
  manifest.json
  assets/
    <referenced external asset source files>
```

Behavior:

- validates and compiles the YAML input;
- resolves only external asset source files referenced by compiled runtime data,
  including standalone SVG assets and sprite sheet image files;
- excludes built-in generated assets: `text`, `rectangle`, `circle`,
  `polygon`, and `line`;
- copies referenced external assets into `<out>/assets`;
- rewrites compiled asset URLs to use `--public-asset-base`;
- copies the standalone browser runtime when `--runtime copy`;
- writes a deployment manifest described in
  `specs/03-contracts/static-bundle.md`;
- exits non-zero without leaving a partially updated deployment folder when
  validation, asset resolution, asset copying, or output writing fails.

### `isostate assets manifest`

```bash
isostate assets manifest assets --out public/isostate-assets.manifest.json --asset-base-url ./assets
```

Options:

| Option | Values | Default | Rule |
|---|---|---|---|
| positional `asset-dir` | directory | required | root directory to scan recursively |
| `--out` | path | `isostate-assets.manifest.json` | parent directories are created |
| `--asset-base-url` | URL/path | `./assets` | written to manifest `assetBaseUrl` |
| `--metadata` | path | `<asset-dir>/.isostate-assets.yaml` when present | optional manifest metadata |
| `--pretty` | flag | on | writes indented JSON when enabled |

Behavior:

- recursively scans `asset-dir` for `.svg` files and metadata-declared sprite
  sheet image files with `.png`, `.webp`, `.jpg`, `.jpeg`, or `.svg`
  extensions;
- follows no symlinks;
- treats the first directory segment below `asset-dir` as the manifest group;
- derives stable DSL-safe ids from relative paths as defined in
  `specs/03-contracts/asset-manifest.md`;
- reads optional labels, anchors, tags, sprite sheet definitions, `sheetSize`,
  and `tileSize` from the metadata file described in
  `specs/03-contracts/asset-manifest.md`;
- computes a `sha256` digest for every manifest asset source file;
- rejects SVG files larger than 512KB;
- rejects raster sprite sheet files larger than 2MB;
- reads raster image dimensions for sprite sheet `sheetSize`; when metadata
  also supplies `sheetSize`, the values must match;
- writes an `isostate.asset-manifest` JSON file;
- excludes dotfiles and files inside dot-directories;
- excludes built-in generated asset ids: `text`, `rectangle`, `circle`,
  `polygon`, and `line`;
- exits non-zero without writing output when the scan finds duplicate derived
  ids, case-only path collisions, reserved ids, invalid SVG filenames that
  cannot normalize to an id, invalid metadata, invalid sprite sheet metadata,
  sprite ids that collide with other manifest ids, unsafe SVG content, external
  SVG references, oversized files, unsupported image extensions, unreadable
  image dimensions, or file access errors.

### `isostate inspect`

```bash
isostate inspect public/isostate/scene/scene.isostate.js
isostate inspect public/isostate/scene/scene.isostate.json
```

Behavior:

- parses canonical runtime bundle JSON or JS default export;
- verifies `_format`, `_version`, and `_digest`;
- prints scene count, asset count, layer count, floor size, and digest;
- exits non-zero for malformed or non-canonical bundle files.

## Diagnostics

CLI diagnostics are human-readable by default and must preserve structured error
codes from core errors. Errors must not print full YAML source.

Warnings never change the exit code unless validation errors are also present.

## Public API Inventory

| Entry | Kind | Owner | Audience | Stability | Execution Semantics | Contract Source | Example Path | Test Path |
|---|---|---|---|---|---|---|---|---|
| `isostate validate` | CLI command | `packages/cli` | app developers, CI | experimental | local_process | `03-contracts/cli.md` | `docs/guides/deploy-static-bundle.md` | `tests/cli/validate.test.ts` |
| `isostate compile` | CLI command | `packages/cli` | app developers, CI | experimental | local_process | `03-contracts/cli.md` | `docs/examples/compile-yaml.md` | `tests/cli/compile.test.ts` |
| `isostate bundle` | CLI command | `packages/cli` | app developers deploying static sites | experimental | local_process | `03-contracts/cli.md`, `03-contracts/static-bundle.md` | `docs/guides/deploy-static-bundle.md` | `tests/cli/bundle.test.ts` |
| `isostate assets manifest` | CLI command | `packages/cli` | app developers and editor users | experimental | local_process | `03-contracts/cli.md`, `03-contracts/asset-manifest.md` | `docs/examples/asset-manifest.md` | `tests/cli/assets-manifest.test.ts` |
| `isostate inspect` | CLI command | `packages/cli` | app developers, support/debugging | experimental | local_process | `03-contracts/cli.md`, `03-contracts/runtime-bundle.md` | `docs/examples/inspect-bundle.md` | `tests/cli/inspect.test.ts` |

## Verification

Default verification for CLI work:

```bash
bun test tests/cli
bun run typecheck
bun run lint
bun run build
```

Release verification also runs:

```bash
bun run publint
bun run size
```

Asset manifest verification must include fixtures for nested groups, metadata,
duplicate ids, reserved ids, hidden files, symlink skipping, unsafe SVG
rejection, oversized SVG rejection, case-only collisions, sprite sheet metadata,
sprite id collisions, invalid sprite rectangles, unsupported extensions, and
generated YAML-ready sprite sheet entries.
