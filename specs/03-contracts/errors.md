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

Validation reports use the same `code` strings but return plain objects instead of throwing.

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
| `BUILTIN_ASSET_ID_RESERVED` | `header.assets` declares a reserved built-in asset id such as `text`. | Remove the declaration and use the built-in element contract. |
| `DUPLICATE_ASSET_ID` | Duplicate asset id in `header.assets`. | Rename or remove duplicate. |
| `LAYER_NOT_FOUND` | Element, floor, or patch references missing layer. | Add layer or fix reference. |
| `DUPLICATE_ELEMENT_ID` | Duplicate element ID. | Rename one element. |
| `DUPLICATE_CONNECTOR_ID` | Duplicate connector ID. | Rename one connector. |
| `DUPLICATE_SCENE_OBJECT_ID` | An element and connector share one id. | Use unique ids across scene objects. |
| `DUPLICATE_LAYER_NAME` | Duplicate layer name. | Rename or merge. |
| `DUPLICATE_SCENE_ID` | Duplicate scene id. | Rename one scene. |
| `NO_ASSETS` | Header has no assets. | Add at least one asset. |
| `INVALID_FLOOR_SIZE` | Floor size is malformed or not positive. | Fix `header.floor.size`. |
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
| `INVALID_SIZE` | Size is missing/invalid where required. | Use a positive number. |
| `INVALID_CONNECTOR_ROUTE` | Connector route has fewer than two points, invalid coordinates, fractional manual coordinates, or manual segments that change both grid axes. | Provide at least two finite non-negative whole-grid route points with one-axis segments, or use `from`/`to` routing for side ports. |
| `INVALID_CONNECTOR_STYLE` | Connector style field is unsupported, unsafe, or out of range. | Use supported style values. |
| `INVALID_CONNECTOR_ENDPOINT` | Connector start/end endpoint is unsupported. | Use `none`, `arrow`, `dot`, `circle`, `diamond`, or `bar`. |
| `INVALID_CONNECTOR_DIRECTION` | Connector direction is unsupported. | Use `route` or `reverse`. |
| `INVALID_CONNECTOR_ROUTING` | Connector routing config is malformed or unsupported. | Fix `routing` fields or use manual `route`. |
| `TEXT_CONTENT_REQUIRED` | `asset: text` is missing `text.value`. | Add a `text` object with a non-empty `value`. |
| `TEXT_CONTENT_FOR_NON_TEXT_ASSET` | A non-text asset defines `text`. | Remove `text` or change `asset` to `text`. |
| `INVALID_TEXT_CONTENT` | Text is empty, too long, or has too many lines. | Keep text non-empty, ≤1000 characters, and ≤20 lines. |
| `INVALID_TEXT_STYLE` | A text style field has an invalid or unsafe value. | Use supported text style values. |
| `UNKNOWN_ANIMATION` | Entry/exit animation is unknown. | Use a built-in value or `none`. |
| `UNKNOWN_AMBIENT_ANIMATION` | Ambient name is unknown and no custom CSS is registered. | Define CSS or fix name. |

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

## Warning Codes

Warnings do not block compilation. The current CLI reports warnings and exits
successfully when no errors are present.

| Code | Meaning |
|---|---|
| `UNREFERENCED_LAYER` | Layer has no elements. |
| `UNREFERENCED_ASSET` | Asset is declared but never used. |
| `ELEMENT_OUTSIDE_FLOOR` | Element lies outside floor bounds while floor-bounded layout is requested. |
| `CONNECTOR_OUTSIDE_FLOOR` | Connector route lies outside floor bounds while floor-bounded layout is requested. |
| `CONNECTOR_INTERSECTS_OBJECT` | Manual connector route crosses an unrelated visible object. |
| `CONNECTOR_ROUTE_DETOUR` | Auto route is valid but much longer than the direct route. |
