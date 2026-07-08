# Capability: Snapshot Export

Status: implemented (wave 06)

Delivers vision capability C6 (static snapshot export). Exports a mounted
scene as a self-contained SVG string or a rasterized PNG blob at a chosen
progress value.

## Placement

- Implementation module: `packages/core/src/runtime/export.ts`.
- Exported from the root entry `packages/core/src/index.ts` only.
- MUST NOT be imported (directly or transitively) by
  `packages/core/src/browser-runtime.ts`; the standalone runtime and the
  20KB size budget are unaffected by this capability.
- Zero new dependencies. Browser-only APIs (`XMLSerializer`, `Image`,
  `canvas`, `fetch`, `btoa`) are used at call time, never at module top level.

## Public API

```ts
interface SnapshotOptions {
  /** Progress to render before serializing. Omitted = current progress. */
  progress?: number;
  /** Inline external <image> hrefs as data: URIs. Default: true. */
  inlineAssets?: boolean;
  /** Solid background color (any CSS color). Default: none (transparent). */
  background?: string;
}

interface PngSnapshotOptions extends SnapshotOptions {
  /** Device-pixel multiplier applied to the viewBox size. Default: 2. */
  scale?: number;
}

/** Serialize the mounted scene to a standalone SVG document string. */
function exportSceneSvg(mounted: MountedScene, options?: SnapshotOptions): Promise<string>;

/** Rasterize the mounted scene to a PNG blob. */
function exportScenePng(mounted: MountedScene, options?: PngSnapshotOptions): Promise<Blob>;
```

Both functions and both option types are public API and get JSDoc, docs
reference entries, and inventory rows in `03-contracts/public-api.md`.

## Behavior (normative)

Order of operations for both functions:

1. If the mounted scene was destroyed (`svg` no longer connected to a
   document), throw `RenderError("EXPORT_TARGET_DESTROYED")`.
2. Validate `progress`: when provided it must be finite and within `[0, 1]`,
   otherwise throw `RenderError("EXPORT_INVALID_OPTIONS")`. Validate `scale`:
   when provided it must be finite and `> 0`, otherwise the same error.
3. When `progress` is provided: record the engine's current progress, call
   `engine.setProgress(progress)` (and the controller's frame-apply path when
   a controller exists, so DOM state matches), serialize, then restore the
   recorded progress before resolving or rejecting. Restoration is mandatory
   on all code paths (use `finally`).
4. Deep-clone `mounted.svg` via `cloneNode(true)`. All subsequent mutations
   happen on the clone; the live scene is never mutated beyond step 3.
5. On the clone:
   - set explicit `width`/`height` attributes from the viewBox size
     (`viewBox.width`, `viewBox.height`, CSS pixels);
   - set the `xmlns` and `xmlns:xlink` attributes;
   - when `background` is set, insert a `<rect>` as first child covering the
     viewBox with `fill` equal to `background`;
   - remove the diagnostics overlay group (`[data-iso-diagnostics]`) if
     present.
6. When `inlineAssets` is `true` (default): for every `<image>` element in
   the clone, fetch its `href`, convert to a data URI
   (`data:<content-type>;base64,...`), and replace the `href`. Fetches run
   concurrently. Any fetch that fails (network error or non-2xx) rejects the
   export with `RenderError("EXPORT_ASSET_FETCH_FAILED")` carrying the
   failing URL in `details.url`. When `inlineAssets` is `false`, hrefs are
   left verbatim.
7. `exportSceneSvg` resolves with
   `<?xml version="1.0" encoding="UTF-8"?>\n` + `XMLSerializer` output of the
   clone.
8. `exportScenePng` additionally: builds an `Image` from the SVG string via a
   `Blob` URL, draws it onto a `<canvas>` of size
   `ceil(viewBox.width * scale)` x `ceil(viewBox.height * scale)`, and
   resolves with the `canvas.toBlob("image/png")` result. If canvas 2D
   context creation fails or `toBlob` yields `null`, reject with
   `RenderError("EXPORT_RASTERIZE_FAILED")`. PNG export always inlines
   assets regardless of `inlineAssets` (external hrefs taint or fail canvas
   rasterization); passing `inlineAssets: false` to `exportScenePng` throws
   `RenderError("EXPORT_INVALID_OPTIONS")`.

Ambient/entry CSS animations are irrelevant to the output: the exported SVG
carries the runtime stylesheet `<style>` node as-is (already part of the
cloned tree), and PNG rasterization captures the un-animated base state.

## Error Codes

| Code | Meaning | Action |
|---|---|---|
| `EXPORT_TARGET_DESTROYED` | Export called on an unmounted/destroyed scene. | Export before calling `destroy()`. |
| `EXPORT_INVALID_OPTIONS` | `progress` outside `[0,1]`, non-positive `scale`, or `inlineAssets: false` on PNG export. | Fix the option value. |
| `EXPORT_ASSET_FETCH_FAILED` | An external asset could not be fetched for inlining. | Serve assets from a reachable URL or export with `inlineAssets: false` (SVG only). |
| `EXPORT_RASTERIZE_FAILED` | Canvas 2D context unavailable or PNG encoding failed. | Run in a browser with canvas support. |

All four are `RenderError` codes and are added to `03-contracts/errors.md`
(Runtime section) and `docs/reference/errors.md`.

## Testing (required)

`tests/runtime/export.test.ts`, using the mount-scene DOM shim pattern:

- SVG export at explicit progress renders that progress and restores the
  prior progress afterwards (assert engine progress unchanged).
- SVG export contains `xmlns`, explicit width/height, and the background
  rect when `background` is set; no background rect otherwise.
- `inlineAssets: true` replaces `<image>` hrefs with data URIs (stub
  `fetch`); a failing fetch rejects with `EXPORT_ASSET_FETCH_FAILED`.
- `inlineAssets: false` keeps hrefs verbatim.
- destroyed mount rejects with `EXPORT_TARGET_DESTROYED`; `progress: 2`
  rejects with `EXPORT_INVALID_OPTIONS`.
- PNG path: rejects with `EXPORT_INVALID_OPTIONS` for `inlineAssets: false`;
  rasterization steps are exercised behind injectable seams so the DOM shim
  can simulate canvas success and `toBlob` returning `null`
  (`EXPORT_RASTERIZE_FAILED`).

## Documentation (required)

- `docs/reference/public-api.md`: new "Snapshot Export" section documenting
  both functions and option fields with one usage example each.
- `docs/examples/export-snapshot.md`: complete example page exporting SVG
  and PNG from the basic example bundle.
- `docs/README.md` and root `README.md` doc trees gain the example link.

## Out of Scope (v1)

- Node/server-side export.
- Animated output (GIF/video/APNG).
- Font embedding/subsetting; text relies on viewer-available fonts.
- JPEG/WebP output formats.
