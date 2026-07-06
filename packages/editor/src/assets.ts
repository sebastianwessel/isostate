import type {
	AssetCatalogEntry,
	ElementPlacement,
	SceneDocument
} from '@sebastianwessel/isostate/types';
import {
	ensureFloorContainsElement,
	withDocumentMutation
} from './commands.ts';
import type {
	AssetManifestEntry,
	EditorAssetCatalog,
	EditorAssetProvider,
	EditorCommand,
	EditorCommandResult,
	EditorDiagnostic,
	EditorWorkspace,
	PlaceableAssetManifestEntry,
	SpriteAssetManifestEntry,
	SpriteManifestDefinition,
	SpriteSheetAssetManifestEntry
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
		if (e.type !== undefined && e.type !== 'sprite-sheet' && e.type !== 'url') {
			diagnostics.push({
				code: 'EDITOR_ASSET_MANIFEST_INVALID',
				message: `Manifest assets[${i}].type must be "url" or "sprite-sheet"`,
				severity: 'error'
			});
		}
		if (e.type === 'sprite-sheet') {
			if (!isTuple2(e.sheetSize)) {
				diagnostics.push({
					code: 'EDITOR_ASSET_MANIFEST_INVALID',
					message: `Manifest assets[${i}].sheetSize must be a number tuple`,
					severity: 'error'
				});
			}
			if (e.tileSize !== undefined && !isTuple2(e.tileSize)) {
				diagnostics.push({
					code: 'EDITOR_ASSET_MANIFEST_INVALID',
					message: `Manifest assets[${i}].tileSize must be a number tuple`,
					severity: 'error'
				});
			}
			if (
				!e.sprites ||
				typeof e.sprites !== 'object' ||
				Array.isArray(e.sprites)
			) {
				diagnostics.push({
					code: 'EDITOR_ASSET_MANIFEST_INVALID',
					message: `Manifest assets[${i}].sprites must be an object`,
					severity: 'error'
				});
			}
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
): PlaceableAssetManifestEntry[] {
	const q = query.toLowerCase();
	return getPlaceableManifestAssets(catalog).filter((asset) => {
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
): PlaceableAssetManifestEntry[] {
	return getPlaceableManifestAssets(catalog).filter(
		(asset) => asset.group === group
	);
}

export function filterAssetsByTag(
	catalog: EditorAssetCatalog,
	tag: string
): PlaceableAssetManifestEntry[] {
	return getPlaceableManifestAssets(catalog).filter((asset) =>
		asset.tags?.includes(tag)
	);
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
	return Array.from(declaredIds).filter((id) => {
		if (!catalogIds.has(id)) return false;
		if (usedIds.has(id)) return false;
		const entry = catalog.assets.find((asset) => asset.id === id);
		if (entry?.type !== 'sprite-sheet') return true;
		return !Object.keys(entry.sprites).some((spriteId) =>
			usedIds.has(spriteId)
		);
	});
}

export function getPlaceableManifestAssets(
	catalog: EditorAssetCatalog
): PlaceableAssetManifestEntry[] {
	const result: PlaceableAssetManifestEntry[] = [];
	for (const asset of catalog.assets) {
		if (asset.type !== 'sprite-sheet') {
			result.push(asset);
			continue;
		}
		for (const [spriteId, sprite] of Object.entries(asset.sprites)) {
			result.push(createSpriteManifestEntry(asset, spriteId, sprite));
		}
	}
	return result;
}

function createSpriteManifestEntry(
	sheet: SpriteSheetAssetManifestEntry,
	spriteId: string,
	sprite: SpriteAssetManifestEntry['sprite']
): SpriteAssetManifestEntry {
	const label =
		!Array.isArray(sprite) && 'label' in sprite ? sprite.label : undefined;
	const tags =
		!Array.isArray(sprite) && 'tags' in sprite ? sprite.tags : sheet.tags;
	const anchor =
		!Array.isArray(sprite) && 'anchor' in sprite ? sprite.anchor : sheet.anchor;
	return {
		id: spriteId,
		type: 'sprite',
		path: sheet.path,
		group: sheet.group,
		name: spriteId,
		label,
		anchor,
		tags,
		digest: sheet.digest,
		sheetId: sheet.id,
		sheetSize: sheet.sheetSize,
		tileSize: sheet.tileSize,
		sheetAnchor: sheet.anchor,
		sprites: sheet.sprites,
		sprite
	};
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

const REBASE_URL_ORIGIN = 'https://isostate-editor.local';

function directoryUrl(baseUrl: string): URL {
	const href = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
	return new URL(href, REBASE_URL_ORIGIN);
}

function serializedBaseUrl(url: URL): string {
	const path = url.pathname.replace(/\/+$/, '');
	if (url.origin === REBASE_URL_ORIGIN) return path || '/';
	return `${url.origin}${path}`;
}

function commonDirectoryUrl(a: URL, b: URL): URL | undefined {
	if (a.origin !== b.origin) return undefined;
	const aParts = a.pathname.split('/').filter(Boolean);
	const bParts = b.pathname.split('/').filter(Boolean);
	const common: string[] = [];
	for (let index = 0; index < Math.min(aParts.length, bParts.length); index++) {
		if (aParts[index] !== bParts[index]) break;
		common.push(aParts[index]);
	}
	const pathname = common.length > 0 ? `/${common.join('/')}/` : '/';
	return new URL(pathname, a.origin);
}

function relativeAssetPath(
	assetBaseUrl: string,
	assetPath: string,
	targetBaseUrl: URL
): string | undefined {
	const assetUrl = new URL(assetPath, directoryUrl(assetBaseUrl));
	if (assetUrl.origin !== targetBaseUrl.origin) return undefined;
	if (!assetUrl.pathname.startsWith(targetBaseUrl.pathname)) return undefined;
	return assetUrl.pathname.slice(targetBaseUrl.pathname.length);
}

function withAssetPath<T extends PlaceableAssetManifestEntry>(
	entry: T,
	path: string
): T {
	return { ...entry, path };
}

function normalizePlacementAssetRoots(
	document: SceneDocument,
	manifestEntry: PlaceableAssetManifestEntry,
	assetBaseUrl: string
): PlaceableAssetManifestEntry {
	const currentBaseUrl = document.header.assetBaseUrl;
	if (!currentBaseUrl) {
		document.header.assetBaseUrl = assetBaseUrl;
		return manifestEntry;
	}
	const currentAssetBaseUrl = currentBaseUrl;

	const current = directoryUrl(currentAssetBaseUrl);
	const incoming = directoryUrl(assetBaseUrl);
	if (current.href === incoming.href) return manifestEntry;

	const common = commonDirectoryUrl(current, incoming);
	if (!common) return manifestEntry;
	const incomingPath = relativeAssetPath(
		assetBaseUrl,
		manifestEntry.path,
		common
	);
	if (!incomingPath || incomingPath.startsWith('../')) return manifestEntry;

	for (const asset of document.header.assets) {
		const rebasedPath = relativeAssetPath(
			currentAssetBaseUrl,
			asset.path ?? asset.id,
			common
		);
		if (!rebasedPath || rebasedPath.startsWith('../')) return manifestEntry;
		asset.path = rebasedPath;
	}

	document.header.assetBaseUrl = serializedBaseUrl(common);
	return withAssetPath(manifestEntry, incomingPath);
}

export function createAssetPlacementCommand(
	sceneId: string,
	manifestEntry: PlaceableAssetManifestEntry,
	gridPoint: [number, number],
	assetBaseUrl: string
): EditorCommand {
	return {
		id: 'asset.place',
		label: 'Place Asset',
		apply(workspace): EditorCommandResult {
			if (workspace.document) {
				const conflict = findSpriteSheetConflict(
					workspace.document,
					manifestEntry
				);
				if (conflict) {
					return {
						workspace,
						changed: false,
						diagnostics: [
							{
								code: 'EDITOR_ASSET_CONFLICT',
								message: conflict,
								severity: 'error'
							}
						]
					};
				}
			}
			return withDocumentMutation(
				workspace,
				'asset.place',
				'Place Asset',
				(doc) => {
					const normalizedEntry = normalizePlacementAssetRoots(
						doc,
						manifestEntry,
						assetBaseUrl
					);
					const assetId =
						normalizedEntry.type === 'sprite'
							? normalizedEntry.sheetId
							: normalizedEntry.id;
					const existingAsset = doc.header.assets.find((a) => a.id === assetId);
					if (!existingAsset) {
						const newAsset = createAssetDeclaration(normalizedEntry);
						doc.header.assets.push(newAsset);
					} else if (normalizedEntry.type === 'sprite') {
						mergeSpriteIntoSheetDeclaration(existingAsset, normalizedEntry);
					} else if (!existingAsset.anchor && normalizedEntry.anchor) {
						existingAsset.anchor = normalizedEntry.anchor;
					}
					const elementId = generateUniqueElementId(doc, normalizedEntry.id);
					const element: ElementPlacement = {
						id: elementId,
						asset: normalizedEntry.id,
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
					ensureFloorContainsElement(doc, element);
				}
			);
		}
	};
}

function tupleEquals(
	a: [number, number] | undefined,
	b: [number, number] | undefined
): boolean {
	if (a === undefined || b === undefined) return a === b;
	return a[0] === b[0] && a[1] === b[1];
}

function spriteDefinitionEquals(
	a: SpriteManifestDefinition | undefined,
	b: SpriteManifestDefinition | undefined
): boolean {
	if (a === undefined || b === undefined) return a === b;
	if (Array.isArray(a) || Array.isArray(b)) {
		return (
			Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1]
		);
	}
	return (
		tupleEquals(a.at, b.at) &&
		tupleEquals(a.anchor, b.anchor) &&
		JSON.stringify(a.rect ?? null) === JSON.stringify(b.rect ?? null)
	);
}

/**
 * Checks whether placing `manifestEntry` would require merging into an
 * already-declared `header.assets[]` sprite-sheet entry whose metadata
 * conflicts with the manifest. Returns a human-readable conflict message, or
 * `undefined` when there is no existing declaration or it is compatible.
 */
function findSpriteSheetConflict(
	document: SceneDocument,
	manifestEntry: PlaceableAssetManifestEntry
): string | undefined {
	if (manifestEntry.type !== 'sprite') return undefined;
	const existingAsset = document.header.assets.find(
		(a) => a.id === manifestEntry.sheetId
	);
	if (!existingAsset) return undefined;
	if (!('type' in existingAsset) || existingAsset.type !== 'sprite-sheet') {
		return `Asset "${manifestEntry.sheetId}" is already declared as a non-sprite-sheet asset`;
	}
	if (existingAsset.path !== manifestEntry.path) {
		return `Sprite sheet "${manifestEntry.sheetId}" path differs from the manifest`;
	}
	if (!tupleEquals(existingAsset.sheetSize, manifestEntry.sheetSize)) {
		return `Sprite sheet "${manifestEntry.sheetId}" sheetSize differs from the manifest`;
	}
	if (!tupleEquals(existingAsset.tileSize, manifestEntry.tileSize)) {
		return `Sprite sheet "${manifestEntry.sheetId}" tileSize differs from the manifest`;
	}
	if (!tupleEquals(existingAsset.anchor, manifestEntry.sheetAnchor)) {
		return `Sprite sheet "${manifestEntry.sheetId}" anchor differs from the manifest`;
	}
	const existingSprite = existingAsset.sprites[manifestEntry.id];
	if (
		existingSprite !== undefined &&
		!spriteDefinitionEquals(existingSprite, manifestEntry.sprite)
	) {
		return `Sprite "${manifestEntry.id}" definition differs from the manifest`;
	}
	return undefined;
}

/**
 * Merges the placed sprite id into an already-declared, compatible
 * sprite-sheet's `sprites` map (adding it when absent). Callers must verify
 * with `findSpriteSheetConflict` first that no metadata conflict exists.
 */
function mergeSpriteIntoSheetDeclaration(
	existingAsset: AssetCatalogEntry,
	normalizedEntry: SpriteAssetManifestEntry
): void {
	if (!('type' in existingAsset) || existingAsset.type !== 'sprite-sheet')
		return;
	if (existingAsset.sprites[normalizedEntry.id] !== undefined) return;
	const sanitized = sanitizeSpriteDefinitions({
		[normalizedEntry.id]: normalizedEntry.sprite
	});
	existingAsset.sprites[normalizedEntry.id] = sanitized[normalizedEntry.id];
}

function createAssetDeclaration(
	manifestEntry: PlaceableAssetManifestEntry
): AssetCatalogEntry {
	if (manifestEntry.type !== 'sprite') {
		const asset: AssetCatalogEntry = {
			id: manifestEntry.id,
			path: manifestEntry.path
		};
		if (manifestEntry.anchor) asset.anchor = manifestEntry.anchor;
		return asset;
	}

	const asset: AssetCatalogEntry = {
		id: manifestEntry.sheetId,
		type: 'sprite-sheet',
		path: manifestEntry.path,
		sheetSize: manifestEntry.sheetSize,
		sprites: sanitizeSpriteDefinitions(manifestEntry.sprites)
	};
	if (manifestEntry.tileSize) asset.tileSize = manifestEntry.tileSize;
	if (manifestEntry.sheetAnchor) asset.anchor = manifestEntry.sheetAnchor;
	return asset;
}

function sanitizeSpriteDefinitions(
	sprites: SpriteAssetManifestEntry['sprites']
): Extract<AssetCatalogEntry, { type: 'sprite-sheet' }>['sprites'] {
	const result: Extract<
		AssetCatalogEntry,
		{ type: 'sprite-sheet' }
	>['sprites'] = {};
	for (const [id, sprite] of Object.entries(sprites)) {
		if (Array.isArray(sprite)) {
			result[id] = sprite;
			continue;
		}
		const sanitized: Exclude<(typeof result)[string], [number, number]> = {};
		if (sprite.at) sanitized.at = sprite.at;
		if (sprite.rect) sanitized.rect = sprite.rect;
		if (sprite.anchor) sanitized.anchor = sprite.anchor;
		result[id] = sanitized;
	}
	return result;
}

function isTuple2(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		value.every((v) => typeof v === 'number' && Number.isFinite(v))
	);
}
