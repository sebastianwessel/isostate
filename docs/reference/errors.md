# Errors

Public APIs throw structured error classes exported from `@isostate/core`.

| Class | Where | Examples |
|---|---|---|
| `ParseError` | `parseScene()` | malformed YAML, unknown authored fields |
| `ValidationErrorClass` | `validateScene()`, `compileScene()` | missing assets, invalid deltas |
| `RenderError` | `mountScene()`, `buildSceneDOM()` | bad bundle, missing assets, unsafe SVG |
| `AnimationError` | `AnimationEngine` | invalid progress or uninitialized engine |
| `ControllerError` | `AnimationController` | missing scenes, invalid navigation |

Every structured error has a `code` and `message`; many include contextual
fields such as `elementId`, `sceneId`, `assetName`, or `layerName`.

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
| `ASSET_NOT_FOUND` | Recompile the bundle so every external asset has a URL entry. |
| `INVALID_ASSET_URL` | Use a non-empty relative or HTTP(S) asset URL, not `javascript:`. |
| `TEXT_CONTENT_REQUIRED` | Add a non-empty `text.value` to an `asset: text` element. |
| `TEXT_CONTENT_FOR_NON_TEXT_ASSET` | Remove `text` from non-text assets. |
| `INVALID_TEXT_CONTENT` | Keep text non-empty, ≤1000 characters, and ≤20 lines. |
| `INVALID_TEXT_STYLE` | Use supported text style values and safe fill colors. |
| `INVALID_CONNECTOR_ROUTE` | Provide at least two finite non-negative connector route points and keep manual segments on one grid axis. |
| `INVALID_CONNECTOR_STYLE` | Use supported connector style values for pattern, variant, stroke, dash, road, and opacity fields. |
| `INVALID_CONNECTOR_ENDPOINT` | Use `none`, `arrow`, `dot`, `circle`, `diamond`, or `bar`. |
| `INVALID_CONNECTOR_DIRECTION` | Use `route` or `reverse`. |
| `INVALID_CONNECTOR_ROUTING` | Fix endpoint routing fields or use a manual `route`. |
| `CONNECTOR_ENDPOINT_NOT_FOUND` | Add the endpoint element before the connector or fix the id. |
| `CONNECTOR_ROUTE_BLOCKED` | Move objects, reduce clearance, use `avoid: none`, or author a manual route. |
| `CONNECTOR_NOT_PRESENT` | Add the connector before updating or removing it. |
| `CONNECTOR_ALREADY_PRESENT` | Update the connector instead of adding it again. |
| `TEXT_CONTENT_MISSING` | Recompile the bundle from validated YAML. |
