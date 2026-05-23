import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
	createAssetPlacementCommand,
	createManifestAssetProvider,
	filterAssetsByGroup,
	filterAssetsByTag,
	getMissingAssets,
	getUnusedAssets,
	searchAssets,
	validateAssetManifest
} from '../../packages/editor/src/assets.ts';
import { applyEditorCommand } from '../../packages/editor/src/commands.ts';
import type {
	AssetManifestEntry,
	EditorAssetCatalog
} from '../../packages/editor/src/types.ts';
import { createEditorWorkspace } from '../../packages/editor/src/workspace.ts';

const VALID_MANIFEST = {
	format: 'isostate.asset-manifest',
	version: 1,
	generatedAt: '2026-05-22T17:00:00.000Z',
	assetBaseUrl: './assets',
	assets: [
		{
			id: 'servers-api',
			path: 'servers/api.svg',
			group: 'servers',
			name: 'api',
			digest: 'sha256:abc'
		},
		{
			id: 'network-lb',
			path: 'network/lb.svg',
			group: 'network',
			name: 'lb',
			label: 'Load Balancer',
			tags: ['infra', 'net'],
			digest: 'sha256:def'
		}
	]
};

const catalog: EditorAssetCatalog = {
	assetBaseUrl: './assets',
	assets: VALID_MANIFEST.assets as AssetManifestEntry[]
};

describe('validateAssetManifest', () => {
	test('accepts valid manifest', () => {
		const result = validateAssetManifest(VALID_MANIFEST);
		expect(result.valid).toBe(true);
		if (result.valid) {
			expect(result.catalog.assetBaseUrl).toBe('./assets');
			expect(result.catalog.assets.length).toBe(2);
		}
	});

	test('rejects wrong format', () => {
		const result = validateAssetManifest({
			...VALID_MANIFEST,
			format: 'wrong'
		});
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.diagnostics.some((d) => d.message.includes('format'))).toBe(
				true
			);
		}
	});

	test('rejects wrong version', () => {
		const result = validateAssetManifest({
			...VALID_MANIFEST,
			version: 2
		});
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(
				result.diagnostics.some((d) => d.message.includes('version'))
			).toBe(true);
		}
	});

	test('rejects missing assetBaseUrl', () => {
		const result = validateAssetManifest({
			...VALID_MANIFEST,
			assetBaseUrl: undefined
		});
		expect(result.valid).toBe(false);
	});

	test('rejects missing assets array', () => {
		const result = validateAssetManifest({
			...VALID_MANIFEST,
			assets: undefined
		});
		expect(result.valid).toBe(false);
	});

	test('rejects asset entry with missing id', () => {
		const result = validateAssetManifest({
			...VALID_MANIFEST,
			assets: [
				{
					path: 'x.svg',
					group: 'g',
					name: 'x',
					digest: 'sha256:abc'
				}
			]
		});
		expect(result.valid).toBe(false);
	});

	test('rejects asset entry with missing path', () => {
		const result = validateAssetManifest({
			...VALID_MANIFEST,
			assets: [
				{
					id: 'x',
					group: 'g',
					name: 'x',
					digest: 'sha256:abc'
				}
			]
		});
		expect(result.valid).toBe(false);
	});

	test('rejects asset entry with missing group', () => {
		const result = validateAssetManifest({
			...VALID_MANIFEST,
			assets: [
				{
					id: 'x',
					path: 'x.svg',
					name: 'x',
					digest: 'sha256:abc'
				}
			]
		});
		expect(result.valid).toBe(false);
	});

	test('rejects asset entry with missing name', () => {
		const result = validateAssetManifest({
			...VALID_MANIFEST,
			assets: [
				{
					id: 'x',
					path: 'x.svg',
					group: 'g',
					digest: 'sha256:abc'
				}
			]
		});
		expect(result.valid).toBe(false);
	});

	test('rejects asset entry with missing digest', () => {
		const result = validateAssetManifest({
			...VALID_MANIFEST,
			assets: [
				{
					id: 'x',
					path: 'x.svg',
					group: 'g',
					name: 'x'
				}
			]
		});
		expect(result.valid).toBe(false);
	});
});

