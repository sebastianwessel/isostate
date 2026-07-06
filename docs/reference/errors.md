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

Common fixes, grouped by the owner that raises each code (matching
`specs/03-contracts/errors.md`):

### Parser

| Code | Fix |
|---|---|
| `DSL_PARSE_SYNTAX_ERROR` | Fix the YAML syntax at the reported location. |
| `DSL_SCHEMA_TYPE_ERROR` | Fix the field so it matches the expected primitive/container type. |
| `UNKNOWN_FIELD` | Remove or rename the unsupported field. |
| `INVALID_IDENTIFIER` | Rename the identifier to kebab-case. |

### Validator

| Code | Fix |
|---|---|
| `ASSET_URL_REQUIRED` | Add `header.assetBaseUrl` or an asset `path` so the compiler can emit a URL. |
| `ASSET_NOT_FOUND` | Recompile the bundle so every external asset has a URL entry. |
| `ASSET_NOT_DECLARED` | Add the asset id to `header.assets`. |
| `ASSET_TYPE_UNSUPPORTED` | Use omitted type for normal SVG assets or `type: sprite-sheet`. |
| `BUILTIN_ASSET_ID_RESERVED` | Remove the reserved asset declaration and use the built-in element contract instead. |
| `DUPLICATE_ASSET_ID` | Rename or remove the duplicate asset id in `header.assets`. |
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
| `LAYER_NOT_FOUND` | Add the missing layer or fix the reference. |
| `DUPLICATE_ELEMENT_ID` | Rename one of the duplicate elements. |
| `DUPLICATE_CONNECTOR_ID` | Rename one of the duplicate connectors. |
| `DUPLICATE_SCENE_OBJECT_ID` | Use unique ids across elements and connectors. |
| `DUPLICATE_LAYER_NAME` | Rename or merge the duplicate layers. |
| `DUPLICATE_SCENE_ID` | Rename one of the duplicate scenes. |
| `NO_ASSETS` | Add at least one asset to `header.assets`. |
| `INVALID_FLOOR_SIZE` | Fix `header.floor.size` to a positive value. |
| `INVALID_FLOOR_ORIGIN` | Use finite numbers in `header.floor.origin`. |
| `INVALID_GRID_CELL_SIZE` | Use a positive finite number for `header.grid.cellSize`. |
| `NO_SCENES` | Add at least one scene to the document. |
| `NO_LAYERS` | Add at least one layer to the scene. |
| `INVALID_INITIAL_SCENE` | Use a full `elements` snapshot only in the first scene, with no delta fields. |
| `INVALID_SCENE_DELTA` | Use `add`, `update`, or `remove` delta operations in later scenes instead of a full `elements` list. |
| `ELEMENT_ALREADY_PRESENT` | Use `update` or remove the element before re-adding it. |
| `ELEMENT_NOT_PRESENT` | Add the element first or fix the id it references. |
| `ELEMENT_DELTA_CONFLICT` | Keep one operation per element per scene. |
| `CONNECTOR_ALREADY_PRESENT` | Use `update.connections` or remove the connector before re-adding it. |
| `CONNECTOR_NOT_PRESENT` | Add the connector before updating or removing it. |
| `CONNECTOR_DELTA_CONFLICT` | Keep one operation per connector per scene. |
| `CONNECTOR_ENDPOINT_NOT_FOUND` | Add the endpoint element before the connector or fix the id. |
| `CONNECTION_ENDPOINT_REMOVED` | Add the connection id to `remove.connections` in the same scene, or remove/update the connection earlier. |
| `CONNECTOR_ROUTE_BLOCKED` | Move objects, reduce clearance, use `avoid: none`, or author a manual route. |
| `INVALID_POSITION` | Fix `at` to a valid, non-negative position tuple. |
| `INVALID_SIZE` | Use a positive whole-cell number for placements; update patches may use `0` to scale an existing element to zero. |
| `INVALID_CONNECTOR_ROUTE` | Provide at least two finite non-negative connector route points and keep manual segments on one grid axis. |
| `INVALID_CONNECTOR_STYLE` | Use supported connector style values for pattern, variant, stroke, dash, road, and opacity fields. |
| `INVALID_CONNECTOR_ENDPOINT` | Use `none`, `arrow`, `dot`, `circle`, `diamond`, or `bar`. |
| `INVALID_CONNECTOR_DIRECTION` | Use `route` or `reverse`. |
| `INVALID_CONNECTOR_ROUTING` | Fix endpoint routing fields or use a manual `route`. |
| `TEXT_CONTENT_REQUIRED` | Add a `text.value` field to an `asset: text` element. |
| `TEXT_CONTENT_FOR_NON_TEXT_ASSET` | Remove `text` from non-text assets. |
| `INVALID_TEXT_CONTENT` | Keep text ≤1000 characters and ≤20 lines. Empty text is allowed but emits `EMPTY_TEXT_CONTENT`. |
| `INVALID_TEXT_STYLE` | Use supported text style values and safe fill colors. |
| `PRIMITIVE_CONTENT_REQUIRED` | Add the matching `primitive` payload to built-in primitive assets. |
| `PRIMITIVE_CONTENT_MISMATCH` | Keep exactly one primitive payload and match it to the asset id. |
| `PRIMITIVE_CONTENT_FOR_TEXT_ASSET` | Remove `primitive` from text elements. |
| `INVALID_PRIMITIVE_POINTS` | Keep primitive points normalized from `0` to `1`. |
| `INVALID_PRIMITIVE_STYLE` | Use supported primitive style values and safe color tokens. |
| `GENERATED_CONTENT_FOR_EXTERNAL_ASSET` | Remove primitive payloads from external URL assets and sprites. |
| `UNKNOWN_ANIMATION` | Use a built-in entry/exit animation value or `none`. |
| `UNKNOWN_AMBIENT_ANIMATION` | Define the custom ambient CSS or fix the animation name. |
| `INVALID_CAMERA_TARGET` | Use exactly one camera target: an existing element, a valid grid area, or `reset: true`. |
| `CAMERA_TARGET_NOT_FOUND` | Fix the element id or move the camera focus to a scene where the element exists. |
| `CAMERA_TARGET_NOT_VISIBLE` | Focus an element visible in the active frame or use `zoomToArea()`. |
| `INVALID_CAMERA_OPTIONS` | Use supported easing, finite non-negative padding for element/area targets, finite positive area size, and a bounded duration. Omit padding for reset. |

