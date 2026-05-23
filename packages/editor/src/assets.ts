import type {
	AssetCatalogEntry,
	ElementPlacement,
	SceneDocument
} from '@sebastianwessel/isostate/types';
import { withDocumentMutation } from './commands.ts';
import type {
	AssetManifestEntry,
	EditorAssetCatalog,
	EditorAssetProvider,
	EditorCommand,
	EditorCommandResult,
	EditorDiagnostic,
	EditorWorkspace
} from './types.ts';

export function validateAssetManifest(
	manifest: unknown
):
	| { valid: true; catalog: EditorAssetCatalog }
	| { valid: false; diagnostics: EditorDiagnostic[] } {
	const diagnostics: EditorDiagnostic[] = [];

	if (typeof manifest !== 'object' || manifest === null) {
		diagnostics.push({
			code: 'EDITOR_ASSET_MANIFEST_INVALID',
			message: 'Manifest must be an object',
			severity: 'error'
		});
		return { valid: false, diagnostics };
	}

	const m = manifest as Record<string, unknown>;

	if (m.format !== 'isostate.asset-manifest') {
		diagnostics.push({
			code: 'EDITOR_ASSET_MANIFEST_INVALID',
			message: `Manifest format must be "isostate.asset-manifest", got ${JSON.stringify(m.format)}`,
			severity: 'error'
		});
	}

	if (m.version !== 1) {
		diagnostics.push({
			code: 'EDITOR_ASSET_MANIFEST_INVALID',
			message: `Manifest version must be 1, got ${JSON.stringify(m.version)}`,
			severity: 'error'
		});
	}

	if (typeof m.assetBaseUrl !== 'string') {
		diagnostics.push({
			code: 'EDITOR_ASSET_MANIFEST_INVALID',
			message: 'Manifest assetBaseUrl must be a string',
			severity: 'error'
		});
	}

	if (!Array.isArray(m.assets)) {
		diagnostics.push({
			code: 'EDITOR_ASSET_MANIFEST_INVALID',
			message: 'Manifest assets must be an array',
			severity: 'error'
		});
	}

	if (diagnostics.length > 0) {
		return { valid: false, diagnostics };
	}

	const assets = m.assets as unknown[];
	for (let i = 0; i < assets.length; i++) {
		const entry = assets[i];
		if (typeof entry !== 'object' || entry === null) {
			diagnostics.push({
				code: 'EDITOR_ASSET_MANIFEST_INVALID',
				message: `Manifest assets[${i}] must be an object`,
				severity: 'error'
			});
			continue;
		}
		const e = entry as Record<string, unknown>;
		if (typeof e.id !== 'string') {
			diagnostics.push({
				code: 'EDITOR_ASSET_MANIFEST_INVALID',
				message: `Manifest assets[${i}].id must be a string`,
				severity: 'error'
			});
		}
		if (typeof e.path !== 'string') {
			diagnostics.push({
				code: 'EDITOR_ASSET_MANIFEST_INVALID',
				message: `Manifest assets[${i}].path must be a string`,
				severity: 'error'
			});
		}
		if (typeof e.group !== 'string') {
			diagnostics.push({
				code: 'EDITOR_ASSET_MANIFEST_INVALID',
				message: `Manifest assets[${i}].group must be a string`,
				severity: 'error'
			});
		}
		if (typeof e.name !== 'string') {
			diagnostics.push({
				code: 'EDITOR_ASSET_MANIFEST_INVALID',
				message: `Manifest assets[${i}].name must be a string`,
				severity: 'error'
			});
		}
		if (typeof e.digest !== 'string') {
			diagnostics.push({
				code: 'EDITOR_ASSET_MANIFEST_INVALID',
				message: `Manifest assets[${i}].digest must be a string`,
				severity: 'error'
			});
		}
	}

	if (diagnostics.length > 0) {
		return { valid: false, diagnostics };
	}

	return {
		valid: true,
		catalog: {
			assetBaseUrl: m.assetBaseUrl as string,
			assets: assets as AssetManifestEntry[]
		}
	};
}