describe('createManifestAssetProvider', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		// no-op
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test('listAssets returns catalog on valid manifest', async () => {
		globalThis.fetch = mock(
			async () => new Response(JSON.stringify(VALID_MANIFEST), { status: 200 })
		);
		const provider = createManifestAssetProvider(
			'https://example.com/manifest.json'
		);
		const result = await provider.listAssets();
		expect(result.assetBaseUrl).toBe('./assets');
		expect(result.assets.length).toBe(2);
	});

	test('listAssets throws on invalid manifest', async () => {
		globalThis.fetch = mock(
			async () =>
				new Response(JSON.stringify({ format: 'wrong' }), { status: 200 })
		);
		const provider = createManifestAssetProvider(
			'https://example.com/manifest.json'
		);
		await expect(provider.listAssets()).rejects.toThrow();
	});

	test('listAssets throws on fetch error', async () => {
		globalThis.fetch = mock(async () => new Response('', { status: 404 }));
		const provider = createManifestAssetProvider(
			'https://example.com/manifest.json'
		);
		await expect(provider.listAssets()).rejects.toThrow();
	});

	test('resolveAssetPreview resolves relative path against manifest URL', async () => {
		globalThis.fetch = mock(
			async () => new Response(JSON.stringify(VALID_MANIFEST), { status: 200 })
		);
		const provider = createManifestAssetProvider(
			'https://example.com/manifest.json'
		);
		const preview = await provider.resolveAssetPreview(
			VALID_MANIFEST.assets[0] as AssetManifestEntry
		);
		expect(preview.url).toBe('https://example.com/assets/servers/api.svg');
	});

	test('resolveAssetPreview includes width and height when present', async () => {
		globalThis.fetch = mock(
			async () =>
				new Response(
					JSON.stringify({
						...VALID_MANIFEST,
						assets: [
							{
								...VALID_MANIFEST.assets[0],
								width: 64,
								height: 64
							}
						]
					}),
					{ status: 200 }
				)
		);
		const provider = createManifestAssetProvider(
			'https://example.com/manifest.json'
		);
		const preview = await provider.resolveAssetPreview({
			...(VALID_MANIFEST.assets[0] as AssetManifestEntry),
			width: 64,
			height: 64
		});
		expect(preview.width).toBe(64);
		expect(preview.height).toBe(64);
	});
});

describe('searchAssets', () => {
	test('searches by id', () => {
		const results = searchAssets(catalog, 'servers-api');
		expect(results.length).toBe(1);
		expect(results[0].id).toBe('servers-api');
	});

	test('searches by label', () => {
		const results = searchAssets(catalog, 'Load Balancer');
		expect(results.length).toBe(1);
		expect(results[0].id).toBe('network-lb');
	});

	test('searches by path', () => {
		const results = searchAssets(catalog, 'network/lb');
		expect(results.length).toBe(1);
		expect(results[0].id).toBe('network-lb');
	});

	test('searches by tag', () => {
		const results = searchAssets(catalog, 'infra');
		expect(results.length).toBe(1);
		expect(results[0].id).toBe('network-lb');
	});

	test('is case-insensitive', () => {
		const results = searchAssets(catalog, 'LOAD');
		expect(results.length).toBe(1);
		expect(results[0].id).toBe('network-lb');
	});

	test('returns empty for no match', () => {
		const results = searchAssets(catalog, 'nonexistent');
		expect(results.length).toBe(0);
	});
});

describe('filterAssetsByGroup', () => {
	test('filters by group', () => {
		const results = filterAssetsByGroup(catalog, 'servers');
		expect(results.length).toBe(1);
		expect(results[0].id).toBe('servers-api');
	});

	test('returns empty for unknown group', () => {
		const results = filterAssetsByGroup(catalog, 'unknown');
		expect(results.length).toBe(0);
	});
});

describe('filterAssetsByTag', () => {
	test('filters by tag', () => {
		const results = filterAssetsByTag(catalog, 'infra');
		expect(results.length).toBe(1);
		expect(results[0].id).toBe('network-lb');
	});

	test('returns empty for unknown tag', () => {
		const results = filterAssetsByTag(catalog, 'unknown');
		expect(results.length).toBe(0);
	});
});

describe('getMissingAssets', () => {
	test('returns declared assets not in manifest', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: `header:
  version: "1"
  assets:
    - id: server
      path: server.svg
    - id: missing-asset
      path: missing.svg
  layers:
    - name: default
scenes:
  - id: scene-1
`
		});
		const missing = getMissingAssets(workspace, catalog);
		expect(missing).toEqual(['server', 'missing-asset']);
	});

	test('returns empty when all declared assets are in manifest', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: `header:
  version: "1"
  assets:
    - id: servers-api
      path: servers/api.svg
  layers:
    - name: default
scenes:
  - id: scene-1
`
		});
		const missing = getMissingAssets(workspace, catalog);
		expect(missing).toEqual([]);
	});
});

