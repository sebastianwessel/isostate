# NFR: Runtime, Security, and CI

## Performance

| Metric | Target | Measurement |
|---|---|---|
| Runtime bundle size | `<20KB` gzipped without dev-time DSL modules | `bun run build && bun run size` |
| Compiled data size | `<2KB` gzipped for representative 50-element scene with URL asset references | fixture size test |
| Initial render | `<200ms` for 50 elements on mid-range device | browser perf test |
| Animation frame budget | 60fps target, no JS frame above 16ms in representative scene | browser perf test |

## Dependency Boundary

- Browser runtime has zero external runtime dependencies.
- `yaml` is a dev-time optional peer dependency and must not appear in runtime chunks.
- Parser, validator, compiler, CLI, and converter code are excluded from runtime browser bundles.
- Static deployment bundles copy only the standalone browser runtime artifact,
  compiled scene data, copied external SVG assets, and manifest metadata.
- Animation CSS is first-party library code. Asset SVG files are loaded by URL and are not parsed or injected by the runtime.

## Security

- Runtime asset URLs must use browser-loadable relative, `http:`, or `https:` URLs. The runtime rejects unsafe schemes such as `javascript:`.
- Runtime must not accept raw asset SVG strings, parse asset SVG with `DOMParser`, or inject per-asset CSS.
- Authored `text.value` is untrusted content. Runtime must render it only by creating SVG text nodes with DOM APIs and assigning line content through `textContent`; it must never use `innerHTML` or parse text as SVG/HTML.
- Theme variable names must start with `--`.
- Theme values are CSS strings and are assigned with `style.setProperty`; no string-concatenated `<style>` blocks from user values.

## Accessibility

- Generated SVG root uses `role="img"` when a scene label is configured.
- If no label is configured, generated SVG root uses `aria-hidden="true"` by default.
- v1 does not expose per-element focus targets unless a later accessibility spec adds interactive elements.
- Motion-heavy ambient animations must respect `prefers-reduced-motion: reduce` by disabling non-essential ambient animations and shortening entry/exit animations to `1ms`.

## Logging and Telemetry

- Production runtime logs nothing by default.
- Development diagnostics may emit warnings for non-blocking issues.
- No telemetry is collected or transmitted by the library.
- Error objects must not include full YAML source in `details`.

## CI Gates

Default CI commands:

```bash
bun ci
bun run format
bun run lint
bun run typecheck
bun run test
bun run build
bun run size
bun run publint
bun run examples:basic:bundle
```

Default CI must not require:

- a browser;
- network access;
- credentials;
- external services;
- GPU access.

Opt-in checks:

| Check | Enable With | Skip Behavior |
|---|---|---|
| Browser visual/perf tests | `ISOSTATE_BROWSER_TESTS=1` | skipped when unset |
| Bundle size budget | `ISOSTATE_SIZE_TESTS=1` or release CI | skipped in local default if tooling unavailable |
| Static bundle browser smoke | `ISOSTATE_BROWSER_TESTS=1` | skipped when unset |

## Supply Chain

- Publish only `dist` files declared in package `files`.
- Run `publint` before release for `@sebastianwessel/isostate` and `@sebastianwessel/isostate-cli`.
- Lock runtime exports so `@sebastianwessel/isostate` and `@sebastianwessel/isostate/dsl` remain separate entrypoints.
- Release process must verify the runtime entrypoint can be bundled without the `yaml` package installed.
- Release process must verify `isostate bundle` output imports without
  dev-time dependencies.
- Pull requests to `main` must run `bun ci`, format, lint, typecheck, tests,
  build, size, package lint, basic example bundle generation, and the static
  website build.
- Manual releases from `main` must verify package versions, reject already
  published npm versions, run `bun ci`/format/lint/typecheck/tests/build/size/
  publint/basic example bundle generation, publish both npm packages, create
  a `v<version>` git tag, create a GitHub release, and deploy the Astro static
  documentation site to GitHub Pages.