### Compiler and Runtime Bundle

| Code | Fix |
|---|---|
| `INVALID_RUNTIME_BUNDLE_MODULE` | Recompile the JS bundle from source rather than hand-editing it. |
| `INVALID_RUNTIME_BUNDLE_JSON` | Recompile the JSON bundle from source rather than hand-editing it. |
| `BUNDLE_FORMAT_MISSING` | Load a compiled `.isostate.js` or `.isostate.json` bundle. |
| `BUNDLE_VERSION_MISMATCH` | Recompile the bundle or upgrade the runtime to a compatible major version. |
| `BUNDLE_DIGEST_MISSING` | Recompile the YAML source with the current compiler. |
| `BUNDLE_DIGEST_MISMATCH` | Recompile the YAML source and use the generated bundle without manual edits. |

### Runtime

| Code | Fix |
|---|---|
| `RENDER_TARGET_NOT_FOUND` | Pass a valid element or selector as the render target. |
| `INVALID_ASSET_URL` | Use a non-empty relative or HTTP(S) asset URL, not `javascript:`. |
| `TEXT_CONTENT_MISSING` | Recompile the bundle from validated YAML. |
| `INVALID_THEME_VAR` | Use `--name` syntax for the CSS variable. |
| `CONTROLLER_NO_SCENES` | Pass at least one scene when initializing the controller. |
| `CONTROLLER_SCENE_INDEX_OUT_OF_RANGE` | Use an existing scene index. |
| `CONTROLLER_PROGRESS_OUT_OF_RANGE` | Clamp the value before calling the strict API, or use the clamping API. |
| `INVALID_PROGRESS` | Pass a finite progress value to `AnimationEngine.setProgress()`. |
| `CONTROLLER_DESTROYED` | Create and initialize a new controller; the API is unusable after `destroy()`. |
| `CAMERA_NOT_INITIALIZED` | Initialize a controller with a scene SVG before calling camera methods. |
| `MOUNT_DESTROYED` | Use `MountedScene.on()` or `attachDiagnosticsOverlay()` only while the scene is mounted, not after `destroy()`. |
| `EXPORT_TARGET_DESTROYED` | Export before calling `destroy()` on the mounted scene. |
| `EXPORT_INVALID_OPTIONS` | Fix the export option value: `progress` in `[0, 1]`, a positive `scale`, and `inlineAssets: true` for PNG export. |
| `EXPORT_ASSET_FETCH_FAILED` | Serve assets from a reachable URL or export SVG with `inlineAssets: false`. |
| `EXPORT_RASTERIZE_FAILED` | Run the export in a browser with canvas support. |

