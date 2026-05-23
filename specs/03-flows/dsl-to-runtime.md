# Flow: YAML DSL to Browser Runtime

## Actor

Developer building a static site, application, documentation page, or generated visual.

## Trigger

Developer creates or updates a `.isostate.yaml` file and runs compile tooling.

## Preconditions

- Bun dependencies are installed.
- `yaml` is available in the dev environment.
- `assetBaseUrl` plus each normal URL asset `path` or `id` resolves every
  referenced standalone SVG asset. Sprite sheet entries resolve through their
  explicit image `path` and expose nested sprite ids as placeable assets.
  External asset entries may declare normalized `anchor` metadata. Built-in
  generated assets and connectors need no external asset entry.
- Browser runtime code does not import `@sebastianwessel/isostate/dsl`.

## Happy Path

1. Developer writes `.isostate.yaml` using `header` plus `scenes`, with
   optional visual connections under `connections` and nested connection delta
   fields, and optional camera focus metadata under `scenes[].camera`.
2. Parser reads YAML and returns `SceneDocument`.
3. Validator checks header asset URL references, asset anchors, built-in text
   payloads, connector routes/styles, camera targets/options,
   floor/layout/layers, scene timeline, and delta legality.
4. Compiler materializes defaults, preserves asset anchors, expands element and
   connector scene deltas into resolved snapshots, normalizes scene camera
   metadata, and emits `RuntimeBundle`.
5. Serializer writes `.isostate.js` or `.isostate.json`.
6. Browser imports/fetches the compiled bundle.
7. Engine checks `_format`, `_version`, and `_digest`.
8. Engine resolves theme and external assets; standalone image viewports and
   sprite viewports use compiled asset anchors, connectors become generated SVG
   paths, and built-in text elements become SVG text nodes directly.
9. Engine computes tight layout bounds/viewBox and builds SVG DOM with floor, connector routes, layers, current scene elements, and the configured root CSS class.
10. Controller sends progress updates to the engine and applies compiled scene
    camera focus by updating the root SVG viewBox from the effective camera
    timeline. Scroll down/up and forward/backward playback interpolate the same
    adjacent effective camera viewBoxes in opposite directions.
11. Engine applies interpolated transforms, derived entry/exit animations, and ambient classes.

## Failure Paths

| Step | Failure | Result |
|---|---|---|
| parse | invalid YAML | throw `ParseError` / CLI exits non-zero |
| validate | semantic errors | return invalid `ValidationReport` / CLI exits non-zero |
| validate/compile | missing asset URL source | return/throw `ASSET_URL_REQUIRED` |
| validate | invalid connector route/style/endpoint/direction | return invalid `ValidationReport` |
| validate | invalid camera target/options | return invalid `ValidationReport` |
| serialize | unsupported format | throw `DSL_SCHEMA_TYPE_ERROR` |
| runtime load | incompatible major version | throw `BUNDLE_VERSION_MISMATCH` |
| runtime load | digest mismatch | throw `BUNDLE_DIGEST_MISMATCH` |
| render | missing runtime asset | throw `ASSET_NOT_FOUND` |
| render | missing runtime text payload | throw `TEXT_CONTENT_MISSING` |

## Cleanup

- Parser/validator/compiler allocate no durable resources.
- Controller `destroy()` removes listeners and cancels pending progress and
  camera animation frames.
- Engine `destroy()` removes owned SVG DOM and event listeners only inside its target container.

## Verification

Default verification must run without browser automation or external services:

```bash
bun test tests/scene-parser.test.ts tests/scene-validator.test.ts tests/compiler.test.ts tests/runtime
bun run typecheck
bun run lint
```

Browser visual tests are opt-in:

```bash
ISOSTATE_BROWSER_TESTS=1 bun test tests/browser
```
