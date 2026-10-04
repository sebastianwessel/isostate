import type {
	AssetManifestEntry,
	SpriteManifestDefinition
} from '../../../packages/editor/src/types.ts';

/** Placeable catalog preview with a source image and optional sprite crop. */
export interface SoftwareCatalogPreview {
	id: string;
	label: string;
	path: string;
	group: string;
	rect?: [number, number, number, number];
	sheetSize?: [number, number];
}

/** Flatten sheet namespaces into the logical objects shown in the collection. */
export function softwareCatalogPreviews(
	assets: AssetManifestEntry[]
): SoftwareCatalogPreview[] {
	return assets.flatMap((asset) => {
		if (asset.type !== 'sprite-sheet') {
			return [
				{
					id: asset.id,
					label: asset.label ?? asset.name,
					path: asset.path,
					group: asset.group
				}
			];
		}
		return Object.entries(asset.sprites).map(([id, sprite]) => ({
			id,
			label:
				(!Array.isArray(sprite) && sprite.label) ||
				id.split('-').slice(1).join(' '),
			path: asset.path,
			group: id.split('-')[0],
			rect: spriteRect(sprite, asset.tileSize),
			sheetSize: asset.sheetSize
		}));
	});
}

function spriteRect(
	sprite: SpriteManifestDefinition,
	tileSize?: [number, number]
): [number, number, number, number] {
	if (!Array.isArray(sprite) && sprite.rect) return sprite.rect;
	const at = Array.isArray(sprite) ? sprite : sprite.at;
	if (!at || !tileSize)
		throw new Error('Sprite preview requires a rectangle or tile coordinates.');
	return [at[0] * tileSize[0], at[1] * tileSize[1], tileSize[0], tileSize[1]];
}