export function createManifestAssetProvider(
	assetManifestUrl: string
): EditorAssetProvider {
	let cachedCatalog: EditorAssetCatalog | undefined;

	return {
		async listAssets() {
			const response = await fetch(assetManifestUrl);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch asset manifest: ${response.status} ${response.statusText}`
				);
			}
			const manifest = await response.json();
			const result = validateAssetManifest(manifest);
			if (!result.valid) {
				throw new Error(
					result.diagnostics[0]?.message ?? 'Invalid asset manifest'
				);
			}
			cachedCatalog = result.catalog;
			return result.catalog;
		},
		async resolveAssetPreview(asset) {
			const catalog = cachedCatalog ?? (await this.listAssets());
			const manifestHref =
				typeof document === 'undefined'
					? assetManifestUrl
					: new URL(assetManifestUrl, document.baseURI).href;
			const resolvedBase = new URL(catalog.assetBaseUrl, manifestHref).href;
			const baseUrl = resolvedBase.endsWith('/')
				? resolvedBase
				: `${resolvedBase}/`;
			const path =
				'path' in asset && typeof asset.path === 'string' ? asset.path : '';
			const url = new URL(path, baseUrl).href;
			return {
				url,
				width: 'width' in asset ? asset.width : undefined,
				height: 'height' in asset ? asset.height : undefined
			};
		}
	};
}

export function searchAssets(
	catalog: EditorAssetCatalog,
	query: string
): AssetManifestEntry[] {
	const q = query.toLowerCase();
	return catalog.assets.filter((asset) => {
		if (asset.id.toLowerCase().includes(q)) return true;
		if (asset.label?.toLowerCase().includes(q)) return true;
		if (asset.path.toLowerCase().includes(q)) return true;
		if (asset.tags?.some((t) => t.toLowerCase().includes(q))) return true;
		return false;
	});
}

export function filterAssetsByGroup(
	catalog: EditorAssetCatalog,
	group: string
): AssetManifestEntry[] {
	return catalog.assets.filter((asset) => asset.group === group);
}

export function filterAssetsByTag(
	catalog: EditorAssetCatalog,
	tag: string
): AssetManifestEntry[] {
	return catalog.assets.filter((asset) => asset.tags?.includes(tag));
}

function getDeclaredAssetIds(workspace: EditorWorkspace): string[] {
	return workspace.document?.header.assets.map((a) => a.id) ?? [];
}

function getUsedAssetIds(workspace: EditorWorkspace): string[] {
	const used = new Set<string>();
	if (!workspace.document) return [];
	for (const scene of workspace.document.scenes) {
		for (const element of scene.elements ?? []) {
			if (element.asset) used.add(element.asset);
		}
		for (const element of scene.add?.elements ?? []) {
			if (element.asset) used.add(element.asset);
		}
		for (const element of scene.update?.elements ?? []) {
			const asset = (element as { asset?: string }).asset;
			if (asset) used.add(asset);
		}
	}
	return Array.from(used);
}

export function getMissingAssets(
	workspace: EditorWorkspace,
	catalog: EditorAssetCatalog
): string[] {
	const catalogIds = new Set(catalog.assets.map((a) => a.id));
	return getDeclaredAssetIds(workspace).filter((id) => !catalogIds.has(id));
}

export function getUnusedAssets(
	workspace: EditorWorkspace,
	catalog: EditorAssetCatalog
): string[] {
	const declaredIds = new Set(getDeclaredAssetIds(workspace));
	const catalogIds = new Set(catalog.assets.map((a) => a.id));
	const usedIds = new Set(getUsedAssetIds(workspace));
	return Array.from(declaredIds).filter(
		(id) => catalogIds.has(id) && !usedIds.has(id)
	);
}

function collectAllElementIds(document: SceneDocument): Set<string> {
	const ids = new Set<string>();
	for (const scene of document.scenes) {
		for (const element of scene.elements ?? []) {
			ids.add(element.id);
		}
		for (const element of scene.add?.elements ?? []) {
			ids.add(element.id);
		}
		for (const element of scene.update?.elements ?? []) {
			ids.add(element.id);
		}
	}
	return ids;
}

function generateUniqueElementId(
	document: SceneDocument,
	baseId: string
): string {
	const existingIds = collectAllElementIds(document);
	let id = baseId;
	let counter = 1;
	while (existingIds.has(id)) {
		id = `${baseId}-${counter}`;
		counter++;
	}
	return id;
}

export function createAssetPlacementCommand(
	sceneId: string,
	manifestEntry: AssetManifestEntry,
	gridPoint: [number, number],
	assetBaseUrl: string
): EditorCommand {
	return {
		id: 'asset.place',
		label: 'Place Asset',
		apply(workspace): EditorCommandResult {
			return withDocumentMutation(
				workspace,
				'asset.place',
				'Place Asset',
				(doc) => {
					if (!doc.header.assetBaseUrl) {
						doc.header.assetBaseUrl = assetBaseUrl;
					}
					const existingAsset = doc.header.assets.find(
						(a) => a.id === manifestEntry.id
					);
					if (!existingAsset) {
						const newAsset: AssetCatalogEntry = {
							id: manifestEntry.id,
							path: manifestEntry.path
						};
						if (manifestEntry.anchor) {
							newAsset.anchor = manifestEntry.anchor;
						}
						doc.header.assets.push(newAsset);
					} else if (!existingAsset.anchor && manifestEntry.anchor) {
						existingAsset.anchor = manifestEntry.anchor;
					}
					const elementId = generateUniqueElementId(doc, manifestEntry.id);
					const element: ElementPlacement = {
						id: elementId,
						asset: manifestEntry.id,
						at: gridPoint,
						size: 1
					};
					const sceneIndex = doc.scenes.findIndex((s) => s.id === sceneId);
					if (sceneIndex === -1) throw new Error(`Scene ${sceneId} not found`);
					const scene = doc.scenes[sceneIndex];
					if (sceneIndex === 0) {
						scene.elements = scene.elements ?? [];
						scene.elements.push(element);
					} else {
						scene.add = scene.add ?? {};
						scene.add.elements = scene.add.elements ?? [];
						scene.add.elements.push(element);
					}
				}
			);
		}
	};
}
