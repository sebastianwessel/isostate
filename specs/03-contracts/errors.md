# Contracts: Errors

## Structured Error Shape

All thrown library errors extend `IsostateError`:

```ts
interface IsostateErrorShape {
  name: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

Validation reports use the same `code` strings but return plain objects instead
of throwing. Validator findings should include contextual fields whenever the
validator can determine them: `sceneId`, `elementId`, `connectionId`,
`assetName`, `layerName`, `field`, and a safe `value` sample. CLI diagnostics
print these as compact key/value pairs before the message.

## Error Classes

| Class | Owner | When Thrown | Retryability |
|---|---|---|---|
| `ParseError` | parser | YAML syntax, schema type mismatch, unknown fields | terminal |
| `ValidationErrorClass` | validator | Programmatic validation failure when throwing API is used | terminal |
| `RenderError` | rendering engine | missing asset URL, unsafe asset URL, missing layer, unsafe runtime bundle | terminal |
| `AnimationError` | animation engine | invalid progress/frame state after initialization | terminal |
| `ControllerError` | controller | invalid scene index, bad config, no scenes | caller_fixable |

## Error Codes

### Parser

| Code | Meaning | Action |
|---|---|---|
| `DSL_PARSE_SYNTAX_ERROR` | YAML parser failed. | Fix YAML. |
| `DSL_SCHEMA_TYPE_ERROR` | A field has the wrong primitive/container type. | Fix field type. |
| `UNKNOWN_FIELD` | Unsupported field appears in authored YAML. | Remove or rename field. |
| `INVALID_IDENTIFIER` | Identifier is not kebab-case. | Rename identifier. |

### Validator

| Code | Meaning | Action |
|---|---|---|
| `ASSET_URL_REQUIRED` | Declared external asset cannot resolve to a URL from `assetBaseUrl`. | Add `assetBaseUrl`, add `path`, or use `asset: text` for generated text. |
| `ASSET_NOT_FOUND` | Runtime bundle does not contain a URL for a referenced external asset. | Recompile from valid YAML or fix reference. |
| `ASSET_NOT_DECLARED` | Element references an asset not listed in `header.assets`. | Add asset to header or fix reference. |
| `ASSET_TYPE_UNSUPPORTED` | `header.assets[]` declares an unsupported asset `type`. | Use no `type` for normal SVG URL assets or `type: sprite-sheet`. |
| `BUILTIN_ASSET_ID_RESERVED` | `header.assets` declares a reserved built-in asset id such as `text`. | Remove the declaration and use the built-in element contract. |
| `DUPLICATE_ASSET_ID` | Duplicate asset id in `header.assets`. | Rename or remove duplicate. |
| `SPRITE_SHEET_NOT_PLACEABLE` | An element or floor references a sprite sheet namespace id instead of a sprite id. | Reference one of the sheet's `sprites` ids. |
| `INVALID_SPRITE_SHEET_PATH` | A sprite sheet path is missing, lacks an explicit supported extension, uses `.gif`, or uses an unsupported extension. | Use a relative `.png`, `.webp`, `.jpg`, `.jpeg`, or `.svg` path. |
| `INVALID_SPRITE_SHEET_SIZE` | `sheetSize` is missing or is not a positive whole-pixel `[width, height]` tuple. | Add a valid source image size. |
| `INVALID_SPRITE_TILE_SIZE` | `tileSize` is required, malformed, or not a positive whole-pixel `[width, height]` tuple. | Add a valid tile size or use only `rect` sprites. |
| `NO_SPRITES` | A sprite sheet declares no sprites. | Add at least one sprite or remove the sheet. |
| `INVALID_SPRITE_ID` | A sprite id is not kebab-case or uses a reserved built-in id. | Rename the sprite. |
| `DUPLICATE_SPRITE_ID` | A sprite id is repeated across sheets. | Rename one sprite. |
| `SPRITE_ASSET_ID_COLLISION` | A sprite id collides with a normal asset id or sprite sheet namespace id. | Rename either the sprite or the colliding asset. |
| `INVALID_SPRITE_DEFINITION` | A sprite definition has both `at` and `rect`, neither `at` nor `rect`, an invalid tuple, or unknown fields. | Use `[column, row]`, `{ at: [column, row] }`, or `{ rect: [x, y, width, height] }`. |
| `INVALID_SPRITE_RECT` | A compiled or authored sprite rectangle is malformed or outside `sheetSize`. | Use whole positive dimensions inside the sheet bounds. |
| `LAYER_NOT_FOUND` | Element, floor, or patch references missing layer. | Add layer or fix reference. |
| `DUPLICATE_ELEMENT_ID` | Duplicate element ID. | Rename one element. |
| `DUPLICATE_CONNECTOR_ID` | Duplicate connector ID. | Rename one connector. |
| `DUPLICATE_SCENE_OBJECT_ID` | An element and connector share one id. | Use unique ids across scene objects. |
| `DUPLICATE_LAYER_NAME` | Duplicate layer name. | Rename or merge. |
| `DUPLICATE_SCENE_ID` | Duplicate scene id. | Rename one scene. |
| `NO_ASSETS` | Header has no assets. | Add at least one asset. |
| `INVALID_FLOOR_SIZE` | Floor size is malformed or not positive. | Fix `header.floor.size`. |
| `INVALID_FLOOR_ORIGIN` | Floor origin contains non-finite numbers. | Fix `header.floor.origin`. |
| `INVALID_GRID_CELL_SIZE` | Grid cellSize is not a positive finite number. | Fix `header.grid.cellSize`. |
| `NO_SCENES` | Document has no scenes. | Add at least one scene. |
| `NO_LAYERS` | Scene has no layers. | Add at least one layer. |
| `INVALID_INITIAL_SCENE` | First scene does not declare a full `elements` snapshot or contains delta fields. | Use `elements` only in first scene. |
| `INVALID_SCENE_DELTA` | Later scene uses full `elements` instead of delta operations. | Use `add`, `update`, or `remove`. |
| `ELEMENT_ALREADY_PRESENT` | `add` references an element id already present. | Use `update` or remove before re-adding. |
| `ELEMENT_NOT_PRESENT` | `update` or `remove` references an absent element. | Add it first or fix id. |
| `ELEMENT_DELTA_CONFLICT` | Same element appears in conflicting operations in one scene. | Keep one operation per element per scene. |
| `CONNECTOR_ALREADY_PRESENT` | `add.connections` references a connector id already present. | Use `update.connections` or remove before re-adding. |
| `CONNECTOR_NOT_PRESENT` | `update.connections` or `remove.connections` references an absent connector. | Add it first or fix id. |
| `CONNECTOR_DELTA_CONFLICT` | Same connector appears in conflicting operations in one scene. | Keep one operation per connector per scene. |
| `CONNECTOR_ENDPOINT_NOT_FOUND` | Connector endpoint references an element that is absent in the resolved scene. | Add the element first or fix the endpoint reference. |
| `CONNECTION_ENDPOINT_REMOVED` | A present connection references an element removed by the same scene and was not removed explicitly. | Add the connection id to `remove.connections` in the same scene, or remove/update the connection earlier. |
| `CONNECTOR_ROUTE_BLOCKED` | Auto routing cannot find an allowed path around required obstacles. | Move objects, reduce clearance, use `avoid: none`, or author a manual route. |
| `INVALID_POSITION` | Position tuple is malformed or negative. | Fix `at`. |
| `INVALID_SIZE` | Size is missing/invalid where required. | Use a positive whole-cell number for placements; update patches may use `0` to scale an existing element to zero. |
| `INVALID_CONNECTOR_ROUTE` | Connector route has fewer than two points, invalid coordinates, fractional manual coordinates, or manual segments that change both grid axes. | Provide at least two finite non-negative whole-grid route points with one-axis segments, or use `from`/`to` routing for side ports. |
| `INVALID_CONNECTOR_STYLE` | Connector style field is unsupported, unsafe, or out of range. | Use supported style values. |
| `INVALID_CONNECTOR_ENDPOINT` | Connector start/end endpoint is unsupported. | Use `none`, `arrow`, `dot`, `circle`, `diamond`, or `bar`. |
| `INVALID_CONNECTOR_DIRECTION` | Connector direction is unsupported. | Use `route` or `reverse`. |
| `INVALID_CONNECTOR_ROUTING` | Connector routing config is malformed or unsupported. | Fix `routing` fields or use manual `route`. |
| `TEXT_CONTENT_REQUIRED` | `asset: text` is missing `text.value`. | Add a `text` object with a `value` field. Use `value: ""` only when the invisible label is intentional. |
| `TEXT_CONTENT_FOR_NON_TEXT_ASSET` | A non-text asset defines `text`. | Remove `text` or change `asset` to `text`. |
| `INVALID_TEXT_CONTENT` | Text is too long or has too many lines. | Keep text ≤1000 characters and ≤20 lines. Empty text is a warning, not an error. |
| `INVALID_TEXT_STYLE` | A text style field has an invalid or unsafe value. | Use supported text style values. |
| `PRIMITIVE_CONTENT_REQUIRED` | A built-in primitive element (`rectangle`, `circle`, `polygon`, `line`) is missing its `primitive` payload. | Add the matching `primitive` payload. |
| `PRIMITIVE_CONTENT_MISMATCH` | A primitive payload does not match the element's built-in asset id, or more than one payload is present. | Keep exactly one payload matching the asset id. |
| `PRIMITIVE_CONTENT_FOR_TEXT_ASSET` | An `asset: text` element defines `primitive` content. | Remove `primitive` from text elements. |
| `INVALID_PRIMITIVE_POINTS` | Primitive `points` are malformed or outside the normalized `0..1` range. | Keep points normalized from `0` to `1`. |
| `INVALID_PRIMITIVE_STYLE` | A primitive style field has an invalid or unsafe value. | Use supported primitive style values. |
| `GENERATED_CONTENT_FOR_EXTERNAL_ASSET` | An external URL asset element defines generated `primitive` content. | Only built-in generated assets may define primitive content. |
| `UNKNOWN_ANIMATION` | Entry/exit animation is unknown. | Use a built-in value or `none`. |
| `UNKNOWN_AMBIENT_ANIMATION` | Ambient name is unknown and no custom CSS is registered. | Define CSS or fix name. |
| `INVALID_CAMERA_TARGET` | Scene camera target is missing, contains multiple target kinds, references a non-element id, uses invalid reset value, or has malformed shape. | Use exactly one valid `target.element`, `target.area`, or `target.reset: true`. |
| `CAMERA_TARGET_NOT_FOUND` | Scene camera element target cannot be resolved in the relevant scene snapshot. | Fix the element id or move the camera to a scene where the element exists. |
| `CAMERA_TARGET_NOT_VISIBLE` | Scene camera element target resolves to an element whose presence is `removed`. | Focus an element visible in that scene or use an explicit area target. |
| `INVALID_CAMERA_OPTIONS` | Camera padding, duration, easing, or area dimensions are invalid, or padding is used with reset. | Use supported easing, finite non-negative padding for element/area targets, finite positive area size, and a bounded duration. |

### Compiler and Runtime Bundle

| Code | Meaning | Action |
|---|---|---|
| `INVALID_RUNTIME_BUNDLE_MODULE` | JS bundle module text is malformed or non-canonical. | Recompile from source. |
| `INVALID_RUNTIME_BUNDLE_JSON` | JSON bundle text is malformed or non-canonical. | Recompile from source. |
| `BUNDLE_FORMAT_MISSING` | Runtime bundle lacks `_format`. | Recompile scene. |
| `BUNDLE_VERSION_MISMATCH` | Bundle major version incompatible with runtime. | Recompile or upgrade runtime. |
| `BUNDLE_DIGEST_MISSING` | Runtime bundle lacks `_digest`. | Recompile scene. |
| `BUNDLE_DIGEST_MISMATCH` | Bundle content changed after compile. | Recompile from source. |

### Runtime

| Code | Meaning | Action |
|---|---|---|
| `RENDER_TARGET_NOT_FOUND` | Engine target element does not exist. | Pass valid element/selector. |
| `INVALID_ASSET_URL` | Runtime asset URL uses an unsafe scheme. | Use a relative, `http:`, or `https:` URL. |
| `TEXT_CONTENT_MISSING` | Runtime text element has no text payload. | Recompile from valid YAML. |
| `INVALID_THEME_VAR` | CSS variable name is invalid. | Use `--name` syntax. |
| `CONTROLLER_NO_SCENES` | Controller initialized with empty scene list. | Pass at least one scene. |
| `CONTROLLER_SCENE_INDEX_OUT_OF_RANGE` | Scene index is invalid. | Use an existing index. |
| `CONTROLLER_PROGRESS_OUT_OF_RANGE` | Strict progress API received value outside `[0, 1]`. | Clamp before calling or use clamping API. |
| `INVALID_PROGRESS` | `AnimationEngine.setProgress()` received a non-finite value. | Pass a finite progress value between `0` and `1`. |
| `CONTROLLER_DESTROYED` | Controller API called after `destroy()`. | Create and initialize a new controller. |
| `CAMERA_NOT_INITIALIZED` | Controller camera API was called before init or without an SVG scene. | Initialize through `mountScene(..., { controller })` or pass `sceneElement` to `AnimationController.init()`. |
| `CAMERA_TARGET_NOT_FOUND` | Runtime `zoomToElement()` cannot resolve the id. | Pass an existing element id. |
| `CAMERA_TARGET_NOT_VISIBLE` | Runtime `zoomToElement()` targets a currently removed element. | Navigate to a scene where it is visible or zoom to an area. |
| `INVALID_CAMERA_OPTIONS` | Runtime camera area or options are invalid. | Fix area, padding, duration, or easing. |
| `MOUNT_DESTROYED` | `MountedScene.on()` or `attachDiagnosticsOverlay()` called after `destroy()`. | Use the API while the scene is mounted. |
| `EXPORT_TARGET_DESTROYED` | Snapshot export called on a destroyed mount. | Export before calling `destroy()`. |
| `EXPORT_INVALID_OPTIONS` | Export `progress` outside `[0, 1]`, non-positive `scale`, or `inlineAssets: false` on PNG export. | Fix the option value. |
| `EXPORT_ASSET_FETCH_FAILED` | An external asset could not be fetched for inlining. | Serve assets from a reachable URL or export SVG with `inlineAssets: false`. |
| `EXPORT_RASTERIZE_FAILED` | Canvas 2D context unavailable or PNG encoding failed. | Run in a browser with canvas support. |

### Converter

`isostate mermaid2dsl` structured errors (see
`02-capabilities/dsl/mermaid2dsl.md`):

| Code | Meaning | Action |
|---|---|---|
| `MERMAID_PARSE_ERROR` | Input line cannot be tokenized as a supported statement. | Fix the statement at `details.line`. |
| `MERMAID_UNSUPPORTED` | Statement uses Mermaid features outside the supported subset. | Remove or rewrite the statement at `details.line`. |
| `MERMAID_EMPTY` | Input declares no nodes. | Add at least one node. |
| `MERMAID_NODE_REDEFINED` | A node is redefined with a different shape or label. | Keep one bracketed definition per node. |
| `MERMAID_ID_COLLISION` | Two Mermaid ids normalize to the same DSL id. | Rename one node id. |
| `MERMAID_INTERNAL` | Generated document failed DSL validation (converter bug). | Report the issue with the input file. |

### CLI

Argument-parsing errors thrown by `isostate` commands (`packages/cli/src/commands.ts`,
`packages/cli/src/static-bundle.ts`, `packages/cli/src/assets-manifest.ts`; see
`03-contracts/cli.md`).

| Code | Meaning | Action |
|---|---|---|
| `MISSING_SUBCOMMAND` | `isostate assets` was called with no subcommand. | Run `isostate assets manifest ...`. |
| `UNKNOWN_SUBCOMMAND` | `isostate assets <subcommand>` is not a recognized subcommand. | Use `isostate assets manifest`. |
| `FILE_READ_FAILED` | The CLI could not read an input or metadata file. | Check the path exists and is readable. |
| `FILE_WRITE_FAILED` | The CLI could not write an output file. | Check the output directory exists and is writable. |
| `MISSING_INPUT` | A command's required positional input argument is missing. | Pass the required input file or directory. |
| `EXTRA_INPUT` | More than one positional input argument was given. | Pass exactly one input. |
| `MISSING_OPTION` | An option flag is present without its required value. | Supply a value after the flag. |
| `UNKNOWN_OPTION` | An unrecognized `-`-prefixed option was passed. | Remove the option or fix the typo. |
| `UNSUPPORTED_FORMAT` | `compile --format` (or the format inferred from `--out`) is not `js` or `json`. | Use `--format js`, `--format json`, or an `--out` path ending in `.js`/`.json`. |

### Asset Manifest

`isostate assets manifest` generator errors (`packages/cli/src/assets-manifest.ts`;
see `03-contracts/asset-manifest.md`).

| Code | Meaning | Action |
|---|---|---|
| `ASSET_MANIFEST_PATH_COLLISION` | Two asset paths differ only by case. | Rename one file so the paths differ beyond case. |
| `ASSET_MANIFEST_OVERSIZED` | An SVG exceeds 512KB, or a raster sprite sheet exceeds 2MB. | Reduce the file size or split the asset. |
| `ASSET_MANIFEST_RESERVED_ID` | A derived asset id matches a reserved built-in id (`text`, `rectangle`, `circle`, `polygon`, `line`). | Rename the file so it derives a non-reserved id. |
| `ASSET_MANIFEST_ID_COLLISION` | Two assets, or a sprite and another manifest id, derive or declare the same id. | Rename one of the colliding files or sprites. |
| `ASSET_MANIFEST_UNSAFE_SVG` | An SVG file contains `<script>` or event-handler attributes. | Remove scripts and event handlers from the SVG. |
| `ASSET_MANIFEST_EXTERNAL_REFERENCE` | An SVG file references external `href`/`xlink:href`/`url()` content. | Inline or remove the external reference. |
| `ASSET_MANIFEST_INVALID_FILENAME` | A relative path normalizes to an empty segment or an id that is not a valid DSL identifier. | Rename the file to a valid kebab-case-safe name. |
| `ASSET_MANIFEST_METADATA_ORPHAN` | The metadata file declares a path with no matching asset file. | Remove the stale metadata entry or add the missing asset file. |

## Warning Codes

Warnings do not block compilation. The current CLI reports warnings and exits
successfully when no errors are present.

| Code | Meaning |
|---|---|
| `UNREFERENCED_LAYER` | Layer has no elements. |
| `UNREFERENCED_ASSET` | Asset is declared but never used. |
| `EMPTY_TEXT_CONTENT` | Text value is empty or whitespace-only and will render no visible label. |
| `ELEMENT_OUTSIDE_FLOOR` | Element lies outside floor bounds while floor-bounded layout is requested. |
| `CONNECTOR_OUTSIDE_FLOOR` | Connector route lies outside floor bounds while floor-bounded layout is requested. |
| `CONNECTOR_INTERSECTS_OBJECT` | Manual connector route crosses an unrelated visible object. |
| `MERMAID_LABEL_DROPPED` | A Mermaid edge label was dropped; the DSL has no connection labels. |
| `MERMAID_CYCLE_BROKEN` | A cycle-closing edge was ignored for layout layering. |
| `CONNECTOR_ROUTE_DETOUR` | Auto route is valid but much longer than the direct route. |

## Documentation Completeness

Every error and warning code in this contract must have a row in
`docs/reference/errors.md`. `tests/nfr/error-docs.test.ts` parses both files
and fails when a code listed here is missing from the docs table.
