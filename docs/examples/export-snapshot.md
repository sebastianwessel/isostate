# Export Snapshot

Export a mounted scene as a self-contained SVG string or a rasterized PNG
blob at a chosen progress value. Both functions are browser-only escape
hatches for static snapshots — thumbnails, share cards, print views, or
downloadable images — and are not part of the standalone runtime bundle.

```ts
import {
	exportScenePng,
	exportSceneSvg,
	mountScene
} from '@sebastianwessel/isostate';
import sceneBundle from './scene.isostate.js';

const target = document.querySelector<HTMLElement>('#scene');
if (!target) throw new Error('Missing #scene mount target');

const mounted = mountScene(target, sceneBundle, {
	label: 'Deployment pipeline overview',
	controller: false
});
```

## SVG Snapshot

`exportSceneSvg` resolves with a standalone SVG document string. It renders
the requested `progress`, inlines external asset `<image>` hrefs as `data:`
URIs by default, and restores the scene's prior progress before resolving.

```ts
const svgString = await exportSceneSvg(mounted, {
	progress: 1,
	background: '#ffffff'
});

const blob = new Blob([svgString], { type: 'image/svg+xml' });
const url = URL.createObjectURL(blob);

const link = document.createElement('a');
link.href = url;
link.download = 'scene-final.svg';
link.click();
URL.revokeObjectURL(url);
```

Pass `inlineAssets: false` to keep external asset URLs verbatim in the
exported markup instead of fetching and inlining them:

```ts
const svgWithExternalRefs = await exportSceneSvg(mounted, {
	inlineAssets: false
});
```

## PNG Snapshot

`exportScenePng` rasterizes the same clone to a PNG `Blob` at a device-pixel
`scale` (default `2`). PNG export always inlines assets — external hrefs
would taint or fail canvas rasterization — so `inlineAssets: false` is
rejected with `EXPORT_INVALID_OPTIONS` for this function.

```ts
const pngBlob = await exportScenePng(mounted, {
	progress: 0.5,
	scale: 3
});

const pngUrl = URL.createObjectURL(pngBlob);
const preview = document.querySelector<HTMLImageElement>('#preview');
if (preview) preview.src = pngUrl;
```

## Error Handling

Both functions reject with a `RenderError` carrying one of the export error
codes when the mount was destroyed, options are invalid, an asset fetch
fails, or rasterization fails:

```ts
import { RenderError } from '@sebastianwessel/isostate';

try {
	await exportScenePng(mounted, { progress: 2 });
} catch (error) {
	if (error instanceof RenderError) {
		console.error(error.code, error.message);
	}
}
```

See [Errors](../reference/errors.md) for the full `EXPORT_TARGET_DESTROYED`,
`EXPORT_INVALID_OPTIONS`, `EXPORT_ASSET_FETCH_FAILED`, and
`EXPORT_RASTERIZE_FAILED` reference, and
[Public API](../reference/public-api.md#snapshot-export) for the complete
option field tables.
