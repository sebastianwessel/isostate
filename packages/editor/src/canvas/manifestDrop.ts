export function parseManifestDrop(dataTransfer: DataTransfer):
	| {
			entry: import('../types.ts').PlaceableAssetManifestEntry;
			assetBaseUrl: string;
	  }
	| undefined {
	const raw = dataTransfer.getData('application/x-isostate-manifest-asset');
	if (!raw) return undefined;
	try {
		const parsed = JSON.parse(raw) as {
			entry?: import('../types.ts').PlaceableAssetManifestEntry;
			assetBaseUrl?: string;
		};
		if (
			parsed.entry &&
			typeof parsed.entry.id === 'string' &&
			typeof parsed.entry.path === 'string' &&
			typeof parsed.assetBaseUrl === 'string'
		) {
			return { entry: parsed.entry, assetBaseUrl: parsed.assetBaseUrl };
		}
	} catch {
		return undefined;
	}
	return undefined;
}
