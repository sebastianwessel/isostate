# Errors

Public APIs throw structured error classes exported from `@sebastianwessel/isostate`.

| Class | Where | Examples |
|---|---|---|
| `ParseError` | `parseScene()` | malformed YAML, unknown authored fields |
| `ValidationErrorClass` | `validateScene()`, `compileScene()` | missing assets, invalid deltas |
| `RenderError` | `mountScene()`, `buildSceneDOM()` | bad bundle, missing assets, unsafe SVG |
| `AnimationError` | `AnimationEngine` | invalid progress or uninitialized engine |
| `ControllerError` | `AnimationController` | missing scenes, invalid navigation |

Every structured error has a `code` and `message`; validation findings also
include contextual fields when available, such as `sceneId`, `elementId`,
`connectionId`, `assetName`, `layerName`, `field`, and `value`. The CLI prints
those fields before the message:

```text
ERROR INVALID_TEXT_STYLE scene=initial element=title field=text.fontSize value=0 Text fontSize must be greater than zero
```

```ts
try {
	mountScene(target, sceneBundle);
} catch (error) {
	if (error instanceof RenderError) {
		console.error(error.code, error.message);
	}
}
```

Common fixes:

| Code | Fix |
|---|---|
| `BUNDLE_FORMAT_MISSING` | Load a compiled `.isostate.js` or `.isostate.json` bundle. |
| `BUNDLE_DIGEST_MISSING` | Recompile the YAML source with the current compiler. |
| `BUNDLE_DIGEST_MISMATCH` | Recompile the YAML source and use the generated bundle without manual edits. |
| `ASSET_NOT_DECLARED` | Add the asset id to `header.assets`. |
| `ASSET_URL_REQUIRED` | Add `header.assetBaseUrl` or an asset `path` so the compiler can emit a URL. |
| `ASSET_TYPE_UNSUPPORTED` | Use omitted type for normal SVG assets or `type: sprite-sheet`. |
| `SPRITE_SHEET_NOT_PLACEABLE` | Reference a nested sprite id instead of the sheet namespace id. |
| `INVALID_SPRITE_SHEET_PATH` | Use an explicit `.png`, `.webp`, `.jpg`, `.jpeg`, or `.svg` sheet path. |
| `INVALID_SPRITE_SHEET_SIZE` | Add a positive whole-pixel `sheetSize`. |
| `INVALID_SPRITE_TILE_SIZE` | Add a positive whole-pixel `tileSize` or use only `rect` sprites. |
| `NO_SPRITES` | Add at least one sprite to the sheet. |
| `INVALID_SPRITE_ID` | Rename the sprite to kebab-case and avoid built-in ids. |
| `DUPLICATE_SPRITE_ID` | Rename duplicate sprites. |
| `SPRITE_ASSET_ID_COLLISION` | Rename the colliding sprite or asset id. |
| `INVALID_SPRITE_DEFINITION` | Use exactly one tuple, `at`, or `rect` sprite definition. |
| `INVALID_SPRITE_RECT` | Keep the sprite rectangle in whole pixels within `sheetSize`. |
| `ASSET_NOT_FOUND` | Recompile the bundle so every external asset has a URL entry. |
| `INVALID_ASSET_URL` | Use a non-empty relative or HTTP(S) asset URL, not `javascript:`. |
| `TEXT_CONTENT_REQUIRED` | Add a `text.value` field to an `asset: text` element. |
| `TEXT_CONTENT_FOR_NON_TEXT_ASSET` | Remove `text` from non-text assets. |
| `INVALID_TEXT_CONTENT` | Keep text ≤1000 characters and ≤20 lines. Empty text is allowed but emits `EMPTY_TEXT_CONTENT`. |
| `INVALID_TEXT_STYLE` | Use supported text style values and safe fill colors. |
| `PRIMITIVE_CONTENT_REQUIRED` | Add the matching `primitive` payload to built-in primitive assets. |
| `PRIMITIVE_CONTENT_MISMATCH` | Keep exactly one primitive payload and match it to the asset id. |
| `INVALID_PRIMITIVE_POINTS` | Keep primitive points normalized from `0` to `1`. |
| `INVALID_PRIMITIVE_STYLE` | Use supported primitive style values and safe color tokens. |
| `GENERATED_CONTENT_FOR_EXTERNAL_ASSET` | Remove primitive payloads from external URL assets and sprites. |
| `INVALID_CONNECTOR_ROUTE` | Provide at least two finite non-negative connector route points and keep manual segments on one grid axis. |
| `INVALID_CONNECTOR_STYLE` | Use supported connector style values for pattern, variant, stroke, dash, road, and opacity fields. |
| `INVALID_CONNECTOR_ENDPOINT` | Use `none`, `arrow`, `dot`, `circle`, `diamond`, or `bar`. |
| `INVALID_CONNECTOR_DIRECTION` | Use `route` or `reverse`. |
| `INVALID_CONNECTOR_ROUTING` | Fix endpoint routing fields or use a manual `route`. |
| `CONNECTOR_ENDPOINT_NOT_FOUND` | Add the endpoint element before the connector or fix the id. |
| `CONNECTOR_ROUTE_BLOCKED` | Move objects, reduce clearance, use `avoid: none`, or author a manual route. |
| `CONNECTOR_NOT_PRESENT` | Add the connector before updating or removing it. |
| `CONNECTOR_ALREADY_PRESENT` | Update the connector instead of adding it again. |
| `INVALID_CAMERA_TARGET` | Use exactly one camera target: an existing element, a valid grid area, or `reset: true`. |
| `CAMERA_TARGET_NOT_FOUND` | Fix the element id or move the camera focus to a scene where the element exists. |
| `CAMERA_TARGET_NOT_VISIBLE` | Focus an element visible in the active frame or use `zoomToArea()`. |
| `INVALID_CAMERA_OPTIONS` | Use supported easing, finite non-negative padding for element/area targets, finite positive area size, and a bounded duration. Omit padding for reset. |
| `CAMERA_NOT_INITIALIZED` | Initialize a controller with a scene SVG before calling camera methods. |
| `TEXT_CONTENT_MISSING` | Recompile the bundle from validated YAML. |