describe('getUnusedAssets', () => {
	test('returns declared manifest assets not used by elements', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: `header:
  version: "1"
  assets:
    - id: servers-api
      path: servers/api.svg
    - id: network-lb
      path: network/lb.svg
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: servers-api
        at: [0, 0]
`
		});
		const unused = getUnusedAssets(workspace, catalog);
		expect(unused).toEqual(['network-lb']);
	});

	test('returns empty when all declared manifest assets are used', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: `header:
  version: "1"
  assets:
    - id: servers-api
      path: servers/api.svg
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: servers-api
        at: [0, 0]
`
		});
		const unused = getUnusedAssets(workspace, catalog);
		expect(unused).toEqual([]);
	});
});

describe('createAssetPlacementCommand', () => {
	test('sets assetBaseUrl, adds asset, and creates element', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
`
		});
		const entry = {
			id: 'new-asset',
			path: 'new/asset.svg',
			group: 'new',
			name: 'asset',
			digest: 'sha256:abc'
		};
		const command = createAssetPlacementCommand(
			'scene-1',
			entry,
			[3, 3],
			'https://example.com/assets'
		);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.header.assetBaseUrl).toBe(
			'https://example.com/assets'
		);
		expect(
			result.workspace.document?.header.assets.some((a) => a.id === 'new-asset')
		).toBe(true);
		const element = result.workspace.document?.scenes[0].elements?.find(
			(e) => e.asset === 'new-asset'
		);
		expect(element).toBeDefined();
		expect(element?.at).toEqual([3, 3]);
		expect(element?.size).toBe(1);
	});

	test('reuses existing asset declaration', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: `header:
  version: "1"
  assets:
    - id: new-asset
      path: new/asset.svg
  layers:
    - name: default
scenes:
  - id: scene-1
`
		});
		const entry = {
			id: 'new-asset',
			path: 'new/asset.svg',
			group: 'new',
			name: 'asset',
			digest: 'sha256:abc'
		};
		const command = createAssetPlacementCommand(
			'scene-1',
			entry,
			[3, 3],
			'https://example.com/assets'
		);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.header.assets.filter(
				(a) => a.id === 'new-asset'
			).length
		).toBe(1);
	});

	test('copies anchor when present', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
`
		});
		const entry = {
			id: 'anchored-asset',
			path: 'anchored.svg',
			group: 'g',
			name: 'anchored',
			anchor: [0.5, 0.92] as [number, number],
			digest: 'sha256:abc'
		};
		const command = createAssetPlacementCommand(
			'scene-1',
			entry,
			[1, 1],
			'https://example.com/assets'
		);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		const asset = result.workspace.document?.header.assets.find(
			(a) => a.id === 'anchored-asset'
		);
		expect(asset?.anchor).toEqual([0.5, 0.92]);
	});

	test('fills missing anchor on existing manifest asset declaration', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: `header:
  version: "1"
  assetBaseUrl: https://example.com/assets
  assets:
    - id: new-asset
      path: new/asset.svg
  layers:
    - name: default
scenes:
  - id: scene-1
`
		});
		const entry = {
			id: 'new-asset',
			path: 'new/asset.svg',
			group: 'new',
			name: 'asset',
			anchor: [0.5, 0.75] as [number, number],
			digest: 'sha256:abc'
		};
		const command = createAssetPlacementCommand(
			'scene-1',
			entry,
			[1, 1],
			'https://example.com/assets'
		);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		const asset = result.workspace.document?.header.assets.find(
			(a) => a.id === 'new-asset'
		);
		expect(asset?.anchor).toEqual([0.5, 0.75]);
	});

	test('creates element in add.elements for later scenes', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: `header:
  version: "1"
  assets:
    - id: existing
      path: existing.svg
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: existing
        at: [0, 0]
  - id: scene-2
`
		});
		const entry = {
			id: 'new-asset',
			path: 'new/asset.svg',
			group: 'new',
			name: 'asset',
			digest: 'sha256:abc'
		};
		const command = createAssetPlacementCommand(
			'scene-2',
			entry,
			[2, 2],
			'https://example.com/assets'
		);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[1].add?.elements?.some(
				(e) => e.asset === 'new-asset'
			)
		).toBe(true);
	});
});
