# Contracts: Static Deployment Bundle

## Overview

A static deployment bundle is a directory generated from one authored
`.isostate.yaml` file. It contains the browser-visible runtime, optimized scene
settings, copied external asset source files, and a manifest for diagnostics.

The bundle is designed to be copied into a website `public/` directory or
served from a CDN without a build-time YAML parser in the browser.

## Directory Shape

```text
<out>/
  isostate.runtime.js
  scene.isostate.js
  manifest.json
  assets/
    service.svg
    gateway.svg
    app-icons.png
```

`scene.isostate.js` is the compiled runtime bundle emitted by `toJs()`.
`isostate.runtime.js` is a standalone browser ESM artifact that exports the
runtime public API needed to mount the scene. `assets/` contains only referenced
external asset source files: standalone SVG assets and sprite sheet image files.

## Manifest Shape

```ts
interface StaticBundleManifest {
  format: 'isostate-static-bundle';
  version: string;
  generatedAt: string;
  source: {
    file: string;
  };
  runtime: {
    file?: string;
    mode: 'copy' | 'external' | 'none';
  };
  scene: {
    file: string;
    format: 'js' | 'json';
    digest: string;
  };
  assets: Array<{
    id: string;
    source: string;
    file: string;
    url: string;
    digest: string;
  }>;
}
```

Manifest rules:

- `format` is always `isostate-static-bundle`.
- `version` matches the CLI package version.
- `generatedAt` is an ISO timestamp.
- `scene.digest` matches `RuntimeBundle._digest`.
- asset `digest` values are SHA-256 hex digests of copied file bytes.
- asset entries are sorted by `id`.
- paths are written with `/` separators.

## Asset Resolution

The bundle command resolves assets from authored `header.assets` entries:

- normal URL asset `path` is relative to `--asset-dir` unless absolute;
- missing `.svg` extensions are appended during normal URL asset resolution;
- sprite sheet `path` is relative to `--asset-dir` unless absolute, must include
  its explicit image extension, and is resolved once for all referenced sprites
  in that sheet;
- copied filenames preserve the source basename unless a collision occurs;
- filename collisions are resolved by prefixing the asset id;
- compiled bundle URLs are rewritten to
  `<public-asset-base>/<copied-file-name>`.

Built-in generated assets are not copied and do not appear in the manifest.

## Runtime Artifact

`isostate.runtime.js` must be browser-safe ESM and must not import or contain:

- `yaml`;
- parser, validator, or compiler modules;
- filesystem APIs;
- `node:crypto`;
- CLI code.

The runtime artifact is allowed to export the same runtime-safe public API as
`@sebastianwessel/isostate`, but static bundle docs use only `mountScene`.

## Failure Behavior

The bundle command must fail before publishing output when:

- YAML parsing or semantic validation fails;
- a referenced external asset cannot be resolved;
- an asset source is not an SVG file;
- runtime artifact generation or copying fails;
- output files cannot be written.

Implementations must write into a temporary directory before publishing. When
the target directory already exists, failures before final publish must preserve
the existing target. During final publish, implementations must either replace
the target atomically or move the existing target aside and restore it when the
new target cannot be published.

## Verification

Static bundle tests must verify:

- expected files are written;
- copied asset set exactly matches referenced external assets;
- compiled asset URLs point at copied assets;
- built-in generated assets are not copied;
- runtime artifact excludes dev-time modules;
- generated output imports in a browser-like ESM environment or Bun ESM smoke
  test.