### Converter

`isostate mermaid2dsl` structured errors (see
`02-capabilities/dsl/mermaid2dsl.md`):

| Code | Fix |
|---|---|
| `MERMAID_PARSE_ERROR` | Fix the statement at `details.line`. |
| `MERMAID_UNSUPPORTED` | Remove or rewrite the statement at `details.line` to stay within the supported subset. |
| `MERMAID_EMPTY` | Add at least one node to the Mermaid input. |
| `MERMAID_NODE_REDEFINED` | Keep one bracketed definition per node. |
| `MERMAID_ID_COLLISION` | Rename one of the colliding Mermaid node ids. |
| `MERMAID_INTERNAL` | Report the issue with the input file; this indicates a converter bug. |

### Warnings

| Code | Fix |
|---|---|
| `UNREFERENCED_LAYER` | Add elements to the layer or remove the unused layer. |
| `UNREFERENCED_ASSET` | Reference the declared asset or remove it from `header.assets`. |
| `EMPTY_TEXT_CONTENT` | Set a non-empty `text.value`, or keep it empty if the invisible label is intentional. |
| `ELEMENT_OUTSIDE_FLOOR` | Move the element inside the floor bounds or adjust the floor size. |
| `CONNECTOR_OUTSIDE_FLOOR` | Adjust the connector route or the floor size so the route stays inside floor bounds. |
| `CONNECTOR_INTERSECTS_OBJECT` | Reroute the manual connector to avoid crossing the unrelated object. |
| `MERMAID_LABEL_DROPPED` | Remove the edge label or accept that DSL connections carry no label. |
| `MERMAID_CYCLE_BROKEN` | Remove or restructure the cycle-closing edge if explicit layering is required. |
| `CONNECTOR_ROUTE_DETOUR` | Shorten the route with a manual `route`, or accept the longer auto-routed path. |

### CLI (General)

This code comes from the CLI's own Help contract (`specs/03-contracts/cli.md`,
"## Help") and is not part of `specs/03-contracts/errors.md`.

| Code | Fix |
|---|---|
| `CLI_UNKNOWN_COMMAND` | Run `isostate --help` to see the supported commands and use one of them. |

### Asset Manifest (CLI)

These codes come from the asset manifest generator's contract
(`specs/03-contracts/asset-manifest.md`, `specs/03-contracts/cli.md`) and are
not part of `specs/03-contracts/errors.md`.

| Code | Fix |
|---|---|
| `ASSET_MANIFEST_METADATA_NOT_FOUND` | Point `--metadata` at an existing file or remove the flag. |
| `ASSET_MANIFEST_INVALID_METADATA` | Fix metadata fields; `sheetSize` must match the actual image dimensions. |
